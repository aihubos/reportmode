# Upload Guide — AI 자동화에서 사람이 빠지면 안 되는 세 지점

## Target

- Repository: `aihubos/reportmode`
- Branch: `main`
- Report folder: `reports/260810-33-human-in-the-loop-ai-automation-v1-0-0/`
- Expected Pages URL: `https://aihubos.github.io/reportmode/reports/260810-33-human-in-the-loop-ai-automation-v1-0-0/`
- Status: Published — user requested publication

## Safe upload

1. Review `index.html`, `report.json`, `source-ledger.json`, and both thumbnail files.
2. From the repository root, extract this ZIP so the `reports/` folder merges with the existing tree.
3. Do not overwrite `archive/index.html` or a live sitemap with an empty file.
4. Use root-level `archive-entry.json` and `sitemap-entry.xml` as insertion data after reading the current archive/sitemap.
5. Verify the five shared scripts under `../../assets/` exist in the repository.
6. Commit and push only after final human approval.

## Suggested commands

```bash
git checkout main
git pull --ff-only
unzip AIHUBOS-260810-33-human-in-the-loop-ai-automation-v1-0-0.zip -d .
git status
git add reports/260810-33-human-in-the-loop-ai-automation-v1-0-0 upload-manifest.json archive-entry.json sitemap-entry.xml
git commit -m "Add report: human-in-the-loop-ai-automation v1.0.0"
git push origin main
```

## Final checks

- Thumbnail is 1200×630 PNG and matching SVG.
- Canonical and OG image point to the report folder.
- External source links use `target="_blank" rel="noopener noreferrer"`.
- Mobile 320px has no page-level horizontal scroll; only tables scroll.
- Embedded metadata version and visible version both equal v1.0.0.
