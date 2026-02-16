/**
 * Cursor Protobuf Module Unit Tests
 * Tests encoder, decoder, translator, and executor components
 */

import { describe, it, expect } from 'bun:test';
import {
  encodeVarint,
  encodeField,
  wrapConnectRPCFrame,
  concatArrays,
} from '../../../src/cursor/cursor-protobuf-encoder';
import {
  decodeVarint,
  decodeField,
  parseConnectRPCFrame,
} from '../../../src/cursor/cursor-protobuf-decoder';
import { buildCursorRequest } from '../../../src/cursor/cursor-translator';
import { generateCursorBody } from '../../../src/cursor/cursor-protobuf';
import { CursorExecutor } from '../../../src/cursor/cursor-executor';
import { WIRE_TYPE, FIELD } from '../../../src/cursor/cursor-protobuf-schema';
import { StreamingFrameParser, decompressPayload } from '../../../src/cursor/cursor-stream-parser';

describe('Protobuf Encoding/Decoding', () => {
  describe('encodeVarint / decodeVarint round-trip', () => {
    it('should encode and decode 0', () => {
      const encoded = encodeVarint(0);
      const [decoded, offset] = decodeVarint(encoded, 0);
      expect(decoded).toBe(0);
      expect(offset).toBe(1);
    });

    it('should encode and decode 1', () => {
      const encoded = encodeVarint(1);
      const [decoded, offset] = decodeVarint(encoded, 0);
      expect(decoded).toBe(1);
      expect(offset).toBe(1);
    });

    it('should encode and decode 127', () => {
      const encoded = encodeVarint(127);
      const [decoded, offset] = decodeVarint(encoded, 0);
      expect(decoded).toBe(127);
      expect(offset).toBe(1);
    });

    it('should encode and decode 128', () => {
      const encoded = encodeVarint(128);
      const [decoded, offset] = decodeVarint(encoded, 0);
      expect(decoded).toBe(128);
      expect(offset).toBe(2);
    });

    it('should encode and decode 16383', () => {
      const encoded = encodeVarint(16383);
      const [decoded, offset] = decodeVarint(encoded, 0);
      expect(decoded).toBe(16383);
      expect(offset).toBe(2);
    });

    it('should encode and decode 0xFFFFFFFF', () => {
      const encoded = encodeVarint(0xffffffff);
      const [decoded, offset] = decodeVarint(encoded, 0);
      expect(decoded).toBe(0xffffffff);
      expect(offset).toBe(5);
    });
  });

  describe('encodeField / decodeField round-trip', () => {
    it('should encode and decode VARINT field', () => {
      const fieldNum = 5;
      const value = 42;
      const encoded = encodeField(fieldNum, WIRE_TYPE.VARINT, value);

      const [decodedFieldNum, wireType, decodedValue, offset] = decodeField(encoded, 0);
      expect(decodedFieldNum).toBe(fieldNum);
      expect(wireType).toBe(WIRE_TYPE.VARINT);
      expect(decodedValue).toBe(value);
      expect(offset).toBe(encoded.length);
    });

    it('should encode and decode LEN field with string', () => {
      const fieldNum = 10;
      const value = 'Hello, World!';
      const encoded = encodeField(fieldNum, WIRE_TYPE.LEN, value);

      const [decodedFieldNum, wireType, decodedValue, offset] = decodeField(encoded, 0);
      expect(decodedFieldNum).toBe(fieldNum);
      expect(wireType).toBe(WIRE_TYPE.LEN);
      expect(new TextDecoder().decode(decodedValue as Uint8Array)).toBe(value);
      expect(offset).toBe(encoded.length);
    });

    it('should encode and decode LEN field with binary data', () => {
      const fieldNum = 15;
      const value = new Uint8Array([1, 2, 3, 4, 5]);
      const encoded = encodeField(fieldNum, WIRE_TYPE.LEN, value);

      const [decodedFieldNum, wireType, decodedValue, offset] = decodeField(encoded, 0);
      expect(decodedFieldNum).toBe(fieldNum);
      expect(wireType).toBe(WIRE_TYPE.LEN);
      expect(decodedValue).toEqual(value);
      expect(offset).toBe(encoded.length);
    });
  });

  describe('wrapConnectRPCFrame / parseConnectRPCFrame round-trip', () => {
    it('should wrap and parse uncompressed frame', () => {
      const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const frame = wrapConnectRPCFrame(payload, false);

      const parsed = parseConnectRPCFrame(Buffer.from(frame));
      expect(parsed).not.toBeNull();
      expect(parsed!.flags).toBe(0x00);
      expect(parsed!.length).toBe(payload.length);
      expect(parsed!.payload).toEqual(payload);
      expect(parsed!.consumed).toBe(5 + payload.length);
    });

    it('should wrap and parse compressed frame', () => {
      const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const frame = wrapConnectRPCFrame(payload, true);

      const parsed = parseConnectRPCFrame(Buffer.from(frame));
      expect(parsed).not.toBeNull();
      expect(parsed!.flags).toBe(0x01); // GZIP flag
      expect(parsed!.payload).toEqual(payload); // Should be decompressed
    });

    it('should handle incomplete frame', () => {
      const partial = new Uint8Array([0x00, 0x00, 0x00]); // Only 3 bytes
      const parsed = parseConnectRPCFrame(Buffer.from(partial));
      expect(parsed).toBeNull();
    });
  });

  describe('concatArrays', () => {
    it('should concatenate multiple arrays', () => {
      const arr1 = new Uint8Array([1, 2, 3]);
      const arr2 = new Uint8Array([4, 5]);
      const arr3 = new Uint8Array([6, 7, 8, 9]);

      const result = concatArrays(arr1, arr2, arr3);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    });

    it('should handle empty arrays', () => {
      const arr1 = new Uint8Array([1, 2]);
      const arr2 = new Uint8Array([]);
      const arr3 = new Uint8Array([3, 4]);

      const result = concatArrays(arr1, arr2, arr3);
      expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
    });
  });
});

