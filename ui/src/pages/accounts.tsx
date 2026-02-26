/**
 * Accounts Page
 * Dashboard parity: Auth profile CRUD operations
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Link2, Plus, Unlink, Users, Zap } from 'lucide-react';
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
  const sharedCount = data?.sharedCount || 0;
  const isolatedCount = data?.isolatedCount || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="rounded-xl border bg-gradient-to-br from-background via-background to-muted/40 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline">CCS Auth Accounts</Badge>
            <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              This page is dedicated to{' '}
              <code className="rounded bg-muted px-1 py-0.5">ccs auth</code> accounts. Choose
              isolated mode to keep context separate, or shared mode to link context across selected
              accounts.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Account
            </Button>
            {cliproxyCount > 0 && (
              <Button variant="outline" onClick={() => navigate('/cliproxy')}>
                Manage OAuth ({cliproxyCount})
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
              Shared (Linked)
            </CardDescription>
            <CardTitle className="text-2xl font-mono text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              {sharedCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-blue-200/70 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-900/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-800/90 dark:text-blue-300">
              Isolated (Separate)
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
          <AlertTitle>OAuth accounts are managed elsewhere</AlertTitle>
          <AlertDescription>
            This screen hides {cliproxyCount} CLIProxy OAuth account
            {cliproxyCount > 1 ? 's' : ''}. Use <strong>CLIProxy Plus</strong> to manage Gemini,
            Codex, Antigravity, and other OAuth providers.
          </AlertDescription>
        </Alert>
      )}

      {legacyContextCount > 0 && (
        <Alert variant="warning">
          <Users className="h-4 w-4" />
          <AlertTitle>Legacy accounts need context review</AlertTitle>
          <AlertDescription>
            {legacyContextCount} account{legacyContextCount > 1 ? 's were' : ' was'} onboarded
            before context controls and currently default to isolated mode. Use the pencil action in
            the table to explicitly choose isolated or shared.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">CCS Auth Accounts</CardTitle>
          <CardDescription>
            New onboarding: <code className="rounded bg-muted px-1 py-0.5">Create Account</code>.
            Existing accounts: use the pencil action to control linkage flexibility per account.
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
