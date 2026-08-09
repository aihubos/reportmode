# Visual QA

- Desktop archive, 1280 x 720: one green Naver card, visitor count, 30-item default, request board in the right rail.
- Mobile archive, 390 x 844: no horizontal overflow (`clientWidth = scrollWidth = 390`), 30 visible reports, one Naver link.
- Portrait report, 1280 x 720 viewport: A4 body stays inside the sheet and the shared floating menu sits in the right gutter.
- Comments: one form per report, three required fields, empty/loading/error states, inline edit and delete panels.
- Automated portrait audit: 45 content reports checked; 45 passed. Criteria: no viewport overflow, one comment section, title at or below 36px, at least 8px menu gutter, and no uncontained visual element outside the A4 sheet.
- Interaction proof: create -> reload -> edit -> reload -> delete -> reload completed against the deployed Worker. The final reload contained no QA comment.
- Admin proof: reserved name rejection, admin edit, admin delete, admin badge, and cleanup all passed against the deployed Worker.

Artifacts:

- `main-desktop.png`
- `main-mobile-390.png`
- `report-a4-portrait.png`
- `report-comments.png`

Design-system check:

- New shared comment CSS passed the Report Hub token and 4px spacing compliance check.
- The repository-wide scan still reports legacy values in older report/archive CSS; those were intentionally not mass-rewritten in this scoped change.
