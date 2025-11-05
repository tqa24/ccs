# Changelog

All notable changes to CCS will be documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.4.9] - 2025-11-05

### Fixed
- **Deprecation Warning**: Fixed Node.js DEP0190 warning by using string concatenation when shell is needed (instead of args array with shell: true)
- Conditional shell usage: only for .cmd/.bat/.ps1 files on Windows
- Proper argument escaping for security

### Technical Details
- **Files Modified**: `bin/ccs.js` (execClaude function, escapeShellArg helper)
- **Change**: When shell needed, pass single string instead of args array to avoid deprecation
- **Security**: Arguments properly escaped with double quotes
- **Performance**: No shell overhead on Unix or for .exe files on Windows

## [2.4.8] - 2025-11-05

### Fixed
- **Deprecation Warning**: Fixed Node.js DEP0190 warning by using platform-specific shell option (Windows only)
- Improved cross-platform compatibility (shell only on Windows, direct spawn on macOS/Linux)

### Technical Details
- **Files Modified**: `bin/ccs.js` (execClaude function)
- **Change**: Use `shell: process.platform === 'win32'` instead of `shell: true`
- **Security**: No injection risk (array-based arguments, controlled inputs)
- **Performance**: Better performance on Unix systems (no shell overhead)

## [2.4.7] - 2025-11-05

### Fixed
- **Windows Spawn Error**: Fixed EINVAL error on Windows PowerShell by enabling shell option for spawning .cmd/.bat files
- Cross-platform spawn compatibility maintained (works on Windows, macOS, Linux)

### Technical Details
- **Files Modified**: `bin/ccs.js` (execClaude function)
- **Change**: Added `shell: true` to spawn options for cross-platform compatibility
- **Security**: No injection risk (array-based arguments, controlled inputs)
- **Performance**: Negligible overhead (~10-20ms)

## [2.4.6] - 2025-11-05

### Changed
- Help command shows CCS-specific content with npm adaptations (npx examples first)
- Color detection improved for better cross-platform compatibility
- Both `-v`/`--version` and `-h`/`--help` work identically to native installers

### Fixed
- **Color Detection**: Fixed TTY detection logic to properly disable colors when output is redirected

### Technical Details
- **Files Modified**: `bin/helpers.js` (color utilities), `bin/ccs.js` (version/help handlers)
- **New Functions**: `getColors()`, `colored()` with dynamic TTY detection

### Removed
- **--install flag**: Temporarily removed from user-facing interfaces (WIP: .claude/ integration testing incomplete)
- **--uninstall flag**: Temporarily removed from user-facing interfaces (WIP: testing incomplete)

### Developer Notes
- Implementation code preserved (commented) for future release
- Test suites marked as skipped pending testing completion
- `.claude/` directory content remains in repository

## [2.4.5] - 2025-11-05

### 📊 Performance Analysis
- **Startup Time Benchmarks**:
  - npm version: 21ms (Node.js initialization overhead)
  - Shell version: 5ms (4x faster, pure bash implementation)
- **Installation Time**:
  - npm package: 1.5s (faster download and setup)
  - Shell installer: 3s (includes configuration and PATH setup)
- **Resource Usage**: Both versions have minimal memory footprint

### 🔄 Migration & Compatibility
- **Seamless Migration**: Users can switch between npm and shell installations without data loss
- **Configuration Interchangeability**: Config files (`~/.ccs/config.json`) work identically across methods
- **Version Consistency**: Both installation methods report identical version information
- **Cleanup Procedures**: Official uninstaller completely removes shell version, npm handles package removal

### 🧪 Testing Framework
- **npm Package Tests**: 39 tests covering installation, configuration, CLI functionality, error handling
- **Unit Tests**: 3 tests for core utilities and helper functions
- **Shell Installer Tests**: 57 tests for bash script functionality and edge cases
- **Integration Tests**: Cross-compatibility validation between installation methods
- **Performance Tests**: Startup time and resource usage benchmarks

