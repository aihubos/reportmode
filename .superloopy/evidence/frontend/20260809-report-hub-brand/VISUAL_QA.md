# Report Hub visual QA

## Scope

- Public library: `/archive/`
- Upload page: `/archive/upload.html`
- Current structured report: `260806-palantir-business-ai-analysis`
- Latest uploaded report: `260809-19-ai-v1-0-0`
- Previous-version report: `versions/2026-08-09-before-refresh/.../260806-palantir-business-ai-analysis/`

## Viewports

- 390 × 844: `final-archive-390.png`
- 768 × 900: `final-archive-768.png`
- 1280 × 900: `final-archive-1280.png`

## Verified

- The upper-left brand appears once per page.
- The logo uses the monochrome RH mark and links to `https://aireport.ai-hub-os.com/`.
- Browser titles and favicon metadata use Report Hub and RH.
- The request board and archive cards remain visible.
- Current, newly uploaded, and previous-version reports have no horizontal overflow.
- Structured reports still open in wide mode and switch to portrait mode correctly.
- Portrait mode keeps the Palantir title at 28px on a 390px viewport.
- The upload page no longer exposes the removed skill-builder link.
- Browser console showed no runtime error on the library page.

## Issue found and fixed

The first browser pass showed a duplicate floating logo on archive pages. The shared brand loader now recognizes the archive header and does not insert a second report button.

## Design-system check

`ds-compliance.mjs` passed with no spacing or undeclared-color violations. The new RH brand layer contains no gradient or glow styling.
