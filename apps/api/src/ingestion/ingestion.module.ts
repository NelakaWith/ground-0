import { Module, Logger } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NewsDiscoveryService } from './news-discovery.service';
import { ScraperService } from './scraper.service';
import { ScraperProcessor } from './scraper.processor';
import { StagehandService } from './stagehand.service';
import { AnalysisModule } from '../analysis/analysis.module';
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
    AnalysisModule,
    /**
     * Register the BullModule with a 'scrape' queue definition.
     * This allows the module to manage and inject the 'scrape' queue using NestJS patterns.
     */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') ?? '127.0.0.1',
          port: configService.get<number>('REDIS_PORT') ?? 6379,
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: 'scrape',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
      {
        name: 'analyze',
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 10000 },
          removeOnComplete: true,
        },
      },
    ),
  ],
  providers: [
    NewsDiscoveryService,
    ScraperService,
    ScraperProcessor,
    StagehandService,
    {
      /**
       * 'SCRAPE_QUEUE' Provider:
       * Manually instantiates and provides the BullMQ Queue instance.
       */
      provide: 'SCRAPE_QUEUE',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisConnection');
        const connection: RedisOptions = {
          host: configService.get<string>('REDIS_HOST') ?? '127.0.0.1',
          port: configService.get<number>('REDIS_PORT') ?? 6379,
        };

        const queue = new Queue('scrape', { connection });

        /**
         * BullMQ provides a waitUntilReady() method that resolves when the
         * underlying Redis client has successfully established a connection.
         */
        void queue
          .waitUntilReady()
          .then(() => {
            logger.log(
              `✅ Successfully connected to Redis at ${connection.host}:${connection.port}`,
            );
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`🛑 Failed to connect to Redis: ${msg}`);
          });

        return queue;
      },
    },
  ],
  /**
   * Export the queue provider so other modules (like a future ScraperModule)
   * can inject it to manage jobs.
   */
  exports: [BullModule, 'SCRAPE_QUEUE', NewsDiscoveryService, StagehandService],
})
export class IngestionModule {}
