ALTER TABLE "providers" ALTER COLUMN "rss_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "homepage_url" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "discovery_type" text DEFAULT 'rss' NOT NULL;