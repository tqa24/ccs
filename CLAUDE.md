# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

CCS (Claude Code Switch): CLI wrapper for instant switching between multiple Claude accounts (work, personal, team) and alternative models (GLM 4.6, Kimi). Built on v3.1 login-per-profile architecture with shared data support.

**Core function**: Switch Claude accounts/models without manual config editing.

## Design Principles

- **YAGNI**: No features "just in case"
- **KISS**: Simple bash/PowerShell/Node.js, no complexity
- **DRY**: One source of truth (config.json)
- **CLI-First**: Command-line primary interface

## Critical Constraints

1. **NO EMOJIS** - ASCII only: [OK], [!], [X], [i]
2. **TTY-aware colors** - Respect NO_COLOR env var
3. **Install locations**:
   - Unix: `~/.local/bin` (auto PATH, no sudo)
   - Windows: `%USERPROFILE%\.ccs`
4. **Auto PATH config** - Detect shell (bash/zsh/fish), add automatically
5. **Idempotent installs** - Safe to run multiple times
6. **Non-invasive** - Never modify `~/.claude/settings.json`
7. **Cross-platform parity** - Identical behavior everywhere
8. **CLI documentation** - ALL changes MUST update `--help` in bin/ccs.js, lib/ccs, lib/ccs.ps1

## Architecture

### v3.5 GLMT Tool Support & Streaming

**Tool support added**: MCP tools and function calling fully supported

**Streaming support added**: Real-time delivery of reasoning content and tool calls

**Architecture**: Embedded HTTP proxy with bidirectional format transformation

**[!] Important**: GLMT only available in Node.js version (`bin/ccs.js`). Native shell versions (`lib/ccs`, `lib/ccs.ps1`) do not support GLMT yet (requires HTTP server).

**Flow**:
1. User: `ccs glmt "solve problem"`
2. `bin/ccs.js` spawns `bin/glmt-proxy.js` on localhost random port
3. Modifies `glmt.settings.json`: `ANTHROPIC_BASE_URL=http://127.0.0.1:<port>`
4. Spawns Claude CLI with modified settings
5. Proxy intercepts requests (streaming or buffered):
   - **Tool Transformation** (bidirectional):
     - Anthropic tools → OpenAI function calling format
     - OpenAI tool_calls → Anthropic tool_use blocks
     - Streaming tool calls with input_json deltas
     - MCP tools execute correctly (no XML tag output)
   - **Streaming mode** (default with auto-fallback):
     - `SSEParser` parses incremental SSE events from Z.AI
     - `DeltaAccumulator` tracks content block state
     - `glmt-transformer.js` converts OpenAI deltas → Anthropic events
     - Real-time delivery to Claude CLI (TTFB <500ms)
     - Auto-fallback to buffered mode on streaming errors
6. Thinking blocks and tool calls appear in Claude Code UI (real-time delivery)

**Thinking parameter support**:
- Claude CLI `thinking` parameter recognized and processed
- Parameter precedence: Claude CLI `thinking` > message tags > keywords
- `thinking.type`: 'enabled'/'disabled' controls reasoning blocks
- Input validation: logs warnings for invalid values
- Backward compatible: control tags and keywords work

**Files**:
- `bin/glmt/glmt-proxy.js`: HTTP proxy server with streaming + auto-fallback
- `bin/glmt/glmt-transformer.js`: Format conversion + delta handling + tool transformation + keyword detection
- `bin/glmt/locale-enforcer.js`: Always enforces English output (prevents Chinese responses)
- `bin/glmt/sse-parser.js`: SSE stream parser
- `bin/glmt/delta-accumulator.js`: State tracking for streaming + tool calls + loop detection
- `config/base-glmt.settings.json`: Template with Z.AI endpoint
- `tests/unit/glmt/glmt-transformer.test.js`: Unit tests (35 tests passing)

**Thinking control** (natural language):
- `think` - Enable reasoning (low effort)
- `think hard` - Enable reasoning (medium effort)
- `think harder` - Enable reasoning (high effort)
- `ultrathink` - Maximum reasoning depth (max effort)

Example:
```bash
ccs glmt "think about the architecture before implementing"
ccs glmt "ultrathink this complex algorithm optimization"
```

**Control tags** (advanced):
- `<Thinking:On|Off>` - Enable/disable reasoning
- `<Effort:Low|Medium|High>` - Control reasoning depth

**Environment variables**:
- `CCS_DEBUG=1` - Enable debug file logging to ~/.ccs/logs/

**Security limits** (DoS protection):
- SSE buffer: 1MB max
- Content buffers: 10MB max per block
- Content blocks: 100 max per message
- Request timeout: 120s (both modes)

**Confirmed working**: Z.AI (1498 reasoning chunks tested)

**Control mechanisms**:
1. **Locale enforcement**: Always injects "MUST respond in English" into system prompts
2. **Thinking keywords**: 4-tier system matching Anthropic's levels
   - `think` (low) < `think hard` (medium) < `think harder` (high) < `ultrathink` (max)
   - Priority: ultrathink wins when multiple keywords present
