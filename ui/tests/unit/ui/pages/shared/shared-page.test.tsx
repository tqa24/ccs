import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@tests/setup/test-utils';
import { SharedPage } from '@/pages/shared';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

describe('SharedPage', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('shows an actionable error state when shared items request fails', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.endsWith('/api/shared/summary')) {
        return jsonResponse({
          commands: 0,
          skills: 0,
          agents: 0,
          total: 0,
          symlinkStatus: { valid: true, message: 'Symlinks active' },
        });
      }
      if (url.endsWith('/api/shared/commands')) {
        return jsonResponse({ error: 'Backend unavailable' }, 500);
      }

      return jsonResponse({ items: [] });
    });

    render(<SharedPage />);

    expect(await screen.findByText('Failed to load shared commands')).toBeInTheDocument();
    expect(screen.getByText('Backend unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows detail content and distinguishes no-match state from loaded results', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.endsWith('/api/shared/summary')) {
        return jsonResponse({
          commands: 1,
          skills: 0,
          agents: 0,
          total: 1,
          symlinkStatus: { valid: true, message: 'Symlinks active' },
        });
      }
      if (url.endsWith('/api/shared/commands')) {
        return jsonResponse({
          items: [
            {
              name: 'engineer/review',
              description: 'Review the latest PR changes.',
              path: '/tmp/commands/engineer/review.md',
              type: 'command',
            },
          ],
        });
      }
      if (url.includes('/api/shared/content?')) {
        return jsonResponse({
          content: '# Review\n\nFull review workflow',
          contentPath: '/tmp/commands/engineer/review.md',
        });
      }

      return jsonResponse({ items: [] });
    });

    render(<SharedPage />);

    expect(await screen.findByText('Showing 1 of 1 commands')).toBeInTheDocument();
    await waitFor(() => {
      const requestedUrls = fetchMock.mock.calls.map(([input]) => requestUrl(input));
      expect(requestedUrls.some((url) => url.includes('/api/shared/content?'))).toBe(true);
    });

    const searchInput = screen.getByRole('textbox', {
      name: 'Filter commands by name, description, or path',
    });
    await userEvent.type(searchInput, 'no-match');

    expect(await screen.findByText('No commands match "no-match".')).toBeInTheDocument();
  });

  it('shows offline guidance when network request fails', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url.endsWith('/api/shared/summary')) {
        throw new TypeError('Failed to fetch');
      }
      throw new TypeError('Failed to fetch');
    });

    render(<SharedPage />);

    expect(await screen.findByText('Counts unavailable')).toBeInTheDocument();
    expect(
      screen.getAllByText(
        'Connection to dashboard server lost or restarting. Keep `ccs config` running, then retry.'
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Retry counts' })).toBeInTheDocument();
  });
});
