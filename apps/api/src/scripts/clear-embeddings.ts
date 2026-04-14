import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get<NeonHttpDatabase<typeof schema>>('DRIZZLE_DB');

  console.log('🧹 Clearing old 3072-dimension embeddings...');

  await db.update(schema.articles).set({
    embedding: null,
    updatedAt: new Date(),
  });

  console.log(
    '✅ All embeddings cleared. You can now run backfill to regenerate them.',
  );

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
