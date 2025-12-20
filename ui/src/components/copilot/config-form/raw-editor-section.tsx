/**
 * Raw Editor Section
 * JSON editor panel for copilot settings
 */

import { Suspense, lazy } from 'react';
import { Loader2, X } from 'lucide-react';
import { GlobalEnvIndicator } from '@/components/shared/global-env-indicator';

// Lazy load CodeEditor
const CodeEditor = lazy(() =>
  import('@/components/shared/code-editor').then((m) => ({ default: m.CodeEditor }))
);

interface RawEditorSectionProps {
  rawJsonContent: string;
  isRawJsonValid: boolean;
  rawJsonEdits: string | null;
  rawSettingsEnv: Record<string, string> | undefined;
  onChange: (value: string) => void;
}

export function RawEditorSection({
  rawJsonContent,
  isRawJsonValid,
  rawJsonEdits,
  rawSettingsEnv,
  onChange,
}: RawEditorSectionProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading editor...</span>
        </div>
      }
    >
      <div className="h-full flex flex-col">
        {!isRawJsonValid && rawJsonEdits !== null && (
          <div className="mb-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2 mx-6 mt-4 shrink-0">
            <X className="w-4 h-4" />
            Invalid JSON syntax
          </div>
        )}
        <div className="flex-1 overflow-hidden px-6 pb-4 pt-4">
          <div className="h-full border rounded-md overflow-hidden bg-background">
            <CodeEditor
              value={rawJsonContent}
              onChange={onChange}
              language="json"
              minHeight="100%"
            />
          </div>
        </div>
        {/* Global Env Indicator */}
        <div className="mx-6 mb-4">
          <div className="border rounded-md overflow-hidden">
            <GlobalEnvIndicator profileEnv={rawSettingsEnv} />
          </div>
        </div>
      </div>
    </Suspense>
  );
}
