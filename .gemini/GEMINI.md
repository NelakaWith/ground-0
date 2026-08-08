# Gemini CLI Project Configuration

## Role
Senior Software Engineer and Orchestrator for Ground-0 Platform.

## Core Mandates
1. **Private-Core Architecture:** All proprietary intelligence, crawling, and analysis logic MUST be managed within `submodules/api-core` and `submodules/crawler-core`. The public repository (`apps/api`) should only contain stubs and orchestration interfaces.
2. **Provider Discovery Strategy:** Use `discoveryType` ('rss' | 'homepage') for all news outlets. RSS discovery uses `rss-parser`; Homepage discovery uses `StagehandService` or `Crawl4AI`.
3. **Admin Controls:** All changes to providers (toggle active status, discovery configuration) MUST be routed through admin-only interfaces (stubs for now, full API endpoints eventually).
4. **Data Integrity:** Any changes to `providers` schema or sync logic must ensure the platform remains functional during transitions between RSS-polling and direct-scraping.

## Sub-agent Instructions
- **Codebase Investigator:** Use this to map architectural dependencies between monorepo apps and submodules.
- **Generalist:** Delegate batch updates to Drizzle schemas, cron-job orchestration, and import refactoring across the `submodules/` directories.

## Conventions
- **Package Manager:** ALL package management MUST be done using `pnpm`. Avoid `npm` or `yarn` commands unless explicitly required for bootstrapping.
- **Process Lifecycle Management:** ALL background processes (dev servers, workers, queues) must be tracked by PID. When a task is complete, processes MUST be explicitly terminated (using `taskkill` or equivalent) to free ports. Always verify port availability before starting new services.
- **Imports:** Always prioritize `@api-core/*` and `@crawler-core/*` aliases over relative paths when crossing into submodule boundaries.
- **Migration:** All schema changes must be accompanied by SQL-compatible migration instructions.
- **Stagehand/Crawl4AI:** Prefer Stagehand for AI-agentic discovery tasks; use Crawl4AI for bulk, high-speed content extraction.