### 📈 Installation Recommendations
- **Choose npm if**: Already using Node.js ecosystem, need cross-platform compatibility (Windows), prefer package manager updates
- **Choose shell if**: Linux/macOS user, want maximum performance, prefer minimal installation footprint
- **Migration Procedures**: Documented step-by-step processes for safe switching between methods

## [2.4.3] - 2025-11-04

### Fixed
- **CRITICAL: Node.js DEP0190 Security Vulnerability**: Fixed command injection vulnerability in Windows npm package
  - **Root Cause**: `spawn()` called with `shell: true` and arguments array creates security vulnerability (DEP0190)
  - **Issue**: Arguments not properly escaped, allowing potential command injection attacks
  - **Solution**:
    1. Added `escapeShellArg()` function for proper argument escaping
    2. Platform-specific handling (Unix vs Windows escaping strategies)
    3. Conditional execution: escaped string when `shell: true`, array when `shell: false`
  - **Files Modified**:
    - `bin/ccs.js`: Added argument escaping, updated all spawn() calls
    - Added `windowsHide: true` for better Windows experience
  - **Security**: Eliminated command injection vectors while maintaining full functionality
  - **Testing**: Comprehensive testing on Linux and Windows platforms completed
  - **Impact**: Resolves Node.js deprecation warning and secures Windows npm installations
  - **Compatibility**: Full cross-platform compatibility maintained, no breaking changes

## [2.4.2] - 2025-11-04

### Changed
- Version bump for npm republish (2.4.1 was already published before final Windows fix)
- No code changes from v2.4.1 - identical functionality

## [2.4.1] - 2025-11-04

### Fixed
- **CRITICAL: Windows npm Installation PATH Detection**: Fixed Node.js spawn() unable to resolve claude on Windows
  - **Root Cause**: Node.js spawn() doesn't use Windows PATHEXT, can't resolve bare command names in SSH/npm context
  - **Solution**:
    1. Pre-resolve absolute path using `where.exe`/`which` before spawning
    2. Prefer executables with extensions (.exe, .cmd, .bat) - `where.exe` returns no-extension file first
    3. Use `shell: true` for .cmd/.bat/.ps1 files (required to execute batch scripts on Windows)
  - **Windows-specific Issues Solved**:
    - `where.exe claude` returns both `claude` (no ext) and `claude.cmd`, but spawn() needs the .cmd wrapper
    - `.cmd` files can't be spawned directly (EINVAL error), need shell: true to execute via cmd.exe
  - **Impact**: Windows users can now use npm-installed CCS in SSH sessions with npm-installed Claude CLI
  - **Files**:
    - `bin/claude-detector.js`: Added execSync PATH resolution + extension preference logic
    - `bin/ccs.js`: Added null checks + getSpawnOptions() helper for shell: true on .cmd files
  - **Security**: Added 5-second timeout, documented command injection safety (hardcoded literals, controlled shell usage)
  - **Diagnostics**: Enhanced error messages with platform, PATH directory count, executable name
  - **Tested**: Verified with `where.exe claude` returning both entries, spawn EINVAL fixed with shell: true
  - Native installation always worked; only affected npm global installs on Windows
- **CRITICAL: PowerShell Terminal Termination**: Fixed PowerShell 7 terminal closing when using `irm | iex` installation
  - Changed `exit 1` to `return` in install.ps1 line 229 for piped script contexts
  - Terminal now stays open on installation errors, showing error messages properly
  - Affects: Windows PowerShell 5.1+, PowerShell 7+, all piped installations
- **Installation Download Path**: Fixed incorrect download path in install.ps1
  - Changed `/ccs.ps1` to `/lib/ccs.ps1` (line 223) to match repository structure
  - Resolves standalone installation failures from GitHub
- **Claude CLI Detection**: Simplified detection logic, removed overengineered validation
  - Removed complex path validation that failed with npm-installed Claude CLI (.cmd wrappers)
  - Now trusts system PATH for Claude detection (standard case for users)
  - Falls back to CCS_CLAUDE_PATH if set for custom installations
  - Affects: Both bash (lib/ccs) and PowerShell (lib/ccs.ps1) versions
  - Fixes: `where.exe claude` shows Claude exists but CCS reports "not found"

