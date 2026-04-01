import {
  pgTable,
  text,
  timestamp,
  uuid,
  real,
  vector,
} from 'drizzle-orm/pg-core';

/**
 * Articles Table Schema:
 * Holds all discovered news items, their metadata, extracted content, and bias analysis.
 */
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull().unique(),
  title: text('title').notNull(),
  providerId: text('provider_id').notNull(),
  pubDate: text('pub_date'),
  content: text('content'),

  // Analysis results
  biasScore: real('bias_score'), // -1.0 to 1.0
  sentiment: text('sentiment'),
  summary: text('summary'),

  // Semantic Search / Near-Duplicate Detection
  // pgvector extension must be enabled in Postgres
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI/Groq standard dimensions

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Providers Metadata (for enrichment)
 */
export const providers = pgTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type'), // 'state', 'private', etc.
  rssUrl: text('rss_url').notNull(),
});
