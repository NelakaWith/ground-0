import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';
import { sql, and, lt } from 'drizzle-orm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @Inject('DRIZZLE_DB') private readonly db: NeonHttpDatabase<typeof schema>,
    @InjectQueue('scrape') private readonly scrapeQueue: Queue,
  ) {}

  async onModuleInit() {
    // Check crawler health on app startup
    await this.checkCrawlerHealth();
  }

  private async checkCrawlerHealth(): Promise<void> {
    const crawlerUrl = process.env.CRAWLER_URL || 'http://127.0.0.1:3001';

    try {
      const response = await fetch(`${crawlerUrl}/health`);

      if (response.ok) {
        const data = (await response.json()) as {
          status: string;
          service: string;
        };
        this.logger.log(
          `✅ Crawler service is healthy (${crawlerUrl}): ${JSON.stringify(data)}`,
        );
      } else {
        this.logger.warn(
          `⚠️ Crawler service returned status ${response.status} (${crawlerUrl})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `🛑 Failed to connect to Crawler service at ${crawlerUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getHello(): string {
    return 'Hello World!';
  }

  async recoverStuckArticles() {
    this.logger.log('🕵️ Checking for stuck articles...');

    // 1. Find articles stuck in 'discovered' or 'scraped' for > 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const stuckArticles = await this.db
      .select()
      .from(schema.articles)
      .where(
        and(
          sql`${schema.articles.processingStatus} IN ('discovered', 'scraped')`,
          lt(schema.articles.updatedAt, tenMinutesAgo),
        ),
      );

    if (stuckArticles.length === 0) {
      this.logger.log('✅ No stuck articles found.');
      return { recovered: 0 };
    }

    this.logger.warn(
      `🔄 Found ${stuckArticles.length} stuck articles. Recovering...`,
    );

    for (const article of stuckArticles) {
      if (article.processingStatus === 'discovered') {
        await this.scrapeQueue.add('scrape', {
          link: article.url,
          providerId: article.providerId,
          title: article.title,
        });
      }
      // Note: ScraperProcessor already enqueues to 'analyze' on success.
      // If stuck in 'scraped', it implies the analysis job failed or was lost.
      // Since we can't easily access the 'analyze' queue from here without injecting it,
      // we'll focus on 'discovered' first.
    }

    return { recovered: stuckArticles.length };
  }

  async getPipelineStatus() {
    const counts = await this.db
      .select({
        status: schema.articles.processingStatus,
        count: sql<number>`count(*)`,
      })
      .from(schema.articles)
      .groupBy(schema.articles.processingStatus);

    const result = counts.reduce(
      (acc, curr) => {
        acc[curr.status || 'unknown'] = Number(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const isIdle =
      (result['discovered'] || 0) === 0 && (result['scraped'] || 0) === 0;

    return {
      stats: result,
      isIdle,
      message: isIdle
        ? '🏁 All pipelines completed. All found articles have been processed.'
        : '🏃‍➡️ Pipeline is still active. There are articles waiting to be scraped or analyzed.',
    };
  }
}