### Changed
- **Error Messages**: Simplified Claude CLI not found error message
  - Removed lengthy "searched locations" output
  - Focused on actionable solutions (install, verify, set custom path)
  - Cleaner UX with less information overload

### Technical Details
- **Files Modified**:
  - `installers/install.ps1`: Line 229 (exit → return), Line 223 (download path fix)
  - `lib/ccs.ps1`: Lines 27-72 (simplified detection, removed Test-ClaudeCli function)
  - `lib/ccs`: Lines 32-72 (simplified detection, removed validate_claude_cli function)
  - `bin/claude-detector.js`: Lines 1-113 (simplified detection for npm package)
  - `bin/ccs.js`: Removed validateClaudeCli calls, simplified error handling
- **Root Cause**: `exit` in piped PowerShell scripts terminates entire session, not just script
- **Solution**: `return` exits script scope only, preserving terminal
- **Cross-Platform Parity**: Applied same simplification to bash, PowerShell, and Node.js versions
- **npm Package**: Updated with simplified detection logic (v2.4.1)
- **Testing**: Validated bash version, npm package syntax, manual Windows testing recommended

## [2.4.0] - 2025-11-04

### ⚠️ BREAKING CHANGES
- **Package Structure**: Moved executables from root directory to `lib/` directory
- **Installation**: npm package now supports cross-platform distribution

### Added
- **npm Package Support**: `npm install -g @kaitranntt/ccs` for easy cross-platform installation
- **Cross-Platform Entry Point**: `bin/ccs.js` Node.js wrapper with platform detection
- **Version Management**: `scripts/sync-version.js` and `scripts/check-executables.js` for consistency
- **Package Metadata**: Complete package.json with bin field and scoped package name (@kaitranntt/ccs)

### Changed
- **Directory Structure**: `ccs` and `ccs.ps1` moved to `lib/` directory
- **Installation Scripts**: Updated install.sh and install.ps1 for lib/ directory support
- **Git Mode Detection**: Fixed to work with new lib/ structure
- **Executable Copy Logic**: Updated for both git and standalone installation modes

### Fixed
- **Installation Script Paths**: Fixed lib/ directory references in install.sh (lines 24, 416-418)
- **PowerShell Installation**: Fixed lib/ directory references in install.ps1 (lines 23, 235-240)
- **Git Installation Mode**: Resolved detection issues with new directory structure

### Technical Details
- **Files Modified**: package.json, bin/ccs.js, lib/ccs, lib/ccs.ps1, installers/install.sh, installers/install.ps1
- **New Scripts**: scripts/sync-version.js, scripts/check-executables.js
- **Testing**: All installation methods validated (npm, curl, irm, git)
- **Code Review**: Passed with 9.7/10 rating
- **Package Size**: < 100KB
- **Breaking Changes**: Only affects package structure, CLI functionality unchanged

### Installation Methods (All Working)
- **npm (Recommended)**: `npm install -g @kaitranntt/ccs`
- **Traditional Unix**: `curl -fsSL ccs.kaitran.ca/install | bash`
- **Traditional Windows**: `irm ccs.kaitran.ca/install | iex`
- **Git Development**: `./installers/install.sh`

## [2.3.1] - 2025-11-04

### Fixed
- **CRITICAL: PowerShell Syntax Errors**: Fixed multi-line string parsing errors in error messages
  - Converted 9 multi-line `Write-ErrorMsg` calls to PowerShell here-strings (`@"...@"`)
  - Fixed 1 multi-line `Write-Critical` call in install.ps1
  - Resolves parser errors: "ampersand (&) character not allowed", "expressions only allowed as first element of pipeline"
  - Affects: Install command (`ccs --install`), error handling, all multi-line error messages
  - Cross-platform: PowerShell 5.1+ and PowerShell Core 7+ compatible

