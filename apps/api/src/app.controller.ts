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
    // Placeholder for recovery logic if needed later
    this.newsDiscoveryService.handleCron(); // For now, re-triggering discovery acts as a soft recovery
    return { status: 'Recovery cycle triggered' };
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
