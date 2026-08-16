# Jemma and Selfish Club Operations Benchmarking Visual QA

- Report: `260816-jemma-selfishclub-operations-benchmarking`
- Representative image: user-provided SELFISH CLUB logo, 196 x 151 PNG.
- Archive check at 1280px: the first featured card shows the exact report title, links to the folder report route, and loads `assets/thumbnail.png` successfully.
- Report check at 1280px: Report Hub header, report title, supplied inline visual assets, and action controls render without document-level horizontal overflow.
- Report check at 768px: header and report content stack cleanly; the Board label remains on a single line and all loaded images have a positive natural width.
- Report check at 390px: Board text becomes an icon-only accessible action, hero content is visible after its intended reveal transition, and there is no document-level horizontal overflow.
- Compatibility adjustment: this source report's broad navigation styles could wrap the shared Board label at desktop width. A report-local `white-space: nowrap` rule keeps the shared Report Hub action readable without changing report content.
- Automated checks: `npm run typecheck`, `npm run reports:integrity`, and `npm run reports:view-id-qa` passed. The full `npm test` suite has one pre-existing, repeatable admin analytics test failure that expects the historical date `2026-08-09`; no Worker or analytics source was changed for this upload.
- Anti-slop pre-flight: no new generic UI, fake screenshots, or synthetic visual assets were introduced. The report retains its supplied editorial layout and uses the provided logo as the real archive cover.
