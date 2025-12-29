/**
 * Error Log Parser Utility
 *
 * Parses CLIProxy error log content into structured data for display.
 * Extracts request info, headers, body, and response sections.
 */

/** Parsed error log structure */
export interface ParsedErrorLog {
  // Request Info
  version: string;
  url: string;
  method: string;
  timestamp: string;

  // Response
  statusCode: number;
  statusText: string;

  // Sections (raw strings)
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseHeaders: Record<string, string>;
  responseBody: string;

  // Computed metadata
  provider: string;
  endpoint: string;
  isClientError: boolean;
  isServerError: boolean;
  errorType: 'rate_limit' | 'auth' | 'not_found' | 'server' | 'timeout' | 'unknown';

  // Extracted from request/response bodies
  model: string | null;
  quotaResetDelay: number | null; // seconds until reset
  quotaResetTimestamp: string | null; // ISO timestamp when quota resets
}

/** Parsed filename metadata */
export interface ParsedFilename {
  provider: string;
  endpoint: string;
  timestamp: Date;
  raw: string;
}

/**
 * Parse error log filename to extract provider, endpoint, and timestamp
 * Format: error-api-provider-{provider}-api-{endpoint}-{timestamp}-{id}.log
 */
export function parseFilename(name: string): ParsedFilename {
  const result: ParsedFilename = {
    provider: 'unknown',
    endpoint: 'unknown',
    timestamp: new Date(),
    raw: name,
  };

  // Extract provider: error-api-provider-{PROVIDER}-api-...
  const providerMatch = name.match(/error-api-provider-([^-]+)-/);
  if (providerMatch) {
    result.provider = providerMatch[1];
  }

  // Extract endpoint from after provider: ...-api-{ENDPOINT}-{timestamp}
  // Example: error-api-provider-agy-api-event_logging-batch-2025-12-18T185041-...
  const endpointMatch = name.match(/-api-([a-z_]+(?:-[a-z_]+)*)-\d{4}-\d{2}-\d{2}T/i);
  if (endpointMatch) {
    result.endpoint = endpointMatch[1].replace(/-/g, '/');
  }

  // Extract timestamp: 2025-12-18T185041
  const tsMatch = name.match(/(\d{4}-\d{2}-\d{2}T\d{6})/);
  if (tsMatch) {
    const ts = tsMatch[1];
    // Parse: 2025-12-18T185041 → 2025-12-18T18:50:41
    const formatted = `${ts.slice(0, 10)}T${ts.slice(11, 13)}:${ts.slice(13, 15)}:${ts.slice(15, 17)}`;
    result.timestamp = new Date(formatted);
  }

  return result;
}

/**
 * Parse raw error log content into structured data
 */
export function parseErrorLog(content: string): ParsedErrorLog {
  const result: ParsedErrorLog = {
    version: '',
    url: '',
    method: '',
    timestamp: '',
    statusCode: 0,
    statusText: '',
    requestHeaders: {},
    requestBody: '',
    responseHeaders: {},
    responseBody: '',
    provider: '',
    endpoint: '',
    isClientError: false,
    isServerError: false,
    errorType: 'unknown',
    model: null,
    quotaResetDelay: null,
    quotaResetTimestamp: null,
  };

  // Split into sections
  const sections = content.split(/^===\s*(.+?)\s*===$/m);

  let currentSection = '';
  for (let i = 0; i < sections.length; i++) {
    const part = sections[i].trim();

    if (part === 'REQUEST INFO') {
      currentSection = 'request_info';
      continue;
    } else if (part === 'HEADERS') {
      currentSection = 'headers';
      continue;
    } else if (part === 'REQUEST BODY') {
      currentSection = 'request_body';
      continue;
    } else if (part === 'RESPONSE') {
      currentSection = 'response';
      continue;
    }

    // Parse section content
    switch (currentSection) {
      case 'request_info':
        parseRequestInfo(part, result);
        break;
      case 'headers':
        result.requestHeaders = parseHeaders(part);
        break;
      case 'request_body':
        result.requestBody = part;
        break;
      case 'response':
        parseResponse(part, result);
        break;
    }
  }

  // Compute derived fields
  computeDerivedFields(result);

  return result;
}

/** Parse REQUEST INFO section */
function parseRequestInfo(content: string, result: ParsedErrorLog): void {
  const lines = content.split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();

    switch (key?.trim()?.toLowerCase()) {
      case 'version':
        result.version = value;
        break;
      case 'url':
        result.url = value;
        break;
      case 'method':
        result.method = value;
        break;
      case 'timestamp':
        result.timestamp = value;
        break;
    }
  }
}

/** Parse headers into key-value object */
function parseHeaders(content: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      if (key) headers[key] = value;
    }
  }

  return headers;
}

/** Parse RESPONSE section */
function parseResponse(content: string, result: ParsedErrorLog): void {
  const lines = content.split('\n');
  let headersEnded = false;
  const bodyLines: string[] = [];

  for (const line of lines) {
    // First line might be "Status: 404"
    if (line.startsWith('Status:')) {
      const statusStr = line.replace('Status:', '').trim();
      const statusParts = statusStr.split(/\s+/);
      result.statusCode = parseInt(statusParts[0], 10) || 0;
      result.statusText = statusParts.slice(1).join(' ') || getStatusText(result.statusCode);
      continue;
    }

    // Check for empty line (separates headers from body)
    if (line.trim() === '' && !headersEnded) {
      headersEnded = true;
      continue;
    }

    // Parse response headers
    if (!headersEnded) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        if (key) result.responseHeaders[key] = value;
      }
    } else {
      bodyLines.push(line);
    }
  }

  result.responseBody = bodyLines.join('\n').trim();
}

