/**
 * Sync Dialog Component
 * Dialog for managing sync configuration, preview, and execution
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSyncPreview, useExecuteSync, useSyncAliases } from '@/hooks/use-cliproxy-sync';

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncDialog({ open, onOpenChange }: SyncDialogProps) {
  const [activeTab, setActiveTab] = useState('preview');
  const { data: preview, isLoading: previewLoading } = useSyncPreview();
  const { data: aliasData } = useSyncAliases();
  const { mutate: executeSync, isPending: isSyncing, isSuccess, reset } = useExecuteSync();

  const handleSync = () => {
    executeSync(undefined, {
      onSuccess: () => {
        // Keep dialog open to show success
      },
    });
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Sync Profiles to Remote CLIProxy
          </DialogTitle>
          <DialogDescription>
            Push your CCS API profiles to the remote CLIProxy server.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="aliases">Model Aliases</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : preview?.count === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No profiles configured to sync.</p>
                <p className="text-sm mt-2">Create API profiles first using the Profiles tab.</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {preview?.profiles.map((profile) => (
                    <div
                      key={profile.name}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div>
                        <div className="font-medium">{profile.name}</div>
                        {profile.baseUrl && (
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {profile.baseUrl}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {profile.hasAliases && (
                          <Badge variant="secondary" className="text-xs">
                            {profile.aliasCount} alias{profile.aliasCount !== 1 ? 'es' : ''}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          Ready
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {preview?.count ?? 0} profile{(preview?.count ?? 0) !== 1 ? 's' : ''} to sync
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSync}
                  disabled={isSyncing || (preview?.count ?? 0) === 0}
                  className={cn('gap-2', isSuccess && 'bg-green-600 hover:bg-green-700')}
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Syncing...
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Synced!
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Sync Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="aliases" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              {!aliasData?.aliases || Object.keys(aliasData.aliases).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No model aliases configured.</p>
                  <p className="text-sm mt-2">
                    Add aliases via CLI:{' '}
                    <code className="bg-muted px-1 rounded">ccs cliproxy alias add</code>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(aliasData.aliases).map(([profileName, aliases]) => (
                    <div key={profileName} className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">{profileName}</div>
                      <div className="space-y-1">
                        {aliases.map((alias) => (
                          <div
                            key={`${profileName}-${alias.from}`}
                            className="flex items-center gap-2 p-2 rounded border bg-muted/30 text-sm"
                          >
                            <code className="flex-1 truncate">{alias.from}</code>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <code className="flex-1 truncate text-right">{alias.to}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="mt-6 pt-4 border-t">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  Model aliases map Claude model names to your provider's model names. Manage
                  aliases via CLI for now. UI editor coming soon.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
