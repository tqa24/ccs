/**
 * Tab Navigation Component
 * Settings page tab switcher with icons
 */

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Settings2, Server, KeyRound, Archive } from 'lucide-react';
import type { SettingsTab } from '../types';

interface TabNavigationProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as SettingsTab)}>
      <TabsList className="w-full">
        <TabsTrigger value="websearch" className="flex-1 gap-2">
          <Globe className="w-4 h-4" />
          WebSearch
        </TabsTrigger>
        <TabsTrigger value="globalenv" className="flex-1 gap-2">
          <Settings2 className="w-4 h-4" />
          Global Env
        </TabsTrigger>
        <TabsTrigger value="proxy" className="flex-1 gap-2">
          <Server className="w-4 h-4" />
          Proxy
        </TabsTrigger>
        <TabsTrigger value="auth" className="flex-1 gap-2">
          <KeyRound className="w-4 h-4" />
          Auth
        </TabsTrigger>
        <TabsTrigger value="backups" className="flex-1 gap-2">
          <Archive className="w-4 h-4" />
          Backups
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
