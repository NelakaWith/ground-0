import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly crawlerUrl: string;

  constructor(private readonly config: ConfigService) {
    this.crawlerUrl =
      this.config.get<string>('CRAWLER_URL') || 'http://127.0.0.1:3001';
  }

  /**
   * Fetches the URL using the Python Crawl4AI microservice.
   * This is our primary high-fidelity extraction layer.
   *
   * @param url The article URL to scrape.
   * @returns The extracted markdown content or null if extraction fails.
   */
  async scrapeContent(url: string): Promise<string | null> {
    this.logger.log(`🐍 Crawl4AI: Starting extraction for ${url}`);

    try {
      const response = await fetch(`${this.crawlerUrl}/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          javascript_enabled: true,
          wait_until: 'networkidle',
          timeout: 20000, // Give Crawl4AI enough time to render
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `🐍 Crawl4AI: Service returned status ${response.status} for ${url}`,
        );
        return null;
      }

      const data = (await response.json()) as {
        success: boolean;
        markdown: string;
        error?: string;
      };

      if (!data.success || !data.markdown) {
        this.logger.warn(
          `🐍 Crawl4AI: Extraction unsuccessful for ${url}: ${data.error || 'No content found'}`,
        );
        return null;
      }

      // Basic heuristic: if content is too short for a news story, it's likely a snippet/paywall
      if (data.markdown.length < 500) {
        this.logger.warn(
          `🐍 Crawl4AI: Extracted content too short (${data.markdown.length} chars). Handing to Stagehand...`,
        );
        return null;
      }

      this.logger.log(
        `✅ Crawl4AI: Successfully extracted ${data.markdown.length} characters for ${url}`,
      );
      return data.markdown;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`🛑 Crawl4AI: Failed to connect to service: ${msg}`);
      return null;
    }
  }
}
