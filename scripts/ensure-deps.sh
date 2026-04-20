#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="$ROOT_DIR/ui"
UI_SENTINEL="$UI_DIR/node_modules/@date-fns/tz/date/mini.js"

ensure_root_deps() {
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    echo "[deps] Installing root dependencies"
    (cd "$ROOT_DIR" && bun install --frozen-lockfile)
  fi
}

ensure_ui_deps() {
  if [[ -d "$UI_DIR/node_modules" && -f "$UI_SENTINEL" ]]; then
    return
  fi

  echo "[deps] Reinstalling UI dependencies"
  rm -rf "$UI_DIR/node_modules"
  (cd "$UI_DIR" && bun install --frozen-lockfile)
}

ensure_root_deps
ensure_ui_deps
