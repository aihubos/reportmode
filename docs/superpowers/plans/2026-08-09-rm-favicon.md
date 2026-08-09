# RM Favicon Implementation Plan

> **For agentic workers:** Execute these steps in order in the clean favicon worktree. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish one consistent `RM` favicon across the Report Mode archive and reports.

**Architecture:** Add one shared SVG asset and reference it from generated/static pages. The existing report helper will replace missing or intentionally empty favicon links without changing report content.

**Tech Stack:** SVG, HTML, TypeScript templates, browser JavaScript, GitHub Pages

---

### Task 1: Add the shared favicon

**Files:**
- Create: `assets/favicon.svg`
- Modify: `archive/index.html`
- Modify: `index.html`
- Modify: `src/site/index.html`
- Modify: `src/lib/render.ts`

- [ ] Create the exact `#3182F6` rounded-square `RM` SVG.
- [ ] Replace empty and single-letter favicon links with the shared asset.
- [ ] Keep relative paths correct for root, archive, and nested report pages.

### Task 2: Cover existing reports

**Files:**
- Modify: `assets/report-view-counter.js`
- Modify: `assets/report-view-counter.test.mjs`

- [ ] Resolve `favicon.svg` relative to the shared script URL.
- [ ] Replace only missing or `data:,` favicon values.
- [ ] Update the existing assertion for the new shared asset.

### Task 3: Verify and publish

- [ ] Run the focused test, typecheck, and build.
- [ ] Serve the built site and capture archive/report screenshots.
- [ ] Commit and push only the favicon change from the clean worktree.
- [ ] Confirm the GitHub Pages build matches the pushed commit.
- [ ] Confirm the live favicon returns HTTP 200 and the live archive references it.

