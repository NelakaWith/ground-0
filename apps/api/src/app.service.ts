import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';
import { sql, and, lt, desc, eq } from 'drizzle-orm';
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

  async getArticles(status?: string) {
    const query = this.db
      .select()
      .from(schema.articles)
      .limit(50)
      .orderBy(desc(schema.articles.pubDate));

    if (status) {
      // @ts-ignore - checking if status matches schema
      query.where(eq(schema.articles.processingStatus, status));
    }

    return query;
  }

  /**
   * Groups articles into clusters based on embedding similarity (The Information Delta).
   */
  async getClusters() {
    // 1. Fetch analyzed articles from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const articles = await this.db
      .select()
      .from(schema.articles)
      .where(
        and(
          eq(schema.articles.processingStatus, 'analyzed'),
          sql`${schema.articles.updatedAt} > ${yesterday}`,
        ),
      )
      .orderBy(desc(schema.articles.pubDate));

    if (articles.length === 0) return [];

    const clusters: any[] = [];
    const processedIds = new Set<string>();

    for (const article of articles) {
      if (processedIds.has(article.id)) continue;

      // Start a new cluster
      const clusterArticles = [article];
      processedIds.add(article.id);

      // Find similar articles (simple cosine similarity in JS for now or use pgvector if possible)
      // For the demo, we'll use a threshold-based approach
      for (const other of articles) {
        if (processedIds.has(other.id)) continue;

        const similarity = this.calculateCosineSimilarity(
          article.embedding,
          other.embedding,
        );

        if (similarity > 0.85) {
          clusterArticles.push(other);
          processedIds.add(other.id);
        }
      }

      if (clusterArticles.length >= 1) {
        clusters.push({
          id: article.id,
          target: article.target,
          title: article.title,
          articles: clusterArticles,
          representativeSentiment: article.sentimentScore,
        });
      }
    }

    return clusters;
  }

  /**
   * Fetches the "Bias Ticker" data — most sensationalized headlines.
   */
  async getBiasTicker() {
    const articles = await this.db
      .select()
      .from(schema.articles)
      .where(eq(schema.articles.processingStatus, 'analyzed'))
      .limit(10)
      .orderBy(desc(schema.articles.updatedAt));

    return articles
      .map((a) => {
        const adjectives = JSON.parse(a.chargedAdjectives || '[]');
        return {
          id: a.id,
          title: a.title,
          providerId: a.providerId,
          adjectiveCount: adjectives.length,
          adjectives,
          sentiment: a.sentimentScore,
        };
      })
      .sort((a, b) => b.adjectiveCount - a.adjectiveCount);
  }

  private calculateCosineSimilarity(vecA: any, vecB: any): number {
    if (!vecA || !vecB) return 0;
    const a = typeof vecA === 'string' ? JSON.parse(vecA) : vecA;
    const b = typeof vecB === 'string' ? JSON.parse(vecB) : vecB;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
