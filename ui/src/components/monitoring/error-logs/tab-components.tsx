/**
 * Tab Content Components for Error Logs Monitor
 * OverviewTab, HeadersTab, BodyTab, RawTab
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Info, Clock, Cpu, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getErrorTypeLabel,
  formatQuotaResetDelay,
  formatQuotaResetTimestamp,
  type ParsedErrorLog,
} from '@/lib/error-log-parser';
import { StatusBadge } from './ui-primitives';

/** Overview tab content */
export function OverviewTab({ parsed }: { parsed: ParsedErrorLog }) {
  const quotaResetDisplay =
    formatQuotaResetDelay(parsed.quotaResetDelay) ||
    formatQuotaResetTimestamp(parsed.quotaResetTimestamp);

  return (
    <div className="p-4 space-y-4">
      {/* Status row */}
      <div className="flex items-center gap-3">
        <StatusBadge code={parsed.statusCode} />
        <span className="text-sm font-medium">{parsed.statusText}</span>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/50">
          {getErrorTypeLabel(parsed.errorType)}
        </span>
      </div>

      {/* Model info - prominent display */}
      {parsed.model && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <Cpu className="w-4 h-4 text-violet-500 shrink-0" />
          <div className="text-sm">
            <span className="text-muted-foreground">Model: </span>
            <span className="font-semibold text-violet-600 dark:text-violet-400">
              {parsed.model}
            </span>
          </div>
        </div>
      )}

      {/* Quota reset info for 429 errors */}
      {parsed.errorType === 'rate_limit' && quotaResetDisplay && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="text-sm">
            <span className="text-muted-foreground">Quota resets in </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {quotaResetDisplay}
            </span>
          </div>
        </div>
      )}

      {/* Key metrics grid */}
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 rounded bg-muted/30 border border-border/50">
          <div className="text-muted-foreground mb-1">Method</div>
          <div className="font-medium">{parsed.method || 'N/A'}</div>
        </div>
        <div className="p-2.5 rounded bg-muted/30 border border-border/50">
          <div className="text-muted-foreground mb-1">Provider</div>
          <div className="font-medium">{parsed.provider || 'N/A'}</div>
        </div>
        <div className="p-2.5 rounded bg-muted/30 border border-border/50">
          <div className="text-muted-foreground mb-1">Version</div>
          <div className="font-medium">{parsed.version || 'N/A'}</div>
        </div>
        <div className="p-2.5 rounded bg-muted/30 border border-border/50">
          <div className="text-muted-foreground mb-1">Endpoint</div>
          <div className="font-medium truncate" title={parsed.endpoint}>
            {parsed.endpoint || 'N/A'}
          </div>
        </div>
      </div>

      {/* URL */}
      <div className="text-xs">
        <div className="text-muted-foreground mb-1.5">URL</div>
        <div className="font-mono p-2.5 rounded bg-muted/30 border border-border/50 break-all leading-relaxed">
          {parsed.url || 'N/A'}
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-xs">
        <div className="text-muted-foreground mb-1.5">Timestamp</div>
        <div className="font-mono">{parsed.timestamp || 'N/A'}</div>
      </div>

      {/* Actionable suggestion based on error type */}
      {parsed.errorType !== 'unknown' && (
        <div
          className={cn(
            'flex items-start gap-3 p-3 rounded text-xs',
            parsed.errorType === 'rate_limit'
              ? 'bg-amber-500/10 border border-amber-500/20'
              : parsed.errorType === 'auth'
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-blue-500/10 border border-blue-500/20'
          )}
        >
          {parsed.errorType === 'rate_limit' ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
          ) : parsed.errorType === 'auth' ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
          ) : (
            <Info className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
          )}
          <div
            className={cn(
              'leading-relaxed',
              parsed.errorType === 'rate_limit'
                ? 'text-amber-600 dark:text-amber-400'
                : parsed.errorType === 'auth'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-blue-600 dark:text-blue-400'
            )}
          >
            {parsed.errorType === 'rate_limit' && (
              <>
                <strong>Rate Limited.</strong> Switch to a different account or wait for quota
                reset.
                {parsed.model && (
                  <>
                    {' '}
                    Model <code className="font-mono text-[11px]">{parsed.model}</code> has
                    exhausted quota.
                  </>
                )}
              </>
            )}
            {parsed.errorType === 'auth' &&
              'Authentication failed. Re-authenticate via CLIProxy Settings or check API key.'}
            {parsed.errorType === 'not_found' &&
              'Endpoint not found. This endpoint may not exist on this provider.'}
            {parsed.errorType === 'server' &&
              'Server error from upstream. Retry later or check provider status page.'}
            {parsed.errorType === 'timeout' &&
              'Request timed out. Check network connection or increase timeout settings.'}
          </div>
        </div>
      )}
    </div>
  );
}

/** Headers tab content */
export function HeadersTab({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground">No headers available</div>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-1">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex gap-3 text-xs font-mono py-1.5 border-b border-border/30 last:border-0"
          >
            <span className="text-muted-foreground shrink-0 min-w-[140px]">{key}:</span>
            <span className="break-all">{value}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/** JSON/Body tab content */
export function BodyTab({ content, label }: { content: string; label: string }) {
  if (!content || content.trim() === '') {
    return <div className="p-4 text-xs text-muted-foreground">No {label.toLowerCase()} body</div>;
  }

  // Try to format as JSON
  let formatted = content;
  let isJson = false;
  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
    isJson = true;
  } catch {
    // Not JSON, use as-is
  }

  return (
    <ScrollArea className="h-full">
      <pre
        className={cn(
          'p-4 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed',
          isJson
            ? 'text-emerald-700 dark:text-green-400'
            : 'text-zinc-700 dark:text-muted-foreground'
        )}
      >
        {formatted}
      </pre>
    </ScrollArea>
  );
}

/** Raw tab content */
export function RawTab({ content }: { content: string }) {
  return (
    <ScrollArea className="h-full">
      <pre className="p-4 text-xs font-mono text-zinc-700 dark:text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
        {content}
      </pre>
    </ScrollArea>
  );
}
