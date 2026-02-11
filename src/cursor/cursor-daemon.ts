/**
 * Cursor Daemon Manager
 *
 * Manages the cursor daemon lifecycle (start/stop/status).
 * Uses CursorExecutor for OpenAI-compatible API proxy to Cursor backend.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import type { CursorDaemonStatus } from './types';
import { getCcsDir } from '../utils/config-manager';

// Temporary interface until #521 adds cursor to unified config
interface CursorConfig {
  port: number;
  model: string;
}

/**
 * Get Cursor directory path.
 */
function getCursorDir(): string {
  return path.join(getCcsDir(), 'cursor');
}

/**
 * Get PID file path.
 * Computed at runtime to respect CCS_HOME changes (e.g., in tests).
 */
function getPidFilePath(): string {
  return path.join(getCursorDir(), 'daemon.pid');
}

/**
 * Check if cursor daemon is running on the specified port.
 * Uses 127.0.0.1 instead of localhost for more reliable local connections.
 */
export async function isDaemonRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/health',
        method: 'GET',
        timeout: 3000,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Get daemon status.
 */
export async function getDaemonStatus(port: number): Promise<CursorDaemonStatus> {
  const running = await isDaemonRunning(port);
  const pid = getPidFromFile();

  return {
    running,
    port,
    pid: running ? (pid ?? undefined) : undefined,
  };
}

/**
 * Read PID from file.
 */
export function getPidFromFile(): number | null {
  const pidFile = getPidFilePath();
  try {
    if (fs.existsSync(pidFile)) {
      const content = fs.readFileSync(pidFile, 'utf8').trim();
      const pid = parseInt(content, 10);
      return isNaN(pid) ? null : pid;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Write PID to file.
 */
export function writePidToFile(pid: number): void {
  const pidFile = getPidFilePath();
  try {
    const dir = path.dirname(pidFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(pidFile, pid.toString(), { mode: 0o600 });
  } catch {
    // Ignore errors
  }
}

/**
 * Remove PID file.
 */
export function removePidFile(): void {
  const pidFile = getPidFilePath();
  try {
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Start the cursor daemon.
 *
 * @param config Cursor configuration
 * @returns Promise that resolves when daemon is ready
 */
export async function startDaemon(
  config: CursorConfig
): Promise<{ success: boolean; pid?: number; error?: string }> {
  // Check if already running
  if (await isDaemonRunning(config.port)) {
    return { success: true, pid: getPidFromFile() ?? undefined };
  }

  // For now, create a simple structure that will be filled in later
  // The actual server implementation will be added in a separate task
  return new Promise((resolve) => {
    let proc: ChildProcess;

    try {
      // Spawn a placeholder Node.js process
      // TODO: Replace with actual CursorExecutor-based server
      const args = [
        '-e',
        `
        const http = require('http');
        const server = http.createServer((req, res) => {
          if (req.url === '/health') {
            res.writeHead(200);
            res.end('OK');
          } else if (req.url === '/v1/models') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: [] }));
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        });
        server.listen(${config.port}, '127.0.0.1');
        `,
      ];

      proc = spawn('node', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
        shell: process.platform === 'win32',
      });

      // Unref so parent can exit
      proc.unref();

      if (proc.pid) {
        writePidToFile(proc.pid);
      }

      // Wait for daemon to be ready (poll for up to 30 seconds)
      let attempts = 0;
      const maxAttempts = 30;
      const checkInterval = setInterval(async () => {
        attempts++;

        if (await isDaemonRunning(config.port)) {
          clearInterval(checkInterval);
          resolve({ success: true, pid: proc.pid });
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          resolve({
            success: false,
            error: 'Daemon did not start within 30 seconds',
          });
        }
      }, 1000);

      proc.on('error', (err) => {
        clearInterval(checkInterval);
        resolve({
          success: false,
          error: `Failed to start daemon: ${err.message}`,
        });
      });

      proc.on('exit', (code, signal) => {
        clearInterval(checkInterval);
        if (code === null) {
          resolve({
            success: false,
            error: `Daemon process was killed by signal ${signal}`,
          });
        } else if (code === 0) {
          resolve({
            success: false,
            error: 'Daemon process exited unexpectedly with code 0',
          });
        } else if (code !== null) {
          resolve({
            success: false,
            error: `Daemon process exited with code ${code}`,
          });
        }
      });
    } catch (err) {
      resolve({
        success: false,
        error: `Failed to spawn daemon: ${(err as Error).message}`,
      });
    }
  });
}

/**
 * Stop the cursor daemon.
 */
export async function stopDaemon(): Promise<{ success: boolean; error?: string }> {
  const pid = getPidFromFile();

  if (!pid) {
    // No PID file, try to find by port
    removePidFile();
    return { success: true };
  }

  try {
    // Send SIGTERM to the process
    process.kill(pid, 'SIGTERM');

    // Wait for process to exit (up to 5 seconds)
    let attempts = 0;
    while (attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        // Check if process still exists (kill(pid, 0) throws if not)
        process.kill(pid, 0);
        attempts++;
      } catch {
        // Process no longer exists
        break;
      }
    }

    // Escalate to SIGKILL if process still alive after SIGTERM attempts
    try {
      process.kill(pid, 0); // Check if still alive
      process.kill(pid, 'SIGKILL'); // Escalate to force kill
    } catch {
      // Already dead — good
    }

    removePidFile();
    return { success: true };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ESRCH') {
      // Process doesn't exist
      removePidFile();
      return { success: true };
    }
    return {
      success: false,
      error: `Failed to stop daemon: ${error.message}`,
    };
  }
}