describe('Message Translation', () => {
  describe('buildCursorRequest', () => {
    it('should convert system message to user with prefix', () => {
      const result = buildCursorRequest(
        'gpt-4',
        {
          messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
        },
        false,
        {}
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toContain('[System Instructions]');
      expect(result.messages[0].content).toContain('You are a helpful assistant.');
    });

    it('should keep user and assistant messages', () => {
      const result = buildCursorRequest(
        'gpt-4',
        {
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        },
        false,
        {}
      );

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello');
      expect(result.messages[1].role).toBe('assistant');
      expect(result.messages[1].content).toBe('Hi there!');
    });

    it('should handle assistant messages with tool_calls', () => {
      const result = buildCursorRequest(
        'gpt-4',
        {
          messages: [
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
                },
              ],
            },
          ],
        },
        false,
        {}
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('assistant');
      expect(result.messages[0].tool_calls).toHaveLength(1);
      expect(result.messages[0].tool_calls![0].id).toBe('call_123');
      expect(result.messages[0].tool_calls![0].function.name).toBe('get_weather');
    });

    it('should accumulate tool results', () => {
      const result = buildCursorRequest(
        'gpt-4',
        {
          messages: [
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
                },
              ],
            },
            {
              role: 'tool',
              content: '{"temperature": 72}',
              name: 'get_weather',
              tool_call_id: 'call_123',
            },
            { role: 'user', content: 'What is the weather?' },
          ],
        },
        false,
        {}
      );

      expect(result.messages).toHaveLength(2);
      // Tool result should be attached to next message
      expect(result.messages[1].tool_results).toBeDefined();
      expect(result.messages[1].tool_results).toHaveLength(1);
      expect(result.messages[1].tool_results![0].tool_call_id).toBe('call_123');
    });

    it('should handle array content format', () => {
      const result = buildCursorRequest(
        'gpt-4',
        {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Hello' },
                { type: 'text', text: ' World' },
              ],
            },
          ],
        },
        false,
        {}
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe('Hello World');
    });

    it('should handle system message with array content format', () => {
      const result = buildCursorRequest(
        'gpt-4',
        {
          messages: [
            {
              role: 'system',
              content: [
                { type: 'text', text: 'System instruction part 1' },
                { type: 'text', text: ' part 2' },
              ],
            },
          ],
        },
        false,
        {}
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('[System Instructions]\nSystem instruction part 1 part 2');
    });
  });
});

