/**
 * Accounts Page
 * Dashboard parity: Auth profile CRUD operations
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Link2, Plus, Unlink, Users, Waves, Zap } from 'lucide-react';
import { AccountsTable } from '@/components/account/accounts-table';
import { CreateAuthProfileDialog } from '@/components/account/create-auth-profile-dialog';
import { CopyButton } from '@/components/ui/copy-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccounts } from '@/hooks/use-accounts';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type MetricTone = 'default' | 'shared' | 'deeper' | 'isolated';

function MetricTile({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: MetricTone;
}) {
  const toneClasses: Record<MetricTone, { border: string; icon: string }> = {
    default: {
      border: 'border-border',
      icon: 'text-primary',
    },
    shared: {
      border: 'border-emerald-300/60 dark:border-emerald-900/40',
      icon: 'text-emerald-700 dark:text-emerald-400',
    },
    deeper: {
      border: 'border-indigo-300/60 dark:border-indigo-900/40',
      icon: 'text-indigo-700 dark:text-indigo-400',
    },
    isolated: {
      border: 'border-blue-300/60 dark:border-blue-900/40',
      icon: 'text-blue-700 dark:text-blue-400',
    },
  };

  return (
    <div className={cn('rounded-md border bg-card px-3 py-2.5', toneClasses[tone].border)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn('h-3.5 w-3.5', toneClasses[tone].icon)} />
      </div>
      <p className={cn('mt-1 text-xl font-mono font-semibold', toneClasses[tone].icon)}>{value}</p>
    </div>
  );
}

function StrategyCard({
  title,
  description,
  variant,
}: {
  title: string;
  description: string;
  variant: 'auth' | 'pool';
}) {
  const variantClasses =
    variant === 'auth'
      ? 'border-emerald-300/70 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10'
      : 'border-blue-300/70 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-900/10';
  const titleClasses =
    variant === 'auth'
      ? 'text-emerald-800 dark:text-emerald-300'
      : 'text-blue-800 dark:text-blue-300';

  return (
    <div className={cn('rounded-md border px-3 py-2.5', variantClasses)}>
      <p className={cn('text-sm font-semibold', titleClasses)}>{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

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
  const hasLegacyFollowUp = legacyContextCount > 0 || legacyContinuityCount > 0;

  return (
    <>
      <div className="h-[calc(100vh-100px)] hidden lg:flex">
        {/* Left rail */}
        <div className="w-80 border-r flex flex-col bg-muted/30 shrink-0">
          <div className="p-4 border-b bg-background space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h1 className="font-semibold">Accounts</h1>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Dedicated
                <code className="mx-1 rounded bg-muted px-1 py-0.5">ccs auth</code>
                continuity controls.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="justify-start">
                <Plus className="w-4 h-4 mr-2" />
                Create Account
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => navigate('/cliproxy')}
              >
                Open CLIProxy Claude Pool
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              <section className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Snapshot
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MetricTile label="Total" value={authAccounts.length} icon={Users} />
                  <MetricTile label="Shared" value={sharedCount} icon={Link2} tone="shared" />
                  <MetricTile label="Deeper" value={deeperSharedCount} icon={Waves} tone="deeper" />
                  <MetricTile
                    label="Isolated"
                    value={isolatedCount}
                    icon={Unlink}
                    tone="isolated"
                  />
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Strategy Lanes
                </p>
                <StrategyCard
                  variant="auth"
                  title="Lane A: ccs auth continuity"
                  description="Isolation-first accounts with explicit shared/deeper controls per profile."
                />
                <StrategyCard
                  variant="pool"
                  title="Lane B: CLIProxy Claude pool"
                  description="OAuth pool routing for lower manual account switching."
                />
              </section>

              {hasLegacyFollowUp && (
                <section className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Migration Follow-up
                  </p>
                  <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-700 dark:text-amber-400 shrink-0" />
                      <div className="space-y-1 text-xs">
                        {legacyContextCount > 0 && (
                          <p className="text-amber-800 dark:text-amber-300">
                            {legacyContextCount} account
                            {legacyContextCount > 1 ? 's still need' : ' still needs'} first-time
                            mode confirmation.
                          </p>
                        )}
                        {legacyContinuityCount > 0 && (
                          <p className="text-amber-800 dark:text-amber-300">
                            {legacyContinuityCount} shared account
                            {legacyContinuityCount > 1 ? 's remain' : ' remains'} on standard legacy
                            continuity depth.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t bg-background text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Standard shared</span>
              <span className="font-mono">{sharedStandardCount}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span>CLIProxy hidden</span>
              <span className="font-mono">{cliproxyCount}</span>
            </div>
          </div>
        </div>

        {/* Main workspace */}
        <div className="flex-1 min-w-0 flex">
          {/* Table column */}
          <div className="flex-1 min-w-0 flex flex-col border-r bg-background">
            <div className="px-5 py-4 border-b bg-background">
              <div className="flex items-center gap-2">
                <Badge variant="outline">ccs auth Workspace</Badge>
                <Badge variant="secondary">History Sync Controls</Badge>
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">Auth Accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This table is intentionally scoped to
                <code className="mx-1 rounded bg-muted px-1 py-0.5">ccs auth</code>
                accounts. Edit each account for isolated, shared-standard, or shared-deeper
                continuity behavior.
              </p>
            </div>

            <div className="flex-1 min-h-0 p-5 overflow-auto">
              {cliproxyCount > 0 && (
                <Alert variant="info" className="mb-4">
                  <Zap className="h-4 w-4" />
                  <AlertTitle>CLIProxy pool accounts are managed in their own page</AlertTitle>
                  <AlertDescription>
                    {cliproxyCount} OAuth account{cliproxyCount > 1 ? 's are' : ' is'} available in
                    CLIProxy. This table only covers local
                    <code className="mx-1 rounded bg-muted px-1 py-0.5">ccs auth</code>
                    profiles.
                  </AlertDescription>
                </Alert>
              )}

              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Account Matrix</CardTitle>
                  <CardDescription>
                    Shared total: {sharedCount}. Update sync behavior from the pencil action in each
                    row.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                  {isLoading ? (
                    <div className="text-muted-foreground">Loading accounts...</div>
                  ) : (
                    <AccountsTable data={authAccounts} defaultAccount={data?.default ?? null} />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right guidance column */}
          <div className="w-80 shrink-0 flex flex-col bg-muted/20">
            <div className="p-4 border-b bg-background">
              <h3 className="font-semibold">Continuity Guide</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose the lightest mode that solves your workflow.
              </p>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Shared Standard</CardTitle>
                    <CardDescription>Project workspace sync only.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Best default when users need continuity but want minimal coupling.
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Shared Deeper (Advanced)</CardTitle>
                    <CardDescription>
                      Adds <code>session-env</code>, <code>file-history</code>,{' '}
                      <code>shell-snapshots</code>, <code>todos</code>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Use only when cross-account continuity is worth stronger coupling.
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Quick Commands</CardTitle>
                    <CardDescription>Copy and run in terminal.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="rounded-md border bg-background px-2 py-2 font-mono text-[11px] flex items-start gap-2">
                      <span className="flex-1 break-all">
                        ccs auth create work --context-group sprint-a --deeper-continuity
                      </span>
                      <CopyButton
                        value="ccs auth create work --context-group sprint-a --deeper-continuity"
                        size="icon"
                      />
                    </div>
                    <div className="rounded-md border bg-background px-2 py-2 font-mono text-[11px] flex items-start gap-2">
                      <span className="flex-1 break-all">ccs cliproxy auth claude</span>
                      <CopyButton value="ccs cliproxy auth claude" size="icon" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Mobile fallback */}
      <div className="p-4 space-y-4 lg:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accounts</CardTitle>
            <CardDescription>
              Manage
              <code className="mx-1 rounded bg-muted px-1 py-0.5">ccs auth</code>
              continuity per account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Account
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate('/cliproxy')}>
              Open CLIProxy Claude Pool
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <MetricTile label="Total" value={authAccounts.length} icon={Users} />
          <MetricTile label="Shared" value={sharedCount} icon={Link2} tone="shared" />
          <MetricTile label="Deeper" value={deeperSharedCount} icon={Waves} tone="deeper" />
          <MetricTile label="Isolated" value={isolatedCount} icon={Unlink} tone="isolated" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-muted-foreground">Loading accounts...</div>
            ) : (
              <AccountsTable data={authAccounts} defaultAccount={data?.default ?? null} />
            )}
          </CardContent>
        </Card>
      </div>

      <CreateAuthProfileDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </>
  );
}
