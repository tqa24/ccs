/**
 * Cursor IDE Type Definitions
 *
 * TypeScript interfaces for the Cursor module.
 */

/**
 * Cursor authentication credentials
 */
export interface CursorCredentials {
  /** Access token from Cursor IDE */
  accessToken: string;
  /** Machine ID for checksum generation */
  machineId: string;
  /** User email (if available from token) */
  email?: string;
  /** User ID (if available from token) */
  userId?: string;
  /** How credentials were obtained */
  authMethod: 'auto-detect' | 'manual';
  /** ISO datetime when credentials were imported */
  importedAt: string;
}

/**
 * Cursor authentication status
 */
export interface CursorAuthStatus {
  /** Whether user is authenticated */
  authenticated: boolean;
  /** Current credentials (if authenticated) */
  credentials?: CursorCredentials;
  /** Hours since credentials were imported (if available) */
  tokenAge?: number;
  /** Whether token has expired (>24 hours old) */
  expired?: boolean;
}

/**
 * Cursor daemon/process status
 */
export interface CursorDaemonStatus {
  /** Whether daemon is running */
  running: boolean;
  /** Port number daemon is listening on */
  port: number;
  /** Process ID (if available) */
  pid?: number;
}

/**
 * Cursor AI model
 */
export interface CursorModel {
  /** Model ID */
  id: string;
  /** Display name */
  name: string;
  /** Provider (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Whether this is the default model */
  isDefault?: boolean;
}

/**
 * Message role
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Cursor message for protobuf
 */
export interface CursorMessage {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Tool calls (if any) */
  tool_calls?: CursorToolCall[];
  /** Tool results (if any) */
  tool_results?: CursorToolResult[];
}

/**
 * Cursor tool call
 */
export interface CursorToolCall {
  /** Unique ID for this tool call */
  id: string;
  /** Type of tool call */
  type: 'function';
  /** Function details */
  function: {
    /** Function name */
    name: string;
    /** JSON-encoded arguments */
    arguments: string;
  };
  /** Whether this is the last tool call in sequence */
  isLast?: boolean;
}

/**
 * Cursor tool result
 */
export interface CursorToolResult {
  /** ID of the tool call this result is for */
  tool_call_id: string;
  /** Tool name */
  name: string;
  /** Result index */
  index: number;
  /** Raw arguments */
  raw_args: string;
}

/**
 * Result from protobuf extraction
 */
export interface ProtobufExtractResult {
  /** Extracted text content */
  text: string | null;
  /** Error message (if extraction failed) */
  error: string | null;
  /** Extracted tool call (if any) */
  toolCall: CursorToolCall | null;
  /** Thinking/reasoning content (if any) */
  thinking: string | null;
}

/**
 * Auto-detection result
 */
export interface AutoDetectResult {
  /** Whether tokens were found */
  found: boolean;
  /** Access token (if found) */
  accessToken?: string;
  /** Machine ID (if found) */
  machineId?: string;
  /** Error message (if detection failed) */
  error?: string;
}
