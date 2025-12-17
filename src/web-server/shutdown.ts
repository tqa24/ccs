/**
 * Shutdown Handler
 *
 * Handles SIGINT/SIGTERM signals to close server and exit immediately.
 * No graceful waiting - config dashboard doesn't need it.
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer } from 'ws';
import { ok } from '../utils/ui';

/**
 * Setup shutdown handlers for SIGINT and SIGTERM
 */
export function setupGracefulShutdown(
  server: HTTPServer,
  _wss: WebSocketServer,
  cleanup?: () => void
): void {
  const shutdown = () => {
    console.log('\n' + ok('Shutting down...'));

    // Run cleanup (closes file watchers + WebSocket clients)
    if (cleanup) {
      cleanup();
    }

    // Close server and exit immediately
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
