#!/usr/bin/env bash

# Cross-platform wrapper to run trunk checks in CI or locally

set -euo pipefail

# Default trunk flags
FLAGS="-j8 --ci"

# Detect current Git branch or fallback to main/dev
UPSTREAM_BRANCH="develop"

# Normalize Git paths for all platforms (no color, no paging)
GIT_DIFF="git diff --no-color --no-pager"

# Check for merge request context (GitLab/GitHub/etc.)
if [ -n "${CI_MERGE_REQUEST_ID-}" ] || [ -n "${GITHUB_HEAD_REF-}" ]; then
  echo "Running in merge/pull request context..."

  # Re-run all checks if Trunk config or project setup changes
  if ! $GIT_DIFF --exit-code origin/$UPSTREAM_BRANCH -- .trunk/ package.json yarn.lock >/dev/null 2>&1; then
    FLAGS="$FLAGS --all"
  elif $GIT_DIFF --unified=0 --no-prefix origin/$UPSTREAM_BRANCH | sed '/^@@/d' | grep -q 'trunk-ignore'; then
    FLAGS="$FLAGS --all"
  else
    FLAGS="$FLAGS --upstream origin/$UPSTREAM_BRANCH"
  fi
else
  echo "Running outside of merge/pull request context. Running full check."
  FLAGS="$FLAGS --all"
fi

# Run trunk check
echo "▶ Running: trunk check $FLAGS"
# shellcheck disable=SC2086
trunk check $FLAGS
