#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const GlmtTransformer = require('./glmt-transformer');
const SSEParser = require('./sse-parser');
const DeltaAccumulator = require('./delta-accumulator');

/**
 * GlmtProxy - Embedded HTTP proxy for GLM thinking support
 *
 * Architecture:
 * - Intercepts Claude CLI → Z.AI calls
 * - Transforms Anthropic format → OpenAI format
 * - Converts reasoning_content → thinking blocks
 * - Supports both streaming and buffered modes
 *
 * Lifecycle:
 * - Spawned by bin/ccs.js when 'glmt' profile detected
 * - Binds to 127.0.0.1:random_port (security + avoid conflicts)
 * - Terminates when parent process exits
 *
 * Debugging:
 * - Verbose: Pass --verbose to see request/response logs
 * - Debug: Set CCS_DEBUG=1 to write logs to ~/.ccs/logs/
 *
 * Usage:
 *   const proxy = new GlmtProxy({ verbose: true });
 *   await proxy.start();
 */
class GlmtProxy {
  constructor(config = {}) {
    this.transformer = new GlmtTransformer({
      verbose: config.verbose,
      debugLog: config.debugLog || process.env.CCS_DEBUG === '1' || process.env.CCS_DEBUG_LOG === '1'
    });
    // Use ANTHROPIC_BASE_URL from environment (set by settings.json) or fallback to Z.AI default
    this.upstreamUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/coding/paas/v4/chat/completions';
    this.server = null;
    this.port = null;
    this.verbose = config.verbose || false;
    this.timeout = config.timeout || 120000; // 120s default
  }

