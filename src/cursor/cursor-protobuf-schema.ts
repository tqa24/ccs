/**
 * Cursor Protobuf Schema Constants
 * Field definitions and wire types for ConnectRPC protocol
 */

/** Wire types for protobuf encoding */
export const WIRE_TYPE = {
  VARINT: 0,
  FIXED64: 1,
  LEN: 2,
  FIXED32: 5,
} as const;

/** Message role constants */
export const ROLE = {
  USER: 1,
  ASSISTANT: 2,
} as const;

/** Unified mode constants */
export const UNIFIED_MODE = {
  CHAT: 1,
  AGENT: 2,
} as const;

/** Thinking level constants */
export const THINKING_LEVEL = {
  UNSPECIFIED: 0,
  MEDIUM: 1,
  HIGH: 2,
} as const;

/** Field numbers for all protobuf messages */
export const FIELD = {
  // StreamUnifiedChatRequestWithTools (top level)
  REQUEST: 1,

  // StreamUnifiedChatRequest
  MESSAGES: 1,
  UNKNOWN_2: 2,
  INSTRUCTION: 3,
  UNKNOWN_4: 4,
  MODEL: 5,
  WEB_TOOL: 8,
  UNKNOWN_13: 13,
  CURSOR_SETTING: 15,
  UNKNOWN_19: 19,
  CONVERSATION_ID: 23,
  METADATA: 26,
  IS_AGENTIC: 27,
  SUPPORTED_TOOLS: 29,
  MESSAGE_IDS: 30,
  MCP_TOOLS: 34,
  LARGE_CONTEXT: 35,
  UNKNOWN_38: 38,
  UNIFIED_MODE: 46,
  UNKNOWN_47: 47,
  SHOULD_DISABLE_TOOLS: 48,
  THINKING_LEVEL: 49,
  UNKNOWN_51: 51,
  UNKNOWN_53: 53,
  UNIFIED_MODE_NAME: 54,

  // ConversationMessage
  MSG_CONTENT: 1,
  MSG_ROLE: 2,
  MSG_ID: 13,
  MSG_TOOL_RESULTS: 18,
  MSG_IS_AGENTIC: 29,
  MSG_UNIFIED_MODE: 47,
  MSG_SUPPORTED_TOOLS: 51,

  // ConversationMessage.ToolResult
  TOOL_RESULT_CALL_ID: 1,
  TOOL_RESULT_NAME: 2,
  TOOL_RESULT_INDEX: 3,
  TOOL_RESULT_RAW_ARGS: 5,
  TOOL_RESULT_RESULT: 8,

  // Model
  MODEL_NAME: 1,
  MODEL_EMPTY: 4,

  // Instruction
  INSTRUCTION_TEXT: 1,

  // CursorSetting
  SETTING_PATH: 1,
  SETTING_UNKNOWN_3: 3,
  SETTING_UNKNOWN_6: 6,
  SETTING_UNKNOWN_8: 8,
  SETTING_UNKNOWN_9: 9,

  // CursorSetting.Unknown6
  SETTING6_FIELD_1: 1,
  SETTING6_FIELD_2: 2,

  // Metadata
  META_PLATFORM: 1,
  META_ARCH: 2,
  META_VERSION: 3,
  META_CWD: 4,
  META_TIMESTAMP: 5,

  // MessageId
  MSGID_ID: 1,
  MSGID_SUMMARY: 2,
  MSGID_ROLE: 3,

  // MCPTool
  MCP_TOOL_NAME: 1,
  MCP_TOOL_DESC: 2,
  MCP_TOOL_PARAMS: 3,
  MCP_TOOL_SERVER: 4,

  // StreamUnifiedChatResponseWithTools (response)
  TOOL_CALL: 1,
  RESPONSE: 2,

  // ClientSideToolV2Call
  TOOL_ID: 3,
  TOOL_NAME: 9,
  TOOL_RAW_ARGS: 10,
  TOOL_IS_LAST: 11,
  TOOL_MCP_PARAMS: 27,

  // MCPParams
  MCP_TOOLS_LIST: 1,

  // MCPParams.Tool (nested)
  MCP_NESTED_NAME: 1,
  MCP_NESTED_PARAMS: 3,

  // StreamUnifiedChatResponse
  RESPONSE_TEXT: 1,
  THINKING: 25,

  // Thinking
  THINKING_TEXT: 1,
} as const;

/** Type definitions */
export type WireType = (typeof WIRE_TYPE)[keyof typeof WIRE_TYPE];
export type RoleType = (typeof ROLE)[keyof typeof ROLE];
export type UnifiedModeType = (typeof UNIFIED_MODE)[keyof typeof UNIFIED_MODE];
export type ThinkingLevelType = (typeof THINKING_LEVEL)[keyof typeof THINKING_LEVEL];
export type FieldNumber = (typeof FIELD)[keyof typeof FIELD];

/** Cursor tool definition */
export interface CursorTool {
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  name?: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}

/** Cursor tool result */
export interface CursorToolResult {
  tool_call_id?: string;
  name?: string;
  index?: number;
  raw_args?: string;
}

/** Cursor message format */
export interface CursorMessage {
  role: string;
  content: string;
  tool_results?: CursorToolResult[];
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/** Formatted message for encoding */
export interface FormattedMessage {
  content: string;
  role: RoleType;
  messageId: string;
  isLast: boolean;
  hasTools: boolean;
  toolResults: CursorToolResult[];
}

/** Message ID structure */
export interface MessageId {
  messageId: string;
  role: RoleType;
}

/** Compression flags for ConnectRPC frames */
export const COMPRESS_FLAG = {
  NONE: 0x00,
  GZIP: 0x01,
  GZIP_ALT: 0x02,
  GZIP_BOTH: 0x03,
} as const;
