# Report Hub on the VPS (https://aibuilderslab.kr/reporthub/)

Report Hub moved from GitHub Pages (`https://aihubos.github.io/reportmode/`) to the Hostinger VPS.

## How it is served
- Files: `/opt/reporthub/current` (read-only bind mount at `/srv/reporthub` in the `aibuilderslab-web` nginx container).
- nginx: see `nginx-reporthub.conf` (`/reporthub` -> 301 `/reporthub/` via `rewrite ... permanent` so the redirect stays relative behind the Cloudflare tunnel, `location ^~ /reporthub/`). Config file: `/opt/aibuilderslab/nginx.conf`; mount added in `/opt/aibuilderslab/docker-compose.yml`.
- The repo is not changed for the new base path. `reporthub-sync.sh` rewrites, **only in the served copy**:
  - `https://aihubos.github.io/reportmode` -> `https://aibuilderslab.kr/reporthub`
  - root-absolute `/reportmode/` -> `/reporthub/`
  - the brand URL `https://aireport.ai-hub-os.com` -> `https://aibuilderslab.kr/reporthub`
  so report generation and the QA scripts (which expect `/reportmode/`) keep working unchanged.
- Not served: dotfiles, `.github`, `workers/`, `src/`, `scripts/`, `deploy/`, `node_modules/`, `package*.json`, `tsconfig.json`.

## Auto-deploy
Cron on the VPS (root), every 5 minutes:

    */5 * * * * /opt/reporthub/reporthub-sync.sh >/dev/null 2>&1

The script does a read-only shallow `git fetch` of the public repo over https (no credentials), and if
`origin/main` moved, applies only the changed files (`git diff old new`), rewrites them and removes
deleted ones. Log: `/opt/reporthub/logs/sync.log`. Last deployed commit: `/opt/reporthub/deployed-commit`.
Force a complete re-sync: `/opt/reporthub/reporthub-sync.sh --full`.

A new report pushed to `main` is therefore live within ~5 minutes (+ nginx `expires 5m`).

## Dynamic features (comments, view counter, request board, admin)
They call the Cloudflare Worker `reportmode-request-board`. The worker only answers CORS for origins in its
allow-list, so `https://aibuilderslab.kr` was added to `workers/report-request-board/src/{index,lounge-platform,private-reports}.ts`
and `admin-analytics.ts`. **The worker must be redeployed (`wrangler deploy`) for these features to work on the new host.**