3. **Loop detection**: Triggers after 3 consecutive thinking blocks with no tool calls (DoS protection)

### v3.1 Shared Data

**Commands/skills/agents symlinked from `~/.ccs/shared/`** - no duplication across profiles.

```
~/.ccs/
├── shared/                  # Shared across all profiles
│   ├── commands/
│   ├── skills/
│   └── agents/
├── instances/               # Profile-specific
│   └── work/
│       ├── commands@ → shared/commands/
│       ├── skills@ → shared/skills/
│       ├── agents@ → shared/agents/
│       ├── settings.json    # API keys, credentials
│       ├── sessions/        # Conversation history
│       ├── todolists/
│       └── logs/
```

**Shared**: commands/, skills/, agents/
**Profile-specific**: settings.json, sessions/, todolists/, logs/

**Windows fallback**: Copies dirs if symlinks unavailable (enable Developer Mode for symlinks)

### Profile Types

**Settings-based**: GLM, GLMT, Kimi, default
- GLM: Uses `--settings` flag (Anthropic endpoint, no thinking)
- GLMT: Embedded proxy (OpenAI endpoint, thinking enabled)
- Kimi: Uses `--settings` flag

**Account-based**: work, personal, team
- Uses `CLAUDE_CONFIG_DIR` for isolated instances
- Create: `ccs auth create <profile>`

### Concurrent Sessions

Multiple profiles run simultaneously via isolated config dirs.

## File Structure

**Key Files**:
- `package.json`: npm manifest + postinstall
- `bin/ccs.js`: Node.js entry point
- `bin/instance-manager.js`: Instance orchestration
- `bin/shared-manager.js`: Shared data symlinks (v3.1)
- `bin/glmt-proxy.js`: Embedded HTTP proxy (v3.3 streaming)
- `bin/glmt-transformer.js`: Anthropic ↔ OpenAI conversion + streaming (v3.3)
- `bin/sse-parser.js`: SSE stream parser (v3.3)
- `bin/delta-accumulator.js`: Streaming state tracker (v3.3)
- `scripts/postinstall.js`: Auto-creates configs (idempotent)
- `lib/ccs`: bash executable
- `lib/ccs.ps1`: PowerShell executable
- `installers/*.sh|*.ps1`: Install/uninstall scripts
- `tests/glmt-transformer.test.js`: GLMT unit tests
- `VERSION`: Version source of truth (MAJOR.MINOR.PATCH)

**Executables**:
- Unix: `~/.local/bin/ccs` → `~/.ccs/ccs`
- Windows: `%USERPROFILE%\.ccs\ccs.ps1`

**Config Files**:
- `~/.ccs/config.json`: Settings-based profiles
- `~/.ccs/profiles.json`: Account-based profiles
- `~/.ccs/glm.settings.json`: GLM template (Anthropic endpoint)
- `~/.ccs/glmt.settings.json`: GLMT template (proxy + thinking)
- `~/.ccs/kimi.settings.json`: Kimi template

## Implementations

**npm package**: Pure Node.js (`bin/ccs.js`) using `child_process.spawn`

**Traditional install**: bash (`lib/ccs`) or PowerShell (`lib/ccs.ps1`)

## Code Standards

### Bash
- Compatibility: bash 3.2+
- Quote vars: `"$VAR"` not `$VAR`
- Tests: `[[ ]]` not `[ ]`
- Shebang: `#!/usr/bin/env bash`
- Safety: `set -euo pipefail`
- Dependency: `jq` only

### PowerShell
- Compatibility: PowerShell 5.1+
- `$ErrorActionPreference = "Stop"`
- Native JSON: ConvertFrom-Json / ConvertTo-Json
- No external dependencies

### Node.js
- Compatibility: Node.js 14+
- `child_process.spawn` for Claude CLI
- Handle SIGINT/SIGTERM
- `path` module for cross-platform paths

### Terminal Output
- TTY detect: `[[ -t 2 ]]` before colors
- Respect `NO_COLOR` env var
- ASCII only: [OK], [!], [X], [i]
- Errors: Box borders (╔═╗║╚╝)
- Colors: Disable when not TTY

## Development

### Version Management
```bash
./scripts/bump-version.sh [major|minor|patch]  # Updates VERSION, install scripts
cat VERSION                                     # Check version
```

### Testing
```bash
./tests/edge-cases.sh      # Unix
./tests/edge-cases.ps1     # Windows
```

### Local Development
```bash
./installers/install.sh    # Test local install
./ccs --version            # Verify

# Test npm package
npm pack && npm install -g @kaitranntt-ccs-*.tgz
ccs --version
npm uninstall -g @kaitranntt/ccs && rm *.tgz

rm -rf ~/.ccs              # Clean environment
```

### Publishing
```bash
# Release workflow
./scripts/bump-version.sh patch
git add VERSION package.json lib/* installers/*
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main && git push origin vX.Y.Z  # Triggers CI

# Manual
npm publish --dry-run && npm publish --access public
```

