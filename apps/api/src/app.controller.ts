import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { NewsDiscoveryService } from './ingestion/news-discovery.service';
import providers from './feed/providers';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly newsDiscoveryService: NewsDiscoveryService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('fetch')
  async triggerFetch() {
    // Manually trigger the discovery sync
    void this.newsDiscoveryService.handleCron();
    return { status: 'Discovery triggered successfully' };
  }

  @Post('recover')
  async triggerRecovery() {
    // True recovery logic to re-dequeue stuck articles
    const result = await this.appService.recoverStuckArticles();
    return { status: 'Recovery cycle triggered', detail: result };
  }

  @Get('status')
  async getStatus() {
    return this.appService.getPipelineStatus();
  }

  @Get('providers')
  getProviders() {
    return providers;
  }
}