/** Compute derived fields from parsed data */
function computeDerivedFields(result: ParsedErrorLog): void {
  // Extract provider from URL: /api/provider/{PROVIDER}/...
  const providerMatch = result.url.match(/\/api\/provider\/([^/]+)/);
  if (providerMatch) {
    result.provider = providerMatch[1];
  }

  // Extract endpoint from URL
  const endpointMatch = result.url.match(/\/api\/provider\/[^/]+\/api\/(.+)/);
  if (endpointMatch) {
    result.endpoint = endpointMatch[1];
  }

  // Status code classification
  result.isClientError = result.statusCode >= 400 && result.statusCode < 500;
  result.isServerError = result.statusCode >= 500;

  // Error type classification
  if (result.statusCode === 429) {
    result.errorType = 'rate_limit';
  } else if (result.statusCode === 401 || result.statusCode === 403) {
    result.errorType = 'auth';
  } else if (result.statusCode === 404) {
    result.errorType = 'not_found';
  } else if (result.statusCode >= 500) {
    result.errorType = 'server';
  } else if (result.statusCode === 408 || result.statusCode === 504) {
    result.errorType = 'timeout';
  }

  // Extract model from request body
  extractModelFromRequestBody(result);

  // Extract quota reset info from response body (for 429 errors)
  if (result.statusCode === 429) {
    extractQuotaResetInfo(result);
  }
}

/** Extract model name from request body JSON */
function extractModelFromRequestBody(result: ParsedErrorLog): void {
  if (!result.requestBody) return;
  try {
    const body = JSON.parse(result.requestBody);
    if (typeof body.model === 'string') {
      result.model = body.model;
    }
  } catch {
    // Not valid JSON, skip
  }
}

/** Extract quota reset info from 429 response body */
function extractQuotaResetInfo(result: ParsedErrorLog): void {
  if (!result.responseBody) return;
  try {
    const body = JSON.parse(result.responseBody);
    // Look for quotaResetDelay in various response formats
    // Format 1: { error: { details: [{ quotaResetDelay: "123s" }] } }
    // Format 2: { error: { quotaResetDelay: 123 } }
    // Format 3: { quotaResetDelay: 123, quotaResetTimeStamp: "..." }
    const delay = findQuotaResetDelay(body);
    if (delay !== null) {
      result.quotaResetDelay = delay;
    }
    const timestamp = findQuotaResetTimestamp(body);
    if (timestamp) {
      result.quotaResetTimestamp = timestamp;
    }
  } catch {
    // Not valid JSON, skip
  }
}

/** Recursively find quotaResetDelay in response object */
function findQuotaResetDelay(obj: unknown): number | null {
  if (typeof obj !== 'object' || obj === null) return null;

  const record = obj as Record<string, unknown>;

  // Check direct properties
  if ('quotaResetDelay' in record) {
    const val = record.quotaResetDelay;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // Handle "123s" format
      const match = val.match(/^(\d+)s?$/);
      if (match) return parseInt(match[1], 10);
    }
  }

  // Check nested error object
  if ('error' in record && typeof record.error === 'object') {
    const found = findQuotaResetDelay(record.error);
    if (found !== null) return found;
  }

  // Check details array
  if ('details' in record && Array.isArray(record.details)) {
    for (const detail of record.details) {
      const found = findQuotaResetDelay(detail);
      if (found !== null) return found;
    }
  }

  return null;
}

/** Recursively find quotaResetTimeStamp in response object */
function findQuotaResetTimestamp(obj: unknown): string | null {
  if (typeof obj !== 'object' || obj === null) return null;

  const record = obj as Record<string, unknown>;

  // Check direct properties (various casing)
  for (const key of ['quotaResetTimeStamp', 'quotaResetTimestamp', 'resetTime', 'reset_time']) {
    if (key in record && typeof record[key] === 'string') {
      return record[key] as string;
    }
  }

  // Check nested error object
  if ('error' in record && typeof record.error === 'object') {
    const found = findQuotaResetTimestamp(record.error);
    if (found) return found;
  }

  // Check details array
  if ('details' in record && Array.isArray(record.details)) {
    for (const detail of record.details) {
      const found = findQuotaResetTimestamp(detail);
      if (found) return found;
    }
  }

  return null;
}

/** Get status text for common codes */
function getStatusText(code: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return statusTexts[code] || '';
}

/**
 * Format Unix timestamp (seconds) to relative time string
 */
export function formatRelativeTime(modifiedSeconds: number): string {
  const now = Date.now();
  const modified = modifiedSeconds * 1000; // Convert to milliseconds
  const diff = now - modified;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  // Format as date for older logs
  const date = new Date(modified);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get status code badge color class
 */
export function getStatusColor(code: number): string {
  if (code >= 500) return 'text-red-500';
  if (code === 429) return 'text-orange-500';
  if (code >= 400) return 'text-yellow-500';
  return 'text-gray-500';
}

/**
 * Get error type label
 */
export function getErrorTypeLabel(type: ParsedErrorLog['errorType']): string {
  const labels: Record<string, string> = {
    rate_limit: 'Rate Limited',
    auth: 'Auth Error',
    not_found: 'Not Found',
    server: 'Server Error',
    timeout: 'Timeout',
    unknown: 'Error',
  };
  return labels[type] || 'Error';
}

/**
 * Format quota reset delay as human-readable string
 */
export function formatQuotaResetDelay(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format quota reset timestamp as relative time
 */
export function formatQuotaResetTimestamp(timestamp: string | null): string | null {
  if (!timestamp) return null;
  try {
    const resetDate = new Date(timestamp);
    const now = new Date();
    const diff = resetDate.getTime() - now.getTime();
    if (diff <= 0) return 'now';

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins}m`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } catch {
    return null;
  }
}
