#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# CCS Installation Script
# ============================================================================

# --- Configuration ---
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
SHARE_DIR="$HOME/.local/share/ccs"
CLAUDE_DIR="$HOME/.claude"
GLM_MODEL="glm-4.6"

# Resolve script directory (handles both file-based and piped execution)
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  SCRIPT_DIR="$(cd "$(dirname "${0:-$PWD}")" && pwd)"
fi

# Detect installation method (git vs standalone)
# Check if ccs executable exists in SCRIPT_DIR (real git install)
# Don't just check .git (user might run curl | bash inside their own git repo)
if [[ -f "$SCRIPT_DIR/ccs" ]]; then
  INSTALL_METHOD="git"
else
  INSTALL_METHOD="standalone"
fi

# --- Helper Functions ---

detect_current_provider() {
  local settings="$CLAUDE_DIR/settings.json"
  if [[ ! -f "$settings" ]]; then
    echo "unknown"
    return
  fi

  if grep -q "api.z.ai\|glm-4" "$settings" 2>/dev/null; then
    echo "glm"
  elif grep -q "ANTHROPIC_BASE_URL" "$settings" 2>/dev/null && ! grep -q "api.z.ai" "$settings" 2>/dev/null; then
    echo "custom"
  else
    echo "claude"
  fi
}

create_glm_template() {
  cat << EOF
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY_HERE",
    "ANTHROPIC_MODEL": "$GLM_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "$GLM_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "$GLM_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "$GLM_MODEL"
  }
}
EOF
}

create_sonnet_template() {
  cat << 'EOF'
{
  "env": {}
}
EOF
}

atomic_mv() {
  local src="$1"
  local dest="$2"
  if mv "$src" "$dest" 2>/dev/null; then
    return 0
  else
    rm -f "$src"
    echo "  ❌ Error: Failed to create $dest (check permissions)"
    exit 1
  fi
}

create_glm_profile() {
  local current_settings="$CLAUDE_DIR/settings.json"
  local glm_settings="$CLAUDE_DIR/glm.settings.json"
  local provider="$1"

  if [[ "$provider" == "glm" ]]; then
    echo "✓ Copying current GLM config to profile..."
    if command -v jq &> /dev/null; then
      if jq '.env |= (. // {}) + {
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "'"$GLM_MODEL"'"
      }' "$current_settings" > "$glm_settings.tmp" 2>/dev/null; then
        atomic_mv "$glm_settings.tmp" "$glm_settings"
        echo "  Created: $glm_settings (with your existing API key + enhanced settings)"
      else
        rm -f "$glm_settings.tmp"
        cp "$current_settings" "$glm_settings"
        echo "  Created: $glm_settings (copied as-is, jq enhancement failed)"
      fi
    else
      cp "$current_settings" "$glm_settings"
      echo "  Created: $glm_settings (copied as-is, jq not available)"
    fi
  else
    echo "Creating GLM profile template at $glm_settings"
    if [[ -f "$current_settings" ]] && command -v jq &> /dev/null; then
      if jq '.env |= (. // {}) + {
        "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
        "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY_HERE",
        "ANTHROPIC_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "'"$GLM_MODEL"'",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "'"$GLM_MODEL"'"
      }' "$current_settings" > "$glm_settings.tmp" 2>/dev/null; then
        atomic_mv "$glm_settings.tmp" "$glm_settings"
      else
        rm -f "$glm_settings.tmp"
        echo "  ℹ️  jq failed, using basic template"
        create_glm_template > "$glm_settings"
      fi
    else
      create_glm_template > "$glm_settings"
    fi
    echo "  Created: $glm_settings"
    echo "  ⚠️  Edit this file and replace YOUR_GLM_API_KEY_HERE with your actual GLM API key"
  fi
}

create_sonnet_profile() {
  local current_settings="$CLAUDE_DIR/settings.json"
  local sonnet_settings="$CLAUDE_DIR/sonnet.settings.json"
  local provider="$1"

  if [[ "$provider" == "claude" ]]; then
    echo "✓ Copying current Claude config to profile..."
    cp "$current_settings" "$sonnet_settings"
    echo "  Created: $sonnet_settings"
  else
    echo "Creating Claude Sonnet profile template at $sonnet_settings"
    if [[ -f "$current_settings" ]] && command -v jq &> /dev/null; then
      if jq 'del(.env.ANTHROPIC_BASE_URL, .env.ANTHROPIC_AUTH_TOKEN, .env.ANTHROPIC_MODEL) |
          if (.env | length) == 0 then .env = {} else . end' "$current_settings" > "$sonnet_settings.tmp" 2>/dev/null; then
        atomic_mv "$sonnet_settings.tmp" "$sonnet_settings"
      else
        rm -f "$sonnet_settings.tmp"
        echo "  ℹ️  jq failed, using basic template"
        create_sonnet_template > "$sonnet_settings"
      fi
    else
      create_sonnet_template > "$sonnet_settings"
    fi
    echo "  Created: $sonnet_settings"
    echo "  ℹ️  This uses your Claude subscription (no API key needed)"
  fi
}