describe('Request Encoding', () => {
  describe('generateCursorBody', () => {
    it('should encode basic text message', () => {
      const result = generateCursorBody([{ role: 'user', content: 'Hello' }], 'gpt-4', [], null);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should encode message with tools', () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather data',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string' },
              },
              required: ['city'],
            },
          },
        },
      ];

      const result = generateCursorBody([{ role: 'user', content: 'What is the weather?' }], 'gpt-4', tools, null);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed frame gracefully', () => {
      const executor = new CursorExecutor();

      // Incomplete frame header (only 3 bytes instead of 5)
      const incompleteFrame = Buffer.from([0x00, 0x00, 0x00]);

      const result = executor.transformProtobufToJSON(incompleteFrame, 'gpt-4', {
        messages: [],
      });

      // Should return valid response even with malformed input
      expect(result.status).toBe(200);
    });

    it('should handle truncated payload', () => {
      const executor = new CursorExecutor();

      // Frame header says payload is 100 bytes but only 5 bytes follow
      const truncatedFrame = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x64, 0x01, 0x02, 0x03, 0x04, 0x05]);

      const result = executor.transformProtobufToJSON(truncatedFrame, 'gpt-4', {
        messages: [],
      });

      // Should handle gracefully
      expect(result.status).toBe(200);
    });

    it('should handle multi-frame buffer', () => {
      const executor = new CursorExecutor();

      // Create two simple frames
      const frame1 = wrapConnectRPCFrame(
        encodeField(FIELD.ChatResponse.TEXT, WIRE_TYPE.LEN, 'Frame 1'),
        false
      );
      const frame2 = wrapConnectRPCFrame(
        encodeField(FIELD.ChatResponse.TEXT, WIRE_TYPE.LEN, ' Frame 2'),
        false
      );

      // Concatenate them
      const multiFrame = Buffer.concat([Buffer.from(frame1), Buffer.from(frame2)]);

      const result = executor.transformProtobufToJSON(multiFrame, 'gpt-4', {
        messages: [],
      });

      expect(result.status).toBe(200);
    });
  });
});

