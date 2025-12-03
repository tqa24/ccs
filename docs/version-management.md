# Version Management

## Overview

CCS uses **semantic-release** for fully automated versioning and releases. Version numbers are determined automatically from conventional commit messages - no manual version bumping required.

## Release Channels

| Branch | npm Tag | Example | Description |
|--------|---------|---------|-------------|
| `main` | `@latest` | `5.1.0` | Stable production releases |
| `dev` | `@dev` | `5.1.0-dev.1` | Pre-release testing |

## How Releases Work

### Automatic Release (Default)

1. **Write conventional commits** during development
2. **Merge PR to `main`** (or push to `dev`)
3. **CI automatically**:
   - Analyzes commits to determine version bump
   - Updates `CHANGELOG.md`
   - Updates `VERSION`, `package.json`, installers
   - Creates git tag
   - Publishes to npm
   - Creates GitHub release

### Conventional Commits

Version bump is determined by commit type:

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `feat:` | MINOR | `5.0.2` → `5.1.0` |
| `fix:` | PATCH | `5.0.2` → `5.0.3` |
| `perf:` | PATCH | `5.0.2` → `5.0.3` |
| `feat!:` or `BREAKING CHANGE:` | MAJOR | `5.0.2` → `6.0.0` |
| `docs:`, `style:`, `refactor:`, `test:`, `chore:`, `ci:` | No release | - |

### Commit Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Examples:**
```bash
feat(cliproxy): add OAuth token refresh
fix(doctor): handle missing config gracefully
feat!: remove deprecated GLMT proxy
docs: update installation guide
```

## Workflow Examples

### Stable Release

```bash
# 1. Work on feature branch
git checkout -b feat/new-feature
git commit -m "feat(scope): add new feature"

# 2. Open PR to main
gh pr create --base main

# 3. Merge PR → CI auto-releases to npm @latest
```

### Dev Release

```bash
# 1. Switch to dev branch
git checkout dev
git merge feat/experimental

# 2. Push → CI auto-releases to npm @dev
git push origin dev
```

### Installing Different Channels

```bash
# Stable (default)
npm install -g @kaitranntt/ccs

# Dev
npm install -g @kaitranntt/ccs@dev

# Specific version
npm install -g @kaitranntt/ccs@5.1.0-dev.1
```

## Version Files

These files are automatically synced by semantic-release:

| File | Purpose |
|------|---------|
| `VERSION` | Shell scripts, runtime display |
| `package.json` | npm package version |
| `installers/install.sh` | Standalone bash installer |
| `installers/install.ps1` | Standalone PowerShell installer |
| `CHANGELOG.md` | Auto-generated release notes |

## Local Commit Validation

Commits are validated locally via husky + commitlint:

```bash
# This will be rejected:
git commit -m "added new feature"

# This will pass:
git commit -m "feat: add new feature"
```

## Emergency Manual Release

For emergencies only (e.g., CI broken, hotfix needed):

```bash
./scripts/bump-version.sh patch
git add -A
git commit -m "chore(release): emergency release"
git push origin main
npm publish
```

## Tooling

| Tool | Purpose |
|------|---------|
| `semantic-release` | Automated versioning and publishing |
| `@semantic-release/changelog` | Auto-update CHANGELOG.md |
| `@semantic-release/git` | Commit version files back |
| `commitlint` | Validate commit message format |
| `husky` | Git hooks for local validation |

## Configuration Files

- `.releaserc.json` - semantic-release configuration
- `commitlint.config.cjs` - commit message rules
- `.husky/commit-msg` - commit validation hook
- `.github/workflows/release.yml` - CI release workflow

## Troubleshooting

### Commit rejected by commitlint

```bash
# Check what's wrong
bunx commitlint --edit

# Fix commit message format
git commit --amend
```

### No release triggered

Check if commits include releasable types (`feat:`, `fix:`, `perf:`). Documentation-only commits (`docs:`) don't trigger releases.

### Dev out of sync with main

```bash
git checkout dev
git rebase main
git push --force-with-lease origin dev
```
