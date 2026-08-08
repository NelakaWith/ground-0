import { Injectable, Logger } from '@nestjs/common';
import { StagehandService } from './stagehand.service';
import { ScraperService } from './scraper.service';
import Bottleneck from 'bottleneck';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

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
   * Strategy:
   * 1. Try Readability (Local parsing)
   * 2. Try Crawl4AI (Microservice)
   * 3. Fall back to Stagehand (Agentic)
   */
  async extractContent(
    url: string,
  ): Promise<{ text: string; type: 'snippet' | 'full' }> {
    this.logger.log(`Queueing extraction for: ${url}`);

    return this.limiter.schedule(async () => {
      this.logger.log(`Attempting extraction for: ${url}`);

      // 1. Tier 1: Local Readability
      try {
        const response = await fetch(url);
        if (response.ok) {
          const html = await response.text();
          const doc = new JSDOM(html, { url });
          const reader = new Readability(doc.window.document);
          const article = reader.parse();
          if (article && article.textContent.length > 500) {
            this.logger.log(`✅ Tier 1 (Readability): Successfully extracted ${article.textContent.length} chars.`);
            return { text: article.textContent, type: 'full' };
          }
        }
      } catch (e) {
        this.logger.warn(`Tier 1 (Readability) failed for ${url}: ${e}`);
      }

      // 2. Tier 2: Crawl4AI
      const scraped = await this.scraperService.scrapeContent(url);
      if (scraped) {
        return { text: scraped, type: 'full' };
      }

      // 3. Tier 3: Stagehand
      this.logger.log(`Falling back to Stagehand for: ${url}`);
      const stagehandResult = await this.stagehandService.extractArticle(url);
      if (stagehandResult) {
        return { text: stagehandResult, type: 'full' };
      }

      throw new Error('All extraction methods failed');
    });
  }
}
