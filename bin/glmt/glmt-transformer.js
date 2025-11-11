#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const SSEParser = require('./sse-parser');
const DeltaAccumulator = require('./delta-accumulator');
const LocaleEnforcer = require('./locale-enforcer');

/**
 * GlmtTransformer - Convert between Anthropic and OpenAI formats with thinking and tool support
 *
 * Features:
 * - Request: Anthropic → OpenAI (inject reasoning params, transform tools)
 * - Response: OpenAI reasoning_content → Anthropic thinking blocks
 * - Tool Support: Anthropic tools ↔ OpenAI function calling (bidirectional)
 * - Streaming: Real-time tool calls with input_json deltas
 * - Debug mode: Log raw data to ~/.ccs/logs/ (CCS_DEBUG_LOG=1)
 * - Verbose mode: Console logging with timestamps
 * - Validation: Self-test transformation results
 *
 * Usage:
 *   const transformer = new GlmtTransformer({ verbose: true, debugLog: true });
 *   const { openaiRequest, thinkingConfig } = transformer.transformRequest(req);
 *   const anthropicResponse = transformer.transformResponse(resp, thinkingConfig);
 *
 * Control Tags (in user prompt):
 *   <Thinking:On|Off>        - Enable/disable reasoning
 *   <Effort:Low|Medium|High> - Control reasoning depth
 */
class GlmtTransformer {
  static _warnedDeprecation = false;

  constructor(config = {}) {
    this.defaultThinking = config.defaultThinking ?? true;
    this.verbose = config.verbose || false;

    // Support both CCS_DEBUG and CCS_DEBUG_LOG (with deprecation warning)
    const oldVar = process.env.CCS_DEBUG_LOG === '1';
    const newVar = process.env.CCS_DEBUG === '1';
    this.debugLog = config.debugLog ?? (newVar || oldVar);

    // Show deprecation warning once
    if (oldVar && !newVar && !GlmtTransformer._warnedDeprecation) {
      console.warn('[glmt] Warning: CCS_DEBUG_LOG is deprecated, use CCS_DEBUG instead');
      GlmtTransformer._warnedDeprecation = true;
    }

    this.debugLogDir = config.debugLogDir || path.join(os.homedir(), '.ccs', 'logs');
    this.modelMaxTokens = {
      'GLM-4.6': 128000,
      'GLM-4.5': 96000,
      'GLM-4.5-air': 16000
    };
    // Effort level thresholds (budget_tokens)
    this.EFFORT_LOW_THRESHOLD = 2048;
    this.EFFORT_HIGH_THRESHOLD = 8192;

    // Initialize locale enforcer (always enforce English)
    this.localeEnforcer = new LocaleEnforcer();
  }

