import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type ParserType from 'rss-parser';
import * as ParserNS from 'rss-parser';
import { eq } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
import providers from '../feed/providers';
import type { Queue } from 'bullmq';

import { diceCoefficient } from '../utils/similarity.util';

/**
 * NewsDiscoveryService handles the initial polling of RSS feeds.
 * It identifies new articles, performs a fuzzy de-duplication,
 * and enqueues valid items for the scraping phase.
 */
@Injectable()
export class NewsDiscoveryService implements OnModuleInit {
  /**
   * RSS Parser instance.
   * Provides normalization for different RSS/Atom formats.
   */
  private readonly parser: ParserType;
  /** Logger instance for discovery-related events. */
  private readonly logger = new Logger(NewsDiscoveryService.name);

  /**
   * In-memory cache for headline de-duplication (Phase 1 logic).
   * In production, this would be a DB query with pgvector or fuzzy search
   * to check across larger historical sets.
   */
  private processedHeadlines: Set<string> = new Set();

  /**
   * @param scrapeQueue - Injected BullMQ 'scrape' Queue.
   * Used for enqueuing discovered URLs into the second phase (Scraping).
   * @param db - Injected Neon Drizzle DB instance.
   */
  constructor(
    @Inject('SCRAPE_QUEUE') private readonly scrapeQueue: Queue,
    @Inject('DRIZZLE_DB') private readonly db: NeonHttpDatabase<typeof schema>,
  ) {
    // Correct CommonJS/ESM interop instantiator for rss-parser.
    this.parser = new (ParserNS as unknown as { new (): ParserType })();
  }

  /**
   * Sync providers from the local config to the Neon DB on startup.
   * Ensures that the 'providers' table is always populated with current feeds.
   */
  async onModuleInit() {
    this.logger.log('Syncing providers to database...');
    try {
      for (const p of providers) {
        await this.db
          .insert(schema.providers)
          .values({
            id: p.id,
            name: p.name,
            discoveryType: p.discoveryType,
            rssUrl: p.discoveryType === 'rss' ? p.url : null,
            homepageUrl: p.discoveryType === 'homepage' ? p.url : null,
          })
          .onConflictDoUpdate({
            target: schema.providers.id,
            set: {
              name: p.name,
              discoveryType: p.discoveryType,
              rssUrl: p.discoveryType === 'rss' ? p.url : null,
              homepageUrl: p.discoveryType === 'homepage' ? p.url : null,
            },
          });
      }
      this.logger.log(`Synced ${providers.length} providers.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to sync providers: ${msg}`);
    }
  }

  /**
   * handleCron: Runs every 6 hours.
   * Discovers and enqueues new headlines for the scraping worker.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCron() {
    this.logger.log('Running scheduled discovery');
    const providers = await this.db
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.isActive, true));

    for (const p of providers) {
      if (p.discoveryType === 'rss') {
        if (!p.rssUrl) {
          this.logger.warn(
            `Provider ${p.id} configured as RSS but missing URL`,
          );
          continue;
        }
        await this.processRssProvider(p);
      } else if (p.discoveryType === 'homepage') {
        if (!p.homepageUrl) {
          this.logger.warn(
            `Provider ${p.id} configured as Homepage but missing URL`,
          );
          continue;
        }
        this.logger.log(`Homepage discovery not yet implemented for ${p.id}`);
        // TODO: Delegate to ScraperService / Crawl4AI
      }
    }
  }

  private async processRssProvider(p: {
    id: string;
    name: string;
    rssUrl: string | null;
  }) {
    try {
      const feed = (await this.tryParseFeed(p.rssUrl!)) as ParserType.Output<{
        [key: string]: any;
      }>;
      const count = (feed.items && feed.items.length) || 0;
      this.logger.log(`Fetched ${p.name} — ${count} items`);

      const itemsToProcess = feed.items || [];

      for (const item of itemsToProcess) {
        if (!item.link || !item.title) continue;

        // --- Step 1: Near-Duplicate Detection (Fuzzy) ---
        const isDuplicate = this.checkNearDuplicate(item.title);
        if (isDuplicate) {
          this.logger.debug(`Skipping fuzzy duplicate: ${item.title}`);
          continue;
        }

        // --- Step 2: DB-based Duplicate Detection (Exact URL) ---
        const existing = await this.db
          .select()
          .from(schema.articles)
          .where(eq(schema.articles.url, item.link))
          .limit(1);

        if (existing.length > 0) {
          this.logger.debug(`URL already in DB: ${item.link}`);
          continue;
        }

        // --- Step 3: Save Discovery Metadata to DB ---
        await this.db.insert(schema.articles).values({
          url: item.link,
          title: item.title,
          providerId: p.id,
          pubDate: item.pubDate,
        });

        // --- Step 4: Enqueue for Scraping ---
        const jobId = Buffer.from(String(item.link)).toString('base64');
        try {
          await this.scrapeQueue.add(
            'scrape',
            {
              providerId: p.id,
              link: item.link,
              title: item.title,
              pubDate: item.pubDate,
            },
            {
              jobId,
              removeOnComplete: true,
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
            },
          );
          this.logger.debug(`Enqueued ${item.link}`);
          this.processedHeadlines.add(item.title);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to enqueue ${item.link}: ${msg}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to fetch ${p.rssUrl}: ${msg}`);
    }
  }

  /**
   * Try to parse a feed, retrying with browser headers if 403 is encountered.
   * @param url - The RSS feed URL to parse.
   * @returns The parsed feed object.
   * @throws Error if parsing fails after retries.
   */
  private async tryParseFeed(url: string): Promise<any> {
    try {
      return await (this.parser.parseURL(url) as any);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('403')) {
        this.logger.warn(`403 for ${url}, retrying with browser headers`);
        // Create a new parser with browser headers
        const browserParser = new (ParserNS as unknown as {
          new (opts?: any): ParserType;
        })({
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept:
              'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
          },
        });
        return await browserParser.parseURL(url);
      }
      throw err;
    }
  }

  /**
   * Simple "Near-Duplicate Detection" for Phase 1.
   * Compares the current title against previously processed titles in the same session.
   * @param title - The headline to check.
   * @returns True if a near-duplicate is found, false otherwise.
   */
  private checkNearDuplicate(title: string): boolean {
    if (this.processedHeadlines.size === 0) return false;

    // Iterate through in-memory cache and calculate similarity.
    // Threshold of 0.85 (85% similarity) to flag as duplicate.
    for (const cached of this.processedHeadlines) {
      if (diceCoefficient(title, cached) > 0.85) {
        return true;
      }
    }

    return false;
  }
}
