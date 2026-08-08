import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
import { inArray } from 'drizzle-orm';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get<NeonHttpDatabase<typeof schema>>('DRIZZLE_DB');

  console.log('🧹 Cleaning stuck articles in DB...');
  await db
    .update(schema.articles)
    .set({ processingStatus: 'failed' })
    .where(
      inArray(
        schema.articles.processingStatus,
        ['discovered', 'scraped'],
      ),
    );

  console.log('✅ DB cleaned. Stuck articles marked as failed.');

  await app.close();
  setTimeout(() => process.exit(0), 100);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