  /**
   * Transform Anthropic request to OpenAI format
   * @param {Object} anthropicRequest - Anthropic Messages API request
   * @returns {Object} { openaiRequest, thinkingConfig }
   */
  transformRequest(anthropicRequest) {
    // Log original request
    this._writeDebugLog('request-anthropic', anthropicRequest);

    try {
      // 1. Extract thinking control from messages (tags like <Thinking:On|Off>)
      const thinkingConfig = this._extractThinkingControl(
        anthropicRequest.messages || []
      );
      const hasControlTags = this._hasThinkingTags(anthropicRequest.messages || []);

      // 2. Detect "think" keywords in user prompts (Anthropic-style)
      const keywordConfig = this._detectThinkKeywords(anthropicRequest.messages || []);
      if (keywordConfig && !anthropicRequest.thinking && !hasControlTags) {
        thinkingConfig.thinking = keywordConfig.thinking;
        thinkingConfig.effort = keywordConfig.effort;
        this.log(`Detected think keyword: ${keywordConfig.keyword}, effort=${keywordConfig.effort}`);
      }

      // 3. Check anthropicRequest.thinking parameter (takes precedence)
      // Claude CLI sends this when alwaysThinkingEnabled is configured
      if (anthropicRequest.thinking) {
        if (anthropicRequest.thinking.type === 'enabled') {
          thinkingConfig.thinking = true;
          this.log('Claude CLI explicitly enabled thinking (overrides budget)');
        } else if (anthropicRequest.thinking.type === 'disabled') {
          thinkingConfig.thinking = false;
          this.log('Claude CLI explicitly disabled thinking (overrides budget)');
        } else {
          this.log(`Warning: Unknown thinking type: ${anthropicRequest.thinking.type}`);
        }
      }

      this.log(`Final thinking control: ${JSON.stringify(thinkingConfig)}`);

      // 3. Map model
      const glmModel = this._mapModel(anthropicRequest.model);

      // 4. Inject locale instruction before sanitization
      const messagesWithLocale = this.localeEnforcer.injectInstruction(
        anthropicRequest.messages || []
      );

      // 5. Convert to OpenAI format
      const openaiRequest = {
        model: glmModel,
        messages: this._sanitizeMessages(messagesWithLocale),
        max_tokens: this._getMaxTokens(glmModel),
        stream: anthropicRequest.stream ?? false
      };

      // 5.5. Transform tools parameter if present
      if (anthropicRequest.tools && anthropicRequest.tools.length > 0) {
        openaiRequest.tools = this._transformTools(anthropicRequest.tools);
        // Always use "auto" as Z.AI doesn't support other modes
        openaiRequest.tool_choice = "auto";
        this.log(`Transformed ${anthropicRequest.tools.length} tools for OpenAI format`);
      }

      // 6. Preserve optional parameters
      if (anthropicRequest.temperature !== undefined) {
        openaiRequest.temperature = anthropicRequest.temperature;
      }
      if (anthropicRequest.top_p !== undefined) {
        openaiRequest.top_p = anthropicRequest.top_p;
      }

      // 7. Handle streaming
      // Keep stream parameter from request
      if (anthropicRequest.stream !== undefined) {
        openaiRequest.stream = anthropicRequest.stream;
      }

      // 8. Inject reasoning parameters
      this._injectReasoningParams(openaiRequest, thinkingConfig);

      // Log transformed request
      this._writeDebugLog('request-openai', openaiRequest);

      return { openaiRequest, thinkingConfig };
    } catch (error) {
      console.error('[glmt-transformer] Request transformation error:', error);
      // Return original request with warning
      return {
        openaiRequest: anthropicRequest,
        thinkingConfig: { thinking: false },
        error: error.message
      };
    }
  }

  /**
   * Transform OpenAI response to Anthropic format
   * @param {Object} openaiResponse - OpenAI Chat Completions response
   * @param {Object} thinkingConfig - Config from request transformation
   * @returns {Object} Anthropic Messages API response
   */
  transformResponse(openaiResponse, thinkingConfig = {}) {
    // Log original response
    this._writeDebugLog('response-openai', openaiResponse);

    try {
      const choice = openaiResponse.choices?.[0];
      if (!choice) {
        throw new Error('No choices in OpenAI response');
      }

      const message = choice.message;
      const content = [];

      // Add thinking block if reasoning_content exists
      if (message.reasoning_content) {
        const length = message.reasoning_content.length;
        const lineCount = message.reasoning_content.split('\n').length;
        const preview = message.reasoning_content
          .substring(0, 100)
          .replace(/\n/g, ' ')
          .trim();

        this.log(`Detected reasoning_content:`);
        this.log(`  Length: ${length} characters`);
        this.log(`  Lines: ${lineCount}`);
        this.log(`  Preview: ${preview}...`);

        content.push({
          type: 'thinking',
          thinking: message.reasoning_content,
          signature: this._generateThinkingSignature(message.reasoning_content)
        });
      } else {
        this.log('No reasoning_content in OpenAI response');
        this.log('Note: This is expected if thinking not requested or model cannot reason');
      }

      // Add text content
      if (message.content) {
        content.push({
          type: 'text',
          text: message.content
        });
      }

      // Handle tool_calls if present
      if (message.tool_calls && message.tool_calls.length > 0) {
        message.tool_calls.forEach(toolCall => {
          let parsedInput;
          try {
            parsedInput = JSON.parse(toolCall.function.arguments || '{}');
          } catch (parseError) {
            this.log(`Warning: Invalid JSON in tool arguments: ${parseError.message}`);
            parsedInput = { _error: 'Invalid JSON', _raw: toolCall.function.arguments };
          }

          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: parsedInput
          });
        });
      }

