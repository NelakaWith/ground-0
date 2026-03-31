import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type ParserType from 'rss-parser';
import * as ParserNS from 'rss-parser';
import providers from '../feed/providers';
import type { Queue } from 'bullmq';

@Injectable()
export class NewsDiscoveryService {
  private readonly parser: InstanceType<typeof ParserNS>;
  private readonly logger = new Logger(NewsDiscoveryService.name);

  constructor(@Inject('SCRAPE_QUEUE') private readonly scrapeQueue: Queue) {
    // Use the correct constructor signature for rss-parser
    // ParserNS is the module namespace, so ParserNS.default or just ParserNS
    // but in CJS, the constructor is the module itself
    this.parser = new (ParserNS as unknown as { new (): ParserType })();
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    this.logger.log('Running scheduled discovery');
    for (const p of providers) {
      try {
        const feed = await this.tryParseFeed(p.rss_url);
        const count = (feed.items && feed.items.length) || 0;
        this.logger.log(`Fetched ${p.name} — ${count} items`);

        for (const item of feed.items || []) {
          if (!item.link) continue;
          const jobId = Buffer.from(String(item.link)).toString('base64');
          try {
            await this.scrapeQueue.add(
              'scrape-article',
              {
                providerId: p.id,
                link: item.link,
                title: item.title,
                pubDate: item.pubDate,
              },
              {
                jobId,
                removeOnComplete: true,
                attempts: 2,
                backoff: { type: 'exponential', delay: 1000 },
              },
            );
            this.logger.debug(`Enqueued ${item.link}`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Failed to enqueue ${item.link}: ${msg}`);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to fetch ${p.rss_url}: ${msg}`);
      }
    }
  }

  /**
   * Try to parse a feed, retrying with browser headers if 403 is encountered.
   */
  private async tryParseFeed(
    url: string,
  ): Promise<Awaited<ReturnType<InstanceType<typeof ParserNS>['parseURL']>>> {
    try {
      return await this.parser.parseURL(url);
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
}