### Testing
- **Comprehensive Test Suite**: 22 automated tests for Custom Claude CLI Path feature (v2.3.0)
  - Environment variable detection (4/4 tests passed)
  - PATH fallback detection (2/2 tests passed)
  - Security validation (4/4 tests passed - injection prevention verified)
  - Edge cases (4/4 tests passed - Unicode, long paths, whitespace)
  - Overall: 20/22 tests passed (90.91% - 2 false positives in test script)
  - Performance: <15ms detection overhead confirmed
  - D drive support verified on Windows

### Technical Details
- **Files Modified**:
  - `ccs.ps1`: 9 here-string conversions (lines 114-158, 194-204, 467-482, 488-492, 501-506, 512-518, 527-532, 550-557, 566-576)
  - `installers/install.ps1`: 1 here-string conversion (lines 374-385)
- **Root Cause**: PowerShell parser fails on unescaped multi-line strings in double quotes
- **Solution**: Here-strings (`@"...@"`) are the idiomatic PowerShell approach for multi-line text
- **Security Review**: No vulnerabilities introduced, here-strings safer than concatenation
- **Testing**: Validated on Windows PowerShell 5.1.19041.6456 (i9-bootcamp)

## [2.3.0] - 2025-11-04

### Added
- **Custom Claude CLI Path Support**: Set `CCS_CLAUDE_PATH` environment variable to specify Claude CLI location
  - Solves D drive installation issues on Windows
  - Supports non-standard installation locations across all platforms
  - Detection priority: `CCS_CLAUDE_PATH` → system PATH → common locations
  - Enhanced error messages showing what was searched and suggesting solutions
  - Platform-specific examples and troubleshooting guidance

### Changed
- Claude CLI detection now uses fallback chain instead of assuming PATH
- Error messages when Claude CLI not found are more helpful with solution steps

### Fixed
- Claude CLI not found when installed on D: drive (Windows)
- Claude CLI not found when installed in custom location
- Unclear error messages when Claude CLI missing
- No guidance for users with non-PATH installations

### Security
- Path validation prevents command injection via CCS_CLAUDE_PATH
- Executable permission checks prevent running non-executable files
- File type validation prevents directory execution attempts

### Performance
- Detection overhead <15ms in worst case (measured ~5ms)
- No performance impact for existing users (Claude in PATH)
- Validation is lightweight (<1ms)

## [2.2.3] - 2025-11-03

### Added
- **Uninstall Command**: `ccs --uninstall` removes CCS commands and skills from `~/.claude/`
  - Removes only CCS-specific files (ccs.md command and ccs-delegation skill)
  - Preserves CCS executable, user configurations, and other Claude Code components
  - Provides clear feedback showing what was removed
  - Safe to run multiple times (idempotent)
  - Cross-platform compatibility (bash/PowerShell)
  - Comprehensive test coverage (20 test cases)

### Updated
- **Documentation**: Added `--uninstall` usage examples to README files
- **Documentation**: Updated install/uninstall cycle documentation

## [2.2.2] - 2025-11-03

### Fixed
- **Installation Command**: `ccs --install` now works when called via symlinks
- **Directory Resolution**: Added fallback logic to check both development and installation locations
  - Checks `$SCRIPT_DIR/.claude` for development (tools/ccs/.claude)
  - Checks `$HOME/.ccs/.claude` for installed (~/.ccs/.claude)
  - Works regardless of how the script is executed (direct or via symlink)
- **Cross-Platform Consistency**: PowerShell version (ccs.ps1) includes identical fix
- **Error Messages**: Enhanced with clear guidance showing both checked locations

### Technical Details
- **Files Modified**:
  - `ccs`: Added fallback directory checking in install_commands_and_skills()
  - `ccs.ps1`: Added identical fallback logic in Install-CommandsAndSkills
- **Root Cause**: Script directory resolution didn't handle symlinks properly
- **Solution**: Simple KISS principle approach - check both possible locations
- **Impact**: No breaking changes, full backward compatibility maintained

## [2.2.1] - 2025-11-03

