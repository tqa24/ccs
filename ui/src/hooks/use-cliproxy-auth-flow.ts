/**
 * OAuth Auth Flow Hook for CLIProxy
 * Supports both auto-callback and manual callback flows
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { isValidProvider, isDeviceCodeProvider } from '@/lib/provider-config';

interface AuthFlowState {
  provider: string | null;
  isAuthenticating: boolean;
  error: string | null;
  /** Authorization URL for manual callback flow */
  authUrl: string | null;
  /** OAuth state parameter for polling */
  oauthState: string | null;
  /** Whether callback is being submitted */
  isSubmittingCallback: boolean;
  /** Whether this is a device code flow (ghcp, qwen, kiro) - dialog handled separately via WebSocket */
  isDeviceCodeFlow: boolean;
}

interface StartAuthOptions {
  nickname?: string;
  kiroMethod?: string;
  flowType?: 'authorization_code' | 'device_code';
  startEndpoint?: 'start' | 'start-url';
  riskAcknowledgement?: {
    version: string;
    reviewedIssue509: boolean;
    understandsBanRisk: boolean;
    acceptsFullResponsibility: boolean;
    typedPhrase: string;
  };
}

/** Polling interval for OAuth status check (3 seconds) */
const POLL_INTERVAL = 3000;
/** Maximum polling duration (5 minutes) */
const MAX_POLL_DURATION = 5 * 60 * 1000;

async function parseResponseBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const fallbackError =
      response.status >= 400 ? `Request failed with status ${response.status}` : undefined;
    return fallbackError ? { error: fallbackError } : {};
  }
}

/** Initial state for auth flow - extracted for DRY */
const INITIAL_STATE: AuthFlowState = {
  provider: null,
  isAuthenticating: false,
  error: null,
  authUrl: null,
  oauthState: null,
  isSubmittingCallback: false,
  isDeviceCodeFlow: false,
};

