import { Injectable, Logger } from '@nestjs/common';
import { StagehandService } from './stagehand.service';
import Bottleneck from 'bottleneck';

/**
 * ExtractionService: Handles content retrieval with a fail-over strategy.
 * Implements robust rate limiting using Bottleneck.
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly limiter: Bottleneck;

  constructor(private readonly stagehandService: StagehandService) {
    this.limiter = new Bottleneck({
      minTime: 2000, // 2 seconds between jobs
      maxConcurrent: 1, // Ensure only one extraction at a time per instance
    });
  }

  /**
   * Extracts content from a given URL using a rate-limited queue.
   */
  async extractContent(
    url: string,
  ): Promise<{ text: string; type: 'snippet' | 'full' }> {
    this.logger.log(`Queueing extraction for: ${url}`);

    return this.limiter.schedule(async () => {
      this.logger.log(`Attempting extraction for: ${url}`);
      try {
        // Logic for tiered extraction would go here
        const result = await this.stagehandService.extractArticle(url);
        if (!result) {
          throw new Error('Extraction returned null/empty content');
        }
        return { text: result, type: 'full' };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Critical extraction error for ${url}: ${message}`);
        throw error; // Re-throw to allow BullMQ to handle retries
      }
    });
  }
}
