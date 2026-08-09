# Report Hub performance check

Lighthouse was run against the local static archive after visual QA.

| Mode | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Mobile | 62 | 96 | 100 | 100 | 6.2s | 6.3s | 0ms | 0 |
| Desktop | 95 | 96 | 100 | 100 | 1.1s | 1.2s | 0ms | 0.013 |

The mobile score is limited by initial paint time on the existing large archive document, while blocking time and layout shift remain clean. The RH layer adds one small SVG, CSS file, and short idempotent script; further mobile speed work should focus on splitting or reducing the archive payload rather than the brand mark.
