import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NewsDiscoveryService } from '../ingestion/news-discovery.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const discovery = app.get(NewsDiscoveryService);
  await discovery.handleCron();
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
