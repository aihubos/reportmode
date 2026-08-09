# Report Hub Weather Clock Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Left-align the Report Hub brand, enlarge the one-line Seoul clock, add a compact live Dongtan weather card, and standardize archive/report share and PDF controls as icon-only buttons.

**Architecture:** Keep the brand, date, clock, and report action icons in shared assets so the archive and all reports stay consistent. Add one archive-only weather script that talks directly to Open-Meteo and renders into server-generated semantic markup. Wrap the existing request board and weather card in a responsive right rail without changing feedback persistence.

**Tech Stack:** Static HTML, CSS, browser JavaScript, TypeScript renderer, Node test runner, GitHub Pages.

---

### Task 1: Lock the approved design

**Files:**
- Modify: `DESIGN.md`
- Create: `docs/superpowers/specs/2026-08-09-report-hub-weather-clock-design.md`

- [ ] Record left-edge brand alignment, one-line clock sizes, right-rail sizing, weather colors, and responsive behavior.
- [ ] Record icon-only PDF/share sizes, reserved archive-card spacing, and accessible labels.
- [ ] Keep the existing Toss Blue single-accent system and avoid gradients or decorative surfaces.

### Task 2: Add failing regression tests

**Files:**
- Modify: `assets/report-hub-brand.test.mjs`
- Create: `assets/archive-weather.test.mjs`
- Modify: `src/lib/render.test.ts`
- Modify: `package.json`

- [ ] Assert left-aligned brand copy and topbar, 13px/22px clock tokens, one-line flex layout, and compact mobile clock tokens.
- [ ] Assert one right rail, request board before weather, accessible weather states, and one weather script.
- [ ] Assert the weather formatter maps Open-Meteo codes and selects today plus four future days.
- [ ] Assert icon-only archive share and report PDF/share controls, success check state, and image-safe positioning.
- [ ] Run the focused tests and confirm they fail before implementation.

### Task 3: Implement shared brand, clock, and report action layout

**Files:**
- Modify: `assets/report-hub-brand.css`
- Modify: `src/site/assets/report-hub-brand.css`
- Modify: `assets/report-hub-brand.js`
- Modify: `src/site/assets/report-hub-brand.js`
- Modify: `src/lib/public-brand.ts`

- [ ] Left-align the two-line brand copy and anchor the archive topbar 16px from the viewport edge.
- [ ] Change the clock container to a single baseline-aligned row and enlarge the date/time.
- [ ] Add compact mobile and portrait-A4 values.
- [ ] Bump the shared asset version to `20260809-rh5` and update generated references.
- [ ] Replace visible PDF/share labels with equal 40px document-download and share icons.
- [ ] Preserve aria labels, tooltips, copy success feedback, and PDF behavior.
- [ ] Run the focused brand tests.

### Task 4: Add the archive weather module

**Files:**
- Create: `assets/archive-weather.js`
- Create: `src/site/assets/archive-weather.js`
- Modify: `src/lib/render.ts`
- Modify: `src/styles/magazine.css`

- [ ] Wrap the request board and weather card in `archive-right-rail`.
- [ ] Render the archive share action as a 36px icon in reserved text-area space outside the cover.
- [ ] Add semantic loading, success, failure, and retry markup.
- [ ] Fetch Open-Meteo using the approved Dongtan8 coordinates and Seoul timezone.
- [ ] Cache successful data for 10 minutes, map Korean conditions, and render current plus four forecast days.
- [ ] Keep the module isolated so an API failure cannot stop archive comments or report filtering.
- [ ] Run the focused weather and renderer tests.

### Task 5: Regenerate and verify the static site

**Files:**
- Modify: `archive/index.html`
- Modify: `reports/**/*.html` content pages only

- [ ] Run the report brand standardizer and static build.
- [ ] Confirm redirects remain redirects and content/report data are unchanged apart from shared asset versions.
- [ ] Run the full test suite, typecheck, brand QA, and build.
- [ ] Check the generated archive has one right rail, one weather card, and one weather script.

### Task 6: Browser QA and Pages release

**Files:**
- Create: `.superloopy/evidence/frontend/20260809-report-hub-weather-clock/VISUAL_QA.md`

- [ ] Verify archive and a representative report at 390px, 768px, and 1280px with no horizontal overflow.
- [ ] Confirm the visible second changes and the weather card renders live Dongtan data.
- [ ] Confirm request-board loading and interaction controls remain present.
- [ ] Commit, push the feature branch, merge through a pull request, wait for Pages success, and verify the public custom domain.
