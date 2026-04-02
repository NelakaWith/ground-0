import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalysisService } from './analysis.service';
import { eq } from 'drizzle-orm';
import { articles } from '../db/schema';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

@Processor('analyze')
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    private readonly analysisService: AnalysisService,
    @Inject('DRIZZLE_DB') private readonly db: NeonHttpDatabase<typeof schema>,
  ) {
    super();
  }

  async process(job: Job<{ articleId: string }>): Promise<any> {
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
      if (!article.content || article.content.length < 50) {
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
        article.content,
      );

      // 3. Pass 2: Sentiment & Adjective Extraction relative to Target
      const pass2 = await this.analysisService.extractSentimentAndFraming(
        article.content,
        pass1.target,
      );

      // 4. Update Database
      await this.db
        .update(articles)
        .set({
          target: pass1.target,
          entities: JSON.stringify(pass1.entities),
          sentimentScore: pass2.sentimentScore,
          chargedAdjectives: JSON.stringify(pass2.chargedAdjectives),
          summary: pass2.summary,
          processingStatus: 'analyzed',
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      this.logger.log(
        `✅ Successfully analyzed article ${articleId} (Target: ${pass1.target})`,
      );

      return {
        success: true,
        target: pass1.target,
        sentiment: pass2.sentimentScore,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`🛑 Analysis failed for ${articleId}: ${message}`);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`❌ Job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(
      `🏁 Pipeline Complete: Analysis finished for article: ${job.data.articleId}`,
    );
  }
}
