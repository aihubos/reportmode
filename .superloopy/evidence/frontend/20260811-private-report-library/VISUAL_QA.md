# Visual QA — Private Report Library

- Date: 2026-08-11 KST
- Browser: headed Chromium through Playwright CLI
- Viewports: 390×844, 768×900, 1280×900

## Verified flows

- Private report create → list → open → edit → lock → delete completed against local D1 and R2.
- Direct private URL showed the password gate when no session existed.
- Lock removed the session and cleared the iframe content before reload.
- Viewer iframe kept `sandbox` without `allow-same-origin` and removed public comment/view/history assets.
- Mobile default hid comments, weather, tags, and categories behind 48×48 round buttons.
- Mobile comments, weather, and taxonomy buttons displayed only their selected panel.
- Selecting a taxonomy item closed the mobile panel and refreshed the report list.
- Selecting Private from the taxonomy panel closed the panel and opened the password gate.
- No horizontal overflow or browser console errors at all three viewports.

## Local captures

- `output/playwright/private-report-library/archive-private-gate-1280.png`
- `output/playwright/private-report-library/archive-private-gate-390.png`
- `output/playwright/private-report-library/private-viewer-gate-390.png`
- `output/playwright/private-report-library/archive-mobile-round-buttons-390.png`
