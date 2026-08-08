# Private/Public Separation Plan: Modular Core Approach

This plan details the migration of proprietary components into independent private Git submodules (`api-core` and `crawler-core`), enabling granular access control, independent CI/CD, and a robust modular architecture for the Ground-0 platform.

## Modular Components
Based on the current architecture, the following directories will be migrated to submodules:

### 1. `submodules/api-core`
- `apps/api/src/analysis/` (Analysis service, processor, module)
- `apps/api/src/ingestion/` (Extraction service, ingestion module, news discovery, scraper processor, scraper service, stagehand service)
- `apps/api/src/feed/` (Providers)

### 2. `submodules/crawler-core`
- `apps/crawler/` (Core Python scraping logic, `main.py`, `start.py`, etc.)

---

## Phase 1: Preparation
- [x] **Repository Creation:** Initialize two private Git repositories: `ground-0-api-core` and `ground-0-crawler-core`.
- [x] **Migration:** Move proprietary logic from the paths above to the corresponding `api-core` and `crawler-core` repositories.
- [x] **Clean Workspace:** Delete the existing proprietary files from the current `apps/` tree.
- [x] **Initialize Submodules:**
  ```bash
  mkdir submodules
  git submodule add <api-core-repo-url> submodules/api-core
  git submodule add <crawler-core-repo-url> submodules/crawler-core
  ```

## Phase 2: Monorepo Integration
- [ ] **Workspace Config:** Update `pnpm-workspace.yaml` to include the modular submodules:
  ```yaml
  packages:
    - 'apps/*'
    - 'packages/*'
    - 'submodules/api-core'
    - 'submodules/crawler-core'
  ```
- [ ] **Build Pipeline:** Update CI/CD configurations (`.github/workflows/ci.yml`) to initialize recursive submodules.

## Phase 3: Import Resolution & Dependency Mapping
- [ ] **TypeScript Aliases:** Update `apps/api/tsconfig.json` to map imports to the specific core modules:
  ```json
  "paths": {
    "@api-core/*": ["../../submodules/api-core/src/*"],
    "@crawler-core/*": ["../../submodules/crawler-core/*"]
  }
  ```
- [ ] **Shared Types:** Move shared interfaces/schemas to `packages/shared-types` (if needed) to prevent tight coupling between core modules.

## Phase 4: Public Sanitization
- [ ] **Audit:** Ensure `submodules/` is tracked by Git (remove from `.gitignore`).
- [ ] **History Scrub:** Use `git filter-repo` to permanently remove original private file paths from the public repository history.
- [ ] **Mocking:** Implement public-safe stubs in `apps/api/src/` to allow build verification of the public showcase without requiring submodule access.

## Phase 5: Verification
- [ ] **Public Build:** Verify `npm run build` succeeds using only public-safe stubs.
- [ ] **Private Build:** Initialize submodules locally and verify the full platform orchestration functions as expected.
