import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ScraperService } from './scraper.service';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

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
    private readonly scraperService: ScraperService,
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
    this.logger.log(`Processing job ${job.id} for article: ${job.data.link}`);
    const { link } = job.data;

    if (!link) {
      this.logger.error(`Job ${job.id} missing mandatory link parameter.`);
      return;
    }

    try {
      // Step 1: Perform actual page scraping and extraction
      const content = await this.scraperService.scrapeContent(link);

      if (!content) {
        this.logger.warn(
          `Could not extract usable content for ${link}. Marking as failed.`,
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

      // Step 2: Update the 'articles' record in Postgres with the extracted text
      const result = await this.db
        .update(schema.articles)
        .set({
          content,
          updatedAt: new Date(),
          processingStatus: 'scraped',
          isSnippet: content.length < 500 ? 'true' : 'false', // basic heuristic
        })
        .where(eq(schema.articles.url, link))
        .returning({ id: schema.articles.id });

      if (result.length === 0) {
        this.logger.warn(
          `Article record with URL ${link} not found for updating scraping result.`,
        );
      } else {
        this.logger.log(`✅ Success for ${link} (Length: ${content.length})`);

        // Step 3: Enqueue to Analysis Queue
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
