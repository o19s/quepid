#!/usr/bin/env bash
#
# Visual Parity Comparison: deangularjs vs deangularjs-experimental
#
# Fully automated orchestrator that:
# 1. Checks out each branch
# 2. Rebuilds Docker (fresh DB + seed data)
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
BASE_URL="http://localhost:3000"
BRANCHES=("deangularjs" "deangularjs-experimental")

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

  # Check playwright is installed
  if [ ! -d "$PROJECT_ROOT/node_modules/@playwright" ]; then
    warn "Playwright not found. Installing..."
    cd "$PROJECT_ROOT"
    yarn add -D @playwright/test
    npx playwright install chromium
  fi

  # Check for uncommitted changes
  cd "$PROJECT_ROOT"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    warn "You have uncommitted changes. They will be stashed."
    git stash push -m "visual-parity-comparison-$(date +%s)"
    STASHED=true
  else
    STASHED=false
  fi

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
# Capture a single branch
# ---------------------------------------------------------------------------
capture_branch() {
  local branch="$1"

  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Processing branch: $branch"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  cd "$PROJECT_ROOT"

  # 1. Check out branch
  log "Checking out $branch..."
  git checkout "$branch"
  ok "On branch $branch"

  # 2. Full Docker rebuild with fresh seed data
  log "Rebuilding Docker environment (this may take a while)..."
  bin/docker d 2>/dev/null || true   # Tear down any existing containers
  bin/setup_docker
  ok "Docker environment rebuilt"

  # 2b. Ensure Playwright is installed (node_modules may differ per branch)
  if [ ! -d "$PROJECT_ROOT/node_modules/@playwright" ]; then
    log "Installing Playwright for this branch..."
    cd "$PROJECT_ROOT"
    yarn add -D @playwright/test
  fi

  # 3. Start the app in daemon mode (avoids stdin-close issues with background execution)
  log "Starting application..."
  docker compose up --no-deps -d nginx
  bin/docker q

  # 4. Wait for ready
  if ! wait_for_app; then
    fail "App failed to start for $branch"
    kill $APP_PID 2>/dev/null || true
    bin/docker d 2>/dev/null || true
    return 1
  fi

  # 5. Capture screenshots
  log "Capturing screenshots for $branch..."
  node "$SCRIPT_DIR/capture_screenshots.mjs" --branch "$branch" --base-url "$BASE_URL"
  ok "Screenshots captured"

  # 6. Capture API structures
  log "Capturing API structures for $branch..."
  node "$SCRIPT_DIR/compare_apis.mjs" --branch "$branch" --base-url "$BASE_URL"
  ok "API structures captured"

  # 7. Tear down
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

  # Generate API diff
  log "Generating API structure diff..."
  node "$SCRIPT_DIR/compare_apis.mjs" --diff
  ok "API diff complete"

  # Generate report
  log "Generating HTML comparison report..."
  node "$SCRIPT_DIR/generate_report.mjs"
  ok "Report generated"

  # Restore original branch
  cd "$PROJECT_ROOT"
  local current_branch
  current_branch=$(git branch --show-current)
  if [ "$current_branch" != "deangularjs-experimental" ]; then
    log "Returning to deangularjs-experimental branch..."
    git checkout deangularjs-experimental
  fi

  # Restore stashed changes if needed
  if [ "$STASHED" = true ]; then
    log "Restoring stashed changes..."
    git stash pop || warn "Could not restore stash (may have conflicts)"
  fi

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
    capture_branch "$2"
    ;;
  --report)
    log "Generating report only..."
    node "$SCRIPT_DIR/compare_apis.mjs" --diff 2>/dev/null || true
    node "$SCRIPT_DIR/generate_report.mjs"
    ;;
  --help)
    echo "Usage:"
    echo "  $0                      Run full comparison (both branches)"
    echo "  $0 --capture <branch>   Capture a single branch"
    echo "  $0 --report             Generate report from existing captures"
    echo "  $0 --help               Show this help"
    ;;
  *)
    main
    ;;
esac