describe('CursorExecutor', () => {
  const executor = new CursorExecutor();

  describe('generateChecksum', () => {
    it('should generate valid checksum format', () => {
      const machineId = 'test-machine-id';
      const checksum = executor.generateChecksum(machineId);

      // Should end with machine ID
      expect(checksum.endsWith(machineId)).toBe(true);

      // Should have base64url-like prefix (8 chars from 6 bytes)
      const prefix = checksum.slice(0, -machineId.length);
      expect(prefix.length).toBe(8);
      expect(/^[A-Za-z0-9_-]+$/.test(prefix)).toBe(true);
    });

    it('should generate valid checksums at different call times', async () => {
      const machineId = 'test-machine-id';
      const checksum1 = executor.generateChecksum(machineId);

      // Wait to ensure timestamp may change (though timestamp granularity is ~16 min)
      await new Promise((resolve) => setTimeout(resolve, 10));

      const checksum2 = executor.generateChecksum(machineId);

      // Verify both checksums are valid (may be same due to timestamp granularity)
      expect(checksum1.endsWith(machineId)).toBe(true);
      expect(checksum2.endsWith(machineId)).toBe(true);
    });
  });

  describe('buildHeaders', () => {
    it('should generate all required headers', () => {
      const credentials = {
        accessToken: 'test-token',
        machineId: 'test-machine-id',
      };

      const headers = executor.buildHeaders(credentials);

      expect(headers).toHaveProperty('authorization');
      expect(headers.authorization).toContain('Bearer');
      expect(headers).toHaveProperty('connect-accept-encoding', 'gzip');
      expect(headers).toHaveProperty('connect-protocol-version', '1');
      expect(headers).toHaveProperty('content-type', 'application/connect+proto');
      expect(headers).toHaveProperty('user-agent', 'connect-es/1.6.1');
      expect(headers).toHaveProperty('x-cursor-checksum');
      expect(headers).toHaveProperty('x-cursor-client-version', '2.3.41');
      expect(headers).toHaveProperty('x-cursor-client-type', 'ide');
      expect(headers).toHaveProperty('x-ghost-mode', 'true');
    });

    it('should handle token with :: delimiter', () => {
      const credentials = {
        accessToken: 'prefix::actual-token',
        machineId: 'test-machine-id',
      };

      const headers = executor.buildHeaders(credentials);

      expect(headers.authorization).toBe('Bearer actual-token');
    });

    it('should respect ghostMode flag', () => {
      const credentialsGhost = {
        accessToken: 'test-token',
        machineId: 'test-machine-id',
        ghostMode: true,
      };

      const credentialsNoGhost = {
        accessToken: 'test-token',
        machineId: 'test-machine-id',
        ghostMode: false,
      };

      const headersGhost = executor.buildHeaders(credentialsGhost);
      const headersNoGhost = executor.buildHeaders(credentialsNoGhost);

      expect(headersGhost['x-ghost-mode']).toBe('true');
      expect(headersNoGhost['x-ghost-mode']).toBe('false');
    });

    it('should throw error if machineId missing', () => {
      const credentials = {
        accessToken: 'test-token',
        machineId: '',
      };

      expect(() => executor.buildHeaders(credentials)).toThrow('Machine ID is required');
    });
  });

  describe('buildUrl', () => {
    it('should return correct API endpoint', () => {
      const url = executor.buildUrl();
      expect(url).toBe('https://api2.cursor.sh/aiserver.v1.AiService/StreamChat');
    });
  });

  describe('transformProtobufToJSON', () => {
    it('should handle basic text response', async () => {
      // Create minimal protobuf response with text
      const textContent = 'Hello, world!';
      const responseField = encodeField(FIELD.ChatResponse.TEXT, WIRE_TYPE.LEN, textContent);
      const responseMsg = encodeField(FIELD.Response.RESPONSE, WIRE_TYPE.LEN, responseField);
      const frame = wrapConnectRPCFrame(responseMsg, false);

      const result = executor.transformProtobufToJSON(Buffer.from(frame), 'gpt-4', {
        messages: [],
      });

      expect(result.status).toBe(200);
      const bodyText = await result.text();
      const body = JSON.parse(bodyText);
      expect(body.choices[0].message.content).toBe(textContent);
      expect(body.choices[0].finish_reason).toBe('stop');
    });

    it('should handle JSON error response', async () => {
      const errorJson = JSON.stringify({
        error: {
          code: 'resource_exhausted',
          message: 'Rate limit exceeded',
        },
      });
      const frame = wrapConnectRPCFrame(new TextEncoder().encode(errorJson), false);

      const result = executor.transformProtobufToJSON(Buffer.from(frame), 'gpt-4', {
        messages: [],
      });

      expect(result.status).toBe(429);
      const bodyText = await result.text();
      const body = JSON.parse(bodyText);
      expect(body.error.type).toBe('rate_limit_error');
    });

    it('should surface reasoning_content when thinking payload is present', async () => {
      const textContent = 'Final answer';
      const thinkingContent = 'Internal reasoning trail';
      const thinkingField = encodeField(FIELD.Thinking.TEXT, WIRE_TYPE.LEN, thinkingContent);
      const chatResponse = concatArrays(
        encodeField(FIELD.ChatResponse.TEXT, WIRE_TYPE.LEN, textContent),
        encodeField(FIELD.ChatResponse.THINKING, WIRE_TYPE.LEN, thinkingField)
      );
      const responseMsg = encodeField(FIELD.Response.RESPONSE, WIRE_TYPE.LEN, chatResponse);
      const frame = wrapConnectRPCFrame(responseMsg, false);

      const result = executor.transformProtobufToJSON(Buffer.from(frame), 'gpt-4', {
        messages: [],
      });

      expect(result.status).toBe(200);
      const bodyText = await result.text();
      const body = JSON.parse(bodyText);
      expect(body.choices[0].message.content).toBe(textContent);
      expect(body.choices[0].message.reasoning_content).toBe(thinkingContent);
    });
  });

  describe('transformProtobufToSSE', () => {
    it('should output SSE format', async () => {
      // Create minimal protobuf response with text
      const textContent = 'Hello';
      const responseField = encodeField(FIELD.ChatResponse.TEXT, WIRE_TYPE.LEN, textContent);
      const responseMsg = encodeField(FIELD.Response.RESPONSE, WIRE_TYPE.LEN, responseField);
      const frame = wrapConnectRPCFrame(responseMsg, false);

      const result = executor.transformProtobufToSSE(Buffer.from(frame), 'gpt-4', {
        messages: [],
      });

      expect(result.status).toBe(200);
      expect(result.headers.get('content-type')).toBe('text/event-stream');

      const bodyText = await result.text();
      expect(bodyText).toContain('data: ');
      expect(bodyText).toContain('data: [DONE]');
      expect(bodyText).toContain(textContent);
    });

    it('should handle JSON error response', async () => {
      const errorJson = JSON.stringify({
        error: {
          code: 'resource_exhausted',
          message: 'Rate limit exceeded',
        },
      });
      const frame = wrapConnectRPCFrame(new TextEncoder().encode(errorJson), false);

      const result = executor.transformProtobufToSSE(Buffer.from(frame), 'gpt-4', {
        messages: [],
      });

      expect(result.status).toBe(429);
      const bodyText = await result.text();
      const body = JSON.parse(bodyText);
      expect(body.error.type).toBe('rate_limit_error');
    });

    it('should emit reasoning_content deltas for thinking payloads', async () => {
      const thinkingContent = 'Deliberate reasoning';
      const thinkingField = encodeField(FIELD.Thinking.TEXT, WIRE_TYPE.LEN, thinkingContent);
      const chatResponse = encodeField(FIELD.ChatResponse.THINKING, WIRE_TYPE.LEN, thinkingField);
      const responseMsg = encodeField(FIELD.Response.RESPONSE, WIRE_TYPE.LEN, chatResponse);
      const frame = wrapConnectRPCFrame(responseMsg, false);

      const result = executor.transformProtobufToSSE(Buffer.from(frame), 'gpt-4', {
        messages: [],
      });

      expect(result.status).toBe(200);
      const bodyText = await result.text();
      expect(bodyText).toContain('reasoning_content');
      expect(bodyText).toContain(thinkingContent);
    });
  });

  describe('decompressPayload error handling', () => {
    it('should return empty buffer on decompression failure', () => {
      // Create invalid gzip data
      const invalidGzip = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xff]);
      const frame = new Uint8Array(5 + invalidGzip.length);
      frame[0] = 0x01; // GZIP flag
      frame[1] = 0;
      frame[2] = 0;
      frame[3] = 0;
      frame[4] = invalidGzip.length;
      frame.set(invalidGzip, 5);

      const result = executor.transformProtobufToJSON(Buffer.from(frame), 'gpt-4', {
        messages: [],
      });

      // Should handle gracefully and return valid response
      expect(result.status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('should return empty buffer on decompression failure', () => {
      const executor = new CursorExecutor();

      // Invalid compressed payload (not actually gzipped)
      const invalidGzipPayload = new Uint8Array([1, 2, 3, 4, 5]);
      const flags = 0x01; // GZIP flag

      // Wrap with ConnectRPC frame header (flags + length)
      const length = invalidGzipPayload.length;
      const frame = new Uint8Array(5 + length);
      frame[0] = flags;
      frame[1] = (length >> 24) & 0xff;
      frame[2] = (length >> 16) & 0xff;
      frame[3] = (length >> 8) & 0xff;
      frame[4] = length & 0xff;
      frame.set(invalidGzipPayload, 5);

      const buffer = Buffer.from(frame);

      // Should not crash - decompression failure returns empty buffer
      const result = executor.transformProtobufToJSON(buffer, 'test-model', {
        messages: [],
        stream: false,
      });

      expect(result.status).toBe(200);
    });

    it('should log unknown message roles in debug mode', () => {
      const originalDebug = process.env.CCS_DEBUG;
      process.env.CCS_DEBUG = '1';

      const consoleSpy: string[] = [];
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        const msg = args.map((a) => String(a)).join(' ');
        consoleSpy.push(msg);
      };

      try {
        const messages = [
          {
            role: 'unknown_role' as 'user', // Type assertion to bypass TS
            content: 'test',
          },
        ];

        // buildCursorRequest expects (model, body, stream, credentials)
        buildCursorRequest('test-model', { messages }, false, { machineId: '12345', accessToken: 'test' });

        // Should have logged warning
        const hasWarning = consoleSpy.some((log) => log.includes('Unknown message role'));
        expect(hasWarning).toBe(true);
      } finally {
        console.error = originalError;
        process.env.CCS_DEBUG = originalDebug;
      }
    });
  });
});

