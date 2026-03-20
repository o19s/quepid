#!/usr/bin/env bash
#
# Visual Parity Comparison (Playwright screenshots + JSON API shape diff + HTML report)
#
# Fully automated orchestrator that:
# 1. Optionally prompts when prior worktrees exist (reuse vs delete)
# 2. Uses git worktrees for each comparison branch (full run never switches your main checkout)
# 3. Boots an isolated Compose project (quepid-vp) with non-default ports + nginx on :8080
# 4. Runs bin/setup_docker + yarn build, then captures screenshots and API structures
# 5. Generates report.html
#
# Usage:
#   bash test/visual_parity/run_comparison.sh
#
# Prerequisites: Docker, Node 20+, Yarn; Playwright browsers (see preflight / package.json).
#
# Branches default to main vs deangularjs-incremental. Override with:
#   VISUAL_PARITY_BRANCHES="main other-branch" bash test/visual_parity/run_comparison.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GIT_ROOT="$(cd "$PROJECT_ROOT" && git rev-parse --show-toplevel)"

BASE_URL_VP="${VISUAL_PARITY_BASE_URL:-http://localhost:3010}"
export VP_COMPOSE_PROJECT_NAME="${VP_COMPOSE_PROJECT_NAME:-quepid-vp}"
export VP_COMPOSE_FILE="docker-compose.yml:docker-compose.visual-parity.yml"

if [ -n "${VISUAL_PARITY_BRANCHES:-}" ]; then
  # shellcheck disable=SC2206
  BRANCHES=($VISUAL_PARITY_BRANCHES)
else
  BRANCHES=("main" "deangularjs-incremental")
fi

# Pin browser downloads under the repo (inside gitignored node_modules). Cursor/sandbox may set
# PLAYWRIGHT_BROWSERS_PATH to /tmp/... where installs never land for a normal shell.
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$GIT_ROOT/node_modules/.cache/ms-playwright}"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"

WT_BASE="$(dirname "$GIT_ROOT")"
WT_SUFFIX="-visual-parity-wt"

# Track active branch root so the trap can tear down on interrupt
_VP_ACTIVE_BRANCH_ROOT=""

cleanup_on_exit() {
  if [ -n "$_VP_ACTIVE_BRANCH_ROOT" ] && [ -d "$_VP_ACTIVE_BRANCH_ROOT" ]; then
    warn "Interrupted — tearing down Docker for VP..."
    (cd "$_VP_ACTIVE_BRANCH_ROOT" && \
      COMPOSE_PROJECT_NAME="$VP_COMPOSE_PROJECT_NAME" \
      COMPOSE_FILE="$VP_COMPOSE_FILE" \
      bin/docker d 2>/dev/null) || true
  fi
}
trap cleanup_on_exit INT TERM

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
warn()  { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠️  $*${NC}"; }
ok()    { echo -e "${GREEN}[$(date +%H:%M:%S)] ✅ $*${NC}"; }
fail()  { echo -e "${RED}[$(date +%H:%M:%S)] ❌ $*${NC}"; }

get_worktree_path() {
  local branch="$1"
  local safe_name="${branch//\//-}"
  echo "${WT_BASE}/quepid${WT_SUFFIX}-${safe_name}"
}

# $1 branch, $2 = "1" to allow GIT_ROOT when it matches current branch (--capture only)
get_branch_root() {
  local branch="$1"
  local allow_cwd_if_match="${2:-}"
  local current_branch
  current_branch=$(cd "$GIT_ROOT" && git branch --show-current)
  # Use the main repo if the branch is already checked out there
  if [ "$current_branch" = "$branch" ]; then
    if [ "$allow_cwd_if_match" = "1" ] || [ "$allow_cwd_if_match" = "true" ]; then
      echo "$GIT_ROOT"
      return
    fi
    # Even in full-run mode, git won't create a worktree for the current branch,
    # so fall back to the main repo.
    warn "Branch $branch is already checked out at $GIT_ROOT; using it directly" >&2
    echo "$GIT_ROOT"
    return
  fi
  local wt_path
  wt_path=$(get_worktree_path "$branch")
  if [ -d "$wt_path" ]; then
    echo "$wt_path"
    return
  fi
  log "Creating worktree for $branch at $wt_path..." >&2
  cd "$GIT_ROOT"
  # worktree add echoes "HEAD is now at…" to stdout; must not pollute $(get_branch_root) capture
  if ! git worktree add "$wt_path" "$branch" >/dev/null 2>&1; then
    fail "Could not create worktree for $branch at $wt_path" >&2
    return 1
  fi
  ok "Worktree created" >&2
  echo "$wt_path"
}

check_existing_worktrees() {
  local wt_path
  for branch in "${BRANCHES[@]}"; do
    wt_path=$(get_worktree_path "$branch")
    if [ -d "$wt_path" ]; then
      return 0
    fi
  done
  return 1
}

prompt_worktree_action() {
  if ! check_existing_worktrees; then
    return 0
  fi

  warn "Visual parity worktrees already exist:"
  local wt_path
  for branch in "${BRANCHES[@]}"; do
    wt_path=$(get_worktree_path "$branch")
    if [ -d "$wt_path" ]; then
      echo "  - $wt_path"
    fi
  done
  echo ""

  if [ ! -t 0 ]; then
    log "Not a TTY; defaulting to reuse existing worktrees"
    return 0
  fi

  while true; do
    read -r -p "Reuse (r) or delete (d)? [r/d]: " choice
    case "${choice,,}" in
      r|reuse|"")
        log "Reusing existing worktrees"
        return 0
        ;;
      d|delete)
        log "Removing worktrees..."
        local wt_path
        for branch in "${BRANCHES[@]}"; do
          wt_path=$(get_worktree_path "$branch")
          if [ -d "$wt_path" ]; then
            cd "$GIT_ROOT"
            git worktree remove "$wt_path" --force 2>/dev/null || warn "Could not remove $wt_path"
          fi
        done
        ok "Worktrees removed"
        return 0
        ;;
      *)
        echo "Please enter 'r' (reuse) or 'd' (delete)"
        ;;
    esac
  done
}

