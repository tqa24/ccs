/**
 * Cursor Executor
 * Handles HTTP/2 requests to Cursor API with protobuf encoding/decoding
 */

import * as crypto from 'crypto';
import * as zlib from 'zlib';
import type { IncomingHttpHeaders } from 'http';
import { generateCursorBody, extractTextFromResponse } from './cursor-protobuf.js';
import { buildCursorRequest } from './cursor-translator.js';
import type { CursorTool } from './cursor-protobuf-schema.js';

import { COMPRESS_FLAG } from './cursor-protobuf-schema.js';

/** Cursor credentials structure */
interface CursorCredentials {
  accessToken: string;
  machineId: string;
  ghostMode?: boolean;
}

/** Executor parameters */
interface ExecutorParams {
  model: string;
  body: {
    messages: Array<{
      role: string;
      content: string | Array<{ type: string; text?: string }>;
      name?: string;
      tool_call_id?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    }>;
    tools?: CursorTool[];
    reasoning_effort?: string;
  };
  stream: boolean;
  credentials: CursorCredentials;
  signal?: AbortSignal;
}

/** HTTP/2 response structure */
interface Http2Response {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

/** Detect cloud environment */
function isCloudEnv(): boolean {
  if (
    typeof globalThis !== 'undefined' &&
    'caches' in globalThis &&
    typeof (globalThis as { caches?: unknown }).caches === 'object'
  )
    return true;
  try {
    // Check for EdgeRuntime without causing compilation error
    if (typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== 'undefined') return true;
  } catch {
    // Continue
  }
  return false;
}

/** Lazy import http2 */
let http2Module: typeof import('http2') | null = null;
async function getHttp2() {
  if (http2Module) return http2Module;
  if (!isCloudEnv()) {
    try {
      http2Module = await import('http2');
      return http2Module;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Decompress payload if needed
 */
function decompressPayload(payload: Buffer, flags: number): Buffer {
  // Check if payload is JSON error
  if (payload.length > 10 && payload[0] === 0x7b && payload[1] === 0x22) {
    try {
      const text = payload.toString('utf-8');
      if (text.startsWith('{"error"')) {
        return payload;
      }
    } catch {
      // Continue
    }
  }

  if (
    flags === COMPRESS_FLAG.GZIP ||
    flags === COMPRESS_FLAG.GZIP_ALT ||
    flags === COMPRESS_FLAG.GZIP_BOTH
  ) {
    try {
      return zlib.gunzipSync(payload);
    } catch {
      return payload;
    }
  }
  return payload;
}

/**
 * Create error response from JSON error
 */
function createErrorResponse(jsonError: {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ debug?: { details?: { title?: string; detail?: string }; error?: string } }>;
  };
}): Response {
  const errorMsg =
    jsonError?.error?.details?.[0]?.debug?.details?.title ||
    jsonError?.error?.details?.[0]?.debug?.details?.detail ||
    jsonError?.error?.message ||
    'API Error';

  const isRateLimit = jsonError?.error?.code === 'resource_exhausted';

  return new Response(
    JSON.stringify({
      error: {
        message: errorMsg,
        type: isRateLimit ? 'rate_limit_error' : 'api_error',
        code: jsonError?.error?.details?.[0]?.debug?.error || 'unknown',
      },
    }),
    {
      status: isRateLimit ? 429 : 400,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export class CursorExecutor {
  private readonly baseUrl = 'https://api2.cursor.sh';
  private readonly chatPath = '/aiserver.v1.AiService/StreamChat';

  buildUrl(): string {
    return `${this.baseUrl}${this.chatPath}`;
  }

  /**
   * Generate checksum using Jyh cipher (time-based XOR with rolling key seed=165)
   */
  generateChecksum(machineId: string): string {
    const timestamp = Math.floor(Date.now() / 1000000);
    // JS bitwise shifts wrap modulo 32, so >>40 and >>32 give wrong results.
    // Use Math.trunc division for upper bytes that exceed 32-bit range.
    const byteArray = new Uint8Array([
      Math.trunc(timestamp / 2 ** 40) & 0xff,
      Math.trunc(timestamp / 2 ** 32) & 0xff,
      (timestamp >>> 24) & 0xff,
      (timestamp >>> 16) & 0xff,
      (timestamp >>> 8) & 0xff,
      timestamp & 0xff,
    ]);

    let t = 165;
    for (let i = 0; i < byteArray.length; i++) {
      byteArray[i] = ((byteArray[i] ^ t) + (i % 256)) & 0xff;
      t = byteArray[i];
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let encoded = '';

    for (let i = 0; i < byteArray.length; i += 3) {
      const a = byteArray[i];
      const b = i + 1 < byteArray.length ? byteArray[i + 1] : 0;
      const c = i + 2 < byteArray.length ? byteArray[i + 2] : 0;

      encoded += alphabet[a >> 2];
      encoded += alphabet[((a & 3) << 4) | (b >> 4)];

      if (i + 1 < byteArray.length) {
        encoded += alphabet[((b & 15) << 2) | (c >> 6)];
      }
      if (i + 2 < byteArray.length) {
        encoded += alphabet[c & 63];
      }
    }

    return `${encoded}${machineId}`;
  }

  buildHeaders(credentials: CursorCredentials): Record<string, string> {
    const accessToken = credentials.accessToken;
    const machineId = credentials.machineId;
    const ghostMode = credentials.ghostMode !== false;

    if (!machineId) {
      throw new Error('Machine ID is required for Cursor API');
    }

    const delimIdx = accessToken.indexOf('::');
    const cleanToken = delimIdx !== -1 ? accessToken.slice(delimIdx + 2) : accessToken;

    return {
      authorization: `Bearer ${cleanToken}`,
      'connect-accept-encoding': 'gzip',
      'connect-protocol-version': '1',
      'content-type': 'application/connect+proto',
      'user-agent': 'connect-es/1.6.1',
      'x-amzn-trace-id': `Root=${crypto.randomUUID()}`,
      'x-client-key': crypto.createHash('sha256').update(cleanToken).digest('hex'),
      'x-cursor-checksum': this.generateChecksum(machineId),
      'x-cursor-client-version': '2.3.41',
      'x-cursor-client-type': 'ide',
      'x-cursor-client-os':
        process.platform === 'win32'
          ? 'windows'
          : process.platform === 'darwin'
            ? 'macos'
            : 'linux',
      'x-cursor-client-arch': process.arch === 'arm64' ? 'aarch64' : 'x64',
      'x-cursor-client-device-type': 'desktop',
      'x-cursor-config-version': crypto.randomUUID(),
      'x-cursor-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      'x-ghost-mode': ghostMode ? 'true' : 'false',
      'x-request-id': crypto.randomUUID(),
      'x-session-id': crypto.createHash('sha256').update(cleanToken).digest('hex').substring(0, 36),
    };
  }

  transformRequest(
    model: string,
    body: ExecutorParams['body'],
    stream: boolean,
    credentials: CursorCredentials
  ): Uint8Array {
    const translatedBody = buildCursorRequest(model, body, stream, credentials);
    const messages = translatedBody.messages || [];
    const tools = (translatedBody.tools || body.tools || []) as CursorTool[];
    const reasoningEffort = body.reasoning_effort || null;
    return generateCursorBody(messages, model, tools, reasoningEffort);
  }

  async makeFetchRequest(
    url: string,
    headers: Record<string, string>,
    body: Uint8Array,
    signal?: AbortSignal
  ): Promise<Http2Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal,
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      headers: responseHeaders,
      body: Buffer.from(await response.arrayBuffer()),
    };
  }

  async makeHttp2Request(
    url: string,
    headers: Record<string, string>,
    body: Uint8Array,
    signal?: AbortSignal
  ): Promise<Http2Response> {
    const http2 = await getHttp2();
    if (!http2) {
      throw new Error('http2 module not available');
    }

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = http2.connect(`https://${urlObj.host}`);
      const chunks: Buffer[] = [];
      let responseHeaders: IncomingHttpHeaders = {};

      client.on('error', (err) => {
        client.close();
        reject(err);
      });

      const req = client.request({
        ':method': 'POST',
        ':path': urlObj.pathname,
        ':authority': urlObj.host,
        ':scheme': 'https',
        ...headers,
      });

      req.on('response', (hdrs) => {
        responseHeaders = hdrs;
      });
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        client.close();
        resolve({
          status: Number(responseHeaders[':status']),
          headers: responseHeaders,
          body: Buffer.concat(chunks),
        });
      });
      req.on('error', (err) => {
        client.close();
        reject(err);
      });

      if (signal) {
        const onAbort = () => {
          req.close();
          client.close();
          reject(new Error('Request aborted'));
        };
        signal.addEventListener('abort', onAbort, { once: true });

        const cleanup = () => {
          signal.removeEventListener('abort', onAbort);
        };
        req.on('end', cleanup);
        req.on('error', cleanup);
      }

      req.write(body);
      req.end();
    });
  }