/**
 * Helper: build a ConnectRPC frame from raw payload bytes
 */
function buildFrame(payload: Uint8Array, flags = 0): Buffer {
  const header = Buffer.alloc(5);
  header[0] = flags;
  header.writeUInt32BE(payload.length, 1);
  return Buffer.concat([header, Buffer.from(payload)]);
}

/**
 * Helper: build a protobuf text response frame
 */
function buildTextFrame(text: string): Buffer {
  const responseField = encodeField(FIELD.ChatResponse.TEXT, WIRE_TYPE.LEN, text);
  const responseMsg = encodeField(FIELD.Response.RESPONSE, WIRE_TYPE.LEN, responseField);
  return buildFrame(responseMsg);
}

/**
 * Helper: build a protobuf thinking response frame
 */
function buildThinkingFrame(thinking: string): Buffer {
  const thinkingField = encodeField(FIELD.Thinking.TEXT, WIRE_TYPE.LEN, thinking);
  const responseField = encodeField(FIELD.ChatResponse.THINKING, WIRE_TYPE.LEN, thinkingField);
  const responseMsg = encodeField(FIELD.Response.RESPONSE, WIRE_TYPE.LEN, responseField);
  return buildFrame(responseMsg);
}

describe('StreamingFrameParser', () => {
  it('should parse a complete single frame', () => {
    const parser = new StreamingFrameParser();
    const frame = buildTextFrame('Hello');
    const results = parser.push(frame);

    expect(results.length).toBe(1);
    expect(results[0].type).toBe('text');
    if (results[0].type === 'text') {
      expect(results[0].text).toBe('Hello');
    }
    expect(parser.hasPartial()).toBe(false);
  });

  it('should buffer partial frame header (< 5 bytes)', () => {
    const parser = new StreamingFrameParser();
    const frame = buildTextFrame('Hi');

    // Send only first 3 bytes (partial header)
    const results1 = parser.push(frame.slice(0, 3));
    expect(results1.length).toBe(0);
    expect(parser.hasPartial()).toBe(true);

    // Send rest of the frame
    const results2 = parser.push(frame.slice(3));
    expect(results2.length).toBe(1);
    expect(results2[0].type).toBe('text');
    expect(parser.hasPartial()).toBe(false);
  });

  it('should buffer partial frame payload', () => {
    const parser = new StreamingFrameParser();
    const frame = buildTextFrame('Hello world');

    // Send header + partial payload
    const splitPoint = 8; // past the 5-byte header but not full payload
    const results1 = parser.push(frame.slice(0, splitPoint));
    expect(results1.length).toBe(0);
    expect(parser.hasPartial()).toBe(true);

    // Complete the frame
    const results2 = parser.push(frame.slice(splitPoint));
    expect(results2.length).toBe(1);
    expect(results2[0].type).toBe('text');
    if (results2[0].type === 'text') {
      expect(results2[0].text).toBe('Hello world');
    }
  });

  it('should parse multiple frames from single chunk', () => {
    const parser = new StreamingFrameParser();
    const frame1 = buildTextFrame('First');
    const frame2 = buildTextFrame('Second');
    const combined = Buffer.concat([frame1, frame2]);

    const results = parser.push(combined);
    expect(results.length).toBe(2);
    expect(results[0].type).toBe('text');
    expect(results[1].type).toBe('text');
    if (results[0].type === 'text' && results[1].type === 'text') {
      expect(results[0].text).toBe('First');
      expect(results[1].text).toBe('Second');
    }
  });

  it('should handle frame split across two chunks', () => {
    const parser = new StreamingFrameParser();
    const frame1 = buildTextFrame('AAA');
    const frame2 = buildTextFrame('BBB');
    const combined = Buffer.concat([frame1, frame2]);

    // Split in the middle of frame2
    const splitPoint = frame1.length + 3;
    const results1 = parser.push(combined.slice(0, splitPoint));
    expect(results1.length).toBe(1); // frame1 complete
    expect(results1[0].type).toBe('text');

    const results2 = parser.push(combined.slice(splitPoint));
    expect(results2.length).toBe(1); // frame2 complete
    expect(results2[0].type).toBe('text');
    if (results2[0].type === 'text') {
      expect(results2[0].text).toBe('BBB');
    }
  });

  it('should detect JSON error mid-stream', () => {
    const parser = new StreamingFrameParser();

    // First: a valid text frame
    const textFrame = buildTextFrame('Before error');
    const results1 = parser.push(textFrame);
    expect(results1.length).toBe(1);

    // Then: a JSON error frame
    const errorJson = JSON.stringify({
      error: { code: 'resource_exhausted', message: 'Rate limit' },
    });
    const errorFrame = buildFrame(new TextEncoder().encode(errorJson));
    const results2 = parser.push(errorFrame);

    expect(results2.length).toBe(1);
    expect(results2[0].type).toBe('error');
    if (results2[0].type === 'error') {
      expect(results2[0].status).toBe(429);
      expect(results2[0].errorType).toBe('rate_limit_error');
    }
  });

  it('should parse thinking frames', () => {
    const parser = new StreamingFrameParser();
    const frame = buildThinkingFrame('Think step by step');
    const results = parser.push(frame);

    expect(results.length).toBe(1);
    expect(results[0].type).toBe('thinking');
    if (results[0].type === 'thinking') {
      expect(results[0].text).toBe('Think step by step');
    }
  });

  it('should report hasPartial() correctly', () => {
    const parser = new StreamingFrameParser();
    expect(parser.hasPartial()).toBe(false);

    // Push partial data
    parser.push(Buffer.from([0x00, 0x00]));
    expect(parser.hasPartial()).toBe(true);

    // Push enough to complete the frame (empty payload)
    // header: flags=0, length=0 → 5 bytes total
    const emptyFrame = Buffer.alloc(5);
    emptyFrame[0] = 0;
    emptyFrame.writeUInt32BE(0, 1);

    const parser2 = new StreamingFrameParser();
    parser2.push(emptyFrame);
    expect(parser2.hasPartial()).toBe(false);
  });
});

