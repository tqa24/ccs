#!/usr/bin/env bash
set -euo pipefail

echo "Uninstalling ccs..."
echo ""

# Remove symlink
if [[ -L "$HOME/.local/bin/ccs" ]]; then
  rm "$HOME/.local/bin/ccs"
  echo "✅ Removed: $HOME/.local/bin/ccs"
elif [[ -f "$HOME/.local/bin/ccs" ]]; then
  rm "$HOME/.local/bin/ccs"
  echo "✅ Removed: $HOME/.local/bin/ccs"
else
  echo "ℹ️  No ccs binary found at $HOME/.local/bin/ccs"
fi

# Remove uninstall symlink
if [[ -L "$HOME/.local/bin/ccs-uninstall" ]]; then
  rm "$HOME/.local/bin/ccs-uninstall"
  echo "✅ Removed: $HOME/.local/bin/ccs-uninstall"
fi

# Ask about ~/.ccs directory
if [[ -d "$HOME/.ccs" ]]; then
  read -p "Remove CCS directory ~/.ccs? This includes config and profiles. (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$HOME/.ccs"
    echo "✅ Removed: $HOME/.ccs"
  else
    echo "ℹ️  Kept: $HOME/.ccs"
  fi
else
  echo "ℹ️  No CCS directory found at $HOME/.ccs"
fi

echo ""
echo "✅ Uninstall complete!"