# --- Main Installation ---

echo "Installing ccs to $INSTALL_DIR..."
echo ""

# Create directories
mkdir -p "$INSTALL_DIR" "$SHARE_DIR"

# Install main executable
if [[ "$INSTALL_METHOD" == "standalone" ]]; then
  # Standalone install - download ccs from GitHub
  if ! command -v curl &> /dev/null; then
    echo "❌ Error: curl is required for standalone installation"
    exit 1
  fi

  echo "Fetching ccs executable..."
  if curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs -o "$SHARE_DIR/ccs"; then
    chmod +x "$SHARE_DIR/ccs"
    ln -sf "$SHARE_DIR/ccs" "$INSTALL_DIR/ccs"
  else
    echo "❌ Error: Failed to download ccs from GitHub"
    exit 1
  fi
else
  # Git install - use local ccs file
  chmod +x "$SCRIPT_DIR/ccs"
  ln -sf "$SCRIPT_DIR/ccs" "$INSTALL_DIR/ccs"
fi

if [[ ! -L "$INSTALL_DIR/ccs" ]]; then
  echo "❌ Error: Failed to create symlink at $INSTALL_DIR/ccs"
  echo "Check directory permissions and try again."
  exit 1
fi

# Install uninstall script
if [[ -f "$SCRIPT_DIR/uninstall.sh" ]]; then
  cp "$SCRIPT_DIR/uninstall.sh" "$SHARE_DIR/uninstall.sh"
  chmod +x "$SHARE_DIR/uninstall.sh"
  ln -sf "$SHARE_DIR/uninstall.sh" "$INSTALL_DIR/ccs-uninstall"
elif [[ "$INSTALL_METHOD" == "standalone" ]] && command -v curl &> /dev/null; then
  echo "Fetching uninstall script..."
  curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/uninstall.sh -o "$SHARE_DIR/uninstall.sh"
  chmod +x "$SHARE_DIR/uninstall.sh"
  ln -sf "$SHARE_DIR/uninstall.sh" "$INSTALL_DIR/ccs-uninstall"
fi

# Check PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo "⚠️  Warning: $INSTALL_DIR is not in PATH"
  echo ""
  echo "Add to your shell profile (~/.bashrc or ~/.zshrc):"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

echo "✅ Installation complete!"
echo ""

# --- Profile Setup ---

CURRENT_PROVIDER=$(detect_current_provider)
GLM_SETTINGS="$CLAUDE_DIR/glm.settings.json"
SONNET_SETTINGS="$CLAUDE_DIR/sonnet.settings.json"

[[ "$CURRENT_PROVIDER" != "unknown" ]] && echo "🔍 Detected current provider: $CURRENT_PROVIDER" && echo ""

# Create missing profiles
if [[ ! -f "$GLM_SETTINGS" ]] || [[ ! -f "$SONNET_SETTINGS" ]]; then
  echo "📝 Setup wizard: Creating profile files..."
  echo ""

  [[ ! -f "$GLM_SETTINGS" ]] && create_glm_profile "$CURRENT_PROVIDER" && echo ""
  [[ ! -f "$SONNET_SETTINGS" ]] && create_sonnet_profile "$CURRENT_PROVIDER" && echo ""
fi

# Create ccs config
if [[ ! -f "$HOME/.ccs.json" ]]; then
  echo "Creating ~/.ccs.json config..."
  cat > "$HOME/.ccs.json.tmp" << 'EOF'
{
  "profiles": {
    "glm": "~/.claude/glm.settings.json",
    "son": "~/.claude/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
EOF
  if [[ ! -f "$HOME/.ccs.json" ]]; then
    atomic_mv "$HOME/.ccs.json.tmp" "$HOME/.ccs.json"
    echo "  ✓ Created: ~/.ccs.json"
  else
    rm -f "$HOME/.ccs.json.tmp"
    echo "  ℹ️  Config already exists"
  fi
  echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "Quick start:"
echo ""
echo "Example:"
echo "  ccs           # Uses default profile"
echo "  ccs glm       # Uses GLM profile"
echo "  ccs son       # Uses Claude Sonnet profile"
echo "  ccs son --verbose"
echo ""
echo "To uninstall: ccs-uninstall"
