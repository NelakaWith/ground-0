# AI-Native Extraction Pipeline Implementation Plan

## Objective

Transition the Ground-0 platform from RSS-snippet analysis to full-length content analysis by implementing a robust, AI-native extraction pipeline.

## 1. Architecture & Design

- **ExtractionService**: A new, centralized service that abstracts the logic for fetching and cleaning content. It follows a "Fail-over" pattern:
  - **Attempt 1 (Readability):** Playwright + `@mozilla/readability`. Efficient for standard pages.
  - **Attempt 2 (Stagehand):** Browser automation + LLM vision for JS-heavy/obfuscated pages.
  - **Attempt 3 (Crawl4AI):** LLM-native scraping for complex WAF/bot-protected sites.
- **Data Model Update**: Add `full_text` column to the `articles` table in Drizzle schema.
- **Orchestration**: Update `ScraperProcessor` to depend on `ExtractionService`, and update `AnalysisService` to prioritize `full_text` for higher-quality bias reports.

## 2. Implementation Steps

### Phase 1: Infrastructure & Schema (Day 1)

- [x] **Modify Drizzle Schema (`apps/api/src/db/schema.ts`)**:
  - Add `full_text: text` column (nullable) to the `articles` table.
  - Add `is_snippet: boolean` (default: `true`) to track the depth of the content.
  - Run migration to update the database.

### Phase 2: Core Abstraction (Day 1-2)

- [x] **Create `apps/api/src/ingestion/extraction.service.ts`**:
  - Inject `StagehandService` and `Crawl4AI` (if installed) or placeholder logic.
  - Define `extractContent(url: string)` returning `{ text: string, type: 'snippet' | 'full' }`.
  - Implement logging for success/failure at each tier.

### Phase 3: Processor Updates (Day 2-3)

- [x] **Update `ScraperProcessor.ts`**:
  - Remove direct extraction logic.
  - Call `ExtractionService.extractContent()`.
  - Handle database update: store text in `full_text`, toggle `is_snippet` to `false`.
  - Enqueue analysis job only after successful full-text extraction.

### Phase 4: Analysis Intelligence (Day 3-4)

- [x] **Update `AnalysisService.ts`**:
  - Modify input logic to select `full_text` (if available) or `snippet_text`.
  - Update system prompt: "Analyze the following [Full Article | Snippet] for media bias..."
  - Add `input_source` flag to the resulting bias report.

## 3. Configuration & Security

- [x] **Env Variables**: Add required keys for any external extraction tools (e.g., `CRAWL4AI_API_KEY` if applicable).
- [x] **Rate Limiting**: Integrate `bottleneck` (or equivalent simple queue) in the new `ExtractionService` to prevent hitting WAF rate limits when running concurrent AI-native extractions.

## 4. Verification & Testing Strategy

- **Unit Testing**: Test the tiered failure logic in `ExtractionService` by mocking successful/failed responses for each tier.
- **Integration Testing**: Target a problematic source (e.g., `EconomyNext`) and a reliable source (e.g., `Daily Mirror`).
- **Data Quality Audit**: Compare `bias_score` outputs from an article processed with snippet-only vs. full-text to verify accuracy improvements.

## 5. Potential Risks & Mitigation

- **Risk**: Increased latency per article due to AI-native extraction (Stagehand).
  - **Mitigation**: Implement a "high-priority" queue for full-extraction jobs and allow snippet-only analysis for fast-breaking news alerts.
- **Risk**: Cost per extraction.
  - **Mitigation**: Use a small model (e.g., Llama 3 8B) for extraction tier 2/3 instead of a high-end model.

## 6. Migration Plan

- Existing articles keep their `snippet` status.
- New articles use the new extraction pipeline.
- Retroactively run `ExtractionService` on old, high-priority articles by enqueuing them into the new pipeline.
