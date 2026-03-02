/**
 * GlobalEnv Section
 * Settings section for global environment variables
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { RefreshCw, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useGlobalEnvConfig, useRawConfig } from '../hooks';
import { useTranslation } from 'react-i18next';

export default function GlobalEnvSection() {
  const { t } = useTranslation();
  const {
    config,
    loading,
    saving,
    error,
    success,
    newEnvKey,
    setNewEnvKey,
    newEnvValue,
    setNewEnvValue,
    fetchConfig,
    saveConfig,
    addEnvVar,
    removeEnvVar,
  } = useGlobalEnvConfig();

  const { fetchRawConfig } = useRawConfig();

  // Load data on mount
  useEffect(() => {
    fetchConfig();
    fetchRawConfig();
  }, [fetchConfig, fetchRawConfig]);

  const toggleGlobalEnv = () => {
    saveConfig({ enabled: !config?.enabled });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>{t('settings.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast-style alerts */}
      <div
        className={`absolute left-5 right-5 top-20 z-10 transition-all duration-200 ease-out ${
          error || success
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {error && (
          <Alert variant="destructive" className="py-2 shadow-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-200 bg-green-50 text-green-700 shadow-lg dark:border-green-900/50 dark:bg-green-900/90 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{t('settings.saved')}</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          <p className="text-sm text-muted-foreground">{t('settingsGlobalEnv.description')}</p>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">
                {config?.enabled ? t('settingsGlobalEnv.enabled') : t('settingsGlobalEnv.disabled')}
              </p>
              <p className="text-sm text-muted-foreground">
                {config?.enabled
                  ? t('settingsGlobalEnv.enabledDesc')
                  : t('settingsGlobalEnv.disabledDesc')}
              </p>
            </div>
            <Switch checked={config?.enabled ?? true} onCheckedChange={toggleGlobalEnv} />
          </div>

          {/* Current Environment Variables */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">{t('settingsGlobalEnv.envVars')}</h3>

            {config?.env && Object.keys(config.env).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(config.env).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-background"
                  >
                    <code className="flex-1 font-mono text-sm truncate">{key}</code>
                    <span className="text-muted-foreground">=</span>
                    <code className="font-mono text-sm px-2 py-1 bg-muted rounded">{value}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEnvVar(key)}
                      disabled={saving}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
                <p>{t('settingsGlobalEnv.noneConfigured')}</p>
              </div>
            )}

            {/* Add New Variable */}
            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-medium mb-3">{t('settingsGlobalEnv.addNew')}</h4>
              <div className="flex gap-2">
                <Input
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                  placeholder={t('settingsGlobalEnv.keyName')}
                  className="flex-1 font-mono text-sm h-9"
                  disabled={saving}
                />
                <span className="flex items-center text-muted-foreground">=</span>
                <Input
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  placeholder={t('settingsGlobalEnv.value')}
                  className="flex-1 font-mono text-sm h-9"
                  disabled={saving}
                />
                <Button
                  size="sm"
                  onClick={addEnvVar}
                  disabled={saving || !newEnvKey.trim()}
                  className="h-9"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('settingsGlobalEnv.add')}
                </Button>
              </div>
            </div>

            {/* Common Variables Quick Add */}
            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-medium mb-3">{t('settingsGlobalEnv.quickAdd')}</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'DISABLE_BUG_COMMAND', value: '1' },
                  { key: 'DISABLE_ERROR_REPORTING', value: '1' },
                  { key: 'DISABLE_TELEMETRY', value: '1' },
                ].map(
                  ({ key, value }) =>
                    !config?.env?.[key] && (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewEnvKey(key);
                          setNewEnvValue(value);
                        }}
                        className="text-xs font-mono"
                      >
                        + {key}
                      </Button>
                    )
                )}
                {config?.env &&
                  ['DISABLE_BUG_COMMAND', 'DISABLE_ERROR_REPORTING', 'DISABLE_TELEMETRY'].every(
                    (k) => config.env[k]
                  ) && (
                    <span className="text-sm text-muted-foreground">
                      {t('settingsGlobalEnv.allConfigured')}
                    </span>
                  )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchConfig();
            fetchRawConfig();
          }}
          disabled={loading || saving}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('settings.refresh')}
        </Button>
      </div>
    </>
  );
}
