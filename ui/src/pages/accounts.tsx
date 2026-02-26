/**
 * Accounts Page
 * Dashboard parity: Auth profile CRUD operations
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Link2, Plus, Unlink, Users, Waves, Zap } from 'lucide-react';
import { AccountsTable } from '@/components/account/accounts-table';
import { CreateAuthProfileDialog } from '@/components/account/create-auth-profile-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccounts } from '@/hooks/use-accounts';

export function AccountsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAccounts();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const authAccounts = data?.accounts || [];
  const cliproxyCount = data?.cliproxyCount || 0;
  const legacyContextCount = data?.legacyContextCount || 0;
  const legacyContinuityCount = data?.legacyContinuityCount || 0;
  const sharedCount = data?.sharedCount || 0;
  const sharedStandardCount = data?.sharedStandardCount || 0;
  const deeperSharedCount = data?.deeperSharedCount || 0;
  const isolatedCount = data?.isolatedCount || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="rounded-xl border bg-gradient-to-br from-background via-background to-muted/40 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline">ccs auth Continuity</Badge>
            <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              This page manages
              <code className="mx-1 rounded bg-muted px-1 py-0.5">ccs auth</code>
              accounts only. Choose isolated, shared-standard, or shared-deeper continuity per
              account.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Account
            </Button>
            <Button variant="outline" onClick={() => navigate('/cliproxy')}>
              Open CLIProxy Claude Pool
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-800/90 dark:text-emerald-300">
              Lane A: ccs auth continuity
            </CardDescription>
            <CardTitle className="text-lg text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Profile isolation + opt-in sync
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use this when you want per-account control over isolated vs shared history behavior.
          </CardContent>
        </Card>

        <Card className="border-blue-200/70 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-800/90 dark:text-blue-300">
              Lane B: CLIProxy Claude pool
            </CardDescription>
            <CardTitle className="text-lg text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              OAuth pool and lower manual switching
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use CLIProxy when you want pooled Claude OAuth accounts and easier account routing
            behavior.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Auth Accounts</CardDescription>
            <CardTitle className="text-2xl font-mono flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {authAccounts.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-800/90 dark:text-emerald-300">
              Shared Standard
            </CardDescription>
            <CardTitle className="text-2xl font-mono text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              {sharedStandardCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-indigo-200/70 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-indigo-800/90 dark:text-indigo-300">
              Shared Deeper
            </CardDescription>
            <CardTitle className="text-2xl font-mono text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
              <Waves className="w-5 h-5" />
              {deeperSharedCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-blue-200/70 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-800/90 dark:text-blue-300">
              Isolated
            </CardDescription>
            <CardTitle className="text-2xl font-mono text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Unlink className="w-5 h-5" />
              {isolatedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {cliproxyCount > 0 && (
        <Alert variant="info">
          <Zap className="h-4 w-4" />
          <AlertTitle>CLIProxy accounts are intentionally excluded from this table</AlertTitle>
          <AlertDescription>
            {cliproxyCount} CLIProxy OAuth account{cliproxyCount > 1 ? 's are' : ' is'} available.
            Manage them in <strong>CLIProxy Plus</strong> to enable account pool usage.
          </AlertDescription>
        </Alert>
      )}

      {legacyContextCount > 0 && (
        <Alert variant="warning">
          <Users className="h-4 w-4" />
          <AlertTitle>Legacy accounts need first-time sync mode review</AlertTitle>
          <AlertDescription>
            {legacyContextCount} account{legacyContextCount > 1 ? 's were' : ' was'} onboarded
            before explicit context controls. Use the pencil action to confirm isolated or shared
            behavior.
          </AlertDescription>
        </Alert>
      )}

      {legacyContinuityCount > 0 && (
        <Alert variant="warning">
          <Waves className="h-4 w-4" />
          <AlertTitle>Shared legacy accounts default to standard continuity</AlertTitle>
          <AlertDescription>
            {legacyContinuityCount} shared account
            {legacyContinuityCount > 1 ? 's are' : ' is'} currently on legacy standard depth. Edit
            and switch to deeper continuity only when you intentionally want broader history sync.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">ccs auth Accounts</CardTitle>
          <CardDescription>
            Shared total: {sharedCount}. Create accounts here, then tune per-account sync mode and
            continuity depth from the table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Loading accounts...</div>
          ) : (
            <AccountsTable data={authAccounts} defaultAccount={data?.default ?? null} />
          )}
        </CardContent>
      </Card>

      <CreateAuthProfileDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </div>
  );
}