preflight() {
  log "Running pre-flight checks..."

  if ! command -v node &> /dev/null; then
    fail "Node.js is required but not found"
    exit 1
  fi

  if ! command -v docker &> /dev/null; then
    fail "Docker is required but not found"
    exit 1
  fi

  if ! command -v git &> /dev/null; then
    fail "Git is required but not found"
    exit 1
  fi

  if [ ! -d "$GIT_ROOT/node_modules/@playwright/test" ]; then
    warn "@playwright/test missing from node_modules. Run: cd \"$GIT_ROOT\" && yarn install"
    exit 1
  fi

  if [ ! -f "$GIT_ROOT/node_modules/.bin/playwright" ]; then
    warn "Playwright CLI not found. After yarn install, run: cd \"$GIT_ROOT\" && npx playwright install chromium"
    exit 1
  fi

  playwright_chromium_ok() {
    (cd "$GIT_ROOT" && node --input-type=module -e "
import fs from 'fs';
import { chromium } from '@playwright/test';
const p = chromium.executablePath();
process.exit(typeof p === 'string' && p && fs.existsSync(p) ? 0 : 1);
" 2>/dev/null)
  }

  if ! playwright_chromium_ok; then
    log "Playwright Chromium missing under PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH"
    log "Running: npx playwright install chromium (needs network)..."
    (cd "$GIT_ROOT" && npx playwright install chromium) || {
      fail "playwright install chromium failed. Run: cd \"$GIT_ROOT\" && npx playwright install chromium"
      exit 1
    }
  fi

  if ! playwright_chromium_ok; then
    fail "Chromium still missing after install. Check PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH"
    exit 1
  fi

  ok "Pre-flight checks passed"
}

wait_for_app() {
  local base_url="${1:-$BASE_URL_VP}"
  local probe_path="${VISUAL_PARITY_HEALTH_PATH:-/healthcheck}"
  # Use an unauthenticated endpoint; GET / can return 403 in some host/SSL setups while the app is fine.
  local probe_url="${base_url%/}${probe_path}"
  local max_attempts=120
  local attempt=0

  log "Waiting for app (probing $probe_url; first boot can take several minutes)..."
  while [ $attempt -lt $max_attempts ]; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "$probe_url" 2>/dev/null || echo "000")
    # 2xx/3xx => stack is answering (health may redirect in some setups; Playwright follows redirects)
    if echo "$code" | grep -qE '^[23][0-9]{2}$'; then
      ok "App is ready (HTTP $code)"
      return 0
    fi
    [ "$attempt" -lt 3 ] && log "  (attempt $((attempt + 1)): HTTP $code)"
    attempt=$((attempt + 1))
    sleep 5
  done

  fail "App did not become ready after ~$((max_attempts * 5))s of polling"
  warn "Diagnostics:"
  docker compose ps 2>/dev/null || true
  docker ps -a --filter "name=quepid-vp" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
  warn "Last 80 lines of app/nginx logs:"
  docker compose logs --tail=80 app nginx 2>/dev/null || true
  echo "  curl $probe_url -> $(curl -s -o /dev/null -w '%{http_code}' "$probe_url" 2>/dev/null || echo 'failed')"
  return 1
}

