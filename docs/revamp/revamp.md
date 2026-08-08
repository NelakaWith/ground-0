# Revamp Changes

## LLM Analysis Disconnected
Modified `apps/api/src/ingestion/scraper.processor.ts` to skip LLM calls. Pipeline now only pulls RSS, scrapes content, and saves to DB.

Changes:
1. **Disable AI Refine:** Replaced `this.analysisService.refineContent` with regex fallback `cleanContent(content)`. Removed title verification logic.
2. **Disable Analysis Queue:** Commented out `await this.analyzeQueue.add('analyze', ...)` so scraped articles do not go to LLM analysis. Added log for skip.
