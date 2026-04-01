import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { NewsDiscoveryService } from './news-discovery.service';
import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';

/**
 * IngestionModule: Manages the first phase of the news pipeline.
 * Responsible for feed discovery and scheduling.
 */
@Module({
  imports: [
    /** Register the ScheduleModule to enable CRON-based discovery tasks. */
    ScheduleModule.forRoot(),
    /**
     * Register the BullModule with a 'scrape' queue definition.
     * This allows the module to manage and inject the 'scrape' queue using NestJS patterns.
     */
    BullModule.registerQueue({ name: 'scrape' }),
  ],
  providers: [
    NewsDiscoveryService,
    {
      /**
       * 'SCRAPE_QUEUE' Provider:
       * Manually instantiates and provides the BullMQ Queue instance.
       * We use a manual factory here to ensure custom Redis connection logic
       * (e.g., pulling host/port from environment variables) and to decouple
       * the underlying BullMQ 'Queue' object for more granular control.
       */
      provide: 'SCRAPE_QUEUE',
      useFactory: () => {
        const connection: RedisOptions = {
          host: process.env.REDIS_HOST ?? '127.0.0.1',
          port: Number(process.env.REDIS_PORT ?? 6379),
        };
        return new Queue('scrape', { connection });
      },
    },
  ],
  /**
   * Export the queue provider so other modules (like a future ScraperModule)
   * can inject it to manage jobs.
   */
  exports: ['SCRAPE_QUEUE'],
})
export class IngestionModule {}
