/**
 * Settings Tab URL Sync Hook
 */

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SettingsTab } from '../types';

export function useSettingsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: SettingsTab =
    tabParam === 'globalenv'
      ? 'globalenv'
      : tabParam === 'proxy'
        ? 'proxy'
        : tabParam === 'auth'
          ? 'auth'
          : 'websearch';

  const setActiveTab = useCallback(
    (tab: SettingsTab) => {
      setSearchParams({ tab }, { replace: true });
    },
    [setSearchParams]
  );

  return { activeTab, setActiveTab };
}
