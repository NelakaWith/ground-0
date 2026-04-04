import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Stagehand,
  type ModelConfiguration,
  type Page,
  type V3Options,
} from '@browserbasehq/stagehand';

@Injectable()
export class StagehandService implements OnModuleDestroy {
  private readonly logger = new Logger(StagehandService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Create a new Stagehand session for browser automation.
   * Uses local Chrome with Groq API for vision-based page understanding.
   * Set GROQ_API_KEY and STAGEHAND_MODEL in environment.
   */
  private async createSession(): Promise<Stagehand> {
    const modelName =
      this.config.get<string>('STAGEHAND_MODEL') ??
      'groq-llama-3.3-70b-versatile';
    const model: ModelConfiguration = {
      modelName,
      apiKey: this.config.get<string>('GROQ_API_KEY') ?? undefined,
    };

    const options: V3Options = {
      env: 'LOCAL',
      localBrowserLaunchOptions: {
        headless: true,
      },
      model,
    };

    const stagehand = new Stagehand(options);

    await stagehand.init();
    return stagehand;
  }

  private getActivePage(stagehand: Stagehand): Page {
    const page = stagehand.context.activePage() ?? stagehand.context.pages()[0];
    if (!page) {
      throw new Error('Stagehand context has no active page');
    }
    return page;
  }

  private async hydratePage(stagehand: Stagehand, page: Page): Promise<void> {
    // A short scroll/wait loop to trigger lazy content and hydration.
    for (let i = 0; i < 3; i += 1) {
      await stagehand.act('Scroll to the bottom of the page');
      await page.waitForTimeout(1500);
    }
  }

  /**
   * Extract full article content using AI-powered page understanding.
   * This is the fallback when Playwright + Readability fails.
   *
   * @param url Article URL to extract from
   * @returns Full article text, or null if extraction fails
   */
  async extractArticle(url: string): Promise<string | null> {
    let stagehand: Stagehand | null = null;

    try {
      stagehand = await this.createSession();
      const page = this.getActivePage(stagehand);

      // Navigate to the URL
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeoutMs: 30000,
      });

      // Let page settle (hydration, lazy-loaded content)
      await page.waitForTimeout(2000);

      // Scroll to trigger any lazy-loaded content
      await this.hydratePage(stagehand, page);

      // Extract the full article body using vision + LLM
      const result = await stagehand.extract(
        'Extract the complete article text from this page, including all paragraphs, quotes, and important details. Ignore navigation, ads, and comments.',
      );

      const content = result?.extraction ?? null;

      if (content) {
        this.logger.log(
          `✓ Stagehand extraction successful for ${url} (${content.length} chars)`,
        );
      }
      return content;
    } catch (err) {
      this.logger.warn(
        `Stagehand extraction failed for ${url}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    } finally {
      if (stagehand) {
        await stagehand
          .close()
          .catch((e: unknown) =>
            this.logger.warn(
              `Failed to close Stagehand session: ${
                e instanceof Error ? e.message : String(e)
              }`,
            ),
          );
      }
    }
  }

  /**
   * Use AI agent for multi-step navigation (e.g., clicking "Read More", pagination).
   * For handling paywalled content with JS-gated access.
   *
   * @param url Starting URL
   * @param task Natural language instruction for the agent
   * @returns Result of the agent execution
   */
  async navigateAndExtract(url: string, task: string): Promise<string | null> {
    let stagehand: Stagehand | null = null;

    try {
      stagehand = await this.createSession();
      const page = this.getActivePage(stagehand);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeoutMs: 30000,
      });
      await page.waitForTimeout(2000);

      // Scroll to trigger any lazy-loaded content
      await this.hydratePage(stagehand, page);

      // Use agent for multi-step interaction
      const agent = stagehand.agent({
        systemPrompt:
          'You are a helpful assistant that navigates websites and extracts article content. Complete the task step by step.',
      });

      await agent.execute(task);

      // Extract final content after agent work
      const result = await stagehand.extract(
        'Extract the article content that is now visible on screen',
      );

      const content = result?.extraction ?? null;

      if (content) {
        this.logger.log(`✓ Stagehand agent navigation successful for ${url}`);
      }
      return content;
    } catch (err) {
      this.logger.warn(
        `Stagehand agent navigation failed for ${url}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    } finally {
      if (stagehand) {
        await stagehand
          .close()
          .catch((e: unknown) =>
            this.logger.warn(
              `Failed to close Stagehand session: ${
                e instanceof Error ? e.message : String(e)
              }`,
            ),
          );
      }
    }
  }

  onModuleDestroy(): void {
    // Sessions are closed per-use above; nothing persistent to clean up
    this.logger.log('StagehandService destroyed');
  }
}
