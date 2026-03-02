/**
 * Provider Card Component
 * Reusable card for CLI provider configuration in WebSearch section
 */

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Terminal, ExternalLink, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ProviderCardProps {
  name: string;
  label: string;
  badge: string;
  badgeColor: 'green' | 'blue' | 'purple';
  enabled: boolean;
  installed: boolean;
  statusLoading: boolean;
  saving: boolean;
  onToggle: () => void;
  modelInput?: string;
  setModelInput?: (v: string) => void;
  onModelBlur?: () => void;
  modelSaved?: boolean;
  modelPlaceholder?: string;
  showHint: boolean;
  setShowHint: (v: boolean) => void;
  installCmd: string;
  docsUrl: string;
  hintColor: 'amber' | 'blue' | 'purple';
}

export function ProviderCard({
  name,
  label,
  badge,
  badgeColor,
  enabled,
  installed,
  statusLoading,
  saving,
  onToggle,
  modelInput,
  setModelInput,
  onModelBlur,
  modelSaved,
  modelPlaceholder,
  showHint,
  setShowHint,
  installCmd,
  docsUrl,
  hintColor,
}: ProviderCardProps) {
  const { t } = useTranslation();
  const badgeClass =
    badgeColor === 'green'
      ? 'bg-green-500/10 text-green-600'
      : badgeColor === 'blue'
        ? 'bg-blue-500/10 text-blue-600'
        : 'bg-purple-500/10 text-purple-600';

  const hintBgClass =
    hintColor === 'amber'
      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
      : hintColor === 'blue'
        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
        : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300';

  const hintCodeClass =
    hintColor === 'amber'
      ? 'bg-amber-100 dark:bg-amber-900/40'
      : hintColor === 'blue'
        ? 'bg-blue-100 dark:bg-blue-900/40'
        : 'bg-purple-100 dark:bg-purple-900/40';

  const hintTextClass =
    hintColor === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : hintColor === 'blue'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-purple-600 dark:text-purple-400';

  const displayName =
    name === 'opencode' ? 'OpenCode' : name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <div
      className={`rounded-lg border transition-colors ${
        enabled ? 'border-primary border-l-4' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Terminal className={`w-5 h-5 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono font-medium">{name}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badgeClass}`}>
                {badge}
              </span>
              {installed ? (
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                  {t('settingsWebsearch.installed')}
                </span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                  {t('settingsWebsearch.notInstalled')}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} disabled={saving || !installed} />
      </div>

      {/* Model input when enabled */}
      {enabled && modelInput !== undefined && setModelInput && onModelBlur && (
        <div className="px-4 pb-4 pt-0">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              {t('settingsWebsearch.model')}
            </label>
            <Input
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              onBlur={onModelBlur}
              placeholder={modelPlaceholder}
              className="h-8 text-sm font-mono"
              disabled={saving}
            />
            {modelSaved && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs animate-in fade-in duration-200">
                <Check className="w-3.5 h-3.5" />
                {t('settings.saved')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Installation hint when not installed */}
      {!installed && !statusLoading && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50">
          <button
            onClick={() => setShowHint(!showHint)}
            className={`flex items-center gap-2 text-sm hover:underline w-full py-2 ${hintTextClass}`}
          >
            {showHint ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {t('settingsWebsearch.howInstall', { name: displayName })}
          </button>
          {showHint && (
            <div className={`mt-2 p-3 rounded-md text-sm ${hintBgClass}`}>
              <p className="mb-2">
                {t('settingsWebsearch.installGlobally')}{' '}
                {badge === 'GROK_API_KEY'
                  ? t('settingsWebsearch.requiresKey')
                  : t('settingsWebsearch.freeTier')}
                :
              </p>
              <code className={`text-sm px-2 py-1 rounded font-mono block mb-2 ${hintCodeClass}`}>
                {installCmd}
              </code>
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                {t('settingsWebsearch.viewDocs')}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
