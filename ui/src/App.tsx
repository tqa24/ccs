import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { ConnectionIndicator } from '@/components/connection-indicator';
import { LocalhostDisclaimer } from '@/components/localhost-disclaimer';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/query-client';
import {
  HomePage,
  ApiPage,
  CliproxyPage,
  AccountsPage,
  SettingsPage,
  HealthPage,
  SharedPage,
} from '@/pages';

function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between p-4 border-b">
          <SidebarTrigger />
          <div className="flex items-center gap-4">
            <ConnectionIndicator />
            <ThemeToggle />
          </div>
        </header>
        <Outlet />
      </main>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/api" element={<ApiPage />} />
            <Route path="/cliproxy" element={<CliproxyPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/shared" element={<SharedPage />} />
          </Route>
        </Routes>
        <Toaster position="top-right" />
        <LocalhostDisclaimer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
