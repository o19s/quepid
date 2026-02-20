#!/usr/bin/env bash
#
# Visual Parity Comparison: deangularjs vs deangularjs-experimental
#
# Fully automated orchestrator that:
# 1. Uses git worktrees so each branch runs in its own directory (no branch switching)
# 2. Rebuilds Docker per worktree (fresh DB + seed data)
# 3. Captures screenshots and API structures
# 4. Generates an HTML comparison report
#
# Usage:
#   bash test/visual_parity/run_comparison.sh
#
# Prerequisites:
#   yarn add -D @playwright/test
#   npx playwright install chromium

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Main repo root (resolves correctly from worktrees)
GIT_ROOT="$(cd "$PROJECT_ROOT" && git rev-parse --show-toplevel)"
BASE_URL="http://localhost:3000"
BRANCHES=("deangularjs" "deangularjs-experimental")
# Worktrees live next to the main repo
WT_BASE="$(dirname "$GIT_ROOT")"
WT_SUFFIX="-visual-parity-wt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()   { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
warn()  { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠️  $*${NC}"; }
ok()    { echo -e "${GREEN}[$(date +%H:%M:%S)] ✅ $*${NC}"; }
fail()  { echo -e "${RED}[$(date +%H:%M:%S)] ❌ $*${NC}"; }

# ---------------------------------------------------------------------------
# Worktree management
# ---------------------------------------------------------------------------
get_worktree_path() {
  local branch="$1"
  # Sanitize branch name for directory (e.g. deangularjs-experimental -> deangularjs-experimental)
  local safe_name="${branch//\//-}"
  echo "${WT_BASE}/quepid${WT_SUFFIX}-${safe_name}"
}

ensure_worktree() {
  local branch="$1"
  local wt_path
  wt_path=$(get_worktree_path "$branch")
  if [ -d "$wt_path" ]; then
    log "Worktree for $branch already exists at $wt_path"
    return 0
  fi
  log "Creating worktree for $branch at $wt_path..."
  cd "$GIT_ROOT"
  git worktree add "$wt_path" "$branch"
  ok "Worktree created"
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
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

  # Check playwright is installed (in main repo / current project)
  if [ ! -d "$GIT_ROOT/node_modules/@playwright" ]; then
    warn "Playwright not found. Installing in $GIT_ROOT..."
    cd "$GIT_ROOT"
    yarn add -D @playwright/test
    npx playwright install chromium
  fi

  # No stash needed: we use worktrees, so the main repo is never switched
  ok "Pre-flight checks passed"
}

# ---------------------------------------------------------------------------
# Wait for the app to be ready
# ---------------------------------------------------------------------------
wait_for_app() {
  local max_attempts=60
  local attempt=0

  log "Waiting for app at $BASE_URL..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" 2>/dev/null | grep -q "200\|302"; then
      ok "App is ready"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 5
  done

  fail "App did not become ready within $((max_attempts * 5)) seconds"
  return 1
}

# ---------------------------------------------------------------------------
# Capture a single branch (runs from its worktree)
# ---------------------------------------------------------------------------
capture_branch() {
  local branch="$1"
  local wt_path
  wt_path=$(get_worktree_path "$branch")

  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Processing branch: $branch (worktree: $wt_path)"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  ensure_worktree "$branch"

  # 1. Full Docker rebuild with fresh seed data (from worktree)
  cd "$wt_path"
  log "Rebuilding Docker environment (this may take a while)..."
  bin/docker d 2>/dev/null || true   # Tear down any existing containers
  bin/setup_docker
  ok "Docker environment rebuilt"

  # 2. Start the app in daemon mode
  log "Starting application..."
  docker compose up --no-deps -d nginx
  bin/docker q

  # 3. Wait for ready
  if ! wait_for_app; then
    fail "App failed to start for $branch"
    bin/docker d 2>/dev/null || true
    return 1
  fi

  # 4. Capture screenshots and API (run from main repo; app is at localhost:3000)
  cd "$GIT_ROOT"
  log "Capturing screenshots for $branch..."
  node "$GIT_ROOT/test/visual_parity/capture_screenshots.mjs" --branch "$branch" --base-url "$BASE_URL" \
    --email "quepid+realisticactivity@o19s.com" --password "password"
  ok "Screenshots captured"

  log "Capturing API structures for $branch..."
  node "$GIT_ROOT/test/visual_parity/compare_apis.mjs" --branch "$branch" --base-url "$BASE_URL" \
    --email "quepid+realisticactivity@o19s.com" --password "password"
  ok "API structures captured"

  # 5. Tear down (from worktree)
  cd "$wt_path"
  log "Tearing down Docker for $branch..."
  bin/docker d 2>/dev/null || true
  ok "Docker torn down"

  log ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║     Visual Parity Comparison Tool                   ║"
  echo "║     deangularjs vs deangularjs-experimental         ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""

  preflight

  local start_time=$SECONDS

  # Capture each branch
  for branch in "${BRANCHES[@]}"; do
    capture_branch "$branch"
  done

  # Generate API diff and report (from main repo)
  cd "$GIT_ROOT"
  log "Generating API structure diff..."
  node "$GIT_ROOT/test/visual_parity/compare_apis.mjs" --diff
  ok "API diff complete"

  log "Generating HTML comparison report..."
  node "$GIT_ROOT/test/visual_parity/generate_report.mjs"
  ok "Report generated"

  # Main repo is never switched; no stash/restore needed
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

# Allow running individual steps
case "${1:-}" in
  --capture)
    if [ -z "${2:-}" ]; then
      fail "Usage: $0 --capture <branch_name>"
      exit 1
    fi
    preflight
    capture_branch "$2"
    ;;
  --report)
    log "Generating report only..."
    cd "$GIT_ROOT"
    node "$GIT_ROOT/test/visual_parity/compare_apis.mjs" --diff 2>/dev/null || true
    node "$GIT_ROOT/test/visual_parity/generate_report.mjs"
    ;;
  --remove-worktrees)
    log "Removing visual parity worktrees..."
    for branch in "${BRANCHES[@]}"; do
      wt_path=$(get_worktree_path "$branch")
      if [ -d "$wt_path" ]; then
        cd "$GIT_ROOT"
        git worktree remove "$wt_path" --force 2>/dev/null || warn "Could not remove $wt_path (cd to main repo first if you're inside it)"
      fi
    done
    ok "Done"
    ;;
  --help)
    echo "Usage:"
    echo "  $0                      Run full comparison (both branches, using worktrees)"
    echo "  $0 --capture <branch>   Capture a single branch"
    echo "  $0 --report             Generate report from existing captures"
    echo "  $0 --remove-worktrees    Remove worktrees created for comparison"
    echo "  $0 --help               Show this help"
    echo ""
    echo "Worktrees are created at: ${WT_BASE}/quepid${WT_SUFFIX}-<branch>"
    echo "They persist between runs for faster re-captures. Use --remove-worktrees to clean up."
    ;;
  *)
    main
    ;;
esac
