/**
 * Settings Page
 * Main entry point with lazy-loaded sections and URL tab persistence
 */

import { lazy, Suspense, startTransition, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { RefreshCw, FileCode, Copy, Check, GripVertical } from 'lucide-react';
import { CodeEditor } from '@/components/shared/code-editor';
import { SettingsProvider } from './context';
import { useSettingsTab, useRawConfig } from './hooks';
import { TabNavigation } from './components/tab-navigation';
import { SectionSkeleton } from './components/section-skeleton';
import type { SettingsTab } from './types';

// Lazy-loaded sections
const WebSearchSection = lazy(() => import('./sections/websearch'));
const GlobalEnvSection = lazy(() => import('./sections/globalenv-section'));
const ProxySection = lazy(() => import('./sections/proxy'));
const AuthSection = lazy(() => import('./sections/auth-section'));

// Inner component that uses context
function SettingsPageInner() {
  const { activeTab, setActiveTab } = useSettingsTab();
  const {
    rawConfig,
    loading: rawConfigLoading,
    copied,
    fetchRawConfig,
    copyToClipboard,
  } = useRawConfig();

  // Fetch raw config on mount
  useEffect(() => {
    fetchRawConfig();
  }, [fetchRawConfig]);

  const handleTabChange = (tab: SettingsTab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  return (
    <div className="h-[calc(100vh-100px)]">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - Settings Controls */}
        <Panel defaultSize={40} minSize={30} maxSize={55}>
          <div className="h-full border-r flex flex-col bg-muted/30 relative">
            {/* Header with Tabs */}
            <div className="p-5 border-b bg-background">
              <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
            </div>

            {/* Tab Content */}
            <Suspense fallback={<SectionSkeleton />}>
              {activeTab === 'websearch' && <WebSearchSection />}
              {activeTab === 'globalenv' && <GlobalEnvSection />}
              {activeTab === 'proxy' && <ProxySection />}
              {activeTab === 'auth' && <AuthSection />}
            </Suspense>
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20 transition-colors cursor-col-resize flex items-center justify-center group">
          <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
        </PanelResizeHandle>

        {/* Right Panel - Config Viewer */}
        <Panel defaultSize={60} minSize={35}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-semibold">config.yaml</h2>
                  <p className="text-sm text-muted-foreground">~/.ccs/config.yaml</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={!rawConfig}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRawConfig}
                  disabled={rawConfigLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${rawConfigLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Config Content - scrollable */}
            <div className="flex-1 overflow-auto">
              {rawConfigLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : rawConfig ? (
                <CodeEditor
                  value={rawConfig}
                  onChange={() => {}}
                  language="yaml"
                  readonly
                  minHeight="auto"
                  className="min-h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Config file not found</p>
                    <code className="text-sm bg-muted px-2 py-1 rounded mt-2 inline-block">
                      ccs migrate
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Main export with context provider
export function SettingsPage() {
  return (
    <SettingsProvider>
      <SettingsPageInner />
    </SettingsProvider>
  );
}
