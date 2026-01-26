/**
 * Sync Status Card Component
 * Shows remote CLIProxy connection status and sync controls
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Upload, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SyncDialog } from './sync-dialog';
import { useSyncStatus, useExecuteSync } from '@/hooks/use-cliproxy-sync';

export function SyncStatusCard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: status, isLoading, refetch } = useSyncStatus();
  const { mutate: executeSync, isPending: isSyncing } = useExecuteSync();

  const handleQuickSync = () => {
    executeSync(undefined, {
      onSuccess: () => {
        refetch();
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Remote Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.connected ?? false;
  const isConfigured = status?.configured ?? false;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Remote Sync
            </CardTitle>
            <Badge
              variant={isConnected ? 'default' : 'secondary'}
              className={cn(
                'gap-1.5',
                isConnected
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
                  : !isConfigured
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
              )}
            >
              {isConnected ? (
                <Wifi className="w-3 h-3" />
              ) : !isConfigured ? (
                <WifiOff className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              {isConnected ? 'Connected' : !isConfigured ? 'Not Configured' : 'Disconnected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected && status?.remoteUrl && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Remote:</span> {status.remoteUrl}
              {status.latencyMs !== undefined && (
                <span className="ml-2">({status.latencyMs}ms)</span>
              )}
            </div>
          )}

          {!isConfigured && (
            <p className="text-xs text-muted-foreground">
              Configure remote proxy in Settings to enable profile sync.
            </p>
          )}

          {isConfigured && !isConnected && status?.error && (
            <p className="text-xs text-red-500">{status.error}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setDialogOpen(true)}
              disabled={!isConfigured}
            >
              Configure
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1 gap-2"
              onClick={handleQuickSync}
              disabled={!isConnected || isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Sync Now
            </Button>
          </div>
        </CardContent>
      </Card>

      <SyncDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
