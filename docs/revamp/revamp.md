# Revamp Changes

## LLM Analysis Disconnected
Modified `apps/api/src/ingestion/scraper.processor.ts` to skip LLM calls. Pipeline now only pulls RSS, scrapes content, and saves to DB.

Changes:
1. **Disable AI Refine:** Replaced `this.analysisService.refineContent` with regex fallback `cleanContent(content)`. Removed title verification logic.
   *Removed Code:*
   ```typescript
   let refinedContent = await this.analysisService.refineContent(content, job.data.title);

   // --- Title Verification Logic ---
   const lines = refinedContent.split('\n');
   const aiTitle = lines[0].replace(/^#+\s*/, '').trim(); 
   const similarity = diceCoefficient(aiTitle, job.data.title);
   const isTitleMismatch = aiTitle.split(' ').length < 3 || similarity < 0.4; 

   const isPlaceholder =
     refinedContent.includes('[NO_ARTICLE_CONTENT_FOUND]') ||
     refinedContent.toLowerCase().includes('this is a placeholder') ||
     refinedContent.toLowerCase().includes('actual article text is missing') ||
     isTitleMismatch;

   if (isPlaceholder) {
     this.logger.warn(`⚠️ AI refinement failed... Using regex fallback.`);
     refinedContent = cleanContent(content);
   }
   ```
   *Replaced With:*
   ```typescript
   let refinedContent = cleanContent(content);
   ```

2. **Disable Analysis Queue:** Commented out `await this.analyzeQueue.add('analyze', ...)` so scraped articles do not go to LLM analysis. Added log for skip.
   *Removed Code:*
   ```typescript
   await this.analyzeQueue.add('analyze', { articleId: result[0].id });
   this.logger.log(`🧬 Enqueued analysis job for ${result[0].id}`);
   ```
   *Replaced With:*
   ```typescript
   // await this.analyzeQueue.add('analyze', { articleId: result[0].id });
   this.logger.log(`⚠️ LLM Analysis skipped for ${result[0].id}`);
   ```
