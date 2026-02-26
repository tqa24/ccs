/**
 * Accounts Page
 * Dashboard parity: Auth profile CRUD operations
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AccountsTable } from '@/components/account/accounts-table';
import { CreateAuthProfileDialog } from '@/components/account/create-auth-profile-dialog';
import { Button } from '@/components/ui/button';
import { useAccounts } from '@/hooks/use-accounts';

export function AccountsPage() {
  const { data, isLoading } = useAccounts();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multi-account Claude sessions and shared context groups
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Account
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading accounts...</div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            New profile login: <code className="rounded bg-muted px-1 py-0.5">Create Account</code>.
            Existing profile context: use the pencil icon in the table.
          </p>
          <AccountsTable data={data?.accounts || []} defaultAccount={data?.default ?? null} />
        </div>
      )}

      <CreateAuthProfileDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </div>
  );
}
