import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ExtractionService } from './extraction.service';
import { AnalysisService } from '../analysis/analysis.service';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { diceCoefficient } from '../utils/similarity.util';

/**
 * Strips markdown noise (nav links, images, short link-only lines),
 * leaving only prose paragraphs before saving to DB.
 */
function cleanContent(raw: string): string {
  return raw
    .split('\n')
    .map((line) =>
      line
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim(),
    )
    .filter((line) => {
      if (line.length < 40) return false;
      if ((line.match(/https?:\/\//g) || []).length > 1) return false;
      return true;
    })
    .join('\n');
}

interface ScrapeJobData {
  link: string;
  providerId: string;
  title: string;
  pubDate?: string;
}

/**
 * ScraperProcessor consumes the 'scrape' queue and performs the
 * heavy lifting of content extraction for news articles.
 */
@Processor('scrape')
export class ScraperProcessor extends WorkerHost {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private readonly extractionService: ExtractionService,
    private readonly analysisService: AnalysisService,
    @Inject('DRIZZLE_DB') private readonly db: NeonHttpDatabase<typeof schema>,
    @InjectQueue('analyze') private readonly analyzeQueue: Queue,
  ) {
    super();
  }

  /**
   * process: Main execution handler for each article scraping job.
   * Runs inside the BullMQ worker context.
   * @param job - The BullMQ job containing relevant article data.
   */
  async process(job: Job<ScrapeJobData, any, string>): Promise<any> {
    this.logger.log(
      `👷 Worker received job: ${job.name} (ID: ${job.id}) for ${job.data.link}`,
    );
    const { link } = job.data;

    if (!link) {
      this.logger.error(`Job ${job.id} missing mandatory link parameter.`);
      return;
    }

    try {
      // Step 1: Perform actual page extraction using tiered service
      const extraction = await this.extractionService.extractContent(link);
      const content = extraction.text;

      if (!content) {
        this.logger.warn(
          `All extraction methods failed for ${link}. Marking as failed.`,
        );

        // Update DB status to failed so it doesn't stay in 'discovered' forever
        await this.db
          .update(schema.articles)
          .set({
            processingStatus: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(schema.articles.url, link));

        return { success: false, reason: 'no_content_extracted' };
      }

      // Step 2: AI-powered refinement to strip noise
      let refinedContent = await this.analysisService.refineContent(
        content,
        job.data.title,
      );

      // --- Title Verification Logic ---
      // AI output format from prompt is markdown, starting with title
      const lines = refinedContent.split('\n');
      const aiTitle = lines[0].replace(/^#+\s*/, '').trim(); // Remove markdown headers

      const similarity = diceCoefficient(aiTitle, job.data.title);
      const isTitleMismatch =
        aiTitle.split(' ').length < 3 || // Too short (like "Local")
        similarity < 0.4; // Too different from RSS

      // Check for AI error tokens or typical placeholder phrases
      const isPlaceholder =
        refinedContent.includes('[NO_ARTICLE_CONTENT_FOUND]') ||
        refinedContent.toLowerCase().includes('this is a placeholder') ||
        refinedContent
          .toLowerCase()
          .includes('actual article text is missing') ||
        isTitleMismatch;

      if (isPlaceholder) {
        this.logger.warn(
          `⚠️ AI refinement failed for ${link} (Mismatch: ${isTitleMismatch}, Title: "${aiTitle}"). Using regex fallback.`,
        );
        refinedContent = cleanContent(content);
      }

      // Step 3: Update database with refined text
      const result = await this.db
        .update(schema.articles)
        .set({
          fullText: refinedContent,
          updatedAt: new Date(),
          processingStatus: 'scraped',
          isSnippet: extraction.type === 'snippet',
        })
        .where(eq(schema.articles.url, link))
        .returning({ id: schema.articles.id });

      if (result.length === 0) {
        this.logger.warn(
          `Article record with URL ${link} not found for updating scraping result.`,
        );
      } else {
        this.logger.log(`✅ Success for ${link} (Length: ${content.length})`);

        // Step 4: Enqueue to Analysis Queue
        if (result[0]?.id) {
          await this.analyzeQueue.add('analyze', { articleId: result[0].id });
          this.logger.log(`🧬 Enqueued analysis job for ${result[0].id}`);
        }
      }

      return { length: content.length, articleId: result[0]?.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to process job ${job.id} for ${link}: ${msg}`);
      throw err; // Allow BullMQ retry logic to handle it if applicable
    }
  }
}
