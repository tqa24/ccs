import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeLastRoute } from '@/lib/last-route';

const LAST_ROUTE_STORAGE_KEY = 'ccs-dashboard:last-route';

describe('storeLastRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes pathname with search and hash', () => {
    storeLastRoute('/accounts', '?tab=auth', '#matrix');

    expect(localStorage.setItem).toHaveBeenCalledWith(
      LAST_ROUTE_STORAGE_KEY,
      '/accounts?tab=auth#matrix'
    );
  });

  it('writes pathname when search and hash are omitted', () => {
    storeLastRoute('/health');

    expect(localStorage.setItem).toHaveBeenCalledWith(LAST_ROUTE_STORAGE_KEY, '/health');
  });

  it('does not throw when localStorage write fails', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => storeLastRoute('/providers')).not.toThrow();
    setItemSpy.mockRestore();
  });
});
