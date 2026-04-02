import { Injectable, Inject } from '@nestjs/common';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './db/schema';
import { sql } from 'drizzle-orm';

@Injectable()
export class AppService {
  constructor(
    @Inject('DRIZZLE_DB') private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getPipelineStatus() {
    const counts = await this.db
      .select({
        status: schema.articles.processingStatus,
        count: sql<number>`count(*)`,
      })
      .from(schema.articles)
      .groupBy(schema.articles.processingStatus);

    const result = counts.reduce(
      (acc, curr) => {
        acc[curr.status || 'unknown'] = Number(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const isIdle =
      (result['discovered'] || 0) === 0 && (result['scraped'] || 0) === 0;

    return {
      stats: result,
      isIdle,
      message: isIdle
        ? '🏁 All pipelines completed. All found articles have been processed.'
        : '🏗️ Pipeline is still active. There are articles waiting to be scraped or analyzed.',
    };
  }
}
