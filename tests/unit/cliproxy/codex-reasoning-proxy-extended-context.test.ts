import * as http from 'http';
import { afterEach, describe, expect, it } from 'bun:test';
import {
  buildCodexModelEffortMap,
  CodexReasoningProxy,
  getEffortForModel,
} from '../../../src/cliproxy/codex-reasoning-proxy';

type JsonRecord = Record<string, unknown>;

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function listenOnRandomPort(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || !address) {
        reject(new Error('Failed to resolve server address'));
        return;
      }
      resolve(address.port);
    });
  });
}

function postJson(
  url: string,
  body: JsonRecord
): Promise<{ statusCode: number; body: JsonRecord }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = JSON.stringify(body);

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          let parsedResponse: JsonRecord = {};
          try {
            parsedResponse = responseBody ? (JSON.parse(responseBody) as JsonRecord) : {};
          } catch {
            parsedResponse = {};
          }
          resolve({ statusCode: res.statusCode ?? 0, body: parsedResponse });
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('CodexReasoningProxy extended-context compatibility', () => {
  const cleanupServers: http.Server[] = [];

  afterEach(async () => {
    while (cleanupServers.length > 0) {
      const server = cleanupServers.pop();
      if (server) {
        await closeServer(server);
      }
    }
  });

  it('normalizes [1m] suffixes in effort map lookups', () => {
    const map = buildCodexModelEffortMap({
      defaultModel: 'gpt-5.3-codex-xhigh[1m]',
      sonnetModel: 'gpt-5.3-codex-high[1m]',
      haikuModel: 'gpt-5-mini-medium[1m]',
    });

    expect(getEffortForModel('gpt-5.3-codex-high', map, 'medium')).toBe('high');
    expect(getEffortForModel('gpt-5-mini-medium', map, 'high')).toBe('medium');
  });

  it('strips [1m] and codex effort suffixes before forwarding upstream', async () => {
    let capturedBody: JsonRecord | null = null;
    let capturedPath = '';

    const upstream = http.createServer((req, res) => {
      let rawBody = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        rawBody += chunk;
      });
      req.on('end', () => {
        capturedPath = req.url || '';
        capturedBody = rawBody ? (JSON.parse(rawBody) as JsonRecord) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    cleanupServers.push(upstream);

    const upstreamPort = await listenOnRandomPort(upstream);
    const proxy = new CodexReasoningProxy({
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}`,
      modelMap: {
        defaultModel: 'gpt-5.3-codex-xhigh[1m]',
        opusModel: 'gpt-5.3-codex-xhigh[1m]',
        sonnetModel: 'gpt-5.3-codex-high[1m]',
        haikuModel: 'gpt-5-mini-medium[1m]',
      },
      defaultEffort: 'medium',
    });

    const proxyPort = await proxy.start();
    const response = await postJson(
      `http://127.0.0.1:${proxyPort}/api/provider/codex/v1/messages`,
      {
        model: 'gpt-5.3-codex-high[1m]',
        messages: [],
      }
    );

    proxy.stop();

    expect(response.statusCode).toBe(200);
    expect(capturedPath).toBe('/api/provider/codex/v1/messages');
    expect(capturedBody?.model).toBe('gpt-5.3-codex');
    expect((capturedBody?.reasoning as JsonRecord | undefined)?.effort).toBe('high');
  });
});