## Common Tasks

### New Feature

1. Verify YAGNI/KISS/DRY alignment
2. Implement for bash/PowerShell/Node.js
3. **REQUIRED**: Update `--help` in bin/ccs.js, lib/ccs, lib/ccs.ps1
4. Test on macOS/Linux/Windows
5. Update tests/edge-cases.*
6. Update README.md if user-facing

### Bug Fix

1. Add test case reproducing bug
2. Fix in bash/PowerShell/Node.js
3. Verify no regression
4. Test all platforms

### Release

1. `./scripts/bump-version.sh [major|minor|patch]`
2. Review VERSION, install scripts
3. Test git + standalone modes
4. Run full test suite
5. `git tag v<VERSION> && git push origin main && git push origin v<VERSION>`

## Testing Checklist

Before PR:
- [ ] macOS (bash)
- [ ] Linux (bash)
- [ ] Windows (PowerShell)
- [ ] Windows (Git Bash)
- [ ] Edge cases pass
- [ ] Idempotent install
- [ ] ASCII only (no emojis)
- [ ] Version + install location correct
- [ ] TTY colors, disabled when piped
- [ ] NO_COLOR respected
- [ ] Auto PATH (bash/zsh/fish)
- [ ] Shell reload instructions shown
- [ ] No PATH duplication
- [ ] Manual PATH instructions clear
- [ ] Concurrent sessions work
- [ ] Instance isolation
- [ ] `--help` updated in bin/ccs.js, lib/ccs, lib/ccs.ps1
- [ ] `--help` consistent across all three

## Technical Details

### Profile Detection

1. Check `profiles.json` (account-based) → use `CLAUDE_CONFIG_DIR`
2. Check `config.json` (settings-based) → use `--settings`
3. Not found → show error + available profiles

### Installation Modes

- **Git**: Cloned repo (symlinks executables)
- **Standalone**: curl/irm (downloads from GitHub)
- Detection: Check if `ccs` exists in script dir/parent

### Idempotency

Install scripts safe to run multiple times:
- Check existing files before create
- Single backup: `config.json.backup` (no timestamps)
- Skip existing `.claude/` install
- Handle clean + existing installs

### Settings Format

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "key",
    "ANTHROPIC_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6"
  }
}
```

All values = strings (not booleans/objects) to prevent PowerShell crashes.

### Profile Files

**profiles.json** (account-based):
```json
{"profiles": {"work": "~/.ccs/instances/work"}}
```

**config.json** (settings-based):
```json
{"profiles": {"glm": "~/.ccs/glm.settings.json"}}
```

## GLMT Troubleshooting

**API Key Issues**:
```bash
# Error: GLMT profile requires Z.AI API key
# Fix: Edit ~/.ccs/glmt.settings.json, set ANTHROPIC_AUTH_TOKEN
```

**Proxy Failures**:
- Timeout (>120s): Proxy didn't start → check Node.js ≥14
- Port conflicts: Uses random port, unlikely
- Connection refused: Firewall blocking 127.0.0.1

**No Thinking Blocks**:
- Check Z.AI API plan supports reasoning_content
- Verify `<Thinking:On>` tag not overridden
- Try using "think" keywords in prompt: `ccs glmt "think about the solution"`
- Test with `ccs glm` (no thinking) to isolate proxy issues

**Chinese Output / Unexpected Language**:
- Locale enforcer always injects "MUST respond in English" into system prompts
- If issues persist, check Z.AI API configuration

**Unbounded Planning Loops**:
- Loop detection triggers after 3 consecutive thinking blocks with no tool calls (auto-stops)
- Use specific execution keywords: "fix", "implement", "debug" to avoid excessive planning

**Tool Execution Issues**:
- **MCP tools outputting XML**: Fixed in v3.5 - upgrade CCS
- **Tool calls not recognized**: Ensure Z.AI API supports function calling
- **Incomplete tool arguments**: Streaming tool calls require complete JSON accumulation
- **Tool results not processed**: Check tool_result format matches Anthropic spec
- Debug with `CCS_DEBUG=1` to inspect request/response transformation

**Streaming Issues**:
- Buffer errors: Hit DoS protection limits (1MB SSE, 10MB content)
- Slow TTFB: Streaming auto-fallback to buffered mode on error
- Incomplete reasoning: Z.AI may not support incremental delivery for all models

**Debug Mode**:
```bash
# Verbose logging
ccs glmt --verbose "test"

# File logging
export CCS_DEBUG=1
ccs glmt --verbose "test"
# Logs: ~/.ccs/logs/
```

## Error Handling

- Validate early, fail fast with clear messages
- Show available options on mistakes
- Suggest recovery steps
- Never leave broken state
- Guide to `ccs auth create` if profile missing

## Claude Code Integration

`.claude/` contains:
- `/ccs` command: Task delegation to different models
- `ccs-delegation` skill: Delegation patterns
