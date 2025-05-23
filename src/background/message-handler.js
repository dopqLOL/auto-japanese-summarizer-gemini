/**
 * Message Passing System - Background Script Handler
 * セキュリティ重視の型安全メッセージングシステム
 */

class MessageHandler {
  constructor() {
    this.handlers = new Map();
    this.activeConnections = new Set();
    this.requestTimings = new Map();
    this.circuitBreaker = new CircuitBreaker();
    
    this.setupMessageListener();
    this.setupConnectionListener();
  }

  /**
   * メッセージリスナーのセットアップ
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return this.handleMessage(message, sender, sendResponse);
    });
  }

  /**
   * 接続リスナーのセットアップ
   */
  setupConnectionListener() {
    chrome.runtime.onConnect.addListener((port) => {
      this.handleConnection(port);
    });
  }

  /**
   * メッセージハンドリングのメイン処理
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      // メッセージバリデーション
      const validationResult = this.validateMessage(message, sender);
      if (!validationResult.isValid) {
        throw new Error(`Message validation failed: ${validationResult.error}`);
      }

      // セキュリティチェック
      const securityResult = await this.performSecurityCheck(message, sender);
      if (!securityResult.isValid) {
        throw new Error(`Security check failed: ${securityResult.error}`);
      }

      // Circuit Breaker チェック
      if (this.circuitBreaker.isOpen(message.type)) {
        throw new Error('Circuit breaker is open for this message type');
      }

      // タイミング記録開始
      const startTime = performance.now();
      this.requestTimings.set(message.id, startTime);

      // ハンドラーの実行
      const handler = this.handlers.get(message.type);
      if (!handler) {
        throw new Error(`No handler found for message type: ${message.type}`);
      }

      const result = await this.executeWithRetry(handler, message, sender);
      
      // タイミング記録終了
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.requestTimings.delete(message.id);

      // Circuit Breaker成功記録
      this.circuitBreaker.recordSuccess(message.type);

      // レスポンス送信
      const response = {
        id: message.id,
        type: `${message.type}_RESPONSE`,
        timestamp: Date.now(),
        source: 'background',
        target: message.source,
        payload: {
          success: true,
          data: result,
          processingTime: duration
        }
      };

      sendResponse(response);
      return true;

    } catch (error) {
      console.error('Message handling error:', error);
      
      // Circuit Breaker失敗記録
      this.circuitBreaker.recordFailure(message.type);

      // エラーレスポンス送信
      const errorResponse = {
        id: message.id,
        type: 'ERROR',
        timestamp: Date.now(),
        source: 'background',
        target: message.source,
        payload: {
          success: false,
          error: {
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message,
            details: error.details
          }
        }
      };

      sendResponse(errorResponse);
      return true;
    }
  }

  /**
   * 接続処理
   */
  handleConnection(port) {
    this.activeConnections.add(port);
    
    port.onDisconnect.addListener(() => {
      this.activeConnections.delete(port);
    });

    port.onMessage.addListener(async (message) => {
      const response = await this.handleMessage(message, { tab: port.sender?.tab });
      port.postMessage(response);
    });
  }

  /**
   * メッセージバリデーション
   */
  validateMessage(message, sender) {
    if (!message || typeof message !== 'object') {
      return { isValid: false, error: 'Invalid message format' };
    }

    const requiredFields = ['id', 'type', 'timestamp', 'source', 'target'];
    for (const field of requiredFields) {
      if (!(field in message)) {
        return { isValid: false, error: `Missing required field: ${field}` };
      }
    }

    // タイムスタンプチェック（5分以内）
    const messageAge = Date.now() - message.timestamp;
    if (messageAge > 5 * 60 * 1000) {
      return { isValid: false, error: 'Message too old' };
    }

    return { isValid: true };
  }

  /**
   * セキュリティチェック
   */
  async performSecurityCheck(message, sender) {
    // Origin チェック
    if (sender.tab && sender.tab.url) {
      const url = new URL(sender.tab.url);
      if (url.protocol !== 'https:' && url.protocol !== 'chrome-extension:') {
        return { isValid: false, error: 'Insecure origin' };
      }
    }

    // レート制限チェック
    const rateLimitResult = await this.checkRateLimit(message, sender);
    if (!rateLimitResult.isValid) {
      return rateLimitResult;
    }

    return { isValid: true };
  }

  /**
   * レート制限チェック
   */
  async checkRateLimit(message, sender) {
    // 実装: 送信者ごとのレート制限
    // 現在は常に成功を返す（実装は後で拡張可能）
    return { isValid: true };
  }

  /**
   * リトライ付きハンドラー実行
   */
  async executeWithRetry(handler, message, sender, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await handler(message, sender);
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          await this.sleep(delay);
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * リトライ可能エラーの判定
   */
  isRetryableError(error) {
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE'
    ];
    
    return retryableCodes.includes(error.code);
  }

  /**
   * スリープ関数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ハンドラー登録
   */
  registerHandler(messageType, handler) {
    this.handlers.set(messageType, handler);
  }

  /**
   * ハンドラー削除
   */
  unregisterHandler(messageType) {
    this.handlers.delete(messageType);
  }
}

/**
 * Circuit Breaker パターン実装
 */
class CircuitBreaker {
  constructor() {
    this.states = new Map(); // messageType -> state
    this.failureCounts = new Map();
    this.lastFailureTime = new Map();
    this.failureThreshold = 5;
    this.timeoutPeriod = 30000; // 30秒
  }

  isOpen(messageType) {
    const state = this.states.get(messageType) || 'CLOSED';
    
    if (state === 'OPEN') {
      const lastFailure = this.lastFailureTime.get(messageType) || 0;
      if (Date.now() - lastFailure > this.timeoutPeriod) {
        this.states.set(messageType, 'HALF_OPEN');
        return false;
      }
      return true;
    }
    
    return false;
  }

  recordSuccess(messageType) {
    this.states.set(messageType, 'CLOSED');
    this.failureCounts.set(messageType, 0);
  }

  recordFailure(messageType) {
    const currentCount = this.failureCounts.get(messageType) || 0;
    const newCount = currentCount + 1;
    
    this.failureCounts.set(messageType, newCount);
    this.lastFailureTime.set(messageType, Date.now());
    
    if (newCount >= this.failureThreshold) {
      this.states.set(messageType, 'OPEN');
    }
  }
}

// グローバルインスタンス
const messageHandler = new MessageHandler();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MessageHandler, CircuitBreaker };
} 