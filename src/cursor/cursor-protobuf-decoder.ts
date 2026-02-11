/**
 * Cursor Protobuf Decoder
 * Implements ConnectRPC protobuf wire format decoding
 */

import * as zlib from 'zlib';
import { WIRE_TYPE, FIELD, type WireType } from './cursor-protobuf-schema.js';

/**
 * Decode a varint from buffer
 * Returns [value, newOffset]
 */
export function decodeVarint(buffer: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;

  while (pos < buffer.length) {
    const b = buffer[pos];
    result |= (b & 0x7f) << shift;
    pos++;
    if (!(b & 0x80)) break;
    shift += 7;
  }

  return [result, pos];
}

/**
 * Decode a single protobuf field
 * Returns [fieldNum, wireType, value, newOffset]
 */
export function decodeField(
  buffer: Uint8Array,
  offset: number
): [number | null, WireType | null, Uint8Array | number | null, number] {
  if (offset >= buffer.length) {
    return [null, null, null, offset];
  }

  const [tag, pos1] = decodeVarint(buffer, offset);
  const fieldNum = tag >> 3;
  const wireType = (tag & 0x07) as WireType;

  let value: Uint8Array | number | null;
  let pos = pos1;

  if (wireType === WIRE_TYPE.VARINT) {
    [value, pos] = decodeVarint(buffer, pos);
  } else if (wireType === WIRE_TYPE.LEN) {
    const [length, pos2] = decodeVarint(buffer, pos);
    value = buffer.slice(pos2, pos2 + length);
    pos = pos2 + length;
  } else if (wireType === WIRE_TYPE.FIXED64) {
    value = buffer.slice(pos, pos + 8);
    pos += 8;
  } else if (wireType === WIRE_TYPE.FIXED32) {
    value = buffer.slice(pos, pos + 4);
    pos += 4;
  } else {
    value = null;
  }

  return [fieldNum, wireType, value, pos];
}

/**
 * Decode a protobuf message into a map of fields
 */
export function decodeMessage(
  data: Uint8Array
): Map<number, Array<{ wireType: WireType; value: Uint8Array | number }>> {
  const fields = new Map<number, Array<{ wireType: WireType; value: Uint8Array | number }>>();
  let pos = 0;

  while (pos < data.length) {
    const [fieldNum, wireType, value, newPos] = decodeField(data, pos);
    if (fieldNum === null || wireType === null || value === null) break;

    if (!fields.has(fieldNum)) {
      fields.set(fieldNum, []);
    }
    fields.get(fieldNum)!.push({ wireType, value: value as Uint8Array | number });
    pos = newPos;
  }

  return fields;
}

/**
 * Parse ConnectRPC frame from buffer
 * Returns frame data or null if incomplete
 */
export function parseConnectRPCFrame(buffer: Buffer): {
  flags: number;
  length: number;
  payload: Uint8Array;
  consumed: number;
} | null {
  if (buffer.length < 5) return null;

  const flags = buffer[0];
  const length = (buffer[1] << 24) | (buffer[2] << 16) | (buffer[3] << 8) | buffer[4];

  if (buffer.length < 5 + length) return null;

  let payload = buffer.slice(5, 5 + length);

  // Decompress if gzip
  if (flags === 0x01 || flags === 0x02 || flags === 0x03) {
    try {
      payload = Buffer.from(zlib.gunzipSync(payload));
    } catch {
      // Decompression failed, use raw payload
    }
  }

  return {
    flags,
    length,
    payload: new Uint8Array(payload),
    consumed: 5 + length,
  };
}

/**
 * Extract tool call from protobuf data
 */
