# Report Hub Brand Clock Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlarge the shared Report Hub wordmark, add the byline and Seoul clock, then add reliable link-copy and matching view-count controls to the archive and every content report.

**Architecture:** Keep clock behavior in the existing shared brand asset. The shared report layout finds or creates the PDF control and adds one canonical copy button plus a view-count output. The existing report counter reads the same static fallback map used by the archive. The renderer owns archive-card copy buttons and canonical markup; the standardizer only updates shared assets and IDs.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Node test runner, TypeScript renderer, GitHub Pages.

---

### Task 1: Lock the design tokens

**Files:**
- Modify: `DESIGN.md`

- [ ] Add approved wordmark, byline, clock, A4 width, and responsive layout tokens.
- [ ] Confirm every new CSS value maps to the documented token scale.

### Task 2: Write failing brand and clock tests

**Files:**
- Modify: `assets/report-hub-brand.test.mjs`
- Modify: `src/lib/public-brand.test.ts`
- Modify: `src/lib/render.test.ts`
- Modify: `assets/report-layout.test.mjs`

- [ ] Assert 36px desktop and 30px mobile wordmarks, a gray byline, clock markup, Seoul formatting, and the new asset version.
- [ ] Run the focused tests and verify they fail because the feature is absent.

### Task 3: Implement the shared brand clock

**Files:**
- Modify: `assets/report-hub-brand.js`
- Modify: `assets/report-hub-brand.css`
- Modify: `src/site/assets/report-hub-brand.js`
- Modify: `src/site/assets/report-hub-brand.css`
- Modify: `assets/report-page-layout.js`
- Modify: `src/site/assets/report-page-layout.js`

- [ ] Add two-line brand markup with `by Jeremy`.
- [ ] Add a pure Seoul clock formatter and a single one-second timer.
- [ ] Insert the clock between the brand and controls on reports and inside the archive brand cluster.
- [ ] Add desktop, mobile, and portrait-A4 layouts without horizontal overflow.
- [ ] Run focused tests and verify green.

### Task 4: Add shared report and archive actions

**Files:**
- Modify: `assets/report-page-layout.js`
- Modify: `assets/report-page-layout.css`
- Modify: `src/site/assets/report-page-layout.js`
- Modify: `src/site/assets/report-page-layout.css`
- Modify: `assets/report-view-counter.js`
- Modify: `src/site/assets/report-view-counter.js`
- Modify: `src/lib/render.ts`
- Modify: `src/styles/magazine.css`
- Modify: `assets/report-layout.test.mjs`
- Modify: `assets/report-view-counter.test.mjs`
- Modify: `src/lib/render.test.ts`

- [ ] Write failing tests for one `공유` control beside PDF, clipboard fallback, report count loading, and one share button per archive card.
- [ ] Reuse or create the primary PDF button, replace legacy share handlers, and insert `공유` plus `조회수 N` without duplicate controls.
- [ ] Read `reports/view-counts.json` by report ID and update the report output while keeping retired CounterAPI disabled.
- [ ] Add an archive-card share button that copies without opening the report.
- [ ] Add responsive and print styles; verify focused tests green.

### Task 5: Update generators and all reports

**Files:**
- Modify: `src/lib/public-brand.ts`
- Modify: `src/lib/render.ts`
- Modify: `scripts/report-refresh-lib.mjs`
- Modify: `archive/index.html`
- Modify: `reports/**/*.html` content pages only

- [ ] Bump the shared brand/layout asset version to `20260809-rh4`.
- [ ] Update canonical archive/report brand markup.
- [ ] Ensure every content report receives exactly one shared counter script with its report ID.
- [ ] Run the standardizer and verify 45 content pages change while 3 redirects remain untouched.

### Task 6: Browser QA and release

**Files:**
- Create: `.superloopy/evidence/frontend/20260809-report-hub-brand-clock/VISUAL_QA.md`
- Create: `.superloopy/evidence/frontend/20260809-report-hub-brand-clock/PERF.md`

- [ ] Run full tests, typecheck, build, brand QA, syntax checks, and design-system compliance.
- [ ] Capture archive/report screenshots and metrics at 390px, 768px, and 1280px.
- [ ] Verify the displayed second changes after one second.
- [ ] Verify archive/report share copy, copied URL reopening, and matching archive/report counts.
- [ ] Commit, push a feature branch, merge the PR, wait for Pages success, and verify the public URL with cache-busting markers.
