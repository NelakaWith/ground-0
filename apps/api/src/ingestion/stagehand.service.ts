import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Interface for Stagehand session
interface StagehandSession {
  init(): Promise<void>;
  context: {
    activePage(): any | undefined;
    pages(): any[];
  };
  act(action: string): Promise<void>;
  extract(prompt: string): Promise<{ extraction: string | null }>;
  agent(config: { systemPrompt: string }): {
    execute(task: string): Promise<void>;
  };
  close(): Promise<void>;
}

let StagehandClass: new (options: any) => StagehandSession;

@Injectable()
export class StagehandService implements OnModuleDestroy {
  private readonly logger = new Logger(StagehandService.name);

  constructor(private readonly config: ConfigService) {}

  private async getStagehandClass(): Promise<
    new (options: any) => StagehandSession
  > {
    if (!StagehandClass) {
      const module = await import('@browserbasehq/stagehand');
      StagehandClass = module.Stagehand as any;
    }
    return StagehandClass;
  }

  private async createSession(): Promise<StagehandSession> {
    const Class = await this.getStagehandClass();
    const modelName =
      this.config.get<string>('STAGEHAND_MODEL') ??
      this.config.get<string>('GEMINI_MODEL') ??
      'google:gemini-2.5-flash';

    const options = {
      env: 'LOCAL',
      localBrowserLaunchOptions: {
        headless: true,
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      },
      model: {
        modelName,
        apiKey: this.config.get<string>('GEMINI_API_KEY'),
      },
    };

    const stagehand = new Class(options);
    await stagehand.init();
    return stagehand;
  }

  private getActivePage(stagehand: StagehandSession): any {
    const page = stagehand.context.activePage() ?? stagehand.context.pages()[0];
    if (!page) {
      throw new Error('Stagehand context has no active page');
    }
    return page;
  }

  private async hydratePage(
    stagehand: StagehandSession,
    page: any,
  ): Promise<void> {
    for (let i = 0; i < 3; i += 1) {
      this.logger.log(`🤖 Stagehand: Scroll-Hydrate iteration ${i + 1}/3...`);
      await stagehand.act('Scroll to the bottom of the page');
      await page.waitForTimeout(1500);
    }
  }

  async extractArticle(url: string): Promise<string | null> {
    let stagehand: StagehandSession | null = null;
    this.logger.log(`🤖 Stagehand: Starting extraction for ${url}`);

    try {
      stagehand = await this.createSession();
      const page = this.getActivePage(stagehand);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeoutMs: 30000 });
      await page.waitForTimeout(2000);
      await this.hydratePage(stagehand, page);

      const result = await stagehand.extract(
        'Extract the complete article text from this page, including all paragraphs, quotes, and important details. Ignore navigation, ads, and comments.',
      );

      return result?.extraction ?? null;
    } catch (err) {
      this.logger.warn(
        `Stagehand extraction failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      if (stagehand) await stagehand.close().catch(() => {});
    }
  }

  async navigateAndExtract(url: string, task: string): Promise<string | null> {
    let stagehand: StagehandSession | null = null;

    try {
      stagehand = await this.createSession();
      const page = this.getActivePage(stagehand);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeoutMs: 30000 });
      await page.waitForTimeout(2000);
      await this.hydratePage(stagehand, page);

      const agent = stagehand.agent({
        systemPrompt:
          'You are a helpful assistant that navigates websites and extracts article content. Complete the task step by step.',
      });

      await agent.execute(task);
      const result = await stagehand.extract(
        'Extract the article content that is now visible on screen',
      );
      return result?.extraction ?? null;
    } catch (err) {
      this.logger.warn(
        `Stagehand agent navigation failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      if (stagehand) await stagehand.close().catch(() => {});
    }
  }

  onModuleDestroy(): void {
    this.logger.log('StagehandService destroyed');
  }
}
