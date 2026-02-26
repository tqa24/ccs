import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Account } from '@/lib/api-client';
import { useUpdateAccountContext } from '@/hooks/use-accounts';

type ContextMode = 'isolated' | 'shared';

const MAX_CONTEXT_GROUP_LENGTH = 64;
const CONTEXT_GROUP_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

interface EditAccountContextDialogProps {
  account: Account;
  onClose: () => void;
}

export function EditAccountContextDialog({ account, onClose }: EditAccountContextDialogProps) {
  const updateContextMutation = useUpdateAccountContext();
  const [mode, setMode] = useState<ContextMode>(
    account.context_mode === 'shared' ? 'shared' : 'isolated'
  );
  const [group, setGroup] = useState(account.context_group || 'default');

  const normalizedGroup = useMemo(() => group.trim().toLowerCase().replace(/\s+/g, '-'), [group]);
  const isSharedGroupValid =
    normalizedGroup.length > 0 &&
    normalizedGroup.length <= MAX_CONTEXT_GROUP_LENGTH &&
    CONTEXT_GROUP_PATTERN.test(normalizedGroup);
  const canSubmit = mode === 'isolated' || isSharedGroupValid;

  const handleSave = () => {
    if (!canSubmit) {
      return;
    }

    updateContextMutation.mutate(
      {
        name: account.name,
        context_mode: mode,
        context_group: mode === 'shared' ? normalizedGroup : undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Context Mode</DialogTitle>
          <DialogDescription>
            Configure how "{account.name}" shares project workspace context with other accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="context-mode">Context Mode</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as ContextMode)}>
              <SelectTrigger id="context-mode">
                <SelectValue placeholder="Select context mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="isolated">isolated</SelectItem>
                <SelectItem value="shared">shared</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mode === 'shared'
                ? 'Shared mode reuses workspace context for accounts in the same group.'
                : 'Isolated mode keeps this account workspace context separate.'}
            </p>
          </div>

          {mode === 'shared' && (
            <div className="space-y-2">
              <Label htmlFor="context-group">Context Group</Label>
              <Input
                id="context-group"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                placeholder="default"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Normalized to lowercase (spaces become dashes). Allowed: letters, numbers, `_`, `-`
                (max {MAX_CONTEXT_GROUP_LENGTH} chars).
              </p>
              {!isSharedGroupValid && (
                <p className="text-xs text-destructive">
                  Enter a valid group name that starts with a letter.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Credentials stay isolated per account. Only project workspace context is shared.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updateContextMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSubmit || updateContextMutation.isPending}>
            {updateContextMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
