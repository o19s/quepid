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
# PROJECT_ROOT: directory containing test/ (where script lives). Used to find git root.
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# GIT_ROOT: git worktree root. When run from main repo = main repo path; when run from a worktree = that worktree path. Used for running capture scripts and writing output.
GIT_ROOT="$(cd "$PROJECT_ROOT" && git rev-parse --show-toplevel)"
# Visual parity uses its own Docker project (quepid-vp) with different ports to avoid
# conflicting with the main quepid stack. Hit app directly on 3010 (run container publishes it).
BASE_URL_DEFAULT="http://localhost:3000"
BASE_URL_VP="http://localhost:3010"
# Env for docker compose when running visual parity (isolated from main quepid)
export VP_COMPOSE_PROJECT_NAME="quepid-vp"
export VP_COMPOSE_FILE="docker-compose.yml:docker-compose.visual-parity.yml"
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
  local safe_name="${branch//\//-}"
  echo "${WT_BASE}/quepid${WT_SUFFIX}-${safe_name}"
}

# Returns the path to use for a branch.
# For full comparison: always uses worktree (never GIT_ROOT) so the main repo is never touched.
# For --capture <branch>: uses GIT_ROOT when already on that branch (convenience), else worktree.
# $1 = branch name, $2 = "1" or "true" to allow GIT_ROOT when on that branch (--capture only)
get_branch_root() {
  local branch="$1"
  local allow_cwd_if_match="${2:-}"
  local current_branch
  current_branch=$(cd "$GIT_ROOT" && git branch --show-current)
  if [ "$allow_cwd_if_match" = "1" ] || [ "$allow_cwd_if_match" = "true" ]; then
    if [ "$current_branch" = "$branch" ]; then
      echo "$GIT_ROOT"
      return
    fi
  fi
  local wt_path
  wt_path=$(get_worktree_path "$branch")
  if [ -d "$wt_path" ]; then
    echo "$wt_path"
    return
  fi
  # This function is used in command substitution; keep logs on stderr
  # so stdout contains only the resolved path.
  log "Creating worktree for $branch at $wt_path..." >&2
  cd "$GIT_ROOT"
  git worktree add "$wt_path" "$branch"
  ok "Worktree created" >&2
  echo "$wt_path"
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
  local base_url="${1:-$BASE_URL_DEFAULT}"
  local max_attempts=120
  local attempt=0

  log "Waiting for app at $base_url (asset builds can take 2–5 min)..."
  sleep 30
  while [ $attempt -lt $max_attempts ]; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "$base_url" 2>/dev/null || echo "000")
    if echo "$code" | grep -q "200\|302"; then
      ok "App is ready"
      return 0
    fi
    [ $attempt -lt 3 ] && log "  (attempt $((attempt + 1)): HTTP $code)"
    attempt=$((attempt + 1))
    sleep 5
  done

  fail "App did not become ready within $((max_attempts * 5)) seconds"
  warn "Diagnostics:"
  docker compose ps 2>/dev/null || true
  docker ps -a --filter "name=quepid-vp" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
  warn "Last 80 lines of app/nginx logs:"
  docker compose logs --tail=80 app nginx 2>/dev/null || true
  echo "  curl $base_url -> $(curl -s -o /dev/null -w '%{http_code}' "$base_url" 2>/dev/null || echo 'failed')"
  return 1
}

# ---------------------------------------------------------------------------
# Capture a single branch (runs from its worktree)
# ---------------------------------------------------------------------------
capture_branch() {
  local branch="$1"
  local allow_cwd="${2:-}"
  local branch_root
  branch_root=$(get_branch_root "$branch" "$allow_cwd")

  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Processing branch: $branch (root: $branch_root)"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Ensure VP compose files exist in branch_root (worktrees may not have them if created before VP was added).
  # Always copy from GIT_ROOT so worktrees get the latest override (e.g. !override for ports).
  if [ -f "$GIT_ROOT/docker-compose.visual-parity.yml" ]; then
    # Skip copy when capturing current branch from GIT_ROOT.
    if [ "$branch_root" != "$GIT_ROOT" ]; then
      log "Copying VP compose files to worktree..."
      cp "$GIT_ROOT/docker-compose.visual-parity.yml" "$branch_root/"
      cp "$GIT_ROOT/nginx.vp.conf" "$branch_root/"
    fi
  elif [ ! -f "$branch_root/docker-compose.visual-parity.yml" ]; then
    fail "docker-compose.visual-parity.yml not found. Run from main repo or ensure VP files are in your branch."
    return 1
  fi

  # 1. Full Docker rebuild with fresh seed data (uses isolated quepid-vp project)
  cd "$branch_root"
  export COMPOSE_PROJECT_NAME="$VP_COMPOSE_PROJECT_NAME"
  export COMPOSE_FILE="$VP_COMPOSE_FILE"
  log "Rebuilding Docker environment (this may take a while)..."
  bin/docker d 2>/dev/null || true   # Tear down any existing VP containers only
  bin/setup_docker
  log "Building frontend assets once for visual parity..."
  bin/docker r yarn build
  # When using main repo (--capture on current branch), setup_docker wipes volumes
  # and only creates dev DB. Ensure test DB exists so we don't leave a dirty state.
  if [ "$branch_root" = "$GIT_ROOT" ]; then
    log "Ensuring test database exists (main repo)..."
    bin/docker r bin/rake db:test:prepare
  fi
  ok "Docker environment rebuilt"

  # 2. Start the app in daemon mode
  # Use a minimal Procfile for VP runs. Foreman stops all processes if any one exits;
  # one-shot/watch build processes in Procfile.dev can exit in detached mode and kill app.
  cat > "$branch_root/Procfile.vp" <<'EOF'
web: bundle exec puma -C config/puma.rb -b tcp://0.0.0.0:3000
worker: bundle exec bin/jobs
EOF
  log "Starting application..."
  docker compose up -d app
  docker compose up --no-deps -d nginx

  # 3. Wait for ready
  if ! wait_for_app "$BASE_URL_VP"; then
    fail "App failed to start for $branch"
    bin/docker d 2>/dev/null || true
    return 1
  fi

  # 4. Capture screenshots and API (run from main repo; app is at localhost:3010 for VP)
  cd "$GIT_ROOT"
  log "Capturing screenshots for $branch..."
  node "$GIT_ROOT/test/visual_parity/capture_screenshots.mjs" --branch "$branch" --base-url "$BASE_URL_VP" \
    --email "quepid+realisticactivity@o19s.com" --password "password"
  ok "Screenshots captured"

  log "Capturing API structures for $branch..."
  node "$GIT_ROOT/test/visual_parity/compare_apis.mjs" --branch "$branch" --base-url "$BASE_URL_VP" \
    --email "quepid+realisticactivity@o19s.com" --password "password"
  ok "API structures captured"

  # 5. Tear down
  cd "$branch_root"
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
    capture_branch "$2" "1"
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
