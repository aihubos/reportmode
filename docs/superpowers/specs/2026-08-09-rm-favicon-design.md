# RM Favicon Design

## Goal

Replace the temporary single-letter Report Mode favicon with a reusable `RM` monogram that matches the archive brand.

## Visual Specification

- Canvas: square, transparent outside the rounded tile
- Tile: solid `#3182F6`, rounded corners
- Mark: centered uppercase `RM`, white, bold sans-serif
- Effects: no gradient, shadow, border, texture, or secondary symbol
- Priority: legibility at 16px and 32px

## Integration

- Store the canonical vector at `assets/favicon.svg`.
- Use the same asset on the archive, root redirect page, generated report pages, and reports that rely on the shared view-counter script.
- Keep all existing page layout and behavior unchanged.

## Success Criteria

- The browser resolves a real favicon asset instead of `data:,` or the old `R` data URI.
- The favicon displays `RM` in white on the exact archive blue.
- The archive and a representative report render without console or asset errors.

