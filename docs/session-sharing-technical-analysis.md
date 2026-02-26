# Session Sharing Technical Analysis

Last Updated: 2026-02-26

## Summary

CCS supports practical cross-account continuity by sharing workspace context files between selected accounts, while keeping credentials isolated per account.

This is implemented as a context policy per account:

- `isolated` (default): account keeps its own workspace context
- `shared`: account workspace context is linked to a shared context group

## Why This Is Safe Enough

CCS only shares workspace context paths (project/session context files). It does **not** merge or copy authentication credentials between accounts.

Credential storage remains per account instance.

## Implementation Model

Account metadata is stored in `~/.ccs/config.yaml`:

```yaml
accounts:
  work:
    created: "2026-02-24T00:00:00.000Z"
    last_used: null
    context_mode: "shared"
    context_group: "team-alpha"
```

Rules:

- `context_mode` must be `isolated` or `shared`
- `context_group` is required when `context_mode=shared`
- group normalization: trim, lowercase, internal spaces -> `-`
- group must start with a letter and only include `[a-zA-Z0-9_-]`
- max length: `64`

## User Workflows

### New account with shared context

```bash
ccs auth create work2 --share-context
ccs auth create backup --context-group sprint-a
```

### Existing account

- Open `ccs config`
- Go to `Accounts`
- Click the pencil icon (`Edit Context`)
- Choose `isolated` or `shared` and set group

No account recreation required for this workflow.

## Current Limitations

- Shared context is local filesystem sharing. It does not bypass remote provider permission models.
- Session continuity still depends on what the upstream tool/provider stores and allows.
- Context sharing should only be enabled for accounts you intentionally trust to share workspace history.

## Validation Checklist

- Confirm account row shows `shared (<group>)` in Dashboard Accounts table
- Switch between accounts in the same group and verify workspace continuity
- Run `ccs doctor` if symlink/context health looks inconsistent

