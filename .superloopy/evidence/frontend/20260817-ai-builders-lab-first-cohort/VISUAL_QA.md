# Visual QA

Local target: `http://127.0.0.1:4187/reports/260817-ai-builders-lab-first-cohort-textbook/`

- 390px: the access panel appeared before entry; entering the requested code opened the guide. `scrollWidth` and `clientWidth` were both 375px.
- 768px: the restored guide had no horizontal overflow. `scrollWidth` and `clientWidth` were both 753px.
- 1280px: the restored guide had no horizontal overflow. `scrollWidth` and `clientWidth` were both 1265px.
- The title resolved to `[교재] AI 빌더스 랩 - 1기 | Report Hub`.
- The archive cover marker and Open Graph image both resolve to `assets/thumbnail.png`.
- The Report Hub shared floating navigation rendered above the preserved teaching content.

## Pre-flight

- The supplied source visual system was preserved rather than restyled.
- No new decorative gradient, icon family, or layout family was introduced.
- The new access panel uses the existing blue, border, surface, typography, radius, and shadow tokens.
- Mobile, tablet, and desktop widths have no page-level horizontal overflow.
