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
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
