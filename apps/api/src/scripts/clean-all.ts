import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
import { inArray } from 'drizzle-orm';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  // 1. Clean Queues (Redis)
  const scrapeQueue = app.get<Queue>(getQueueToken('scrape'));
  const analyzeQueue = app.get<Queue>(getQueueToken('analyze'));

  for (const [name, queue] of [
    ['scrape', scrapeQueue],
    ['analyze', analyzeQueue],
  ] as const) {
    console.log(`🧹 Cleaning "${name}" queue...`);
    await queue.drain();
    await queue.obliterate({ force: true });
    console.log(`✅ "${name}" queue cleaned.`);
  }

  // 2. Clean DB (Postgres)
  const db = app.get<NeonHttpDatabase<typeof schema>>('DRIZZLE_DB');
  console.log('🧹 Cleaning stuck articles in DB...');
  await db
    .update(schema.articles)
    .set({ processingStatus: 'failed' })
    .where(
      inArray(schema.articles.processingStatus, ['discovered', 'scraped']),
    );
  console.log('✅ DB cleaned. Stuck articles marked as failed.');

  // Close the NestJS app context
  await app.close();
  setTimeout(() => process.exit(0), 100);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
