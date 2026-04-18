import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectQueue,
} from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue, DelayedError } from 'bullmq';
import { AnalysisService, GroqRateLimitError } from './analysis.service';
import { eq, and, lt } from 'drizzle-orm';
import { articles } from '../db/schema';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

@Processor('analyze', {
  limiter: { max: 1, duration: 60_000 }, // 1 job/min → 2 Groq calls/min, stays well under token limits
})
export class AnalysisProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    private readonly analysisService: AnalysisService,
    @Inject('DRIZZLE_DB') private readonly db: NeonHttpDatabase<typeof schema>,
    @InjectQueue('analyze') private readonly analyzeQueue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    // Only recover jobs that are in 'scraped' status AND haven't been updated in 30 minutes.
    // This prevents re-enqueuing active jobs on every dev server restart.
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const pending = await this.db
      .select({ id: articles.id })
      .from(articles)
      .where(
        and(
          eq(articles.processingStatus, 'scraped'),
          lt(articles.updatedAt, thirtyMinutesAgo),
        ),
      );

    if (pending.length === 0) return;

    this.logger.log(
      `Re-queuing ${pending.length} article(s) pending analysis...`,
    );
    for (const { id } of pending) {
      await this.analyzeQueue
        .add(
          'analyze',
          { articleId: id },
          { jobId: `requeue-${id}`, removeOnComplete: true },
        )
        .catch(() => {}); // ignore duplicate jobId errors
    }
  }

  async process(job: Job<{ articleId: string }>, token?: string): Promise<any> {
    const { articleId } = job.data;
    this.logger.log(`🧬 Starting Analysis for article: ${articleId}`);

    try {
      // 1. Fetch Article from DB
      const result = await this.db
        .select()
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);

      if (result.length === 0) {
        throw new Error(`Article not found: ${articleId}`);
      }

      const article = result[0];
      const textToAnalyze = article.fullText || article.content;
      const isFullText = !!article.fullText;

      if (!textToAnalyze || textToAnalyze.length < 50) {
        this.logger.warn(
          `Article content too short or null for analysis: ${articleId}`,
        );
        await this.db
          .update(articles)
          .set({
            processingStatus: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(articles.id, articleId));
        return { success: false, reason: 'insufficient_content' };
      }

      // 2. Pass 1: Entity & Target Detection
      const pass1 = await this.analysisService.detectEntitiesAndTarget(
        textToAnalyze,
        isFullText,
      );

      // 3. Pass 2: Sentiment & Adjective Extraction relative to Target
      const pass2 = await this.analysisService.extractSentimentAndFraming(
        textToAnalyze,
        pass1.target,
        isFullText,
      );

      // 4. Pass 3: Embedding Generation for Clustering
      const embedding = await this.analysisService.generateEmbedding(
        textToAnalyze,
      );

      // 5. Update Database
      await this.db
        .update(articles)
        .set({
          target: pass1.target,
          entities: JSON.stringify(pass1.entities),
          biasScore: pass2.sentimentScore, // Sync to legacy column
          sentiment: pass2.summary, // Sync to legacy column
          sentimentScore: pass2.sentimentScore,
          chargedAdjectives: JSON.stringify(pass2.chargedAdjectives),
          summary: pass2.summary,
          embedding: embedding,
          processingStatus: 'analyzed',
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      this.logger.log(
        `✅ Successfully analyzed article ${articleId} (Target: ${pass1.target}, FullText: ${isFullText})`,
      );

      return {
        success: true,
        target: pass1.target,
        sentiment: pass2.sentimentScore,
      };
    } catch (error) {
      if (error instanceof GroqRateLimitError) {
        this.logger.warn(
          `⏳ Rate limited for ${articleId}. Rescheduling in ${Math.ceil(error.retryAfterMs / 1000)}s.`,
        );
        await job.moveToDelayed(Date.now() + error.retryAfterMs, token);
        throw new DelayedError();
      }
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`🛑 Analysis failed for ${articleId}: ${message}`);
      await this.db
        .update(articles)
        .set({ processingStatus: 'failed', updatedAt: new Date() })
        .where(eq(articles.id, articleId))
        .catch(() => {});
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<{ articleId: string }>) {
    this.logger.log(
      `🏁 Pipeline Complete: Analysis finished for article: ${job.data.articleId}`,
    );
  }
}