  /**
   * Start HTTP server on random port
   * @returns {Promise<number>} Port number
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Bind to 127.0.0.1:0 (random port for security + avoid conflicts)
      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port;
        // Signal parent process
        console.log(`PROXY_READY:${this.port}`);

        // Info message (only show in verbose mode)
        if (this.verbose) {
          console.error(`[glmt] Proxy listening on port ${this.port} (streaming with auto-fallback)`);
        }

        // Debug mode notice
        if (this.transformer.debugLog) {
          console.error(`[glmt] Debug logging enabled: ${this.transformer.debugLogDir}`);
          console.error(`[glmt] WARNING: Debug logs contain full request/response data`);
        }

        this.log(`Verbose logging enabled`);
        resolve(this.port);
      });

      this.server.on('error', (error) => {
        console.error('[glmt-proxy] Server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Handle incoming HTTP request
   * @param {http.IncomingMessage} req - Request
   * @param {http.ServerResponse} res - Response
   */
  async handleRequest(req, res) {
    const startTime = Date.now();
    this.log(`Request: ${req.method} ${req.url}`);

    try {
      // Only accept POST requests
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      // Read request body
      const body = await this._readBody(req);
      this.log(`Request body size: ${body.length} bytes`);

      // Parse JSON with error handling
      let anthropicRequest;
      try {
        anthropicRequest = JSON.parse(body);
      } catch (jsonError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            type: 'invalid_request_error',
            message: 'Invalid JSON in request body: ' + jsonError.message
          }
        }));
        return;
      }

      // Log thinking parameter for debugging
      if (anthropicRequest.thinking) {
        this.log(`Request contains thinking parameter: ${JSON.stringify(anthropicRequest.thinking)}`);
      } else {
        this.log(`Request does NOT contain thinking parameter (will use message tags or default)`);
      }

      // Try streaming first (default), fallback to buffered on error
      const useStreaming = anthropicRequest.stream !== false;

      if (useStreaming) {
        try {
          await this._handleStreamingRequest(req, res, anthropicRequest, startTime);
        } catch (streamError) {
          this.log(`Streaming failed: ${streamError.message}, retrying buffered mode`);
          try {
            await this._handleBufferedRequest(req, res, anthropicRequest, startTime);
          } catch (bufferedError) {
            // Both modes failed, propagate error
            throw bufferedError;
          }
        }
      } else {
        await this._handleBufferedRequest(req, res, anthropicRequest, startTime);
      }

    } catch (error) {
      console.error('[glmt-proxy] Request error:', error.message);
      const duration = Date.now() - startTime;
      this.log(`Request failed after ${duration}ms: ${error.message}`);

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          type: 'proxy_error',
          message: error.message
        }
      }));
    }
  }

  /**
   * Handle buffered (non-streaming) request
   * @private
   */
  async _handleBufferedRequest(req, res, anthropicRequest, startTime) {
    // Transform to OpenAI format
    const { openaiRequest, thinkingConfig } =
      this.transformer.transformRequest(anthropicRequest);

    this.log(`Transformed request, thinking: ${thinkingConfig.thinking}`);

    // Forward to Z.AI
    const openaiResponse = await this._forwardToUpstream(
      openaiRequest,
      req.headers
    );

    this.log(`Received response from upstream`);

    // Transform back to Anthropic format
    const anthropicResponse = this.transformer.transformResponse(
      openaiResponse,
      thinkingConfig
    );

    // Return to Claude CLI
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(anthropicResponse));

    const duration = Date.now() - startTime;
    this.log(`Request completed in ${duration}ms`);
  }

  /**
   * Handle streaming request
   * @private
   */
  async _handleStreamingRequest(req, res, anthropicRequest, startTime) {
    this.log('Using streaming mode');

    // Transform request
    const { openaiRequest, thinkingConfig } =
      this.transformer.transformRequest(anthropicRequest);

    // Force streaming
    openaiRequest.stream = true;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no' // Disable proxy buffering
    });

    // Disable Nagle's algorithm to prevent buffering at socket level
    if (res.socket) {
      res.socket.setNoDelay(true);
    }

    this.log('Starting SSE stream to Claude CLI (socket buffering disabled)');

    // Forward and stream
    await this._forwardAndStreamUpstream(
      openaiRequest,
      req.headers,
      res,
      thinkingConfig,
      startTime
    );
  }

  /**
   * Read request body
   * @param {http.IncomingMessage} req - Request
   * @returns {Promise<string>} Body content
   * @private
   */
  _readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const maxSize = 10 * 1024 * 1024; // 10MB limit
      let totalSize = 0;

      req.on('data', chunk => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          reject(new Error('Request body too large (max 10MB)'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
  }

  /**
   * Forward request to Z.AI upstream
   * @param {Object} openaiRequest - OpenAI format request
   * @param {Object} originalHeaders - Original request headers
   * @returns {Promise<Object>} OpenAI response
   * @private
   */
  _forwardToUpstream(openaiRequest, originalHeaders) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.upstreamUrl);
      const requestBody = JSON.stringify(openaiRequest);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname || '/api/coding/paas/v4/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          // Preserve auth header from original request
          'Authorization': originalHeaders['authorization'] || '',
          'User-Agent': 'CCS-GLMT-Proxy/1.0'
        }
      };

      // Debug logging
      this.log(`Forwarding to: ${url.hostname}${url.pathname}`);

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        req.destroy();
        reject(new Error('Upstream request timeout'));
      }, this.timeout);

      const req = https.request(options, (res) => {
        clearTimeout(timeoutHandle);

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));

        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString();
            this.log(`Upstream response size: ${body.length} bytes`);

            // Check for non-200 status
            if (res.statusCode !== 200) {
              reject(new Error(
                `Upstream error: ${res.statusCode} ${res.statusMessage}\n${body}`
              ));
              return;
            }

            const response = JSON.parse(body);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid JSON from upstream: ' + error.message));
          }
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * Forward request to Z.AI and stream response
   * @param {Object} openaiRequest - OpenAI format request
   * @param {Object} originalHeaders - Original request headers
   * @param {http.ServerResponse} clientRes - Response to Claude CLI
   * @param {Object} thinkingConfig - Thinking configuration
   * @param {number} startTime - Request start time
   * @returns {Promise<void>}
   * @private
   */
  async _forwardAndStreamUpstream(openaiRequest, originalHeaders, clientRes, thinkingConfig, startTime) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.upstreamUrl);
      const requestBody = JSON.stringify(openaiRequest);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname || '/api/coding/paas/v4/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Authorization': originalHeaders['authorization'] || '',
          'User-Agent': 'CCS-GLMT-Proxy/1.0',
          'Accept': 'text/event-stream'
        }
      };

      this.log(`Forwarding streaming request to: ${url.hostname}${url.pathname}`);

      // C-03 Fix: Apply timeout to streaming requests
      const timeoutHandle = setTimeout(() => {
        req.destroy();
        reject(new Error(`Streaming request timeout after ${this.timeout}ms`));
      }, this.timeout);

      const req = https.request(options, (upstreamRes) => {
        clearTimeout(timeoutHandle);
        if (upstreamRes.statusCode !== 200) {
          let body = '';
          upstreamRes.on('data', chunk => body += chunk);
          upstreamRes.on('end', () => {
            reject(new Error(`Upstream error: ${upstreamRes.statusCode}\n${body}`));
          });
          return;
        }

        const parser = new SSEParser();
        const accumulator = new DeltaAccumulator(thinkingConfig);

        upstreamRes.on('data', (chunk) => {
          try {
            const events = parser.parse(chunk);

            events.forEach(event => {
              // Transform OpenAI delta → Anthropic events
              const anthropicEvents = this.transformer.transformDelta(event, accumulator);

              // Forward to Claude CLI with immediate flush
              anthropicEvents.forEach(evt => {
                const eventLine = `event: ${evt.event}\n`;
                const dataLine = `data: ${JSON.stringify(evt.data)}\n\n`;
                clientRes.write(eventLine + dataLine);

                // Flush immediately if method available (HTTP/2 or custom servers)
                if (typeof clientRes.flush === 'function') {
                  clientRes.flush();
                }
              });
            });
          } catch (error) {
            this.log(`Error processing chunk: ${error.message}`);
          }
        });

        upstreamRes.on('end', () => {
          const duration = Date.now() - startTime;
          this.log(`Streaming completed in ${duration}ms`);
          clientRes.end();
          resolve();
        });

        upstreamRes.on('error', (error) => {
          clearTimeout(timeoutHandle);
          this.log(`Upstream stream error: ${error.message}`);
          clientRes.write(`event: error\n`);
          clientRes.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          clientRes.end();
          reject(error);
        });
      });

      req.on('error', (error) => {
        clearTimeout(timeoutHandle);
        this.log(`Request error: ${error.message}`);
        clientRes.write(`event: error\n`);
        clientRes.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        clientRes.end();
        reject(error);
      });

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * Stop proxy server
   */
  stop() {
    if (this.server) {
      this.log('Stopping proxy server');
      this.server.close();
    }
  }

  /**
   * Log message if verbose
   * @param {string} message - Message to log
   * @private
   */
  log(message) {
    if (this.verbose) {
      console.error(`[glmt-proxy] ${message}`);
    }
  }
}

// Main entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');

  const proxy = new GlmtProxy({ verbose });

  proxy.start().catch(error => {
    console.error('[glmt-proxy] Failed to start:', error);
    process.exit(1);
  });

  // Cleanup on signals
  process.on('SIGTERM', () => {
    proxy.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    proxy.stop();
    process.exit(0);
  });

  // Keep process alive
  process.on('uncaughtException', (error) => {
    console.error('[glmt-proxy] Uncaught exception:', error);
    proxy.stop();
    process.exit(1);
  });
}

module.exports = GlmtProxy;
