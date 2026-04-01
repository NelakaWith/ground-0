ALTER TABLE "articles" ADD COLUMN "is_paywalled" text DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "is_snippet" text DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "processing_status" text DEFAULT 'discovered';