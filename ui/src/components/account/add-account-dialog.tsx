/**
 * Add Account Dialog Component
 * Uses /start-url to get OAuth URL + polls for completion via management API.
 * For Device Code flows (ghcp, qwen, kiro): Uses /start endpoint which spawns CLIProxy
 * binary and emits WebSocket events. DeviceCodeDialog handles user code display.
 * Shows auth URL + callback paste field. Polling auto-closes on success.
 * For Kiro: Also shows "Import from IDE" option.
 */

import { useState, useEffect, useRef } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ExternalLink, User, Download, Copy, Check, ShieldAlert } from 'lucide-react';
import { useKiroImport } from '@/hooks/use-cliproxy';
import { useCliproxyAuthFlow } from '@/hooks/use-cliproxy-auth-flow';
import { applyDefaultPreset } from '@/lib/preset-utils';
import { AccountSafetyWarningCard } from '@/components/account/account-safety-warning-card';
import { AntigravityResponsibilityChecklist } from '@/components/account/antigravity-responsibility-checklist';
import {
  ANTIGRAVITY_ACK_VERSION,
  DEFAULT_ANTIGRAVITY_RISK_CHECKLIST,
  isAntigravityRiskChecklistComplete,
} from '@/components/account/antigravity-responsibility-constants';
import {
  DEFAULT_KIRO_AUTH_METHOD,
  getKiroAuthMethodOption,
  isDeviceCodeProvider,
  isNicknameRequiredProvider,
  KIRO_AUTH_METHOD_OPTIONS,
} from '@/lib/provider-config';
import type { KiroAuthMethod } from '@/lib/provider-config';
import { toast } from 'sonner';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  provider: string;
  displayName: string;
  /** Whether this is the first account being added (shows different toast message) */
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
  const [callbackUrl, setCallbackUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  const [agyRiskChecklist, setAgyRiskChecklist] = useState(DEFAULT_ANTIGRAVITY_RISK_CHECKLIST);
  const [agyAckBypassEnabled, setAgyAckBypassEnabled] = useState(false);
  const [agyAckBypassLoading, setAgyAckBypassLoading] = useState(false);
  const [kiroAuthMethod, setKiroAuthMethod] = useState<KiroAuthMethod>(DEFAULT_KIRO_AUTH_METHOD);
  const wasAuthenticatingRef = useRef(false);
  const authFlow = useCliproxyAuthFlow();
  const kiroImportMutation = useKiroImport();

  const isKiro = provider === 'kiro';
  const requiresSafetyAcknowledgement = provider === 'gemini';
  const requiresAgyResponsibilityFlow = provider === 'agy' && !agyAckBypassEnabled;
  const isAgyBypassStatePending = provider === 'agy' && agyAckBypassLoading;
  const isAgyRiskChecklistComplete = isAntigravityRiskChecklistComplete(agyRiskChecklist);
  const defaultDeviceCode = isDeviceCodeProvider(provider);
  const requiresNickname = isNicknameRequiredProvider(provider);
  const kiroMethodOption = getKiroAuthMethodOption(kiroAuthMethod);
  const isDeviceCode = isKiro ? kiroMethodOption.flowType === 'device_code' : defaultDeviceCode;
  const isPending = authFlow.isAuthenticating || kiroImportMutation.isPending;
  const nicknameTrimmed = nickname.trim();
  const errorMessage = localError || authFlow.error;

  const resetAndClose = () => {
    setNickname('');
    setCallbackUrl('');
    setCopied(false);
    setLocalError(null);
    setAcknowledgedRisk(false);
    setAgyRiskChecklist(DEFAULT_ANTIGRAVITY_RISK_CHECKLIST);
    setAgyAckBypassEnabled(false);
    setAgyAckBypassLoading(false);
    setKiroAuthMethod(DEFAULT_KIRO_AUTH_METHOD);
    wasAuthenticatingRef.current = false;
    onClose();
  };

  useEffect(() => {
    if (open) {
      setAcknowledgedRisk(false);
      setAgyRiskChecklist(DEFAULT_ANTIGRAVITY_RISK_CHECKLIST);
      setLocalError(null);
    }
  }, [provider, open]);

  useEffect(() => {
    let cancelled = false;

    if (!open || provider !== 'agy') {
      setAgyAckBypassEnabled(false);
      setAgyAckBypassLoading(false);
      return;
    }

    const loadAgyBypassState = async () => {
      try {
        setAgyAckBypassLoading(true);
        const response = await fetch('/api/settings/auth/antigravity-risk');
        if (!response.ok) {
          throw new Error('Failed to load Antigravity power user setting');
        }
        const data = (await response.json()) as { antigravityAckBypass?: boolean };
        if (!cancelled) {
          setAgyAckBypassEnabled(data.antigravityAckBypass === true);
        }
      } catch {
        if (!cancelled) {
          setAgyAckBypassEnabled(false);
        }
      } finally {
        if (!cancelled) {
          setAgyAckBypassLoading(false);
        }
      }
    };

    loadAgyBypassState();

    return () => {
      cancelled = true;
    };
  }, [open, provider]);

  // When authFlow completes successfully (polling detected success), apply preset and close
  useEffect(() => {
    if (!authFlow.isAuthenticating && !authFlow.error && authFlow.provider === null && open) {
      if (wasAuthenticatingRef.current) {
        wasAuthenticatingRef.current = false;
        const applyPresetAndClose = async () => {
          try {
            const result = await applyDefaultPreset(provider);
            if (result.success && result.presetName && isFirstAccount) {
              toast.success(`Applied "${result.presetName}" preset`);
            }
          } catch {
            // Continue to close dialog even if preset apply fails
          }
          resetAndClose();
        };
        applyPresetAndClose();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFlow.isAuthenticating, authFlow.error, authFlow.provider]);

  const handleCancel = () => {
    // Always cancel authFlow (handles its own no-op if not active)
    authFlow.cancelAuth();
    resetAndClose();
  };

  const handleCopyUrl = async () => {
    if (authFlow.authUrl) {
      await navigator.clipboard.writeText(authFlow.authUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmitCallback = () => {
    if (callbackUrl.trim()) {
      authFlow.submitCallback(callbackUrl.trim());
    }
  };

  /**
   * Start auth flow using provider capabilities.
   * - Device code providers use /start and rely on WebSocket events for code display.
   * - Authorization code providers use /start-url and polling.
   */
  const handleAuthenticate = () => {
    if (isAgyBypassStatePending) {
      setLocalError('Loading Antigravity safety settings. Please wait a moment and retry.');
      return;
    }
    if (requiresAgyResponsibilityFlow && !isAgyRiskChecklistComplete) {
      setLocalError(
        'Complete all Antigravity responsibility steps before authenticating this provider.'
      );
      return;
    }
    if (requiresSafetyAcknowledgement && !acknowledgedRisk) {
      setLocalError(
        'Please acknowledge the account safety warning before authenticating this provider.'
      );
      return;
    }
    if (requiresNickname && !nicknameTrimmed) {
      setLocalError(`Nickname is required for ${displayName} accounts.`);
      return;
    }
    setLocalError(null);
    wasAuthenticatingRef.current = true;
    authFlow.startAuth(provider, {
      nickname: nicknameTrimmed || undefined,
      kiroMethod: isKiro ? kiroAuthMethod : undefined,
      flowType: isKiro ? kiroMethodOption.flowType : undefined,
      startEndpoint: isKiro ? kiroMethodOption.startEndpoint : undefined,
      riskAcknowledgement: requiresAgyResponsibilityFlow
        ? {
            version: ANTIGRAVITY_ACK_VERSION,
            reviewedIssue622: agyRiskChecklist.reviewedIssue622,
            understandsBanRisk: agyRiskChecklist.understandsBanRisk,
            acceptsFullResponsibility: agyRiskChecklist.acceptsFullResponsibility,
            typedPhrase: agyRiskChecklist.typedPhrase,
          }
        : undefined,
    });
  };

  const handleKiroImport = () => {
    wasAuthenticatingRef.current = true;
    kiroImportMutation.mutate(undefined, {
      onSuccess: async () => {
        const result = await applyDefaultPreset('kiro');
        if (result.success && result.presetName && isFirstAccount) {
          toast.success(`Applied "${result.presetName}" preset`);
        }
        resetAndClose();
      },
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleCancel();
    }
  };

  const showAuthUI = authFlow.isAuthenticating;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          // Prevent accidental close by clicking outside during auth
          if (showAuthUI) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add {displayName} Account</DialogTitle>
          <DialogDescription>
            {isKiro
              ? 'Choose a Kiro auth method, then authenticate via browser or import from Kiro IDE.'
              : isDeviceCode
                ? 'Click Authenticate. A verification code will appear for you to enter on the provider website.'
                : 'Click Authenticate to get an OAuth URL. Open it in any browser to sign in.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {requiresAgyResponsibilityFlow && !showAuthUI && (
            <AntigravityResponsibilityChecklist
              value={agyRiskChecklist}
              onChange={(value) => {
                setAgyRiskChecklist(value);
                setLocalError(null);
              }}
              disabled={isPending}
            />
          )}

          {provider === 'agy' && agyAckBypassEnabled && !showAuthUI && (
            <div className="rounded-lg border border-amber-400/35 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-100">
              <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5" />
                Power user mode enabled
              </div>
              AGY responsibility checklist is skipped from Settings {'>'} Auth. You accept full
              responsibility for OAuth/account risk.
            </div>
          )}

          {requiresSafetyAcknowledgement && !showAuthUI && (
            <AccountSafetyWarningCard
              provider="gemini"
              showAcknowledgement
              acknowledged={acknowledgedRisk}
              onAcknowledgedChange={(value) => {
                setAcknowledgedRisk(value);
                setLocalError(null);
              }}
              disabled={isPending}
            />
          )}

          {/* Kiro auth method */}
          {isKiro && !showAuthUI && (
            <div className="space-y-2">
              <Label htmlFor="kiro-auth-method">Auth Method</Label>
              <Select
                value={kiroAuthMethod}
                onValueChange={(value) => {
                  setKiroAuthMethod(value as KiroAuthMethod);
                  setLocalError(null);
                }}
              >
                <SelectTrigger id="kiro-auth-method">
                  <SelectValue placeholder="Select Kiro auth method" />
                </SelectTrigger>
                <SelectContent>
                  {KIRO_AUTH_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{kiroMethodOption.description}</p>
            </div>
          )}

          {/* Nickname input - only show before auth starts */}
          {!showAuthUI && (
            <div className="space-y-2">
              <Label htmlFor="nickname">
                {requiresNickname ? 'Nickname (required)' : 'Nickname (optional)'}
              </Label>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setLocalError(null);
                  }}
                  placeholder="e.g., work, personal"
                  disabled={isPending}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {requiresNickname
                  ? 'Required for this provider. Use a unique friendly name (e.g., work, personal).'
                  : 'A friendly name to identify this account. Auto-generated from email if left empty.'}
              </p>
            </div>
          )}

          {/* Unified auth state: spinner + auth URL + callback paste */}
          {showAuthUI && (
            <div className="space-y-4">
              {/* Spinner */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  Waiting for authentication...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {authFlow.isDeviceCodeFlow
                    ? 'A verification code dialog will appear shortly. Enter the code on the provider website.'
                    : 'Complete the authentication in your browser. This dialog closes automatically.'}
                </p>
              </div>

              {/* Auth URL section - only for Authorization Code flows, NOT Device Code */}
              {authFlow.authUrl && !authFlow.isDeviceCodeFlow && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Open this URL in any browser to sign in:</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground break-all font-mono line-clamp-3">
                        {authFlow.authUrl}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                          {copied ? (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!authFlow.authUrl) return;
                            const popup = window.open(authFlow.authUrl, '_blank');
                            if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                              toast.warning(
                                'Popup blocked. Copy the URL above and open it manually in your browser.',
                                { duration: 5000 }
                              );
                            }
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Callback paste field */}
                  <div className="space-y-2">
                    <Label htmlFor="callback-url" className="text-xs">
                      Redirect didn&apos;t work? Paste the callback URL:
                    </Label>
                    <Input
                      id="callback-url"
                      value={callbackUrl}
                      onChange={(e) => setCallbackUrl(e.target.value)}
                      placeholder="Paste the redirect URL here..."
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSubmitCallback}
                      disabled={!callbackUrl.trim() || authFlow.isSubmittingCallback}
                    >
                      {authFlow.isSubmittingCallback ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Callback'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {!authFlow.authUrl && !authFlow.isDeviceCodeFlow && (
                <p className="text-xs text-center text-muted-foreground">
                  Preparing sign-in URL...
                </p>
              )}
            </div>
          )}

          {/* Persist error visibility outside auth-only UI states */}
          {errorMessage && <p className="text-xs text-center text-destructive">{errorMessage}</p>}

          {/* Kiro import loading */}
          {kiroImportMutation.isPending && (
            <p className="text-sm text-center text-muted-foreground">
              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
              Importing token from Kiro IDE...
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            {isKiro && !showAuthUI && (
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
            {!showAuthUI && (
              <Button
                onClick={handleAuthenticate}
                disabled={
                  isPending ||
                  isAgyBypassStatePending ||
                  (requiresNickname && !nicknameTrimmed) ||
                  (requiresAgyResponsibilityFlow && !isAgyRiskChecklistComplete) ||
                  (requiresSafetyAcknowledgement && !acknowledgedRisk)
                }
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Authenticate
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
