import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { StagehandService } from './../src/ingestion/stagehand.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StagehandService)
      .useValue({
        extractArticle: jest.fn().mockResolvedValue('Mocked content'),
        navigateAndExtract: jest.fn().mockResolvedValue('Mocked content'),
      })
      .overrideProvider('DRIZZLE_DB')
      .useValue({}) // Mock DB to avoid connection errors in tests
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200);
  });
});
