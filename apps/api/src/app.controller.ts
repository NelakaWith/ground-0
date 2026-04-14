import { Controller, Get, Post, Query } from '@nestjs/common';
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
  triggerFetch() {
    void this.newsDiscoveryService.handleCron();
    return { status: 'Discovery triggered successfully' };
  }

  @Post('recover')
  async triggerRecovery() {
    const result = await this.appService.recoverStuckArticles();
    return { status: 'Recovery cycle triggered', detail: result };
  }

  @Get('status')
  getStatus() {
    return this.appService.getPipelineStatus();
  }

  @Post('backfill')
  async triggerBackfill() {
    const result = await this.appService.backfillMissingData();
    return { status: 'Backfill process triggered', detail: result };
  }

  @Get('providers')
  getProviders() {
    return providers;
  }

  @Get('articles')
  async getArticles(@Query('status') status?: string) {
    return this.appService.getArticles(status);
  }

  @Get('articles/clusters')
  async getClusters() {
    return this.appService.getClusters();
  }

  @Get('articles/bias-ticker')
  async getBiasTicker() {
    return this.appService.getBiasTicker();
  }
}
