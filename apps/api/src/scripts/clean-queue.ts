import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
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

  // Close the NestJS app context
  await app.close();

  // Force exit after a small delay to ensure all connections (Redis/BullMQ) are severed
  setTimeout(() => process.exit(0), 100);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
