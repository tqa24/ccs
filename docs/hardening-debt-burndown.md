# Hardening Debt Burndown Tracker

Last Updated: 2026-02-12
Owner: Stream D (`#542`)

## Scope

Maintainability hardening groundwork with low-risk changes:

- Inventory legacy shims/compatibility markers
- Inventory sync filesystem usage, especially runtime hotpaths
- Incrementally migrate hotpath sync I/O to async I/O with tests

## How to Measure

Run:

```bash
bun run report:hardening
```

Generated artifacts:

- `docs/reports/hardening-inventory.json`
- `docs/reports/hardening-inventory.md`

## Kickoff Baseline (Issue #542 Stream D)

The current baseline is sourced from `docs/reports/hardening-inventory.json` after running `bun run report:hardening`.
Baseline captured: `2026-02-12`.

| Metric | Baseline |
|---|---:|
| Sync fs occurrences (all) | 841 |
| Sync fs files affected (all) | 100 |
| Sync fs occurrences (runtime hotpaths) | 730 |
| Sync fs files affected (runtime hotpaths) | 89 |
| Legacy shim markers | 131 |
| Legacy shim files affected | 56 |

## Initial Async I/O Migration Log

| Date | Area | Change | Safety Notes |
|---|---|---|---|
| 2026-02-12 | `src/web-server/jsonl-parser.ts` | Migrated `parseProjectDirectory()` directory listing from sync `readdirSync` to async `fs.promises.readdir` | Existing behavior kept (same filtering/fallback); covered by `tests/unit/jsonl-parser.test.ts` |
