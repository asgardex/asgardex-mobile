#!/bin/bash

set -e

echo "🔍 Scanning yarn.lock for sneaky packages (compared to develop)..."

# Check dependencies
command -v jq >/dev/null 2>&1 || {
  echo "❌ jq is required but not installed."
  exit 1
}
command -v git >/dev/null 2>&1 || {
  echo "❌ git is required but not installed."
  exit 1
}

# Default to 'develop' as target branch, override with env var if set
TARGET_BRANCH=${TARGET_BRANCH:-develop}

# Ensure develop is up to date
echo "📥 Fetching $TARGET_BRANCH..."
git fetch origin "$TARGET_BRANCH" || {
  echo "❌ Failed to fetch $TARGET_BRANCH."
  exit 1
}

# Temp files
tmp_declared=$(mktemp)
tmp_lockfile=$(mktemp)
tmp_diff_report=$(mktemp)

# Cleanup on exit
trap 'rm -f "$tmp_declared" "$tmp_lockfile" "$tmp_diff_report"' EXIT

# Declared packages in develop's package.json
if ! git show "origin/$TARGET_BRANCH:package.json" >/dev/null 2>&1; then
  echo "❌ package.json not found in $TARGET_BRANCH."
  exit 1
fi
git show "origin/$TARGET_BRANCH:package.json" | jq -r '.dependencies, .devDependencies | keys[]' | sort | uniq >"$tmp_declared"

# Top-level packages in current branch's yarn.lock
# Match Yarn 4 package entries like "package-name@version:" or "package-name@npm:version:"
if ! [ -f yarn.lock ]; then
  echo "❌ yarn.lock not found in current branch."
  exit 1
fi
grep -E '^ {0,2}"?[^ "@]+@[^:]+":$' yarn.lock | sed 's/^ *//;s/":$//;s/"//g' | grep -vE '^(workspace|virtual|portal|patch|__metadata)' | cut -d'@' -f1 | sort | uniq >"$tmp_lockfile"

# Diff: packages in yarn.lock but not declared in develop's package.json
sneaky=$(comm -13 "$tmp_declared" "$tmp_lockfile")

# Check if package.json was modified
package_json_changed=$(git diff "origin/$TARGET_BRANCH" HEAD -- package.json | wc -l)

# Generate diff report for added/removed packages
git diff "origin/$TARGET_BRANCH" HEAD -- yarn.lock | grep -E '^[+-] {0,2}"?[^ "@]+@[^:]+":$' | sed 's/^[+-] *//;s/":$//;s/"//g' | while read -r line; do
  pkg=$(echo "$line" | cut -d'@' -f1)
  version=$(echo "$line" | cut -d'@' -f2-)
  if [[ $line == +* ]]; then
    echo "+ $pkg@$version" >>"$tmp_diff_report"
  elif [[ $line == -* ]]; then
    echo "- $pkg@$version" >>"$tmp_diff_report"
  fi
done

# Analyze results
if [ -n "$sneaky" ]; then
  echo "🚨 Sneaky packages detected in yarn.lock (NOT in $TARGET_BRANCH/package.json):"
  echo "$sneaky" | while read -r pkg; do
    version=$(grep -E "^\"?$pkg@[^:]+\":$" yarn.lock | sed 's/.*@//;s/":$//' | head -n 1)
    echo "- $pkg@$version"
  done
  if [ "$package_json_changed" -eq 0 ]; then
    echo "⚠️ Warning: package.json was not modified, but yarn.lock has new packages."
    echo "   Consider running 'yarn install' on $TARGET_BRANCH to compare."
  else
    echo "ℹ️ Note: package.json was modified. Verify these packages are intentionally added."
  fi
  if [ -s "$tmp_diff_report" ]; then
    echo "📈 yarn.lock diff summary:"
    cat "$tmp_diff_report"
  fi
  exit 1
else
  echo "✅ No sneaky packages detected."
  if [ "$package_json_changed" -eq 0 ] && git diff "origin/$TARGET_BRANCH" HEAD -- yarn.lock | grep -q .; then
    echo "⚠️ Warning: yarn.lock changed without package.json changes. Possible lockfile update (e.g., yarn dedupe)."
    echo "   Run 'yarn install' on $TARGET_BRANCH to verify."
    if [ -s "$tmp_diff_report" ]; then
      echo "📈 yarn.lock diff summary:"
      cat "$tmp_diff_report"
    fi
  fi
fi

# Suggest manual review for large yarn.lock diffs
lock_diff_lines=$(git diff "origin/$TARGET_BRANCH" HEAD -- yarn.lock | wc -l)
if [ "$lock_diff_lines" -gt 100 ]; then
  echo "📝 Tip: yarn.lock diff is large ($lock_diff_lines lines). To review:"
  echo "   - Run 'yarn why <package>' for suspect packages."
  echo "   - Use 'git diff origin/$TARGET_BRANCH HEAD -- yarn.lock' to inspect changes."
  echo "   - Consider 'yarn dedupe' to minimize lockfile churn."
fi
