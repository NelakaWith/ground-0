import {
  pgTable,
  text,
  timestamp,
  uuid,
  real,
  vector,
  boolean,
  type PgTable,
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
  // Content
  content: text('content'), // This is the old snippet content
  fullText: text('full_text'), // New: Full article content

  // Analysis results
  biasScore: real('bias_score'), // -1.0 to 1.0
  sentiment: text('sentiment'),
  summary: text('summary'),

  // New Intelligent Framing Fields
  target: text('target'), // Primary subject identified in Pass 1
  entities: text('entities'), // JSON array of secondary entities
  chargedAdjectives: text('charged_adjectives'), // JSON array of extracted adjectives/phrases
  sentimentScore: real('sentiment_score'), // Pass 2 relative sentiment score

  // Flags for content quality and paywalls
  isPaywalled: text('is_paywalled').default('false'), // or boolean if supported
  isSnippet: boolean('is_snippet').default(true),
  processingStatus: text('processing_status').default('discovered'), // discovered, scraped, analyzed, failed

  // Semantic Search / Near-Duplicate Detection
  // pgvector extension must be enabled in Postgres
  embedding: vector('embedding', { dimensions: 3072 }), // Gemini Embedding 2 standard dimensions

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

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
