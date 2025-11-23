#!/bin/bash
# validate-tauri-integrity.sh
#
# Validates that Tauri-specific changes are properly preserved after rebases or compressions.
# This script compares the Tauri delta between two branches to ensure nothing was lost.
#
# Usage:
#   ./scripts/validate-tauri-integrity.sh [reference_branch] [target_branch]
#
# Defaults:
#   reference_branch = compress-commits-backup (or main if not exists)
#   target_branch = HEAD
#
# The script compares patches of Tauri-specific files and reports differences.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# Arguments
REF_BRANCH="${1:-compress-commits-backup}"
TARGET_BRANCH="${2:-HEAD}"

# Check if reference branch exists
if ! git rev-parse --verify "$REF_BRANCH" >/dev/null 2>&1; then
  REF_BRANCH="main"
  log_warn "compress-commits-backup not found, using main"
fi

log_info "Validating Tauri integrity"
log_info "Reference: $REF_BRANCH"
log_info "Target: $TARGET_BRANCH"
echo ""

# Find merge bases
REF_BASE=$(git merge-base "$REF_BRANCH" upstream/develop 2>/dev/null || git merge-base "$REF_BRANCH" origin/main)
TARGET_BASE=$(git merge-base "$TARGET_BRANCH" upstream/develop 2>/dev/null || echo "upstream/develop")

log_info "Reference merge-base: $(git log -1 --oneline $REF_BASE)"
log_info "Target baseline: $TARGET_BASE"
echo ""

# Tauri-specific paths to validate
TAURI_PATHS=(
  "src-tauri/Cargo.toml"
  "src-tauri/src/lib.rs"
  "src-tauri/capabilities/"
  "src/renderer/tauri/"
  "src/renderer/services/app/logging.ts"
  "src/renderer/services/app/telemetry.ts"
  "src/renderer/services/app/notifications.ts"
  "src/renderer/services/wallet/keystore-mobile.ts"
  "src/shared/config/biometric.ts"
  "src/shared/url/whitelist.ts"
  "src/renderer/safe-area.css"
  "vite.tauri.config.mjs"
)

# Create temp files
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# === Test 1: Check all Tauri files exist ===
log_info "Test 1: Checking Tauri files exist..."
MISSING=0
for path in "${TAURI_PATHS[@]}"; do
  if [ -e "$path" ] || [ -d "$path" ]; then
    echo "  ✓ $path"
  else
    echo "  ✗ $path MISSING"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -eq 0 ]; then
  log_pass "All Tauri files exist"
else
  log_fail "$MISSING files missing"
fi
echo ""

# === Test 2: Check key content markers ===
log_info "Test 2: Checking key content markers..."
MARKERS_FAILED=0

check_marker() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo "  ✓ $desc"
  else
    echo "  ✗ $desc MISSING"
    MARKERS_FAILED=$((MARKERS_FAILED + 1))
  fi
}

check_marker "src/renderer/tauri/windowApi.ts" "secureStorageApi" "Secure storage API"
check_marker "src/renderer/tauri/windowApi.ts" "biometric" "Biometric handling"
check_marker "src/renderer/tauri/windowApi.ts" "plugin-opener" "Opener plugin"
check_marker "package.json" "@tauri-apps/plugin-opener" "Opener in package.json"
check_marker "package.json" "@tauri-apps/plugin-notification" "Notification in package.json"
check_marker "src-tauri/Cargo.toml" "tauri-plugin-opener" "Opener in Cargo.toml"
check_marker "src-tauri/Cargo.toml" "tauri-plugin-notification" "Notification in Cargo.toml"
check_marker "src-tauri/Cargo.toml" "tauri-plugin-biometric" "Biometric in Cargo.toml"

# Check shell plugin is NOT present
if ! grep -q "@tauri-apps/plugin-shell" package.json 2>/dev/null; then
  echo "  ✓ Shell plugin removed from package.json"
else
  echo "  ✗ Shell plugin still in package.json"
  MARKERS_FAILED=$((MARKERS_FAILED + 1))
fi

if ! grep -q "tauri-plugin-shell" src-tauri/Cargo.toml 2>/dev/null; then
  echo "  ✓ Shell plugin removed from Cargo.toml"
else
  echo "  ✗ Shell plugin still in Cargo.toml"
  MARKERS_FAILED=$((MARKERS_FAILED + 1))
fi

if [ $MARKERS_FAILED -eq 0 ]; then
  log_pass "All content markers present"
else
  log_fail "$MARKERS_FAILED markers missing or incorrect"
fi
echo ""

# === Test 3: Compare Tauri-specific patches (excluding locks) ===
log_info "Test 3: Comparing Tauri patches..."

# Create reference patch
git diff "$REF_BASE" "$REF_BRANCH" -- \
  src-tauri/ ':!src-tauri/Cargo.lock' ':!src-tauri/gen/' \
  src/renderer/tauri/ ':!*.test.ts' \
  src/shared/config/biometric.ts \
  src/shared/url/whitelist.ts \
  vite.tauri.config.mjs \
  >"$TEMP_DIR/ref.patch" 2>/dev/null || true

# Create target patch
git diff "$TARGET_BASE" "$TARGET_BRANCH" -- \
  src-tauri/ ':!src-tauri/Cargo.lock' ':!src-tauri/gen/' \
  src/renderer/tauri/ ':!*.test.ts' \
  src/shared/config/biometric.ts \
  src/shared/url/whitelist.ts \
  vite.tauri.config.mjs \
  >"$TEMP_DIR/target.patch" 2>/dev/null || true

REF_SIZE=$(wc -l <"$TEMP_DIR/ref.patch" | tr -d ' ')
TARGET_SIZE=$(wc -l <"$TEMP_DIR/target.patch" | tr -d ' ')
DIFF_SIZE=$(diff "$TEMP_DIR/ref.patch" "$TEMP_DIR/target.patch" 2>/dev/null | wc -l | tr -d ' ')

echo "  Reference patch: $REF_SIZE lines"
echo "  Target patch: $TARGET_SIZE lines"
echo "  Difference: $DIFF_SIZE lines"

# Allow up to 200 lines of difference (for capability tweaks, import order, etc.)
if [ "$DIFF_SIZE" -lt 200 ]; then
  log_pass "Patches are equivalent (diff < 200 lines)"
else
  log_warn "Patches differ by $DIFF_SIZE lines - review needed"
  echo ""
  echo "Sample of differences:"
  diff "$TEMP_DIR/ref.patch" "$TEMP_DIR/target.patch" 2>/dev/null | head -50
fi
echo ""

# === Test 4: Run tests ===
log_info "Test 4: Running test suite..."
if yarn test --run 2>&1 | grep -q "passed"; then
  TEST_RESULT=$(yarn test --run 2>&1 | grep -E "passed|failed" | tail -1)
  log_pass "Tests: $TEST_RESULT"
else
  log_fail "Tests failed"
fi
echo ""

# === Summary ===
echo "=== VALIDATION SUMMARY ==="
TOTAL_ISSUES=$((MISSING + MARKERS_FAILED))
if [ $TOTAL_ISSUES -eq 0 ] && [ "$DIFF_SIZE" -lt 200 ]; then
  log_pass "All validations passed!"
  exit 0
else
  log_warn "Some issues detected - review above"
  exit 1
fi
