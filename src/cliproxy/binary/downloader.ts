/**
 * Binary Downloader
 * Handles downloading files with retry logic, progress tracking, and redirect following.
 * Robust handling for transient network errors (socket hang up, ECONNRESET, etc.)
 */

import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { DownloadResult, ProgressCallback } from '../types';

/** Default configuration for downloader */
export interface DownloaderConfig {
  /** Maximum retry attempts */
  maxRetries: number;
  /** Enable verbose logging */
  verbose: boolean;
  /** Timeout in milliseconds (default: 120000 for large files) */
  timeout?: number;
}

const DEFAULT_CONFIG: DownloaderConfig = {
  maxRetries: 5,
  verbose: false,
  timeout: 120000, // 2 minutes for large binaries
};

/** Error types for categorized handling */
export type NetworkErrorType = 'socket' | 'timeout' | 'http' | 'redirect' | 'unknown';

/** Categorize error for appropriate retry/reporting */
export function categorizeError(error: Error): NetworkErrorType {
  const msg = error.message.toLowerCase();
  if (msg.includes('socket hang up') || msg.includes('econnreset') || msg.includes('epipe')) {
    return 'socket';
  }
  if (msg.includes('timeout') || msg.includes('etimedout')) {
    return 'timeout';
  }
  if (msg.includes('http ')) {
    return 'http';
  }
  if (msg.includes('redirect')) {
    return 'redirect';
  }
  return 'unknown';
}

/** Get user-friendly error message */
export function getErrorMessage(error: Error, attempt: number, maxAttempts: number): string {
  const type = categorizeError(error);
  const prefix = `[Attempt ${attempt}/${maxAttempts}]`;

  switch (type) {
    case 'socket':
      return `${prefix} Connection dropped (socket hang up) - retrying with fresh connection...`;
    case 'timeout':
      return `${prefix} Download timed out - retrying with extended timeout...`;
    case 'http':
      return `${prefix} Server error: ${error.message}`;
    case 'redirect':
      return `${prefix} Redirect failed: ${error.message}`;
    default:
      return `${prefix} Network error: ${error.message}`;
  }
}

/** Check if error is retryable */
export function isRetryableError(error: Error): boolean {
  const type = categorizeError(error);
  // Retry socket errors, timeouts, and unknown errors
  if (type === 'socket' || type === 'timeout' || type === 'unknown') {
    return true;
  }
  if (type === 'http') {
    const msg = error.message;
    // Retry 5xx server errors and 429 rate limit (HTTP 5xx matches 500, 502, 503, 504, etc.)
    return msg.includes('HTTP 5') || msg.includes('HTTP 429');
  }
  return false;
}

/**
 * Download file from URL with progress tracking
 * @param timeout Timeout in ms (default 120000 for large files)
 */
export function downloadFile(
  url: string,
  destPath: string,
  onProgress?: ProgressCallback,
  verbose = false,
  timeout = 120000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const cleanup = (err?: Error) => {
      if (resolved) return;
      resolved = true;
      fs.unlink(destPath, () => {}); // Cleanup partial file
      reject(err || new Error('Download aborted'));
    };

    const handleResponse = (res: http.IncomingMessage) => {
      // Handle redirects (GitHub releases use 302)
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (!redirectUrl) {
          cleanup(new Error('Redirect without location header'));
          return;
        }
        if (verbose) {
          console.error(`[cliproxy] Following redirect: ${redirectUrl}`);
        }
        downloadFile(redirectUrl, destPath, onProgress, verbose, timeout)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        cleanup(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress({
            total: totalBytes,
            downloaded: downloadedBytes,
            percentage: Math.round((downloadedBytes / totalBytes) * 100),
          });
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        if (resolved) return;
        resolved = true;
        fileStream.close();
        resolve();
      });

      fileStream.on('error', cleanup);
      res.on('error', cleanup);
    };

    const protocol = url.startsWith('https') ? https : http;

    // Use agent: false to prevent connection pooling (allows process to exit)
    const options = {
      headers: {
        'User-Agent': 'CCS-CLIProxyPlus-Downloader/1.0',
      },
      agent: false, // Disable connection pooling for clean exit
    };

    const req = protocol.get(url, options, handleResponse);

    req.on('error', (err) => {
      if (!resolved) {
        cleanup(err);
      }
    });

    req.setTimeout(timeout, () => {
      req.destroy();
      if (!resolved) {
        cleanup(new Error(`Download timeout (${timeout / 1000}s)`));
      }
    });
  });
}

/**
 * Download file with retry logic and exponential backoff
 * Uses smarter backoff for socket errors (longer delays)
 */
