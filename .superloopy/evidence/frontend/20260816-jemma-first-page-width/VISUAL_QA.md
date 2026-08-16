# Jemma First Page Width QA

- Report: `260816-jemma-selfishclub-operations-benchmarking`
- Issue: the opening `.summary-shell` resolved to full viewport width instead of the established Report Hub desktop report canvas.
- Fix: above 720px, the opening shell uses the source report's established `1180px` maximum and `20px` side gutters. Mobile keeps the source responsive rule.
- Desktop verification at 1280px: opening shell is 1180px wide and begins at x=50px, matching the reference report canvas. No document-level horizontal overflow.
- Tablet verification at 768px: opening shell is 728px wide. Header, title, summary, and image stack remain visible without horizontal overflow.
- Mobile verification at 390px: opening shell is 362px wide. Hero remains visible after the supplied reveal transition and does not overflow.
- Automated checks: `npm run typecheck`, `npm run reports:integrity`, `npm run reports:view-id-qa`, and `git diff --check` passed.
- Anti-slop pre-flight: no new visual language or synthetic content was added. The correction reuses the report's existing 1180px canvas and 40px total gutter values.
