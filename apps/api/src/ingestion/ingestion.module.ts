import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { NewsDiscoveryService } from './news-discovery.service';
import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: 'scrape' }),
  ],
  providers: [
    NewsDiscoveryService,
    {
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
  exports: ['SCRAPE_QUEUE'],
})
export class IngestionModule {}