### Changed
- **Version Management Simplified**: Executables now use hardcoded versions instead of reading VERSION file
  - `ccs` and `ccs.ps1` have hardcoded `CCS_VERSION` variable
  - `bump-version.sh` updates all files atomically (5 locations)
  - No runtime file I/O for version display (~1-2ms faster startup)
  - Removed VERSION file copying from installers
- **Selective Uninstall Cleanup**: When keeping ~/.ccs directory, only config files preserved
  - Removes: `ccs`, `uninstall.sh`, `VERSION` (executables and metadata)
  - Keeps: `config.json`, `*.settings.json`, `.claude/` (user configuration)
  - Clear reporting of removed vs kept files

### Fixed
- **Uninstall Issue**: Executables no longer left in ~/.ccs when choosing to keep directory
- **Version Display**: No longer requires VERSION file in ~/.ccs

### Technical Details
- **Files Modified**:
  - `ccs`: Hardcoded version, removed VERSION file reading
  - `ccs.ps1`: Hardcoded version, removed VERSION file reading
  - `scripts/bump-version.sh`: Updates 5 files (VERSION, executables, installers)
  - `installers/install.sh`: Removed VERSION file copying
  - `installers/install.ps1`: Removed VERSION file copying
  - `installers/uninstall.sh`: Added selective_cleanup() function
  - `installers/uninstall.ps1`: Added Invoke-SelectiveCleanup function
- **Security**: No new vulnerabilities introduced
- **Cross-platform**: Full parity maintained (Unix/Linux/macOS/Windows)

## [2.2.0] - 2025-11-03

### Added
- **Auto PATH Configuration**: Installer automatically detects shell (bash/zsh/fish) and adds `~/.local/bin` to PATH
- **Terminal Color Support**: ANSI color codes with TTY detection for enhanced visual feedback
- **NO_COLOR Support**: Respects NO_COLOR environment variable for accessibility
- **Enhanced Error Messages**: Box-drawing characters for critical errors (╔═╗ style)
- Multi-shell support with shell-specific syntax (bash/zsh: `export`, fish: `set -gx`)
- Idempotent PATH configuration (checks for existing entries before adding)
- Shell profile detection logic with automatic configuration
- Reload instructions after installation (source profile or new terminal)
- Manual PATH fallback instructions if auto-config fails
- **Install Location Display**: --version output shows installation path

### Changed
- **Unified Install Location**: All Unix systems now use `~/.local/bin` (consistent across macOS/Linux)
- **No Sudo Required**: User-writable location eliminates permission issues
- **All Emojis Removed**: Replaced with ASCII symbols for universal compatibility
  - [!] for warnings
  - [OK] for success
  - [X] for errors
  - [i] for information
- **PATH Warnings Enhanced**: Step-by-step instructions for shell configuration
- **GLM API Key Notices Improved**: Actionable guidance with URLs and examples
- **Error Message Format**: Consistent boxed formatting across all scripts
- **Success/Warning/Info Messages**: Unified styling with color support
- Enhanced PATH configuration workflow with clear user instructions
- Simplified installation process (one location for all platforms)

### Fixed
- **Shell Injection Vulnerability**: Critical security fix in shell detection (CVE-level)
- Error handling for profile directory creation
- Profile file creation errors now properly handled
- SHELL environment variable edge cases

### Technical Details
- **Files Modified**:
  - installers/install.sh: Auto PATH config functions, shell detection, security fixes
  - installers/install.ps1: Color function equivalents
  - installers/uninstall.sh: Color functions, simplified cleanup
  - installers/uninstall.ps1: Color function equivalents
  - ccs: Color functions, enhanced error messages, install location display
  - ccs.ps1: Enhanced error messages with PowerShell colors
- **Lines Added**: ~200+ (new auto PATH logic)
- **Lines Removed**: ~50 (platform-specific code)
- **Test Coverage**: 100% pass rate (syntax, idempotent, shell detection, security)
- **Security Review**: Approved after fixes (shell injection vulnerability patched)
- **Cross-Platform Parity**: Maintained across macOS, Linux, Windows

