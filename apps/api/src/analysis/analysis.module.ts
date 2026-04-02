import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AnalysisService } from './analysis.service';
import { AnalysisProcessor } from './analysis.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || '127.0.0.1',
          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'analyze',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 10000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [AnalysisService, AnalysisProcessor],
  exports: [AnalysisService],
})
export class AnalysisModule {}
