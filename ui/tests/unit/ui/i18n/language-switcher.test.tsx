import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@tests/setup/test-utils';
import i18n from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { TabNavigation } from '@/pages/settings/components/tab-navigation';
import { getInitialLocale, LOCALE_STORAGE_KEY, persistLocale } from '@/lib/locales';

describe('Dashboard i18n', () => {
  const storage = new Map<string, string>();
  const localStorageMock = window.localStorage as unknown as {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storage.clear();
    localStorageMock.getItem.mockImplementation((key: string) => storage.get(key) ?? null);
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      storage.set(key, value);
    });
    localStorageMock.removeItem.mockImplementation((key: string) => {
      storage.delete(key);
    });
    localStorageMock.clear.mockImplementation(() => {
      storage.clear();
    });
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    await i18n.changeLanguage('en');
  });

  it(
    'renders language switcher and changes locale',
    async () => {
      render(<LanguageSwitcher />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Simplified Chinese'));

    await waitFor(() => {
      expect(i18n.language).toBe('zh-CN');
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'zh-CN');
    },
    10000
  );

  it('restores locale from persisted storage', () => {
    persistLocale('zh-CN');
    expect(getInitialLocale()).toBe('zh-CN');
  });

  it('shows Chinese labels on translated settings tabs', async () => {
    await i18n.changeLanguage('zh-CN');

    render(<TabNavigation activeTab="websearch" onTabChange={() => {}} />);

    expect(screen.getByText('网页')).toBeInTheDocument();
    expect(screen.getByText('环境')).toBeInTheDocument();
    expect(screen.getByText('认证')).toBeInTheDocument();
  });
});
