/**
 * Add Account Dialog Component
 * Triggers OAuth flow server-side to add another account to a provider
 * Applies default preset when adding first account
 * For Kiro: Also shows "Import from IDE" option as fallback
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink, User, Download } from 'lucide-react';
import { useStartAuth, useKiroImport } from '@/hooks/use-cliproxy';
import { applyDefaultPreset } from '@/lib/preset-utils';
import { toast } from 'sonner';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  provider: string;
  displayName: string;
  /** Whether this is the first account being added (triggers preset application) */
  isFirstAccount?: boolean;
}

export function AddAccountDialog({
  open,
  onClose,
  provider,
  displayName,
  isFirstAccount = false,
}: AddAccountDialogProps) {
  const [nickname, setNickname] = useState('');
  const startAuthMutation = useStartAuth();
  const kiroImportMutation = useKiroImport();

  const isKiro = provider === 'kiro';
  const isPending = startAuthMutation.isPending || kiroImportMutation.isPending;

  const handleStartAuth = () => {
    startAuthMutation.mutate(
      { provider, nickname: nickname.trim() || undefined },
      {
        onSuccess: async () => {
          // Apply default preset if this is the first account
          if (isFirstAccount) {
            const result = await applyDefaultPreset(provider);
            if (result.success && result.presetName) {
              toast.success(`Applied "${result.presetName}" preset`);
            } else if (!result.success) {
              toast.warning('Account added, but failed to apply default preset');
            }
          }
          setNickname('');
          onClose();
        },
      }
    );
  };

  const handleKiroImport = () => {
    kiroImportMutation.mutate(undefined, {
      onSuccess: async () => {
        // Apply default preset if this is the first account
        if (isFirstAccount) {
          const result = await applyDefaultPreset('kiro');
          if (result.success && result.presetName) {
            toast.success(`Applied "${result.presetName}" preset`);
          }
        }
        setNickname('');
        onClose();
      },
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isPending) {
      setNickname('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {displayName} Account</DialogTitle>
          <DialogDescription>
            {isKiro
              ? 'Authenticate via browser or import an existing token from Kiro IDE.'
              : 'Click the button below to authenticate a new account. A browser window will open for OAuth.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname (optional)</Label>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., work, personal"
                disabled={isPending}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this account. Auto-generated from email if left empty.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            {isKiro && (
              <Button variant="outline" onClick={handleKiroImport} disabled={isPending}>
                {kiroImportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import from IDE
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleStartAuth} disabled={isPending}>
              {startAuthMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Authenticate
                </>
              )}
            </Button>
          </div>

          {startAuthMutation.isPending && (
            <p className="text-sm text-center text-muted-foreground">
              Complete the OAuth flow in your browser...
            </p>
          )}
          {kiroImportMutation.isPending && (
            <p className="text-sm text-center text-muted-foreground">
              Importing token from Kiro IDE...
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
