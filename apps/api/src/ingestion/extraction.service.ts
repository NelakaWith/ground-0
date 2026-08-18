import { Injectable, Logger } from '@nestjs/common';
import { StagehandService } from './stagehand.service';
import { ScraperService } from './scraper.service';
import Bottleneck from 'bottleneck';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { providers } from '../feed/providers';

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
    providerId?: string,
  ): Promise<{ text: string; type: 'snippet' | 'full' }> {
    // Sanitize the URL to fix stray '%' signs that cause HTTP clients to crash
    const safeUrl = url.replace(/%(?![0-9a-fA-F]{2})/g, '%25');
    this.logger.log(`Queueing extraction for: ${safeUrl}`);

    return this.limiter.schedule(async () => {
      this.logger.log(`Attempting extraction for: ${safeUrl}`);

      let cssSelector: string | undefined;
      if (providerId) {
        const provider = providers.find((p) => p.id === providerId);
        cssSelector = provider?.articleSelector;
      }

      // 1. Tier 1: Crawl4AI (High Fidelity with CSS Selector)
      const scraped = await this.scraperService.scrapeContent(
        safeUrl,
        cssSelector,
      );
      if (scraped) {
        return { text: scraped, type: 'full' };
      }

      this.logger.warn(
        `Tier 1 (Crawl4AI) failed for ${safeUrl}. Falling back to Readability...`,
      );

      // 2. Tier 2: Local Readability (Fallback heuristic)
      try {
        const response = await fetch(safeUrl, {
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
        });
        if (response.ok) {
          const html = await response.text();
          const doc = new JSDOM(html, { url: safeUrl });
          const reader = new Readability(doc.window.document);
          const article = reader.parse();
          if (article && article.content) {
            // Treat HTML source newlines as spaces, then convert tags to real newlines
            const formattedText = article.content
              .replace(/<!--[\s\S]*?-->/g, '') // Strip all HTML comments completely first
              .replace(/\r?\n/g, ' ') // Collapse source code newlines into spaces
              .replace(/<p[^>]*>/g, '')
              .replace(/<\/(p|div|article|section|h[1-6]|ul|ol|li|blockquote)>/gi, '\n\n')
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]+>/g, '') // Strip all other HTML tags
              .replace(/&nbsp;/g, ' ')
              .trim();

            if (formattedText.length > 500) {
              this.logger.log(
                `✅ Tier 2 (Readability): Successfully extracted ${formattedText.length} chars.`,
              );
              return { text: formattedText, type: 'full' };
            }
          }
        }
      } catch (e) {
        this.logger.warn(`Tier 2 (Readability) failed for ${safeUrl}: ${e}`);
      }

      // 3. Tier 3: Stagehand (Disabled - No LLM API)
      // this.logger.log(`Falling back to Stagehand for: ${safeUrl}`);
      // const stagehandResult = await this.stagehandService.extractArticle(safeUrl);
      // if (stagehandResult) {
      //   return { text: stagehandResult, type: 'full' };
      // }

      throw new Error('All extraction methods failed');
    });
  }
}