describe('decompressPayload', () => {
  it('should pass through uncompressed payload', () => {
    const payload = Buffer.from('raw protobuf data');
    const result = decompressPayload(payload, 0x00);
    expect(result).toEqual(payload);
  });

  it('should skip decompression for JSON error payloads', () => {
    const errorPayload = Buffer.from('{"error":"something went wrong"}');
    const result = decompressPayload(errorPayload, 0x01); // GZIP flag but JSON error
    expect(result).toEqual(errorPayload);
  });

  it('should return empty buffer on invalid gzip data', () => {
    const invalidGzip = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    const result = decompressPayload(invalidGzip, 0x01);
    expect(result.length).toBe(0);
  });

  it('should decompress valid gzip payload', () => {
    const zlib = require('zlib');
    const original = Buffer.from('Hello compressed world');
    const compressed = zlib.gzipSync(original);

    const result = decompressPayload(compressed, 0x01);
    expect(result.toString()).toBe('Hello compressed world');
  });

  it('should handle GZIP_ALT and GZIP_BOTH flags', () => {
    const zlib = require('zlib');
    const original = Buffer.from('test data');
    const compressed = zlib.gzipSync(original);

    expect(decompressPayload(compressed, 0x02).toString()).toBe('test data');
    expect(decompressPayload(compressed, 0x03).toString()).toBe('test data');
  });
});
