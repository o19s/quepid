#!/bin/bash

# Script to clean up old Renovate branches
# Usage: ./bin/cleanup_renovate_branches.sh [--dry-run]

set -e

DRY_RUN=false

# Parse arguments
if [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  echo "🔍 DRY RUN MODE - No branches will be deleted"
  echo ""
fi

# Fetch latest remote info
echo "Fetching remote branches..."
git fetch --prune

# Get all renovate branches
RENOVATE_BRANCHES=$(git branch -r | grep "origin/renovate/" | sed 's|origin/||' || true)

if [ -z "$RENOVATE_BRANCHES" ]; then
  echo "✅ No Renovate branches found to clean up"
  exit 0
fi

# Count branches
BRANCH_COUNT=$(echo "$RENOVATE_BRANCHES" | wc -l | tr -d ' ')
echo "Found $BRANCH_COUNT Renovate branches:"
echo ""
echo "$RENOVATE_BRANCHES"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "To delete these branches, run without --dry-run:"
  echo "  ./bin/cleanup_renovate_branches.sh"
  exit 0
fi

# Confirm deletion
read -p "Do you want to delete all these branches? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# Delete branches
echo ""
echo "Deleting branches..."
DELETED=0
FAILED=0

while IFS= read -r branch; do
  if git push origin --delete "$branch" 2>/dev/null; then
    echo "✅ Deleted: $branch"
    ((DELETED++))
  else
    echo "❌ Failed to delete: $branch"
    ((FAILED++))
  fi
done <<< "$RENOVATE_BRANCHES"

echo ""
echo "Summary:"
echo "  Deleted: $DELETED"
echo "  Failed: $FAILED"
echo ""
echo "✨ Done!"