export function useCliproxyAuthFlow() {
  const [state, setState] = useState<AuthFlowState>(INITIAL_STATE);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const openedAuthUrlRef = useRef(false);
  const queryClient = useQueryClient();

  // Clear polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      stopPolling();
      openedAuthUrlRef.current = false;
    };
  }, [stopPolling]);

  // Poll OAuth status
  const pollStatus = useCallback(
    async (provider: string, oauthState: string) => {
      // Check timeout
      if (Date.now() - pollStartRef.current > MAX_POLL_DURATION) {
        stopPolling();
        setState((prev) => ({
          ...prev,
          isAuthenticating: false,
          error: 'Authentication timed out. Please try again.',
        }));
        return;
      }

      try {
        const response = await fetch(
          `/api/cliproxy/auth/${provider}/status?state=${encodeURIComponent(oauthState)}`
        );
        const data = (await response.json()) as {
          status?: string;
          error?: string;
          url?: string;
          auth_url?: string;
          verification_url?: string;
          user_code?: string;
        };

        if (data.status === 'ok') {
          stopPolling();
          queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
          queryClient.invalidateQueries({ queryKey: ['account-quota'] });
          toast.success(`${provider} authentication successful`);
          openedAuthUrlRef.current = false;
          setState(INITIAL_STATE);
        } else if (data.status === 'auth_url') {
          const authUrl = data.url || data.auth_url;
          if (authUrl) {
            setState((prev) => ({
              ...prev,
              authUrl,
            }));
            if (!openedAuthUrlRef.current) {
              openedAuthUrlRef.current = true;
              window.open(authUrl, '_blank');
            }
          }
        } else if (data.status === 'device_code') {
          stopPolling();
          const details =
            data.user_code && data.verification_url
              ? `Open ${data.verification_url} and enter code: ${data.user_code}`
              : 'Switch to Device Code method and try again.';
          toast.error('Provider returned Device Code flow in callback mode');
          setState((prev) => ({
            ...prev,
            isAuthenticating: false,
            error: details,
          }));
        } else if (data.status === 'error') {
          stopPolling();
          const errorMsg = data.error || 'Authentication failed';
          toast.error(errorMsg);
          setState((prev) => ({
            ...prev,
            isAuthenticating: false,
            error: errorMsg,
          }));
        }
        // status === 'wait' (or pending) means continue polling
      } catch {
        // Network error - continue polling
      }
    },
    [queryClient, stopPolling]
  );

  const startAuth = useCallback(
    async (provider: string, options?: StartAuthOptions) => {
      if (!isValidProvider(provider)) {
        setState({
          ...INITIAL_STATE,
          error: `Unknown provider: ${provider}`,
        });
        return;
      }

      // Abort any in-progress auth
      abortControllerRef.current?.abort();
      stopPolling();
      openedAuthUrlRef.current = false;

      // Create fresh controller and capture locally to avoid race with cancelAuth
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const flowType =
        options?.flowType ||
        (isDeviceCodeProvider(provider) ? 'device_code' : 'authorization_code');
      const deviceCodeFlow = flowType === 'device_code';
      const startEndpoint = options?.startEndpoint || (deviceCodeFlow ? 'start' : 'start-url');
      const payload = {
        nickname: options?.nickname,
        kiroMethod: options?.kiroMethod,
        riskAcknowledgement: options?.riskAcknowledgement,
      };

      setState({
        provider,
        isAuthenticating: true,
        error: null,
        authUrl: null,
        oauthState: null,
        isSubmittingCallback: false,
        isDeviceCodeFlow: deviceCodeFlow,
      });

      try {
        if (startEndpoint === 'start') {
          // /start spawns CLIProxy binary and blocks until completion.
          // For Device Code flows, userCode is delivered via WebSocket.
          fetch(`/api/cliproxy/auth/${provider}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
            .then(async (response) => {
              const data = await parseResponseBody(response);
              const success = data.success === true;
              if (response.ok && success) {
                queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
                queryClient.invalidateQueries({ queryKey: ['account-quota'] });
                // Note: No toast here - DeviceCodeDialog's useDeviceCode hook handles success toast
                // via deviceCodeCompleted WebSocket event to avoid duplicate toasts
                openedAuthUrlRef.current = false;
                setState(INITIAL_STATE);
              } else {
                const errorMsg =
                  typeof data.error === 'string' ? data.error : 'Authentication failed';
                toast.error(errorMsg);
                setState((prev) => ({
                  ...prev,
                  isAuthenticating: false,
                  error: errorMsg,
                }));
              }
            })
            .catch((error) => {
              if (error instanceof Error && error.name === 'AbortError') {
                // Cancelled - state already reset by cancelAuth
                return;
              }
              const message = error instanceof Error ? error.message : 'Authentication failed';
              toast.error(message);
              setState((prev) => ({
                ...prev,
                isAuthenticating: false,
                error: message,
              }));
            });
          // Don't await - keeps UI responsive while backend auth is in progress
        } else {
          // /start-url uses management API to bootstrap callback/social flows.
          const response = await fetch(`/api/cliproxy/auth/${provider}/start-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          const data = await parseResponseBody(response);
          const success = data.success === true;

          if (!response.ok || !success) {
            const errorMsg = typeof data.error === 'string' ? data.error : 'Failed to start OAuth';
            throw new Error(errorMsg);
          }

          const authUrl = typeof data.authUrl === 'string' ? data.authUrl : null;
          const oauthState = typeof data.state === 'string' ? data.state : null;

          // Update state with auth URL
          setState((prev) => ({
            ...prev,
            authUrl,
            oauthState,
          }));

          // Auto-open auth URL in new browser tab (fallback URL still shown in dialog)
          if (authUrl) {
            openedAuthUrlRef.current = true;
            window.open(authUrl, '_blank');
          }

          // Start polling for completion
          if (oauthState) {
            pollStartRef.current = Date.now();
            pollIntervalRef.current = setInterval(() => {
              pollStatus(provider, oauthState);
            }, POLL_INTERVAL);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          openedAuthUrlRef.current = false;
          setState(INITIAL_STATE);
          return;
        }
        const message = error instanceof Error ? error.message : 'Authentication failed';
        toast.error(message);
        setState((prev) => ({
          ...prev,
          isAuthenticating: false,
          error: message,
        }));
      }
    },
    [pollStatus, stopPolling, queryClient]
  );

  const cancelAuth = useCallback(() => {
    const currentProvider = state.provider;
    abortControllerRef.current?.abort();
    stopPolling();
    openedAuthUrlRef.current = false;
    setState(INITIAL_STATE);
    // Also cancel on backend
    if (currentProvider) {
      api.cliproxy.auth.cancel(currentProvider).catch(() => {
        // Ignore errors - session may have already completed
      });
    }
  }, [state.provider, stopPolling]);

  const submitCallback = useCallback(
    async (redirectUrl: string) => {
      if (!state.provider) return;

      setState((prev) => ({ ...prev, isSubmittingCallback: true, error: null }));

      try {
        const response = await fetch(`/api/cliproxy/auth/${state.provider}/submit-callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ redirectUrl }),
        });

        const data = await parseResponseBody(response);
        const success = data.success === true;

        if (response.ok && success) {
          stopPolling();
          queryClient.invalidateQueries({ queryKey: ['cliproxy-auth'] });
          queryClient.invalidateQueries({ queryKey: ['account-quota'] });
          toast.success(`${state.provider} authentication successful`);
          setState(INITIAL_STATE);
        } else {
          const errorMsg =
            typeof data.error === 'string' ? data.error : 'Callback submission failed';
          throw new Error(errorMsg);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit callback';
        toast.error(message);
        setState((prev) => ({ ...prev, isSubmittingCallback: false, error: message }));
      }
    },
    [state.provider, queryClient, stopPolling]
  );

  return useMemo(
    () => ({
      ...state,
      startAuth,
      cancelAuth,
      submitCallback,
    }),
    [state, startAuth, cancelAuth, submitCallback]
  );
}