function extractToolCall(toolCallData: Uint8Array): {
  id: string;
  type: string;
  function: { name: string; arguments: string };
  isLast: boolean;
} | null {
  const toolCall = decodeMessage(toolCallData);
  let toolCallId = '';
  let toolName = '';
  let rawArgs = '';
  let isLast = false;

  // Extract tool call ID
  if (toolCall.has(FIELD.TOOL_ID)) {
    const fullId = new TextDecoder().decode(toolCall.get(FIELD.TOOL_ID)![0].value as Uint8Array);
    toolCallId = fullId.split('\n')[0]; // Take first line
  }

  // Extract tool name
  if (toolCall.has(FIELD.TOOL_NAME)) {
    toolName = new TextDecoder().decode(toolCall.get(FIELD.TOOL_NAME)![0].value as Uint8Array);
  }

  // Extract is_last flag
  if (toolCall.has(FIELD.TOOL_IS_LAST)) {
    isLast = (toolCall.get(FIELD.TOOL_IS_LAST)![0].value as number) !== 0;
  }

  // Extract MCP params - nested real tool info
  if (toolCall.has(FIELD.TOOL_MCP_PARAMS)) {
    try {
      const mcpParams = decodeMessage(toolCall.get(FIELD.TOOL_MCP_PARAMS)![0].value as Uint8Array);

      if (mcpParams.has(FIELD.MCP_TOOLS_LIST)) {
        const tool = decodeMessage(mcpParams.get(FIELD.MCP_TOOLS_LIST)![0].value as Uint8Array);

        if (tool.has(FIELD.MCP_NESTED_NAME)) {
          toolName = new TextDecoder().decode(
            tool.get(FIELD.MCP_NESTED_NAME)![0].value as Uint8Array
          );
        }

        if (tool.has(FIELD.MCP_NESTED_PARAMS)) {
          rawArgs = new TextDecoder().decode(
            tool.get(FIELD.MCP_NESTED_PARAMS)![0].value as Uint8Array
          );
        }
      }
    } catch {
      // MCP parse error, continue
    }
  }

  // Fallback to raw_args
  if (!rawArgs && toolCall.has(FIELD.TOOL_RAW_ARGS)) {
    rawArgs = new TextDecoder().decode(toolCall.get(FIELD.TOOL_RAW_ARGS)![0].value as Uint8Array);
  }

  if (toolCallId && toolName) {
    return {
      id: toolCallId,
      type: 'function',
      function: {
        name: toolName,
        arguments: rawArgs || '{}',
      },
      isLast,
    };
  }

  return null;
}

/**
 * Extract text and thinking from response data
 */
function extractTextAndThinking(responseData: Uint8Array): {
  text: string | null;
  thinking: string | null;
} {
  const nested = decodeMessage(responseData);
  let text: string | null = null;
  let thinking: string | null = null;

  // Extract text
  if (nested.has(FIELD.RESPONSE_TEXT)) {
    text = new TextDecoder().decode(nested.get(FIELD.RESPONSE_TEXT)![0].value as Uint8Array);
  }

  // Extract thinking
  if (nested.has(FIELD.THINKING)) {
    try {
      const thinkingMsg = decodeMessage(nested.get(FIELD.THINKING)![0].value as Uint8Array);
      if (thinkingMsg.has(FIELD.THINKING_TEXT)) {
        thinking = new TextDecoder().decode(
          thinkingMsg.get(FIELD.THINKING_TEXT)![0].value as Uint8Array
        );
      }
    } catch {
      // Thinking parse error, continue
    }
  }

  return { text, thinking };
}

/**
 * Extract text and tool calls from response payload
 */
export function extractTextFromResponse(payload: Uint8Array): {
  text: string | null;
  error: string | null;
  toolCall: {
    id: string;
    type: string;
    function: { name: string; arguments: string };
    isLast: boolean;
  } | null;
  thinking: string | null;
} {
  try {
    const fields = decodeMessage(payload);

    // Field 1: ClientSideToolV2Call
    if (fields.has(FIELD.TOOL_CALL)) {
      const toolCall = extractToolCall(fields.get(FIELD.TOOL_CALL)![0].value as Uint8Array);
      if (toolCall) {
        return { text: null, error: null, toolCall, thinking: null };
      }
    }

    // Field 2: StreamUnifiedChatResponse
    if (fields.has(FIELD.RESPONSE)) {
      const { text, thinking } = extractTextAndThinking(
        fields.get(FIELD.RESPONSE)![0].value as Uint8Array
      );

      if (text || thinking) {
        return { text, error: null, toolCall: null, thinking };
      }
    }

    return { text: null, error: null, toolCall: null, thinking: null };
  } catch {
    return { text: null, error: null, toolCall: null, thinking: null };
  }
}
