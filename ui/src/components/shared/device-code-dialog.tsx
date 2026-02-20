/**
 * Device Code Dialog Component
 *
 * Displays during OAuth Device Code flow when user needs to enter
 * a verification code at the provider's website (e.g., GitHub, Qwen).
 * Shows prominently formatted code with copy and open URL buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Copy, Check, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  getDeviceCodeProviderDisplayName,
  getDeviceCodeProviderInstruction,
} from '@/lib/provider-config';

interface DeviceCodeDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  provider: string;
  userCode: string;
  verificationUrl: string;
  expiresAt: number;
}

export function DeviceCodeDialog({
  open,
  onClose,
  sessionId,
  provider,
  userCode,
  verificationUrl,
  expiresAt,
}: DeviceCodeDialogProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Calculate and update remaining time, stop at 0
  useEffect(() => {
    if (!open) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const updateTime = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
      // Stop timer when expired
      if (remaining === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    updateTime();
    timer = setInterval(updateTime, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [open, expiresAt]);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setHasCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  }, [userCode]);

  const handleOpenUrl = useCallback(() => {
    window.open(verificationUrl, '_blank', 'noopener,noreferrer');
  }, [verificationUrl]);

  const providerDisplay = getDeviceCodeProviderDisplayName(provider);
  const instructions = getDeviceCodeProviderInstruction(provider);
  const openActionLabel =
    providerDisplay === 'Unknown provider'
      ? 'Open verification page'
      : `Open ${providerDisplay.split(' ')[0]}`;

  // Format remaining time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpired = timeRemaining === 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md" data-session-id={sessionId}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Authorize {providerDisplay}
          </DialogTitle>
          <DialogDescription>
            Enter the code below at the authorization page.
            {timeRemaining !== null && timeRemaining > 0 && (
              <span className="text-muted-foreground ml-1">
                (Expires in {formatTime(timeRemaining)})
              </span>
            )}
            {isExpired && <span className="text-destructive ml-1 font-medium">(Code expired)</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Large code display */}
          <div className="relative">
            <div className="bg-muted rounded-lg p-6 text-center">
              <div className="text-4xl font-mono font-bold tracking-[0.3em] text-foreground select-all">
                {userCode}
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleCopyCode}
              aria-label={hasCopied ? 'Code copied' : 'Copy verification code'}
            >
              {hasCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground text-center">
            <p>{instructions}</p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Button onClick={handleOpenUrl} className="w-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              {openActionLabel}
            </Button>
            <Button variant="outline" onClick={handleCopyCode} className="w-full">
              {hasCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Code
                </>
              )}
            </Button>
          </div>

          {/* Waiting indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Waiting for authorization...</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
