const LAST_ROUTE_STORAGE_KEY = 'ccs-dashboard:last-route';
const NON_RESTORABLE_PATHS = new Set(['/login']);

export function storeLastRoute(pathname: string, search = '', hash = ''): void {
  try {
    localStorage.setItem(LAST_ROUTE_STORAGE_KEY, `${pathname}${search}${hash}`);
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

export function getStoredLastRoute(): string | null {
  try {
    const route = localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    if (!route || !route.startsWith('/')) {
      return null;
    }

    const pathOnly = route.split(/[?#]/, 1)[0];
    if (NON_RESTORABLE_PATHS.has(pathOnly)) {
      return null;
    }

    return route;
  } catch {
    return null;
  }
}

export function shouldRestoreRoute(route: string | null): route is string {
  if (!route) {
    return false;
  }

  const pathOnly = route.split(/[?#]/, 1)[0];
  return pathOnly !== '/' && !NON_RESTORABLE_PATHS.has(pathOnly);
}
