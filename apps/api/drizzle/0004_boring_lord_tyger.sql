ALTER TABLE "articles" ALTER COLUMN "is_snippet" DROP DEFAULT;
ALTER TABLE "articles" ALTER COLUMN "is_snippet" TYPE boolean USING is_snippet::boolean;
ALTER TABLE "articles" ALTER COLUMN "is_snippet" SET DEFAULT true;
ALTER TABLE "articles" ADD COLUMN "full_text" text;