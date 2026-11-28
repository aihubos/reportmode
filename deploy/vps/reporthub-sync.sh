#!/usr/bin/env bash
# Report Hub -> aibuilderslab.kr/reporthub/ sync (runs on the Hostinger VPS from cron).
#
# Read-only: clones the PUBLIC repo over https, no credentials. Pulls origin/main and copies the
# site files into the directory nginx serves (/opt/reporthub/current), rewriting the GitHub Pages
# base path (/reportmode/ and https://aihubos.github.io/reportmode) and the old aireport.ai-hub-os.com
# brand URL to https://aibuilderslab.kr/reporthub. The repo itself is NOT modified, so the report
# pipeline (QA scripts, report generation) keeps working unchanged.
#
# Usage: reporthub-sync.sh [--full]   (--full = force a complete re-sync even if nothing changed)
set -euo pipefail

BASE=${REPORTHUB_BASE:-/opt/reporthub}
REPO_URL=${REPORTHUB_REPO_URL:-https://github.com/aihubos/reportmode.git}
SRC="$BASE/repo"
DEST="$BASE/current"
STATE="$BASE/deployed-commit"
LOG="$BASE/logs/sync.log"
NEW_BASE_URL="https://aibuilderslab.kr/reporthub"
FULL=0; [ "${1:-}" = "--full" ] && FULL=1

mkdir -p "$BASE/logs" "$DEST"
exec 9>"$BASE/.lock"
flock -n 9 || { echo "$(date -Is) another sync is running, skip" >> "$LOG"; exit 0; }
log() { echo "$(date -Is) $*" >> "$LOG"; }
# keep the log small
if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG")" -gt 2000000 ]; then tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; fi

# Paths never served (dev/pipeline files, dotfiles, secrets examples). Top-level names only.
is_excluded() {
  case "$1" in
    .*|*/.*) return 0 ;;                                   # any dotfile / dot-directory
    .git/*|.github/*|.superloopy/*|node_modules/*|workers/*|src/*|scripts/*|deploy/*) return 0 ;;
    package.json|package-lock.json|tsconfig.json|.env.example) return 0 ;;
  esac
  return 1
}

# Rewrite base path / host inside text files. Idempotent.
rewrite_file() {
  local f="$1" name="${2:-$1}"
  case "$name" in
    *.html|*.htm|*.js|*.mjs|*.json|*.xml|*.txt|*.webmanifest|*.css|*.svg|*.md) ;;
    *) return 0 ;;
  esac
  grep -Iq . "$f" 2>/dev/null || return 0
  grep -qE 'aihubos\.github\.io/reportmode|aireport\.ai-hub-os\.com|/reportmode/' "$f" 2>/dev/null || return 0
  perl -0pi -e '
    s{https://aihubos\.github\.io/reportmode(?![A-Za-z0-9_-])}{'"$NEW_BASE_URL"'}g;
    s{https://aireport\.ai-hub-os\.com(?![A-Za-z0-9.-])}{'"$NEW_BASE_URL"'}g;
    s{(?<![A-Za-z0-9_./-])/reportmode/}{/reporthub/}g;
  ' "$f"
}

cd "$BASE"
if [ ! -d "$SRC/.git" ]; then
  log "initial shallow clone"
  git clone --depth 1 --quiet "$REPO_URL" "$SRC"
else
  git -C "$SRC" fetch --depth 1 --quiet origin main
fi
NEW=$(git -C "$SRC" rev-parse FETCH_HEAD 2>/dev/null || git -C "$SRC" rev-parse HEAD)
OLD=$(cat "$STATE" 2>/dev/null || true)

if [ "$FULL" = 0 ] && [ -n "$OLD" ] && [ "$OLD" = "$NEW" ]; then exit 0; fi

git -C "$SRC" reset --hard --quiet "$NEW"

if [ "$FULL" = 1 ] || [ -z "$OLD" ] || ! git -C "$SRC" cat-file -e "$OLD^{commit}" 2>/dev/null; then
  log "full sync -> $NEW"
  rsync -a --delete --delete-excluded \
    --exclude='.*' \
    --exclude='/.git/' --exclude='/node_modules/' --exclude='/workers/' --exclude='/src/' \
    --exclude='/scripts/' --exclude='/deploy/' \
    --exclude='/package.json' --exclude='/package-lock.json' --exclude='/tsconfig.json' \
    "$SRC/" "$DEST/"
  # rewrite only text files that mention the old base
  grep -rIlE --exclude-dir=.git 'aihubos\.github\.io/reportmode|aireport\.ai-hub-os\.com|/reportmode/' "$DEST" 2>/dev/null \
    | while IFS= read -r f; do rewrite_file "$f"; done
else
  log "incremental $OLD -> $NEW"
  git -C "$SRC" diff --name-status --no-renames -z "$OLD" "$NEW" > "$BASE/.changes"
  n=0
  while IFS= read -r -d '' status && IFS= read -r -d '' path; do
    is_excluded "$path" && continue
    case "$status" in
      D) rm -f -- "$DEST/$path" ;;
      *) mkdir -p -- "$DEST/$(dirname "$path")"
         # copy to temp name then move, so nginx never serves a half-written file
         cp -f -- "$SRC/$path" "$DEST/$path.tmp-sync"
         rewrite_file "$DEST/$path.tmp-sync" "$path" 2>/dev/null || true
         mv -f -- "$DEST/$path.tmp-sync" "$DEST/$path" ;;
    esac
    n=$((n+1))
  done < "$BASE/.changes"
  log "applied $n changed paths"
fi

echo "$NEW" > "$STATE"
log "done $NEW"
