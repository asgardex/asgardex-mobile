#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

declare -a PATHS_TO_REMOVE=(
  "build"
  "src-tauri/target"
  "src-tauri/gen/android/.gradle"
  "src-tauri/gen/android/build"
  "src-tauri/gen/android/app/build"
  "src-tauri/gen/android/app/.cxx"
  "src-tauri/gen/android/app/.externalNativeBuild"
  "src-tauri/gen/apple/build"
  "src-tauri/gen/apple/Externals"
  "src-tauri/gen/apple/asgardex-tauri.xcodeproj/project.xcworkspace/xcuserdata"
)

echo "Cleaning Tauri build artifacts..."

for rel_path in "${PATHS_TO_REMOVE[@]}"; do
  abs_path="$ROOT_DIR/$rel_path"
  if [[ -e $abs_path ]]; then
    echo " - removing $rel_path"
    rm -rf "$abs_path"
  fi
done

DIST_DIR="$ROOT_DIR/dist"
if [[ -d $DIST_DIR ]]; then
  echo " - pruning dist/"
  shopt -s nullglob
  for entry in "$DIST_DIR"/*; do
    name="$(basename "$entry")"
    if [[ $name == "android" && -d "$entry/releases" ]]; then
      find "$entry" -mindepth 1 -maxdepth 1 ! -name "releases" -exec rm -rf {} +
    else
      rm -rf "$entry"
    fi
  done
  shopt -u nullglob
fi

echo "Tauri build artifacts cleaned."