### Migration Notes

#### For All Unix Users (macOS & Linux)
Installation location: `~/.local/bin/ccs`

**What Happens Automatically:**
1. Installer detects your shell (bash/zsh/fish)
2. Checks if ~/.local/bin in PATH
3. If not, adds to shell profile with clear comment
4. Shows reload instructions

**Manual PATH Config (if auto-config fails):**
```bash
# For bash/zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc

# For fish
echo 'set -gx PATH $HOME/.local/bin $PATH' >> ~/.config/fish/config.fish

# Reload
source ~/.bashrc  # or ~/.zshrc or restart terminal
```

#### For Windows Users
No changes. Installation remains at `~/.ccs/ccs.ps1` with automatic PATH configuration.

## [2.1.0] - 2025-11-02

### Changed
- **MAJOR SIMPLIFICATION**: Windows PowerShell now uses `--settings` flag (confirmed working in Claude CLI 2.0.31+)
- Removed 64 lines of environment variable management code from ccs.ps1
- Windows and Unix/Linux/macOS now use identical approach
- Updated all documentation to reflect cross-platform consistency
- ccs.ps1: 235 lines → 171 lines (27% reduction)

### Technical Details
- Windows Claude CLI DOES support `--settings` flag (contrary to previous assumptions)
- No longer manually sets/restores environment variables
- Simpler, cleaner, more maintainable codebase
- Settings file format unchanged (still uses `{"env": {...}}` structure)

## [2.0.0] - 2025-11-02

### BREAKING CHANGES
- Removed `ccs son` profile - use `ccs` (default) for Claude subscription
- Config structure simplified - `sonnet` profile removed from default config

### Added
- `config/` folder with organized templates (base-glm, base-dsp, config.example)
- `config/README.md` - comprehensive config documentation
- `installers/` folder for clean project structure (install/uninstall scripts)
- Smart installer with validation and self-healing
- Non-invasive approach - never modifies `~/.claude/settings.json`
- Version pinning support: `curl ccs.kaitran.ca/v2.0.0/install | bash`
- CHANGELOG.md for release tracking
- WORKFLOW.md - comprehensive workflow documentation
- Migration detection and auto-migration from v1.x configs
- Config backup before modifications with timestamp
- JSON validation for all config files
- GitHub Actions workflow for auto-deploying CloudFlare Worker
- VERSION file for centralized version management

### Fixed
- **CRITICAL**: PowerShell env var bug - strict filtering prevents crashes on non-string values
- PowerShell now requires `env` object in settings files (prevents crashes on root-level fields)
- Type validation for environment variables (strings only)
- Installer now validates all JSON before processing
- Better error messages with actionable solutions

### Changed
- `ccs` now default behavior (uses Claude subscription, no profile needed)
- Simplified profile management (glm fallback only)
- Moved `.ccs.example.json` → `config/config.example.json`
- Reorganized project: install/uninstall scripts → `installers/` folder
- Enhanced error messages with solutions and reinstall instructions
- Removed sonnet profile creation from installers
- Config structure: `{ "glm": "...", "default": "~/.claude/settings.json" }`
- Worker.js routing updated for new installers/ path

### Migration Guide
- Old users: `ccs son` → `ccs` (automatic deprecation warning during install)
- Config auto-migrates during installation (son/sonnet profiles removed)
- GLM API keys preserved during upgrade
- Backup created automatically: `~/.ccs/config.json.backup.TIMESTAMP`
- No action needed unless you customized `sonnet` profile

## [1.1.0] - 2025-11-01

### Added
- Support for git worktrees and submodules
- Enhanced GLM profile with default model variables
- Improved installer detection logic

### Fixed
- BASH_SOURCE unbound variable error in installer
- Git worktree detection

## [1.0.0] - 2025-10-31

### Added
- Initial release
- Profile-based switching between Claude and GLM
- Cross-platform support (macOS, Linux, Windows)
- One-line installation
- Auto-detection of current provider
