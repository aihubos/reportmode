# Report Hub Brand Clock Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlarge the shared Report Hub wordmark, add the byline, and show a Seoul date/weekday/second clock on the archive and every content report.

**Architecture:** Keep all behavior in the existing shared brand asset. The renderer and report standardizer only provide canonical markup and cache-version updates; the shared script owns clock creation and one-second updates. Responsive layout stays in the shared brand stylesheet.

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

### Task 4: Update generators and all reports

**Files:**
- Modify: `src/lib/public-brand.ts`
- Modify: `src/lib/render.ts`
- Modify: `scripts/report-refresh-lib.mjs`
- Modify: `archive/index.html`
- Modify: `reports/**/*.html` content pages only

- [ ] Bump the shared brand/layout asset version to `20260809-rh4`.
- [ ] Update canonical archive/report brand markup.
- [ ] Run the standardizer and verify 45 content pages change while 3 redirects remain untouched.

### Task 5: Browser QA and release

**Files:**
- Create: `.superloopy/evidence/frontend/20260809-report-hub-brand-clock/VISUAL_QA.md`
- Create: `.superloopy/evidence/frontend/20260809-report-hub-brand-clock/PERF.md`

- [ ] Run full tests, typecheck, build, brand QA, syntax checks, and design-system compliance.
- [ ] Capture archive/report screenshots and metrics at 390px, 768px, and 1280px.
- [ ] Verify the displayed second changes after one second.
- [ ] Commit, push a feature branch, merge the PR, wait for Pages success, and verify the public URL with cache-busting markers.