      const anthropicResponse = {
        id: openaiResponse.id || 'msg_' + Date.now(),
        type: 'message',
        role: 'assistant',
        content: content,
        model: openaiResponse.model || 'glm-4.6',
        stop_reason: this._mapStopReason(choice.finish_reason),
        usage: {
          input_tokens: openaiResponse.usage?.prompt_tokens || 0,
          output_tokens: openaiResponse.usage?.completion_tokens || 0
        }
      };

      // Validate transformation in verbose mode
      if (this.verbose) {
        const validation = this._validateTransformation(anthropicResponse);
        this.log(`Transformation validation: ${validation.passed}/${validation.total} checks passed`);
        if (!validation.valid) {
          this.log(`Failed checks: ${JSON.stringify(validation.checks, null, 2)}`);
        }
      }

      // Log transformed response
      this._writeDebugLog('response-anthropic', anthropicResponse);

      return anthropicResponse;
    } catch (error) {
      console.error('[glmt-transformer] Response transformation error:', error);
      // Return minimal valid response
      return {
        id: 'msg_error_' + Date.now(),
        type: 'message',
        role: 'assistant',
        content: [{
          type: 'text',
          text: '[Transformation Error] ' + error.message
        }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 }
      };
    }
  }

  /**
   * Sanitize messages for OpenAI API compatibility
   * Convert tool_result blocks to separate tool messages
   * Filter out thinking blocks
   * @param {Array} messages - Messages array
   * @returns {Array} Sanitized messages
   * @private
   */
  _sanitizeMessages(messages) {
    const result = [];

    for (const msg of messages) {
      // If content is a string, add as-is
      if (typeof msg.content === 'string') {
        result.push(msg);
        continue;
      }

      // If content is an array, process blocks
      if (Array.isArray(msg.content)) {
        // Separate tool_result blocks from other content
        const toolResults = msg.content.filter(block => block.type === 'tool_result');
        const textBlocks = msg.content.filter(block => block.type === 'text');
        const toolUseBlocks = msg.content.filter(block => block.type === 'tool_use');

        // CRITICAL: Tool messages must come BEFORE user text in OpenAI API
        // Convert tool_result blocks to OpenAI tool messages FIRST
        for (const toolResult of toolResults) {
          result.push({
            role: 'tool',
            tool_call_id: toolResult.tool_use_id,
            content: typeof toolResult.content === 'string'
              ? toolResult.content
              : JSON.stringify(toolResult.content)
          });
        }

        // Add text content as user/assistant message AFTER tool messages
        if (textBlocks.length > 0) {
          const textContent = textBlocks.length === 1
            ? textBlocks[0].text
            : textBlocks.map(b => b.text).join('\n');

          result.push({
            role: msg.role,
            content: textContent
          });
        }

        // Add tool_use blocks (assistant's tool calls) - skip for now, they're in assistant messages
        // OpenAI handles these differently in response, not request

        // If no content at all, add empty message (but not if we added tool messages)
        if (textBlocks.length === 0 && toolResults.length === 0 && toolUseBlocks.length === 0) {
          result.push({
            role: msg.role,
            content: ''
          });
        }

        continue;
      }

      // Fallback: return message as-is
      result.push(msg);
    }

    return result;
  }

  /**
   * Transform Anthropic tools to OpenAI tools format
   * @param {Array} anthropicTools - Anthropic tools array
   * @returns {Array} OpenAI tools array
   * @private
   */
  _transformTools(anthropicTools) {
    return anthropicTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema || {}
      }
    }));
  }

  /**
   * Check if messages contain thinking control tags
   * @param {Array} messages - Messages array
   * @returns {boolean} True if tags found
   * @private
   */
  _hasThinkingTags(messages) {
    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      const content = msg.content;
      if (typeof content !== 'string') continue;

      // Check for control tags
      if (/<Thinking:(On|Off)>/i.test(content) || /<Effort:(Low|Medium|High)>/i.test(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract thinking control tags from user messages
   * @param {Array} messages - Messages array
   * @returns {Object} { thinking: boolean, effort: string }
   * @private
   */
  _extractThinkingControl(messages) {
    const config = {
      thinking: this.defaultThinking,
      effort: 'medium'
    };

    // Scan user messages for control tags
    for (const msg of messages) {
      if (msg.role !== 'user') continue;

      const content = msg.content;
      if (typeof content !== 'string') continue;

      // Check for <Thinking:On|Off>
      const thinkingMatch = content.match(/<Thinking:(On|Off)>/i);
      if (thinkingMatch) {
        config.thinking = thinkingMatch[1].toLowerCase() === 'on';
      }

      // Check for <Effort:Low|Medium|High>
      const effortMatch = content.match(/<Effort:(Low|Medium|High)>/i);
      if (effortMatch) {
        config.effort = effortMatch[1].toLowerCase();
      }
    }

    return config;
  }

  /**
   * Generate thinking signature for Claude Code UI
   * @param {string} thinking - Thinking content
   * @returns {Object} Signature object
   * @private
   */
  _generateThinkingSignature(thinking) {
    // Generate signature hash
    const hash = crypto.createHash('sha256')
      .update(thinking)
      .digest('hex')
      .substring(0, 16);

    return {
      type: 'thinking_signature',
      hash: hash,
      length: thinking.length,
      timestamp: Date.now()
    };
  }

  /**
   * Detect Anthropic-style "think" keywords in user prompts
   * Maps: "ultrathink" > "think harder" > "think hard" > "think"
   * @param {Array} messages - Messages array
   * @returns {Object|null} { thinking, effort, keyword } or null
   * @private
   */
  _detectThinkKeywords(messages) {
    if (!messages || messages.length === 0) return null;

    // Extract text from user messages
    const text = messages
      .filter(m => m.role === 'user')
      .map(m => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .filter(block => block.type === 'text')
            .map(block => block.text || '')
            .join(' ');
        }
        return '';
      })
      .join(' ');

    // Priority: ultrathink > think harder > think hard > think
    // Effort levels: max > high > medium > low (matches Anthropic's 4-tier system)
    // Use word boundaries to avoid matching "thinking", "rethink", etc.
    if (/\bultrathink\b/i.test(text)) {
      return { thinking: true, effort: 'max', keyword: 'ultrathink' };
    }
    if (/\bthink\s+harder\b/i.test(text)) {
      return { thinking: true, effort: 'high', keyword: 'think harder' };
    }
    if (/\bthink\s+hard\b/i.test(text)) {
      return { thinking: true, effort: 'medium', keyword: 'think hard' };
    }
    if (/\bthink\b/i.test(text)) {
      return { thinking: true, effort: 'low', keyword: 'think' };
    }

    return null; // No keywords detected
  }

  /**
   * Inject reasoning parameters into OpenAI request
   * @param {Object} openaiRequest - OpenAI request to modify
   * @param {Object} thinkingConfig - Thinking configuration
   * @returns {Object} Modified request
   * @private
   */
  _injectReasoningParams(openaiRequest, thinkingConfig) {
    // Always enable sampling for temperature/top_p to work
    openaiRequest.do_sample = true;

    // Add thinking-specific parameters if enabled
    if (thinkingConfig.thinking) {
      // Z.AI may support these parameters (based on research)
      openaiRequest.reasoning = true;
      openaiRequest.reasoning_effort = thinkingConfig.effort;
    }

    return openaiRequest;
  }

  /**
   * Map Anthropic model to GLM model
   * @param {string} anthropicModel - Anthropic model name
   * @returns {string} GLM model name
   * @private
   */
  _mapModel(anthropicModel) {
    // Default to GLM-4.6 (latest and most capable)
    return 'GLM-4.6';
  }

  /**
   * Get max tokens for model
   * @param {string} model - Model name
   * @returns {number} Max tokens
   * @private
   */
  _getMaxTokens(model) {
    return this.modelMaxTokens[model] || 128000;
  }

  /**
   * Map OpenAI stop reason to Anthropic stop reason
   * @param {string} openaiReason - OpenAI finish_reason
   * @returns {string} Anthropic stop_reason
   * @private
   */
  _mapStopReason(openaiReason) {
    const mapping = {
      'stop': 'end_turn',
      'length': 'max_tokens',
      'tool_calls': 'tool_use',
      'content_filter': 'stop_sequence'
    };
    return mapping[openaiReason] || 'end_turn';
  }

  /**
   * Write debug log to file
   * @param {string} type - 'request-anthropic', 'request-openai', 'response-openai', 'response-anthropic'
   * @param {object} data - Data to log
   * @private
   */
  _writeDebugLog(type, data) {
    if (!this.debugLog) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const filename = `${timestamp}-${type}.json`;
      const filepath = path.join(this.debugLogDir, filename);

      // Ensure directory exists
      fs.mkdirSync(this.debugLogDir, { recursive: true });

      // Write file (pretty-printed)
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');

      if (this.verbose) {
        this.log(`Debug log written: ${filepath}`);
      }
    } catch (error) {
      console.error(`[glmt-transformer] Failed to write debug log: ${error.message}`);
    }
  }

  /**
   * Validate transformed Anthropic response
   * @param {object} anthropicResponse - Response to validate
   * @returns {object} Validation results
   * @private
   */
  _validateTransformation(anthropicResponse) {
    const checks = {
      hasContent: Boolean(anthropicResponse.content && anthropicResponse.content.length > 0),
      hasThinking: anthropicResponse.content?.some(block => block.type === 'thinking') || false,
      hasText: anthropicResponse.content?.some(block => block.type === 'text') || false,
      validStructure: anthropicResponse.type === 'message' && anthropicResponse.role === 'assistant',
      hasUsage: Boolean(anthropicResponse.usage)
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;

    return { checks, passed, total, valid: passed === total };
  }

  /**
   * Transform OpenAI streaming delta to Anthropic events
   * @param {Object} openaiEvent - Parsed SSE event from Z.AI
   * @param {DeltaAccumulator} accumulator - State accumulator
   * @returns {Array<Object>} Array of Anthropic SSE events
   */
  transformDelta(openaiEvent, accumulator) {
    const events = [];

    // Debug logging for streaming deltas
    if (this.debugLog && openaiEvent.data) {
      this._writeDebugLog('delta-openai', openaiEvent.data);
    }

    // Handle [DONE] marker
    // Only finalize if we haven't already (deferred finalization may have already triggered)
    if (openaiEvent.event === 'done') {
      if (!accumulator.finalized) {
        return this.finalizeDelta(accumulator);
      }
      return []; // Already finalized
    }

    // Usage update (appears in final chunk, may be before choice data)
    // Process this BEFORE early returns to ensure we capture usage
    if (openaiEvent.data?.usage) {
      accumulator.updateUsage(openaiEvent.data.usage);

      // If we have both usage AND finish_reason, finalize immediately
      if (accumulator.finishReason) {
        events.push(...this.finalizeDelta(accumulator));
        return events; // Early return after finalization
      }
    }

    const choice = openaiEvent.data?.choices?.[0];
    if (!choice) return events;

    const delta = choice.delta;
    if (!delta) return events;

    // Message start
    if (!accumulator.messageStarted) {
      if (openaiEvent.data.model) {
        accumulator.model = openaiEvent.data.model;
      }
      events.push(this._createMessageStartEvent(accumulator));
      accumulator.messageStarted = true;
    }

    // Role
    if (delta.role) {
      accumulator.role = delta.role;
    }

    // Reasoning content delta (Z.AI streams incrementally - confirmed in Phase 02)
    if (delta.reasoning_content) {
      const currentBlock = accumulator.getCurrentBlock();

      if (!currentBlock || currentBlock.type !== 'thinking') {
        // Start thinking block
        const block = accumulator.startBlock('thinking');
        events.push(this._createContentBlockStartEvent(block));
      }

      accumulator.addDelta(delta.reasoning_content);
      events.push(this._createThinkingDeltaEvent(
        accumulator.getCurrentBlock(),
        delta.reasoning_content
      ));
    }

    // Text content delta
    if (delta.content) {
      const currentBlock = accumulator.getCurrentBlock();

      // Close thinking block if transitioning from thinking to text
      if (currentBlock && currentBlock.type === 'thinking' && !currentBlock.stopped) {
        events.push(this._createSignatureDeltaEvent(currentBlock));
        events.push(this._createContentBlockStopEvent(currentBlock));
        accumulator.stopCurrentBlock();
      }

      if (!accumulator.getCurrentBlock() || accumulator.getCurrentBlock().type !== 'text') {
        // Start text block
        const block = accumulator.startBlock('text');
        events.push(this._createContentBlockStartEvent(block));
      }

      accumulator.addDelta(delta.content);
      events.push(this._createTextDeltaEvent(
        accumulator.getCurrentBlock(),
        delta.content
      ));
    }

    // Check for planning loop after each thinking block completes
    if (accumulator.checkForLoop()) {
      this.log('WARNING: Planning loop detected - 3 consecutive thinking blocks with no tool calls');
      this.log('Forcing early finalization to prevent unbounded planning');

      // Close current block if any
      const currentBlock = accumulator.getCurrentBlock();
      if (currentBlock && !currentBlock.stopped) {
        if (currentBlock.type === 'thinking') {
          events.push(this._createSignatureDeltaEvent(currentBlock));
        }
        events.push(this._createContentBlockStopEvent(currentBlock));
        accumulator.stopCurrentBlock();
      }

      // Force finalization
      events.push(...this.finalizeDelta(accumulator));
      return events;
    }

    // Tool calls deltas
    if (delta.tool_calls && delta.tool_calls.length > 0) {
      // Close current content block ONCE before processing any tool calls
      const currentBlock = accumulator.getCurrentBlock();
      if (currentBlock && !currentBlock.stopped) {
        if (currentBlock.type === 'thinking') {
          events.push(this._createSignatureDeltaEvent(currentBlock));
        }
        events.push(this._createContentBlockStopEvent(currentBlock));
        accumulator.stopCurrentBlock();
      }

      // Process each tool call delta
      for (const toolCallDelta of delta.tool_calls) {
        // Track tool call state
        const isNewToolCall = !accumulator.toolCallsIndex[toolCallDelta.index];
        accumulator.addToolCallDelta(toolCallDelta);

        // Emit tool use events (start + input_json deltas)
        if (isNewToolCall) {
          // Start new tool_use block in accumulator
          const block = accumulator.startBlock('tool_use');
          const toolCall = accumulator.toolCallsIndex[toolCallDelta.index];

          events.push({
            event: 'content_block_start',
            data: {
              type: 'content_block_start',
              index: block.index,
              content_block: {
                type: 'tool_use',
                id: toolCall.id || `tool_${toolCallDelta.index}`,
                name: toolCall.function.name || ''
              }
            }
          });
        }

        // Emit input_json delta if arguments present
        if (toolCallDelta.function?.arguments) {
          const currentToolBlock = accumulator.getCurrentBlock();
          if (currentToolBlock && currentToolBlock.type === 'tool_use') {
            events.push({
              event: 'content_block_delta',
              data: {
                type: 'content_block_delta',
                index: currentToolBlock.index,
                delta: {
                  type: 'input_json_delta',
                  partial_json: toolCallDelta.function.arguments
                }
              }
            });
          }
        }
      }
    }

    // Finish reason
    if (choice.finish_reason) {
      accumulator.finishReason = choice.finish_reason;

      // If we have both finish_reason AND usage, finalize immediately
      if (accumulator.usageReceived) {
        events.push(...this.finalizeDelta(accumulator));
      }
    }

    // Debug logging for generated events
    if (this.debugLog && events.length > 0) {
      this._writeDebugLog('delta-anthropic-events', { events, accumulator: accumulator.getSummary() });
    }

    return events;
  }

  /**
   * Finalize streaming and generate closing events
   * @param {DeltaAccumulator} accumulator - State accumulator
   * @returns {Array<Object>} Final Anthropic SSE events
   */
  finalizeDelta(accumulator) {
    if (accumulator.finalized) {
      return []; // Already finalized
    }

    const events = [];

    // Close current content block if any (including tool_use blocks)
    const currentBlock = accumulator.getCurrentBlock();
    if (currentBlock && !currentBlock.stopped) {
      if (currentBlock.type === 'thinking') {
        events.push(this._createSignatureDeltaEvent(currentBlock));
      }
      events.push(this._createContentBlockStopEvent(currentBlock));
      accumulator.stopCurrentBlock();
    }

    // No need to manually stop tool_use blocks - they're now tracked in contentBlocks
    // and will be stopped by the logic above if they're the current block

    // Message delta (stop reason + usage)
    events.push({
      event: 'message_delta',
      data: {
        type: 'message_delta',
        delta: {
          stop_reason: this._mapStopReason(accumulator.finishReason || 'stop')
        },
        usage: {
          input_tokens: accumulator.inputTokens,
          output_tokens: accumulator.outputTokens
        }
      }
    });

    // Message stop
    events.push({
      event: 'message_stop',
      data: {
        type: 'message_stop'
      }
    });

    accumulator.finalized = true;
    return events;
  }

  /**
   * Create message_start event
   * @private
   */
  _createMessageStartEvent(accumulator) {
    return {
      event: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: accumulator.messageId,
          type: 'message',
          role: accumulator.role,
          content: [],
          model: accumulator.model || 'glm-4.6',
          stop_reason: null,
          usage: {
            input_tokens: accumulator.inputTokens,
            output_tokens: 0
          }
        }
      }
    };
  }

  /**
   * Create content_block_start event
   * @private
   */
  _createContentBlockStartEvent(block) {
    return {
      event: 'content_block_start',
      data: {
        type: 'content_block_start',
        index: block.index,
        content_block: {
          type: block.type,
          [block.type]: ''
        }
      }
    };
  }

  /**
   * Create thinking_delta event
   * @private
   */
  _createThinkingDeltaEvent(block, delta) {
    return {
      event: 'content_block_delta',
      data: {
        type: 'content_block_delta',
        index: block.index,
        delta: {
          type: 'thinking_delta',
          thinking: delta
        }
      }
    };
  }

  /**
   * Create text_delta event
   * @private
   */
  _createTextDeltaEvent(block, delta) {
    return {
      event: 'content_block_delta',
      data: {
        type: 'content_block_delta',
        index: block.index,
        delta: {
          type: 'text_delta',
          text: delta
        }
      }
    };
  }

  /**
   * Create thinking signature delta event
   * @private
   */
  _createSignatureDeltaEvent(block) {
    const signature = this._generateThinkingSignature(block.content);
    return {
      event: 'content_block_delta',
      data: {
        type: 'content_block_delta',
        index: block.index,
        delta: {
          type: 'thinking_signature_delta',
          signature: signature
        }
      }
    };
  }

  /**
   * Create content_block_stop event
   * @private
   */
  _createContentBlockStopEvent(block) {
    return {
      event: 'content_block_stop',
      data: {
        type: 'content_block_stop',
        index: block.index
      }
    };
  }

  /**
   * Log message if verbose
   * @param {string} message - Message to log
   * @private
   */
  log(message) {
    if (this.verbose) {
      const timestamp = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
      console.error(`[glmt-transformer] [${timestamp}] ${message}`);
    }
  }
}

module.exports = GlmtTransformer;