capture_branch() {
  local branch="$1"
  local allow_cwd="${2:-}"
  local branch_root
  branch_root=$(get_branch_root "$branch" "$allow_cwd")

  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Processing branch: $branch (root: $branch_root)"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ -f "$GIT_ROOT/docker-compose.visual-parity.yml" ]; then
    if [ "$branch_root" != "$GIT_ROOT" ]; then
      log "Copying VP compose files to worktree..."
      cp "$GIT_ROOT/docker-compose.visual-parity.yml" "$branch_root/"
      cp "$GIT_ROOT/nginx.vp.conf" "$branch_root/"
    fi
  elif [ ! -f "$branch_root/docker-compose.visual-parity.yml" ]; then
    fail "docker-compose.visual-parity.yml not found at GIT_ROOT ($GIT_ROOT). Run from the repo that contains VP files."
    return 1
  fi

  cd "$branch_root"
  _VP_ACTIVE_BRANCH_ROOT="$branch_root"
  export COMPOSE_PROJECT_NAME="$VP_COMPOSE_PROJECT_NAME"
  export COMPOSE_FILE="$VP_COMPOSE_FILE"

  log "Rebuilding Docker environment (this may take a while)..."
  bin/docker d 2>/dev/null || true
  bin/setup_docker

  log "Building frontend assets once for visual parity (no Procfile.dev watchers)..."
  bin/docker r yarn build

  if [ "$branch_root" = "$GIT_ROOT" ]; then
    log "Ensuring test database exists (main repo)..."
    bin/docker r bin/rake db:test:prepare
  fi
  ok "Docker environment rebuilt"

  # Foreman stops all processes if any proc exits; Procfile.dev watchers are unsafe in detached mode.
  cat > "$branch_root/Procfile.vp" <<'EOF'
web: bundle exec puma -C config/puma.rb -b tcp://0.0.0.0:3000
worker: bundle exec bin/jobs
EOF

  log "Starting application (puma + jobs + nginx)..."
  docker compose up -d app
  docker compose up --no-deps -d nginx

  if ! wait_for_app "$BASE_URL_VP"; then
    fail "App failed to start for $branch"
    bin/docker d 2>/dev/null || true
    return 1
  fi

  cd "$GIT_ROOT"
  log "Capturing screenshots for $branch..."
  node "$GIT_ROOT/test/visual_parity/capture_screenshots.mjs" --branch "$branch" --base-url "$BASE_URL_VP" \
    --email "quepid+realisticactivity@o19s.com" --password "password"
  ok "Screenshots captured"

  log "Capturing API structures for $branch..."
  node "$GIT_ROOT/test/visual_parity/compare_apis.mjs" --branch "$branch" --base-url "$BASE_URL_VP" \
    --email "quepid+realisticactivity@o19s.com" --password "password"
  ok "API structures captured"

  cd "$branch_root"
  log "Tearing down Docker for $branch..."
  bin/docker d 2>/dev/null || true
  _VP_ACTIVE_BRANCH_ROOT=""
  ok "Docker torn down"
  log ""
}

