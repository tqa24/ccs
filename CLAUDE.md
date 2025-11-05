# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCS (Claude Code Switch) is a lightweight CLI wrapper enabling instant profile switching between Claude Sonnet 4.5 and GLM 4.6 models. The tool delegates to the official Claude CLI via the `--settings` flag, supporting both Unix-like systems (bash) and Windows (PowerShell).

**Primary Installation Methods** (highest priority):
- **npm Package** (recommended): `npm install -g @kaitranntt/ccs` (cross-platform)
- macOS/Linux: `curl -fsSL ccs.kaitran.ca/install | bash`
- Windows: `irm ccs.kaitran.ca/install | iex`

## Core Design Principles

**YAGNI** (You Aren't Gonna Need It): No features "just in case"
**KISS** (Keep It Simple): Simple bash/PowerShell, no complexity
**DRY** (Don't Repeat Yourself): One source of truth (config.json)

The tool does ONE thing: map profile names to Claude settings files. Never add features that violate these principles.

## Key Constraints

1. **NO EMOJIS in terminal output** - Use ASCII symbols ([OK], [!], [X], [i]) for compatibility
2. **TTY-aware color output** - Colors only when output to terminal, respects NO_COLOR env var
3. **Unified install location** (v2.2.0+):
   - All Unix: `~/.local/bin` (auto PATH config, no sudo)
   - Windows: `%USERPROFILE%\.ccs`
4. **Auto PATH configuration** - Detects shell (bash/zsh/fish), adds to profile automatically
5. **Idempotent installations** - Running install scripts multiple times must be safe
6. **Non-invasive** - Never modify `~/.claude/settings.json`
7. **Cross-platform parity** - Identical behavior on Unix/Linux/macOS/Windows
8. **Edge case handling** - Handle all scenarios gracefully (see tests/edge-cases.sh)

## Architecture

**Core Flow** (common to both npm and traditional install):
```
User: ccs [profile] [claude-args]
  ↓
Read ~/.ccs/config.json
  ↓
Lookup profile → settings file path
  ↓
Validate settings file exists
  ↓
Execute: claude --settings <path> [args]
```

**Implementation Variants**:
- **npm package**: Pure Node.js (bin/ccs.js) using child_process.spawn
- **Traditional install**: Platform-specific bash (lib/ccs) or PowerShell (lib/ccs.ps1)

**Key Files**:
- `package.json`: npm package manifest with bin field configuration and postinstall script
- `bin/ccs.js`: Cross-platform Node.js entry point (npm package)
- `scripts/postinstall.js`: Auto-creates config files during npm install (idempotent)
- `lib/ccs` (bash) / `lib/ccs.ps1` (PowerShell): Platform-specific executable wrappers
- `installers/install.sh` / `installers/install.ps1`: Traditional installation scripts
- `installers/uninstall.sh` / `installers/uninstall.ps1`: Removal scripts
- `VERSION`: Single source of truth for version (format: MAJOR.MINOR.PATCH)
- `.claude/`: Commands and skills for Claude Code integration

**npm Package Architecture** (Pure Node.js):
```
npm install -g @kaitranntt/ccs
  ↓
npm runs postinstall: scripts/postinstall.js
  ├─ Create ~/.ccs/ directory
  ├─ Create config.json (if missing)
  └─ Create glm.settings.json (if missing)
  ↓
npm creates ccs command (symlink to bin/ccs.js)
  ↓
User: ccs [profile] [claude-args]
  ↓
bin/ccs.js (pure Node.js, cross-platform):
  ├─ Parse arguments and detect profile
  ├─ Read ~/.ccs/config.json (via config-manager.js)
  ├─ Get settings path for profile
  ├─ Detect claude CLI location (via claude-detector.js)
  └─ spawn('claude', ['--settings', settingsPath, ...args])
```

**Traditional Installer Architecture** (Bash/PowerShell):
```
curl -fsSL ccs.kaitran.ca/install | bash  # or irm install | iex
  ↓
installers/install.sh (or install.ps1)
  ├─ Create ~/.ccs/ directory
  ├─ Copy lib/ccs (or lib/ccs.ps1)
  ├─ Create config.json
  ├─ Create glm.settings.json
  └─ Create symlink ~/.local/bin/ccs → ~/.ccs/ccs
  ↓
User: ccs [profile] [claude-args]
  ↓
lib/ccs (bash) or lib/ccs.ps1 (PowerShell):
  ├─ Read ~/.ccs/config.json (jq or ConvertFrom-Json)
  ├─ Get settings path for profile
  └─ exec claude --settings <path> [args]
```

**Installation Creates**:

**Executable Locations**:
- macOS / Linux: `~/.local/bin/ccs` (symlink to `~/.ccs/ccs`)
- Windows: `%USERPROFILE%\.ccs\ccs.ps1`

**Configuration Directory**:
```
~/.ccs/
├── ccs                     # Main executable (or ccs.ps1 on Windows)
├── config.json             # Profile mappings
├── config.json.backup      # Single backup (overwrites on each install)
├── glm.settings.json       # GLM profile template
├── VERSION                 # Version file copy
├── uninstall.sh            # Uninstaller (or ccs-uninstall.ps1 on Windows)
└── .claude/                # Claude Code integration
    ├── commands/ccs.md
    └── skills/ccs-delegation/
```

## Development Commands

### Version Management
```bash
# Bump version (updates VERSION, install.sh, install.ps1)
./scripts/bump-version.sh [major|minor|patch]

# Get current version
cat VERSION
# or
./scripts/get-version.sh
```

### Testing
```bash
# Comprehensive edge case testing (Unix)
./tests/edge-cases.sh

# Comprehensive edge case testing (Windows)
./tests/edge-cases.ps1
```

### Local Development
```bash
# Test local installation from git repo
./installers/install.sh

# Test with local executable
./ccs --version
./ccs glm --help

# Test npm package locally
npm pack                    # Creates kai-ccs-X.Y.Z.tgz
npm install -g kai-ccs-X.Y.Z.tgz  # Test installation
ccs --version               # Verify it works
npm uninstall -g @kaitranntt/ccs   # Cleanup
rm kai-ccs-X.Y.Z.tgz        # Remove tarball

# Clean test environment
rm -rf ~/.ccs
```

### npm Package Publishing
```bash
# First-time setup (one-time)
npm login                   # Login to npm account
npm token create --type=granular --scope=publish  # Create token
# Add NPM_TOKEN to GitHub Secrets

# Publishing workflow
./scripts/bump-version.sh patch  # Bump version
git add VERSION package.json lib/ccs lib/ccs.ps1 installers/install.sh installers/install.ps1
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z  # Triggers GitHub Actions publish

# Manual publish (if needed)
npm publish --dry-run    # Test before publishing
npm publish --access public  # Publish to npm registry
```

## Code Standards

### Bash (Unix Systems)
- Compatibility: bash 3.2+ (macOS default)
- Always quote variables: `"$VAR"` not `$VAR`
- Use `[[ ]]` for tests, not `[ ]`
- Use `#!/usr/bin/env bash` shebang
- Set `set -euo pipefail` for safety
- Dependencies: Only `jq` for JSON parsing

### Terminal Output
- **TTY Detection**: Check `[[ -t 2 ]]` before using colors (stderr)
- **NO_COLOR Support**: Respect `${NO_COLOR:-}` environment variable
- **ASCII Symbols Only**: [OK], [!], [X], [i] - no emojis
- **Error Formatting**: Use box borders (╔═╗║╚╝) for critical messages
- **Color Codes**: RED, YELLOW, GREEN, CYAN, BOLD, RESET - disable when not TTY

### PowerShell (Windows)
- Compatibility: PowerShell 5.1+
- Use `$ErrorActionPreference = "Stop"`
- Native JSON parsing via `ConvertFrom-Json` / `ConvertTo-Json`
- No external dependencies required

### Version Synchronization
When changing version, update ALL three locations:
1. `VERSION` file
2. `installers/install.sh` (CCS_VERSION variable)
3. `installers/install.ps1` ($CcsVersion variable)

Use `./scripts/bump-version.sh` to update all locations atomically.

## Critical Implementation Details

### Profile Detection Logic
The `ccs` wrapper uses smart detection:
- No args OR first arg starts with `-` → use default profile
- First arg doesn't start with `-` → treat as profile name
- Special flags handled BEFORE profile detection: `--version`, `-v`, `--help`, `-h`
- WIP: `--install` / `--uninstall` flags disabled pending .claude/ integration testing

### Installation Modes
- **Git mode**: Running from cloned repository (symlinks executables)
- **Standalone mode**: Running via curl/irm (downloads from GitHub)

Detection: Check if `ccs` executable exists in script directory or parent.

### Idempotency Requirements
Install scripts must be safe to run multiple times:
- Check existing files before creating
- Use single backup file (no timestamps): `config.json.backup`
- Skip existing `.claude/` folder installation
- Handle both clean and existing installations

### Settings File Format
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your_api_key",
    "ANTHROPIC_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6"
  }
}
```

All values must be strings (not booleans/objects) to prevent PowerShell crashes.

## Common Tasks

### Adding a New Feature
1. Verify it aligns with YAGNI/KISS/DRY principles
2. Implement for both bash and PowerShell
3. Test on all platforms (macOS, Linux, Windows)
4. Update tests in `tests/edge-cases.sh` and `tests/edge-cases.ps1`
5. Update relevant documentation in `docs/`

### Fixing Bugs
1. Add test case reproducing the bug
2. Fix in both bash and PowerShell versions
3. Verify fix doesn't break existing tests
4. Test on all supported platforms

### Releasing New Version
1. Run `./scripts/bump-version.sh [major|minor|patch]`
2. Review changes to VERSION, install.sh, install.ps1
3. Test installation from both git and standalone modes
4. Run full edge case test suite
5. Commit and tag: `git tag v<VERSION>`

## Testing Requirements

Before any PR, verify:
- [ ] Works on macOS (bash)
- [ ] Works on Linux (bash)
- [ ] Works on Windows (PowerShell)
- [ ] Works on Windows (Git Bash)
- [ ] Handles all edge cases in test suite
- [ ] Installation is idempotent
- [ ] No emojis in terminal output (ASCII symbols only)
- [ ] Version displayed correctly with install location
- [ ] Colors work on TTY, disabled when piped
- [ ] NO_COLOR environment variable respected
- [ ] Auto PATH config works for bash, zsh, fish
- [ ] Shell reload instructions shown correctly
- [ ] PATH not duplicated on multiple installs
- [ ] Manual PATH setup instructions clear if auto fails

## Integration with Claude Code

The `.claude/` folder contains:
- `/ccs` command: Meta-command for delegating tasks to different models
- `ccs-delegation` skill: Intelligent task delegation patterns

**WIP**: Installation via `ccs --install` disabled pending .claude/ integration testing

## Error Handling Philosophy

- Validate early, fail fast with clear error messages
- Show available options when user makes mistake
- Suggest recovery steps (e.g., restore from backup)
- Never leave system in broken state
