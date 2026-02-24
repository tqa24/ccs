import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AccountSafetyWarningCardProps {
  className?: string;
  provider?: 'gemini' | 'agy';
  showAcknowledgement?: boolean;
  acknowledged?: boolean;
  onAcknowledgedChange?: (value: boolean) => void;
  disabled?: boolean;
}

export function AccountSafetyWarningCard({
  className,
  provider = 'gemini',
  showAcknowledgement = false,
  acknowledged = false,
  onAcknowledgedChange,
  disabled = false,
}: AccountSafetyWarningCardProps) {
  const isAgy = provider === 'agy';

  const title = isAgy ? 'Antigravity OAuth Risk' : 'Account Safety Warning';
  const subtitle = isAgy
    ? 'Issue #509 · Third-party OAuth ban risk'
    : 'Issue #509 · Shared Gemini + AGY account risk';
  const firstLine = isAgy ? (
    <>
      Antigravity OAuth currently has active ban/suspension patterns. Complete the responsibility
      steps before running auth or starting <code className="font-mono">ccs agy</code>.
    </>
  ) : (
    <>
      Using one Google account for both <code className="font-mono">ccs gemini</code> and{' '}
      <code className="font-mono">ccs agy</code> can trigger account disable/ban.
    </>
  );
  const secondLine = isAgy ? (
    <>If you want to keep this account, do not continue unless you accept full responsibility.</>
  ) : (
    <>If you want to keep Google AI access, do not continue this shared-account setup.</>
  );
  const issueUrl = 'https://github.com/kaitranntt/ccs/issues/509';
  const issueLabel = 'Read issue #509';

  return (
    <section
      role="alert"
      className={cn(
        'relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-50 via-background to-rose-50/70 shadow-sm dark:from-amber-950/20 dark:to-rose-950/20',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-5">{title}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-700 dark:text-amber-300"
          >
            High Risk
          </Badge>
        </div>

        <div className="space-y-2 text-sm leading-relaxed">
          <p>{firstLine}</p>
          <p className="font-medium text-amber-900 dark:text-amber-200">{secondLine}</p>
          <p className="text-xs text-muted-foreground">
            CCS is provided as-is and does not take responsibility for suspension, bans, or access
            loss from upstream providers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={issueUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/15 dark:text-amber-200"
          >
            {issueLabel}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <span className="rounded-md border border-border/70 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
            Applies to CLI and dashboard auth
          </span>
        </div>

        {showAcknowledgement && onAcknowledgedChange && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
            <div className="flex items-start gap-2">
              <Checkbox
                id="account-risk-ack"
                checked={acknowledged}
                onCheckedChange={(checked) => onAcknowledgedChange(Boolean(checked))}
                disabled={disabled}
              />
              <Label htmlFor="account-risk-ack" className="text-xs leading-5">
                I understand this risk and that CCS takes no responsibility if I continue this
                setup.
              </Label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
