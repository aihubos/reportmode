# Visual and interaction QA

## Scope

- Source HTML contained no comment CSS or script.
- Blog Hub preflight ID: `preflight_20260809085451946_1cbea83b`
- Temporary report ID: `260809-blog-hub-02`
- Publish commit: `0964193144bc5f86445f0918a5e2ec1964a751de`
- Delete commit: `d80226c1ee4364541e6d89a40922ba0c0489dfd5`

## Publication proof

- Pages status was `built` at the publish commit.
- Report, archive, root, and manifest returned the expected report state.
- Required internal resource failures: 0
- Public HTML loaded `report-comments.css` and `report-comments.js` with the correct report ID.

## Comment mutation proof

1. Created one visitor comment.
2. Reloaded and confirmed the comment remained.
3. Edited the comment with its author password.
4. Reloaded and confirmed the edited text remained.
5. Deleted the comment with its author password.
6. Reloaded and confirmed the list returned to 0 comments.
7. Browser console errors and warnings: 0

## Responsive evidence

- `report-comments-1280.png`: desktop, 1280px
- `report-comments-768.png`: tablet, 768px
- `report-comments-390.png`: mobile, 390px
- Comment fields, submit action, count, edit action, and delete action remained visible without horizontal overflow.

## Cleanup proof

- The temporary report was deleted through the supported publisher API.
- Pages status was `built` at the delete commit.
- The deleted report returned HTTP 404.
- Archive and manifest contained no `260809-blog-hub-02` entry.

## Anti-slop preflight

- Existing Toss Blue palette, typography, spacing, radius, and component tokens were retained.
- No new gradient, glow, font, layout family, decorative icon, or placeholder visual was introduced.
- No new visible copy contains an em dash.
