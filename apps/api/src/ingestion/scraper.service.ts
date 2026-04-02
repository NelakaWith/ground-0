import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  /**
   * Fetches the URL using Playwright and extracts the article content.
   * @param url The article URL to scrape.
   * @returns The extracted content or null if extraction fails.
   */
  async scrapeContent(url: string): Promise<string | null> {
    this.logger.log(`Starting scrape for ${url}`);

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();

      // Optimize: Abort common non-essential resources to speed up extraction
      await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}', (route) =>
        route.abort(),
      );

      // Navigate with 30s timeout and wait for DOM content loaded (faster than networkidle)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Quick wait for potential hydration if needed
      await page.waitForTimeout(1000);

      // --- Improvement: Scroll to bottom with safety cap ---
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 400; // Faster scroll
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight || totalHeight > 10000) {
              clearInterval(timer);
              resolve(null);
            }
          }, 50);
        });
      });

      // Wait for any final network activity after scroll
      await page.waitForTimeout(3000);

      // Get full HTML after it renders
      const html = await page.content();
      this.logger.debug(`HTML size for ${url}: ${html.length} chars`);

      // Use JSDOM and Readability to extract clean text
      const dom = new JSDOM(html, { url });

      // --- Improvement: Manual cleaning before Readability ---
      // Remove known "clutter" tags that confuse the parser
      const doc = dom.window.document;
      const selectorsToRemove = [
        'nav',
        'footer',
        'aside',
        '.ads',
        '.social-share',
        '.related-news',
        'script',
        'style',
      ];
      selectorsToRemove.forEach((selector) => {
        doc.querySelectorAll(selector).forEach((el) => el.remove());
      });

      const reader = new Readability(doc);
      const article = reader.parse();

      let cleanText = article?.textContent?.trim().replace(/\s\s+/g, ' ') ?? '';

      // --- Improvement: Handle Paywalls/Snippets/Short Content ---
      // If content is very short (< 400 chars), it's likely a paywall teaser or snippet
      if (cleanText.length < 400) {
        this.logger.warn(
          `Short content detected (${cleanText.length} chars) for ${url}. Attempting deeper extraction.`,
        );

        // Strategy: Look for specific article containers that might not be tagged correctly for Readability
        const bodySelectors = [
          'article',
          '.article-body',
          '.entry-content',
          '.post-content',
          '#articleContent',
        ];
        const deeperContent = Array.from(
          doc.querySelectorAll(bodySelectors.join(',')),
        )
          .map((el) => el.textContent?.trim())
          .join(' ')
          .replace(/\s\s+/g, ' ');

        if (deeperContent.length > cleanText.length) {
          this.logger.log(
            `Deeper extraction found more content: ${deeperContent.length} chars`,
          );
          cleanText = deeperContent;
        }
      }

      // Final Quality Check: If it's still just a 1-sentence teaser, discard it
      if (cleanText.length < 150) {
        this.logger.warn(
          `Scrape abandoned: Content too short (${cleanText.length} chars) - likely a paywall or snippet.`,
        );
        return null;
      }

      this.logger.log(
        `Successfully extracted ${cleanText.length} characters for ${url}`,
      );

      return cleanText;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error scraping ${url}: ${msg}`);
      return null;
    } finally {
      await browser.close();
    }
  }
}
