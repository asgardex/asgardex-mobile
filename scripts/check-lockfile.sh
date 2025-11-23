#!/bin/bash

set -e

echo "🔍 Scanning yarn.lock for undeclared packages (compared to target branch)..."

# Check dependencies
command -v jq >/dev/null 2>&1 || {
  echo "❌ jq is required but not installed."
  exit 1
}
command -v git >/dev/null 2>&1 || {
  echo "❌ git is required but not installed."
  exit 1
}

TARGET_REMOTE=${TARGET_REMOTE:-upstream}
TARGET_BRANCH=${TARGET_BRANCH:-develop}
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Optional: auto-detect upstream when TARGET_BRANCH=auto
if [[ $TARGET_BRANCH == "auto" ]]; then
  upstream_ref=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)
  if [[ -n $upstream_ref && $upstream_ref == */* ]]; then
    TARGET_REMOTE=${TARGET_REMOTE:-${upstream_ref%%/*}}
    TARGET_BRANCH=${upstream_ref#*/}
  else
    TARGET_BRANCH=$CURRENT_BRANCH
  fi
fi

# Fetch latest target branch
echo "📥 Fetching $TARGET_REMOTE/$TARGET_BRANCH..."
git fetch "$TARGET_REMOTE" "$TARGET_BRANCH" || {
  echo "❌ Failed to fetch $TARGET_BRANCH."
  exit 1
}

# Temp files
tmp_declared=$(mktemp)
tmp_lockfile=$(mktemp)
tmp_diff_report=$(mktemp)

# Read declared deps from package.json in target branch
if ! git show "$TARGET_REMOTE/$TARGET_BRANCH:package.json" >/dev/null 2>&1; then
  echo "❌ package.json not found in $TARGET_REMOTE/$TARGET_BRANCH."
  exit 1
fi
git show "$TARGET_REMOTE/$TARGET_BRANCH:package.json" | jq -r '.dependencies, .devDependencies | keys[]' | sort | uniq >"$tmp_declared"

# Allowlist for intentional additions (e.g., Tauri deps when comparing against develop).
tmp_allowlist=$(mktemp)
trap 'rm -f "$tmp_declared" "$tmp_lockfile" "$tmp_diff_report" "$tmp_allowlist"' EXIT

default_allowlist=()
if [[ $TARGET_BRANCH == "develop" ]]; then
  default_allowlist=(
    @tauri-apps/api
    @tauri-apps/cli
    @tauri-apps/plugin-biometric
    @tauri-apps/plugin-dialog
    @tauri-apps/plugin-fs
    @tauri-apps/plugin-log
    @tauri-apps/plugin-notification
    @tauri-apps/plugin-opener
    @tauri-apps/plugin-store
    tauri-plugin-safe-area-insets
    tauri-plugin-secure-storage
  )
fi

# EXTRA_ALLOWED_PACKAGES can be comma/space separated.
IFS=', ' read -r -a extra_allow <<<"${EXTRA_ALLOWED_PACKAGES-}"
printf "%s\n" "${default_allowlist[@]}" "${extra_allow[@]}" | sed '/^$/d' | sort -u >"$tmp_allowlist"

# Read top-level packages from current yarn.lock
if ! [ -f yarn.lock ]; then
  echo "❌ yarn.lock not found in current branch."
  exit 1
fi
grep -E '^ {0,2}"?[^ "@]+@[^:]+":$' yarn.lock | sed 's/^ *//;s/":$//;s/"//g' | grep -vE '^(workspace|virtual|portal|patch|__metadata)' | cut -d'@' -f1 | sort | uniq >"$tmp_lockfile"

# Compare
undeclared_packages=$(comm -13 "$tmp_declared" "$tmp_lockfile")
if [ -s "$tmp_allowlist" ]; then
  undeclared_packages=$(printf "%s\n" "$undeclared_packages" | grep -vx -f "$tmp_allowlist" || true)
fi

# Was package.json changed?
package_json_changed=$(git diff "$TARGET_REMOTE/$TARGET_BRANCH" HEAD -- package.json | wc -l)

# Diff summary - extract added/removed packages from yarn.lock diff
# Pattern matches lines like: +"@package/name@npm:1.0.0": or -"package@npm:1.0.0":
while IFS= read -r line; do
  # Extract the prefix (+/-) and package info
  prefix="${line:0:1}"
  # Remove prefix, quotes, and trailing colon; extract first package@version
  pkg_line=$(echo "${line:1}" | sed 's/^"//;s/":$//;s/"//g' | cut -d',' -f1)
  pkg=$(echo "$pkg_line" | sed 's/@[^@]*$//')                     # Remove version suffix
  version=$(echo "$pkg_line" | grep -oE '@[^@]+$' | sed 's/^@//') # Extract version
  if [[ -n $pkg && -n $version ]]; then
    echo "$prefix $pkg@$version" >>"$tmp_diff_report"
  fi
done < <(git diff "$TARGET_REMOTE/$TARGET_BRANCH" HEAD -- yarn.lock | grep -E '^[+-]"[^@]+@')

if [ -n "$undeclared_packages" ]; then
  echo "🚨 Undeclared packages in yarn.lock (not in $TARGET_REMOTE/$TARGET_BRANCH package.json):"
  echo "$undeclared_packages" | while read -r pkg; do
    version=$(grep -E "^\"?$pkg@[^:]+\":$" yarn.lock | sed 's/.*@//;s/":$//' | head -n 1)
    echo "- $pkg@$version"
  done
  if [ "$package_json_changed" -eq 0 ]; then
    echo "⚠️ yarn.lock changed, but package.json did not."
  else
    echo "ℹ️ package.json changed — verify additions are intentional."
  fi
  if [ -s "$tmp_diff_report" ]; then
    echo "📈 yarn.lock diff summary:"
    cat "$tmp_diff_report"
  fi
  exit 1
else
  echo "✅ yarn.lock is consistent with package.json."
  if [ "$package_json_changed" -eq 0 ] && git diff "$TARGET_REMOTE/$TARGET_BRANCH" HEAD -- yarn.lock | grep -q .; then
    echo "⚠️ yarn.lock changed but package.json did not. Possibly due to dedupe or version bumps."
    if [ -s "$tmp_diff_report" ]; then
      echo "📈 yarn.lock diff summary:"
      cat "$tmp_diff_report"
    fi
  fi
fi

lock_diff_lines=$(git diff "$TARGET_REMOTE/$TARGET_BRANCH" HEAD -- yarn.lock | wc -l)
if [ "$lock_diff_lines" -gt 100 ]; then
  echo "📝 Large lockfile diff ($lock_diff_lines lines). Suggestions:"
  echo "   - Run 'yarn why <package>'"
  echo "   - Use 'git diff $TARGET_REMOTE/$TARGET_BRANCH HEAD -- yarn.lock'"
  echo "   - Consider 'yarn dedupe'"
fi