  async execute(params: ExecutorParams): Promise<{
    response: Response;
    url: string;
    headers: Record<string, string>;
    transformedBody: ExecutorParams['body'];
  }> {
    const { model, body, stream, credentials, signal } = params;
    const url = this.buildUrl();
    const headers = this.buildHeaders(credentials);
    const transformedBody = this.transformRequest(model, body, stream, credentials);

    try {
      const http2 = await getHttp2();
      const response = http2
        ? await this.makeHttp2Request(url, headers, transformedBody, signal)
        : await this.makeFetchRequest(url, headers, transformedBody, signal);

      if (response.status !== 200) {
        const errorText = response.body?.toString() || 'Unknown error';
        const errorResponse = new Response(
          JSON.stringify({
            error: {
              message: `[${response.status}]: ${errorText}`,
              type: 'invalid_request_error',
              code: '',
            },
          }),
          {
            status: response.status,
            headers: { 'Content-Type': 'application/json' },
          }
        );
        return { response: errorResponse, url, headers, transformedBody: body };
      }

      const transformedResponse =
        stream !== false
          ? this.transformProtobufToSSE(response.body, model, body)
          : this.transformProtobufToJSON(response.body, model, body);

      return { response: transformedResponse, url, headers, transformedBody: body };
    } catch (error) {
      const errorResponse = new Response(
        JSON.stringify({
          error: {
            message: (error as Error).message,
            type: 'connection_error',
            code: '',
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return { response: errorResponse, url, headers, transformedBody: body };
    }
  }

  transformProtobufToJSON(buffer: Buffer, model: string, _body: ExecutorParams['body']): Response {
    const responseId = `chatcmpl-cursor-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    let offset = 0;
    let totalContent = '';
    const toolCalls: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }> = [];
    const toolCallsMap = new Map<
      string,
      {
        id: string;
        type: string;
        function: { name: string; arguments: string };
        isLast: boolean;
        index: number;
      }
    >();

    while (offset < buffer.length) {
      if (offset + 5 > buffer.length) break;

      const flags = buffer[offset];
      const length = buffer.readUInt32BE(offset + 1);

      if (offset + 5 + length > buffer.length) break;

      let payload = buffer.slice(offset + 5, offset + 5 + length);
      offset += 5 + length;

      payload = decompressPayload(payload, flags);

      try {
        const text = payload.toString('utf-8');
        if (text.startsWith('{') && text.includes('"error"')) {
          return createErrorResponse(JSON.parse(text));
        }
      } catch {
        // Continue
      }

      const result = extractTextFromResponse(new Uint8Array(payload));

      if (result.error) {
        return new Response(
          JSON.stringify({
            error: {
              message: result.error,
              type: 'rate_limit_error',
              code: 'rate_limited',
            },
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (result.toolCall) {
        const tc = result.toolCall;

        if (toolCallsMap.has(tc.id)) {
          const existing = toolCallsMap.get(tc.id);
          if (!existing) continue;
          existing.function.arguments += tc.function.arguments;
          existing.isLast = tc.isLast;
        } else {
          toolCallsMap.set(tc.id, {
            ...tc,
            index: toolCallsMap.size,
          });
        }

        if (tc.isLast) {
          const finalToolCall = toolCallsMap.get(tc.id);
          if (!finalToolCall) continue;
          toolCalls.push({
            id: finalToolCall.id,
            type: finalToolCall.type,
            function: {
              name: finalToolCall.function.name,
              arguments: finalToolCall.function.arguments,
            },
          });
        }
      }

      if (result.text) totalContent += result.text;
    }

    // Finalize remaining tool calls
    for (const id of Array.from(toolCallsMap.keys())) {
      const tc = toolCallsMap.get(id);
      if (!tc) continue;
      if (!toolCalls.find((t) => t.id === id)) {
        toolCalls.push({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        });
      }
    }

    const message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    } = {
      role: 'assistant',
      content: totalContent || null,
    };

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    const completion = {
      id: responseId,
      object: 'chat.completion',
      created,
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    return new Response(JSON.stringify(completion), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  transformProtobufToSSE(buffer: Buffer, model: string, _body: ExecutorParams['body']): Response {
    // TODO: Implement true streaming — currently buffers entire response before transforming.
    // This should pipe HTTP/2 data events through a TransformStream for incremental SSE output.
    const responseId = `chatcmpl-cursor-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    const chunks: string[] = [];
    let offset = 0;
    const toolCalls: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
      index: number;
    }> = [];
    const toolCallsMap = new Map<
      string,
      {
        id: string;
        type: string;
        function: { name: string; arguments: string };
        isLast: boolean;
        index: number;
      }
    >();

    while (offset < buffer.length) {
      if (offset + 5 > buffer.length) break;

      const flags = buffer[offset];
      const length = buffer.readUInt32BE(offset + 1);

      if (offset + 5 + length > buffer.length) break;

      let payload = buffer.slice(offset + 5, offset + 5 + length);
      offset += 5 + length;

      payload = decompressPayload(payload, flags);

      try {
        const text = payload.toString('utf-8');
        if (text.startsWith('{') && text.includes('"error"')) {
          return createErrorResponse(JSON.parse(text));
        }
      } catch {
        // Continue
      }

      const result = extractTextFromResponse(new Uint8Array(payload));

      if (result.error) {
        return new Response(
          JSON.stringify({
            error: {
              message: result.error,
              type: 'rate_limit_error',
              code: 'rate_limited',
            },
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (result.toolCall) {
        const tc = result.toolCall;

        if (chunks.length === 0) {
          chunks.push(
            `data: ${JSON.stringify({
              id: responseId,
              object: 'chat.completion.chunk',
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: { role: 'assistant', content: '' },
                  finish_reason: null,
                },
              ],
            })}\n\n`
          );
        }

        if (toolCallsMap.has(tc.id)) {
          const existing = toolCallsMap.get(tc.id);
          if (!existing) continue;
          existing.function.arguments += tc.function.arguments;
          existing.isLast = tc.isLast;

          if (tc.function.arguments) {
            chunks.push(
              `data: ${JSON.stringify({
                id: responseId,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      tool_calls: [
                        {
                          index: existing.index,
                          id: tc.id,
                          type: 'function',
                          function: {
                            name: tc.function.name,
                            arguments: tc.function.arguments,
                          },
                        },
                      ],
                    },
                    finish_reason: null,
                  },
                ],
              })}\n\n`
            );
          }
        } else {
          const toolCallIndex = toolCalls.length;
          toolCalls.push({ ...tc, index: toolCallIndex });
          toolCallsMap.set(tc.id, { ...tc, index: toolCallIndex });

          chunks.push(
            `data: ${JSON.stringify({
              id: responseId,
              object: 'chat.completion.chunk',
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        index: toolCallIndex,
                        id: tc.id,
                        type: 'function',
                        function: {
                          name: tc.function.name,
                          arguments: tc.function.arguments,
                        },
                      },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            })}\n\n`
          );
        }
      }

      if (result.text) {
        chunks.push(
          `data: ${JSON.stringify({
            id: responseId,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [
              {
                index: 0,
                delta:
                  chunks.length === 0 && toolCalls.length === 0
                    ? { role: 'assistant', content: result.text }
                    : { content: result.text },
                finish_reason: null,
              },
            ],
          })}\n\n`
        );
      }
    }

    if (chunks.length === 0 && toolCalls.length === 0) {
      chunks.push(
        `data: ${JSON.stringify({
          id: responseId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: '' },
              finish_reason: null,
            },
          ],
        })}\n\n`
      );
    }

    chunks.push(
      `data: ${JSON.stringify({
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      })}\n\n`
    );
    chunks.push('data: [DONE]\n\n');

    return new Response(chunks.join(''), {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }
}

export default CursorExecutor;
