/**
 * Accounts Page
 * Dashboard parity: Auth profile CRUD operations
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Plus,
  Users,
  Zap,
} from 'lucide-react';
import { AccountsTable } from '@/components/account/accounts-table';
import { CreateAuthProfileDialog } from '@/components/account/create-auth-profile-dialog';
import { HistorySyncLearningMap } from '@/components/account/history-sync-learning-map';
import { CopyButton } from '@/components/ui/copy-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAccounts, useConfirmLegacyAccountPolicies } from '@/hooks/use-accounts';
import { cn } from '@/lib/utils';

export function AccountsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useAccounts();
  const confirmLegacyMutation = useConfirmLegacyAccountPolicies();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showGuideRail, setShowGuideRail] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  const authAccounts = data?.accounts || [];
  const cliproxyCount = data?.cliproxyCount || 0;
  const legacyContextCount = data?.legacyContextCount || 0;
  const legacyContinuityCount = data?.legacyContinuityCount || 0;
  const sharedCount = data?.sharedCount || 0;
  const sharedStandardCount = data?.sharedStandardCount || 0;
  const deeperSharedCount = data?.deeperSharedCount || 0;
  const isolatedCount = data?.isolatedCount || 0;
  const sharedGroups = Array.from(
    new Set(
      authAccounts
        .filter((account) => account.context_mode === 'shared')
        .map((account) => account.context_group || 'default')
    )
  ).sort((a, b) => a.localeCompare(b));

  const legacyTargets = authAccounts.filter(
    (account) => account.context_inferred || account.continuity_inferred
  );
  const legacyTargetCount = legacyTargets.length;
  const hasLegacyFollowUp = legacyTargetCount > 0;

  const handleOpenClaudePool = () => navigate('/cliproxy?provider=claude');
  const handleOpenClaudePoolAuth = () => navigate('/cliproxy?provider=claude&action=auth');
  const handleConfirmLegacy = () => confirmLegacyMutation.mutate(legacyTargets);

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
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pool auth actions live in Action Center to avoid duplicate controls.
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {hasLegacyFollowUp && (
                <section className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Migration Follow-up
                  </p>
                  <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-3">
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

                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleConfirmLegacy}
                      disabled={confirmLegacyMutation.isPending || legacyTargetCount === 0}
                    >
                      {confirmLegacyMutation.isPending
                        ? 'Confirming Legacy Accounts...'
                        : `Confirm Current Policy for ${legacyTargetCount} Legacy Account${legacyTargetCount > 1 ? 's' : ''}`}
                    </Button>
                  </div>
                </section>
              )}

              {!hasLegacyFollowUp && (
                <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                  No legacy follow-up pending. Manage pool auth from Action Center.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main workspace */}
        <div className="flex-1 min-w-0 flex">
          {/* Table column */}
          <div className="flex-1 min-w-0 flex flex-col border-r bg-background">
            <div className="px-5 py-4 border-b bg-background">
              <div className="flex items-center gap-2">
                <Badge variant="outline">ccs auth Workspace</Badge>
                <Badge variant="secondary">History Sync Controls</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setShowGuideRail((prev) => !prev)}
                >
                  {showGuideRail ? 'Hide Action Center' : 'Show Action Center'}
                </Button>
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">Auth Accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This table is intentionally scoped to
                <code className="mx-1 rounded bg-muted px-1 py-0.5">ccs auth</code>
                accounts. Use
                <code className="mx-1 rounded bg-muted px-1 py-0.5">Sync</code>
                for mode/group/depth changes.
              </p>
            </div>

            <div className="flex-1 min-h-0 p-5 space-y-4 overflow-y-auto">
              <HistorySyncLearningMap
                isolatedCount={isolatedCount}
                sharedStandardCount={sharedStandardCount}
                deeperSharedCount={deeperSharedCount}
                sharedGroups={sharedGroups}
                legacyTargetCount={legacyTargetCount}
                cliproxyCount={cliproxyCount}
              />

              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Account Matrix</CardTitle>
                  <CardDescription>
                    Shared total: {sharedCount}. Actions include Sync settings and legacy
                    confirmation.
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
            </div>
          </div>

          {/* Right action center */}
          {showGuideRail ? (
            <div className="w-80 shrink-0 flex flex-col bg-muted/20">
              <div className="p-4 border-b bg-background flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Action Center</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    High-value actions for pool auth and legacy cleanup.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowGuideRail(false)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Immediate Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        size="sm"
                        className="w-full justify-start"
                        onClick={handleOpenClaudePoolAuth}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Authenticate Claude in Pool
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={handleOpenClaudePool}
                      >
                        Open Claude Pool Settings
                        <ArrowRight className="w-4 h-4 ml-auto" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={handleConfirmLegacy}
                        disabled={confirmLegacyMutation.isPending || legacyTargetCount === 0}
                      >
                        {confirmLegacyMutation.isPending
                          ? 'Confirming Legacy Policies...'
                          : `Confirm Legacy Policies (${legacyTargetCount})`}
                      </Button>
                    </CardContent>
                  </Card>

                  <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
                    <Card>
                      <CardHeader className="pb-2">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-auto w-full justify-between px-0 py-0"
                          >
                            <div className="text-left">
                              <CardTitle className="text-sm">Continuity Guide</CardTitle>
                              <CardDescription className="mt-1">
                                Expand only when needed.
                              </CardDescription>
                            </div>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 transition-transform',
                                guideOpen && 'rotate-180'
                              )}
                            />
                          </Button>
                        </CollapsibleTrigger>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent className="space-y-3 text-xs text-muted-foreground">
                          <div className="rounded-md border p-2.5">
                            <p className="font-semibold text-foreground">Shared Standard</p>
                            <p className="mt-1">
                              Project workspace sync only. Best default for most teams.
                            </p>
                          </div>
                          <div className="rounded-md border p-2.5">
                            <p className="font-semibold text-foreground">Shared Deeper</p>
                            <p className="mt-1">
                              Adds <code>session-env</code>, <code>file-history</code>,{' '}
                              <code>shell-snapshots</code>, <code>todos</code>.
                            </p>
                          </div>
                          <div className="rounded-md border p-2.5">
                            <p className="font-semibold text-foreground">Isolated</p>
                            <p className="mt-1">No link. Best for strict separation.</p>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>

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
          ) : (
            <div className="w-14 shrink-0 border-l bg-muted/20 flex items-start justify-center pt-3">
              <Button variant="ghost" size="icon" onClick={() => setShowGuideRail(true)}>
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          )}
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
            <Button variant="outline" className="w-full" onClick={handleOpenClaudePool}>
              Open CLIProxy Claude Pool
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" className="w-full" onClick={handleOpenClaudePoolAuth}>
              Authenticate Claude in Pool
              <Zap className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleConfirmLegacy}
              disabled={confirmLegacyMutation.isPending || legacyTargetCount === 0}
            >
              {confirmLegacyMutation.isPending
                ? 'Confirming Legacy Policies...'
                : `Confirm Legacy Policies (${legacyTargetCount})`}
            </Button>
          </CardContent>
        </Card>

        <HistorySyncLearningMap
          isolatedCount={isolatedCount}
          sharedStandardCount={sharedStandardCount}
          deeperSharedCount={deeperSharedCount}
          sharedGroups={sharedGroups}
          legacyTargetCount={legacyTargetCount}
          cliproxyCount={cliproxyCount}
        />

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
