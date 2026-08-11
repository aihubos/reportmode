# Lighthouse evidence

Local production build, three runs per profile on `/archive/`.

| Profile | Performance median | Accessibility | Best Practices | SEO | LCP median | CLS |
|---|---:|---:|---:|---:|---:|---:|
| Desktop | 73 | 96 | 100 | 100 | 2.48s | 0.001 |
| Mobile | 51 | 96 | 100 | 100 | 28.73s | 0.000 |

The mobile LCP remains limited by the known large archive HTML payload containing report search text. The approved plan already separates search-index extraction as a follow-up performance project; the private library and round mobile panels add no public private-report payload and introduced no layout shift.

Raw results are stored locally under `output/lighthouse/private-report-library/`.
