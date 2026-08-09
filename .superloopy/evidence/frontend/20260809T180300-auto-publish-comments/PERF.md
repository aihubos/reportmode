# Performance record

- The publisher adds links to the existing shared comment assets instead of embedding a second UI bundle.
- `report-comments.css`: 6,028 bytes
- `report-comments.js`: 15,623 bytes
- Total shared comment assets: 21,651 bytes before transfer compression
- No new font, image, framework, or runtime dependency was added.
- Public report verification now checks the comments hook before reporting completion.