export async function downloadWithRetry(
  url: string,
  destPath: string,
  config: Partial<DownloaderConfig> = {}
): Promise<DownloadResult> {
  const { maxRetries, verbose, timeout } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;
  let retries = 0;
  let currentTimeout = timeout || 120000;

  while (retries < maxRetries) {
    try {
      await downloadFile(url, destPath, undefined, verbose, currentTimeout);
      return { success: true, filePath: destPath, retries };
    } catch (error) {
      const err = error as Error;
      lastError = err;
      retries++;

      // Check if error is retryable
      if (!isRetryableError(err)) {
        if (verbose) {
          console.error(`[cliproxy] Non-retryable error: ${err.message}`);
        }
        break;
      }

      if (retries < maxRetries) {
        const errorType = categorizeError(err);
        // Socket errors: longer backoff (2s, 4s, 8s, 16s, 32s)
        // Timeout errors: increase timeout and use standard backoff
        // Other errors: standard exponential backoff (1s, 2s, 4s...)
        let delay: number;

        if (errorType === 'socket') {
          delay = Math.pow(2, retries) * 1000; // 2s, 4s, 8s, 16s, 32s
        } else if (errorType === 'timeout') {
          delay = Math.pow(2, retries - 1) * 1000;
          currentTimeout = Math.min(currentTimeout * 1.5, 300000); // Increase timeout up to 5 min
        } else {
          delay = Math.pow(2, retries - 1) * 1000;
        }

        // Log with user-friendly message
        console.error(`[cliproxy] ${getErrorMessage(err, retries, maxRetries)}`);
        if (verbose) {
          console.error(`[cliproxy] Waiting ${delay}ms before retry...`);
        }
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: `Download failed after ${retries} attempts: ${lastError?.message || 'Unknown error'}`,
    retries,
  };
}

/**
 * Fetch text content from URL (single attempt)
 */
function fetchTextOnce(url: string, verbose = false, timeout = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const handleResponse = (res: http.IncomingMessage) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        fetchTextOnce(redirectUrl, verbose, timeout).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (!resolved) {
          resolved = true;
          resolve(data);
        }
      });
      res.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    };

    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'CCS-CLIProxyPlus-Downloader/1.0',
      },
      agent: false, // Disable connection pooling for clean exit
    };

    const req = protocol.get(url, options, handleResponse);
    req.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      if (!resolved) {
        resolved = true;
        reject(new Error(`Request timeout (${timeout / 1000}s)`));
      }
    });
  });
}

/**
 * Fetch text content from URL with retry logic
 */
export async function fetchText(url: string, verbose = false, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchTextOnce(url, verbose);
    } catch (error) {
      const err = error as Error;
      lastError = err;

      if (!isRetryableError(err) || attempt === maxRetries) {
        break;
      }

      const delay = Math.pow(2, attempt - 1) * 1000;
      if (verbose) {
        console.error(`[cliproxy] fetchText retry ${attempt}/${maxRetries}: ${err.message}`);
      }
      await sleep(delay);
    }
  }

  throw lastError || new Error('fetchText failed');
}

/**
 * Fetch JSON from URL (single attempt, for GitHub API)
 */
function fetchJsonOnce(
  url: string,
  verbose = false,
  timeout = 15000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const options: https.RequestOptions = {
      headers: {
        'User-Agent': 'CCS-CLIProxyPlus-Updater/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
      agent: false, // Disable connection pooling for clean exit
    };

    const handleResponse = (res: http.IncomingMessage) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location header'));
          return;
        }
        fetchJsonOnce(redirectUrl, verbose, timeout).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API error: HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (resolved) return;
        resolved = true;
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON from GitHub API'));
        }
      });
      res.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    };

    const req = https.get(url, options, handleResponse);
    req.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
    req.setTimeout(timeout, () => {
      req.destroy();
      if (!resolved) {
        resolved = true;
        reject(new Error(`GitHub API timeout (${timeout / 1000}s)`));
      }
    });
  });
}

/**
 * Fetch JSON from URL (for GitHub API) with retry logic
 */
export async function fetchJson(
  url: string,
  verbose = false,
  maxRetries = 3
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchJsonOnce(url, verbose);
    } catch (error) {
      const err = error as Error;
      lastError = err;

      if (!isRetryableError(err) || attempt === maxRetries) {
        break;
      }

      const delay = Math.pow(2, attempt - 1) * 1000;
      if (verbose) {
        console.error(`[cliproxy] GitHub API retry ${attempt}/${maxRetries}: ${err.message}`);
      }
      await sleep(delay);
    }
  }

  throw lastError || new Error('fetchJson failed');
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
