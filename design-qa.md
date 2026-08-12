# Report Hub logo design QA

- source visual truth: `/Users/JeremyLee/.codex/attachments/ed1779c2-6830-4ffd-8962-5d21fc66b4aa/레포트 허브.png`
- implementation routes: `/archive/`, `/board/`, `/reports/260812-ai-knowledge-self-assessment/`
- desktop viewport: 1440 x 900 CSS px, device scale 1
- mobile viewport: 390 x 844 CSS px, device scale 1 (archive header)
- source pixels: 2172 x 724
- optimized logo pixels: 950 x 215, transparent background
- state: default top-of-page header, wide/detail report mode

## Full-view comparison evidence

- The source mark and REPORT / HUB lockup were preserved as one supplied image asset.
- Large surrounding white margins were removed before placement; the source artwork itself was not redrawn.
- Desktop archive rendered the logo at 196 x 44 CSS px with no horizontal overflow.
- Desktop board and representative report loaded the same shared asset with no legacy text wordmark.
- Mobile archive rendered the logo at 142 x 32 CSS px; document width stayed within the viewport.

## Focused region comparison evidence

- Typography: embedded REPORT / HUB letterforms come directly from the supplied image, so no substitute font was introduced.
- Spacing: desktop uses a 204 x 56 px click target around the 196 x 44 px logo; mobile uses a 142 x 32 px image inside the existing touch-safe header.
- Colors: the supplied glass blue mark and navy letters were preserved.
- Image quality: source was cropped, downsampled with Lanczos, and made transparent; natural size is 950 x 215 and all tested pages reported the image as complete.
- Copy: `by Jeremy` and the former HTML wordmark were removed from all 249 public/draft report entry pages plus archive, board, upload, admin, and private pages. A bundled source-reference HTML file remains intentionally untouched because it is not a public entry route.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- The mobile report shell uses its own wide-canvas presentation behavior; the shared logo still follows the common compact rule when the shell enters its existing mobile breakpoint.

## Comparison history

1. Initial source inspection found excessive white margin around the supplied logo.
2. Fixed by cropping to the visible lockup, scaling to 950 x 215, and removing the white background.
3. Post-fix desktop and mobile captures confirmed readable proportions, completed image loads, no `by Jeremy`, and no archive horizontal overflow.

## Implementation checklist

- [x] Shared image asset added to source and generated public assets.
- [x] Shared renderer and runtime script use the image logo.
- [x] Archive, board, report, upload, admin, and private pages use the same logo.
- [x] Existing content reports were normalized to the new logo.
- [x] Legacy `by Jeremy` and text wordmark removed.
- [x] Desktop and mobile header checks completed.

final result: passed
