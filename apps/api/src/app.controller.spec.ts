import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getQueueToken } from '@nestjs/bullmq';

import { NewsDiscoveryService } from './ingestion/news-discovery.service';

describe('AppController', () => {
  let appController: AppController;

  const mockNewsDiscoveryService = {
    handleCron: jest.fn(),
  };

  const mockDrizzleDb = {
    query: {
      articles: {
        findMany: jest.fn(),
      },
    },
  };

  const mockScrapeQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: NewsDiscoveryService,
          useValue: mockNewsDiscoveryService,
        },
        {
          provide: 'DRIZZLE_DB',
          useValue: mockDrizzleDb,
        },
        {
          provide: getQueueToken('scrape'),
          useValue: mockScrapeQueue,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
