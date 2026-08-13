import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get<NeonHttpDatabase<typeof schema>>('DRIZZLE_DB');

  const providers = await db.select().from(schema.providers);
  console.log(`All providers in DB: ${providers.length}`);
  providers.forEach((p) =>
    console.log(
      `${p.name} - isActive: ${p.isActive} (type: ${typeof p.isActive})`,
    ),
  );

  await app.close();
  setTimeout(() => process.exit(0), 100);
}

main().catch(console.error);
