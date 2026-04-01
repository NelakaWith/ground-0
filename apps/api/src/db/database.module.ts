import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

@Global()
@Module({
  providers: [
    {
      provide: 'DRIZZLE_DB',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>(
          'DATABASE_URL',
        ) as string;
        const client = neon(connectionString);
        return drizzle(client, { schema });
      },
    },
  ],
  exports: ['DRIZZLE_DB'],
})
export class DatabaseModule {}
