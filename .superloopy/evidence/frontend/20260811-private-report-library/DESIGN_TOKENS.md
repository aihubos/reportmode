# Design-token compliance

Command:

```bash
node /Users/JeremyLee/.codex/skills/superloopy-frontend/scripts/ds-compliance.mjs \
  DESIGN.md \
  src/site/assets/archive-private-library.css \
  src/site/assets/private-report-viewer.css \
  src/site/assets/archive-admin-console.css
```

Result: pass, zero undeclared colors and zero off-scale spacing violations.

The new mobile taxonomy panel was kept in the token-compliant shared archive asset instead of adding new raw colors or spacing values to the legacy magazine stylesheet.
