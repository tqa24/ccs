# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [3.4.3] - 2025-11-11

### Added
- Keyword thinking control: `think` < `think hard` < `think harder` < `ultrathink`
- Streaming auto-fallback on error

### Changed
- YAGNI/KISS: Removed budget-calculator.js, task-classifier.js (-272 LOC)
- `CCS_DEBUG_LOG` → `CCS_DEBUG` (backward compatible)

### Removed
- `CCS_GLMT_THINKING_BUDGET`, `CCS_GLMT_STREAMING`, `CCS_GLMT_FORCE_ENGLISH` env vars

### Fixed
- GLMT proxy path (glmt/glmt-proxy.js)
- `ultrathink` effort: `high` → `max`

---

## [3.4.2] - 2025-11-11

### Changed
- Version bump for npm CI workaround

---

## [3.4.1] - 2025-11-11

### Added
- GLMT loop prevention (locale enforcer, budget calculator, task classifier, loop detector)
- Env vars: `CCS_GLMT_FORCE_ENGLISH`, `CCS_GLMT_THINKING_BUDGET`
- 110 GLMT tests (all passing)

### Changed
- Directory structure: bin/{glmt,auth,management,utils}, tests/{unit,integration}
- Token savings: 50-80% for execution tasks

### Fixed
- Thinking parameter processing from Claude CLI
- GLMT tool support (MCP tools, function calling)
- Unbounded planning loops (20+ min → <2 min)
- Chinese output issues

---

## [3.4.0] - 2025-11-11

### Added
- GLMT streaming (5-20x faster TTFB: <500ms vs 2-10s)
- SSEParser, DeltaAccumulator classes
- Security limits (1MB SSE, 10MB content, 100 blocks)

---

## [3.3.0] - 2025-11-11

### Added
- Debug mode: `CCS_DEBUG_LOG=1`
- Verbose flag: `ccs glmt --verbose`
- GLMT config defaults

---

## [3.2.0] - 2025-11-10

### Changed
- **BREAKING**: Symlink-based shared data (was copy-based)
- ~/.ccs/shared/ → ~/.claude/ symlinks
- 60% faster installs

---

## [3.1.1] - 2025-11-10

### Fixed
- Migration now runs during install (not on first `ccs` execution)

---

## [3.1.0] - 2025-11-10

### Added
- Shared data architecture (commands/skills/agents shared across profiles)

---

## [3.0.2] - 2025-11-10

### Fixed
- Profile creation no longer auto-sets as default
- Help text simplified (40% shorter)

---

## [3.0.1] - 2025-11-10

### Added
- Auto-recovery system for missing/corrupted configs
- `ccs doctor` health check command
- ErrorManager class

---

## [3.0.0] - 2025-11-09

### Added
- **Multi-account switching**: Run multiple Claude accounts concurrently
- Auth commands: create, list, show, remove, default
- Profile isolation (sessions, todos, logs per profile)

### BREAKING
- Removed v2.x vault encryption
- Login-per-profile model

---

## [2.5.1] - 2025-11-07
### Added
- Kimi `ANTHROPIC_SMALL_FAST_MODEL` support

## [2.5.0] - 2025-11-07
### Added
- Kimi integration

## [2.4.9] - 2025-11-05
### Fixed
- Node.js DEP0190 warning

## [2.4.8] - 2025-11-05
### Fixed
- Deprecation warning (platform-specific shell)

## [2.4.7] - 2025-11-05
### Fixed
- Windows spawn EINVAL error

## [2.4.6] - 2025-11-05
### Fixed
- Color detection, TTY handling

## [2.4.5] - 2025-11-05
### Added
- Performance benchmarks (npm vs shell)

## [2.4.3] - 2025-11-04
### Fixed
- **CRITICAL**: DEP0190 command injection vulnerability

## [2.4.2] - 2025-11-04
### Changed
- Version bump for republish

## [2.4.1] - 2025-11-04
### Fixed
- **CRITICAL**: Windows PATH detection
- PowerShell terminal termination

## [2.4.0] - 2025-11-04
### Added
- npm package support
### BREAKING
- Executables moved to lib/

## [2.3.1] - 2025-11-04
### Fixed
- PowerShell syntax errors

## [2.3.0] - 2025-11-04
### Added
- Custom Claude CLI path: `CCS_CLAUDE_PATH`

## [2.2.3] - 2025-11-03
### Added
- `ccs --uninstall` command

## [2.2.2] - 2025-11-03
### Fixed
- `ccs --install` via symlinks

## [2.2.1] - 2025-11-03
### Changed
- Hardcoded versions (no VERSION file)

## [2.2.0] - 2025-11-03
### Added
- Auto PATH configuration
- Terminal colors (NO_COLOR support)
### Changed
- Unified install: ~/.local/bin (Unix)
### Fixed
- **CRITICAL**: Shell injection vulnerability

## [2.1.0] - 2025-11-02
### Changed
- Windows uses --settings flag (27% code reduction)

## [2.0.0] - 2025-11-02
### BREAKING
- Removed `ccs son` profile
### Added
- Config templates, installers/ folder
### Fixed
- **CRITICAL**: PowerShell env var crash

## [1.1.0] - 2025-11-01
### Added
- Git worktrees support

## [1.0.0] - 2025-10-31
### Added
- Initial release