main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║     Visual Parity Comparison Tool                    ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
  echo "  Comparing: ${BRANCHES[0]}  ↔  ${BRANCHES[1]}"
  echo ""

  preflight
  prompt_worktree_action

  if [ "${#BRANCHES[@]}" -ne 2 ]; then
    fail "Exactly two branches are required. Set VISUAL_PARITY_BRANCHES=\"branch-a branch-b\" (space-separated)."
    exit 1
  fi

  local start_time=$SECONDS

  for branch in "${BRANCHES[@]}"; do
    capture_branch "$branch"
  done

  cd "$GIT_ROOT"
  export VISUAL_PARITY_BRANCH_A="${BRANCHES[0]}"
  export VISUAL_PARITY_BRANCH_B="${BRANCHES[1]}"
  log "Generating API structure diff..."
  node "$GIT_ROOT/test/visual_parity/compare_apis.mjs" --diff
  ok "API diff complete"

  log "Generating HTML comparison report..."
  node "$GIT_ROOT/test/visual_parity/generate_report.mjs"
  ok "Report generated"

  local elapsed=$(( SECONDS - start_time ))
  local minutes=$(( elapsed / 60 ))
  local seconds=$(( elapsed % 60 ))

  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  ✅ Comparison complete!                             ║"
  echo "║                                                      ║"
  echo "║  Open the report:                                    ║"
  echo "║  test/visual_parity/report.html                      ║"
  echo "║                                                      ║"
  printf "║  Time elapsed: %dm %ds                              ║\n" "$minutes" "$seconds"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
}

case "${1:-}" in
  --capture)
    if [ -z "${2:-}" ]; then
      fail "Usage: $0 --capture <branch_name>"
      exit 1
    fi
    preflight
    capture_branch "$2" "1"
    ;;
  --report)
    log "Generating report only..."
    cd "$GIT_ROOT"
    if [ "${#BRANCHES[@]}" -eq 2 ]; then
      export VISUAL_PARITY_BRANCH_A="${BRANCHES[0]}"
      export VISUAL_PARITY_BRANCH_B="${BRANCHES[1]}"
    else
      warn "VISUAL_PARITY_BRANCHES is not exactly two names; diff/report will pick dirs lexicographically or use CLI on compare_apis."
    fi
    node "$GIT_ROOT/test/visual_parity/compare_apis.mjs" --diff 2>/dev/null || true
    node "$GIT_ROOT/test/visual_parity/generate_report.mjs"
    ;;
  --remove-worktrees)
    log "Removing visual parity worktrees..."
    for branch in "${BRANCHES[@]}"; do
      _vp_wt=$(get_worktree_path "$branch")
      if [ -d "$_vp_wt" ]; then
        cd "$GIT_ROOT"
        git worktree remove "$_vp_wt" --force 2>/dev/null || warn "Could not remove $_vp_wt (cd to main repo first if you're inside it)"
      fi
    done
    unset _vp_wt
    ok "Done"
    ;;
  --help|-h)
    echo "Usage:"
    echo "  $0                      Run full comparison (${BRANCHES[*]} by default)"
    echo "  $0 --capture <branch>   Capture one branch (uses main repo dir if already on that branch)"
    echo "  $0 --report             Build report from existing screenshots + api_structures"
    echo "  $0 --remove-worktrees   Remove worktrees created for this tool"
    echo "  $0 --help               This help"
    echo ""
    echo "Environment:"
    echo "  VISUAL_PARITY_BRANCHES=\"a b\"   Two branch names to compare (space-separated)"
    echo "  VISUAL_PARITY_BASE_URL=...       Default http://localhost:8080 (nginx from VP compose)"
    echo "  VISUAL_PARITY_HEALTH_PATH=...    Default /healthcheck (readiness probe path)"
    echo "  PLAYWRIGHT_BROWSERS_PATH=...     Default \$GIT_ROOT/node_modules/.cache/ms-playwright"
    echo "  VP_COMPOSE_PROJECT_NAME           Default quepid-vp"
    echo ""
    echo "Worktrees: ${WT_BASE}/quepid${WT_SUFFIX}-<branch>"
    echo "Requires: docker-compose.visual-parity.yml + nginx.vp.conf at repo root; yarn + @playwright/test."
    ;;
  *)
    main
    ;;
esac
