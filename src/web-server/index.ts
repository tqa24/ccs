/**
 * CCS Config Dashboard - Web Server
 *
 * Express server with WebSocket support for real-time config management.
 * Single HTTP server handles REST API, static files, and WebSocket connections.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from './websocket';

export interface ServerOptions {
  port: number;
  staticDir?: string;
}

export interface ServerInstance {
  server: http.Server;
  wss: WebSocketServer;
  cleanup: () => void;
}

/**
 * Start Express server with WebSocket support
 */
export async function startServer(options: ServerOptions): Promise<ServerInstance> {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // JSON body parsing
  app.use(express.json());

  // REST API routes (Phase 03)
  const { apiRoutes } = await import('./routes');
  app.use('/api', apiRoutes);

  // Shared data routes (Phase 07)
  const { sharedRoutes } = await import('./shared-routes');
  app.use('/api/shared', sharedRoutes);

  // Overview routes (Phase 07)
  const { overviewRoutes } = await import('./overview-routes');
  app.use('/api/overview', overviewRoutes);

  // Static files (dist/ui/)
  const staticDir = options.staticDir || path.join(__dirname, '../../dist/ui');
  app.use(express.static(staticDir));

  // SPA fallback - return index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  // WebSocket connection handler + file watcher
  const { cleanup } = setupWebSocket(wss);

  // Start listening
  return new Promise<ServerInstance>((resolve) => {
    server.listen(options.port, () => {
      resolve({ server, wss, cleanup });
    });
  });
}
