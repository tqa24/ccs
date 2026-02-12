# Hardening Inventory Report

Scope: `src/**/*.{ts,tsx,js,jsx,mjs,cjs}`

## Summary

| Metric | Value |
|---|---:|
| Sync fs occurrences (all) | 835 |
| Sync fs files affected (all) | 100 |
| Sync fs occurrences (runtime hotpaths) | 724 |
| Sync fs files affected (runtime hotpaths) | 89 |
| Legacy shim markers | 131 |
| Legacy shim files affected | 56 |

## Top Runtime Hotpath Sync fs Files

| File | Sync Calls | API Names |
|---|---:|---|
| `src/management/shared-manager.ts` | 60 | copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync |
| `src/utils/claude-symlink-manager.ts` | 27 | copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync |
| `src/utils/shell-completion.ts` | 23 | appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync |
| `src/web-server/routes/settings-routes.ts` | 23 | copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync |
| `src/utils/claude-dir-installer.ts` | 21 | copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync |
| `src/cliproxy/binary/version-cache.ts` | 20 | existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync |
| `src/management/recovery-manager.ts` | 20 | copyFileSync, existsSync, mkdirSync, renameSync, writeFileSync |
| `src/web-server/routes/cliproxy-stats-routes.ts` | 20 | closeSync, existsSync, fstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, writeFileSync |
| `src/web-server/routes/misc-routes.ts` | 20 | copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync |
| `src/web-server/routes/persist-routes.ts` | 17 | closeSync, copyFileSync, existsSync, lstatSync, openSync, readdirSync, readSync, renameSync, unlinkSync, writeFileSync |

## Top Legacy Shim Marker Files

| File | Marker Count |
|---|---:|
| `src/utils/config-manager.ts` | 13 |
| `src/auth/profile-detector.ts` | 11 |
| `src/config/unified-config-loader.ts` | 9 |
| `src/commands/setup-command.ts` | 7 |
| `src/management/checks/config-check.ts` | 6 |
| `src/web-server/routes/account-routes.ts` | 6 |
| `src/config/migration-manager.ts` | 5 |
| `src/api/services/profile-writer.ts` | 4 |
| `src/cliproxy/quota-fetcher-gemini-cli.ts` | 4 |
| `src/auth/profile-registry.ts` | 3 |

## Explicit Shim/Re-export Files

- `src/cliproxy/openai-compat-manager.ts`
