import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const queue = app.get<Queue>(getQueueToken('scrape'));

  console.log('🧹 Cleaning "scrape" queue...');

  // Removes all jobs that are waiting or delayed
  await queue.drain();
  // Removes all jobs in all states (completed, failed, etc.)
  await queue.obliterate({ force: true });

  console.log('✅ Queue cleaned successfully.');

  // Close the NestJS app context
  await app.close();

  // Force exit after a small delay to ensure all connections (Redis/BullMQ) are severed
  setTimeout(() => process.exit(0), 100);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
