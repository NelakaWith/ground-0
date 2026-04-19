import { Injectable, Logger } from '@nestjs/common';
import { StagehandService } from './stagehand.service';
import { ScraperService } from './scraper.service';
import Bottleneck from 'bottleneck';

/**
 * ExtractionService: Handles content retrieval with a fail-over strategy.
 * Implements robust rate limiting using Bottleneck.
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private readonly limiter: Bottleneck;

  constructor(
    private readonly stagehandService: StagehandService,
    private readonly scraperService: ScraperService,
  ) {
    this.limiter = new Bottleneck({
      minTime: 2000, // 2 seconds between jobs
      maxConcurrent: 1, // Ensure only one extraction at a time per instance
    });
  }

  /**
   * Extracts content from a given URL using a rate-limited queue.
   * Strategy: Try Crawl4AI (ScraperService) first, fall back to Stagehand (Agentic) if needed.
   */
  async extractContent(
    url: string,
  ): Promise<{ text: string; type: 'snippet' | 'full' }> {
    this.logger.log(`Queueing extraction for: ${url}`);

    return this.limiter.schedule(async () => {
      this.logger.log(`Attempting extraction for: ${url}`);

      // 1. Try high-fidelity Crawl4AI extraction
      const scraped = await this.scraperService.scrapeContent(url);
      if (scraped) {
        return { text: scraped, type: 'full' };
      }

      // 2. Fall back to agentic Stagehand extraction
      this.logger.log(`Falling back to Stagehand for: ${url}`);
      const stagehandResult = await this.stagehandService.extractArticle(url);
      if (!stagehandResult) {
        throw new Error('All extraction methods failed');
      }

      return { text: stagehandResult, type: 'full' };
    });
  }
}
