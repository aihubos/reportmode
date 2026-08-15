# LEGO Computer Science & AI K-2 Guide Visual QA

- Report: `260815-lego-csai-k2-purchase-guide`
- Representative image: user-provided LEGO Education Computer Science & AI K-2 product image, 1800 x 1080 PNG.
- Archive check: the first featured card renders the exact report title, links to the folder report route, and loads `assets/thumbnail.png` successfully.
- Report check: at 390 x 844, the Report Hub header, title, product image, and CTA actions fit without document-level horizontal overflow.
- Desktop check: at 1440 x 900, the 1180px hero composition and the report cover render without horizontal overflow.
- Asset check: every image on the report completed loading with a positive natural width.
- Automated checks: `npm run typecheck`, `npm test`, `npm run reports:integrity`, and `npm run reports:view-id-qa` passed.
