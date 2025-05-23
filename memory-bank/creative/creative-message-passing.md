# 🎨🎨🎨 ENTERING CREATIVE PHASE: ARCHITECTURE DESIGN - Message Passing設計

## コンポーネント説明
Chrome拡張機能における異なるコンテキスト間（popup、content script、background script、options page）での効率的かつ安全な通信を実現するMessage Passingシステム。Manifest V3のService Worker制約下で、型安全性、エラーハンドリング、パフォーマンス最適化を実現する通信アーキテクチャです。

## 要件と制約

### 機能要件
- **コンポーネント間通信**: popup ↔ background ↔ content script間のメッセージ配信
- **型安全性**: TypeScriptベースの型定義による実行時エラー防止
- **非同期処理**: Promise/async-awaitベースの現代的非同期通信
- **エラーハンドリング**: 通信失敗・タイムアウト・無効状態の適切な処理
- **状態同期**: 複数コンポーネント間でのアプリケーション状態の一貫性

### 技術制約
- **Manifest V3制約**: Service Workerの制限とlifecycle管理
- **Context分離**: 異なる実行コンテキスト間での変数・関数共有不可
- **シリアライゼーション**: JSON serializable objectsのみ送信可能
- **Permission制約**: activeTab権限での限定的なcontent script注入

### パフォーマンス制約
- **レスポンス時間**: メッセージ処理1秒以内の応答
- **メモリ効率**: 大量メッセージ処理でのメモリリークなし
- **バッテリー効率**: バックグラウンド処理の最小化
- **エラー伝播**: 障害時の迅速な回復とユーザーフィードバック

## 設計オプション分析

### オプション1: シンプル・プレーンメッセージング
```javascript
// 基本的なChrome runtime messaging
chrome.runtime.sendMessage({
  type: 'SUMMARIZE_PAGE',
  data: { url: window.location.href, content: pageText }
}, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Message failed:', chrome.runtime.lastError);
    return;
  }
  console.log('Response:', response);
});

// Background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUMMARIZE_PAGE') {
    summarizeContent(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期応答
  }
});
```

**プロス:**
- 実装の単純性と理解しやすさ
- Chrome標準APIの直接利用
- 軽量で高速な通信
- デバッグの容易性

**コンス:**
- 型安全性の欠如
- エラーハンドリングの複雑化
- メッセージタイプの管理困難
- 大規模化時の保守性悪化

### オプション2: Event-Driven・Pub/Sub設計
```javascript
// EventBusパターン
class ExtensionEventBus {
  constructor() {
    this.listeners = new Map();
    this.middleware = [];
  }
  
  emit(eventType, data) {
    const event = {
      type: eventType,
      data: data,
      timestamp: Date.now(),
      source: this.getContextType()
    };
    
    // Middlewareチェーン実行
    this.middleware.forEach(fn => fn(event));
    
    // Listenersに配信
    const handlers = this.listeners.get(eventType) || [];
    handlers.forEach(handler => handler(event));
    
    // 他コンテキストに配信
    this.broadcastToOtherContexts(event);
  }
  
  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(handler);
  }
}
```

**プロス:**
- 疎結合なコンポーネント通信
- スケーラブルなイベント管理
- ミドルウェアによる拡張性
- リアルタイム性の向上

**コンス:**
- デバッグの困難性
- イベントフローの複雑化
- メモリリークのリスク
- パフォーマンスオーバーヘッド

### オプション3: RPC (Remote Procedure Call) 設計
```javascript
// RPC-style messaging
class ExtensionRPC {
  constructor() {
    this.pendingCalls = new Map();
    this.procedures = new Map();
    this.callId = 0;
  }
  
  async call(procedure, ...args) {
    const callId = ++this.callId;
    const message = {
      type: 'RPC_CALL',
      procedure: procedure,
      args: args,
      callId: callId
    };
    
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(callId, { resolve, reject });
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response.error));
        }
        
        this.pendingCalls.delete(callId);
      });
      
      // タイムアウト設定
      setTimeout(() => {
        if (this.pendingCalls.has(callId)) {
          this.pendingCalls.delete(callId);
          reject(new Error('RPC call timeout'));
        }
      }, 30000);
    });
  }
  
  register(name, procedure) {
    this.procedures.set(name, procedure);
  }
}
```

**プロス:**
- 直感的な関数呼び出しスタイル
- 型安全なRPC呼び出し
- タイムアウト・エラーハンドリング内蔵
- Promise/async-await対応

**コンス:**
- シリアライゼーション制約
- 状態共有の制限
- ネットワーク分断時の処理
- 複雑な設定とボイラープレート

### オプション4: ハイブリッド・型安全メッセージング
```typescript
// Type-safe message definitions
interface MessageMap {
  SUMMARIZE_PAGE: {
    request: { url: string; content: string; options?: SummaryOptions };
    response: { summary: string; metadata: SummaryMetadata };
  };
  UPDATE_SETTINGS: {
    request: { settings: AppSettings };
    response: { success: boolean };
  };
  GET_SAVED_SUMMARIES: {
    request: { limit?: number; offset?: number };
    response: { summaries: SavedSummary[] };
  };
}

class TypedMessageBus {
  async send<T extends keyof MessageMap>(
    type: T,
    data: MessageMap[T]['request']
  ): Promise<MessageMap[T]['response']> {
    const message = {
      type,
      data,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    
    const response = await this.sendWithRetry(message);
    return this.validateResponse<T>(type, response);
  }
  
  onMessage<T extends keyof MessageMap>(
    type: T,
    handler: (data: MessageMap[T]['request']) => Promise<MessageMap[T]['response']>
  ) {
    this.handlers.set(type, handler);
  }
}
```

**プロス:**
- TypeScriptによる完全な型安全性
- IDE支援とリファクタリング安全性
- ランタイム検証とエラー検出
- 段階的移行とレガシー対応

**コンス:**
- TypeScript設定の複雑性
- ビルドプロセスの追加
- 型定義の保守コスト
- バンドルサイズの増加

## 推奨アプローチ: オプション4（ハイブリッド・型安全メッセージング）

### 選択理由
1. **型安全性**: TypeScriptによる開発時・実行時エラー防止
2. **開発効率**: IDEサポートによる生産性向上とリファクタリング安全性
3. **保守性**: 明確な契約定義による長期メンテナンス性
4. **拡張性**: 新機能追加時の影響範囲明確化
5. **品質保証**: コンパイル時検証による品質向上

### 詳細アーキテクチャ設計

#### メッセージ型定義システム
```typescript
// Core message types
interface BaseMessage {
  id: string;
  timestamp: number;
  source: ContextType;
  target?: ContextType;
}

interface RequestMessage<T = any> extends BaseMessage {
  type: string;
  data: T;
}

interface ResponseMessage<T = any> extends BaseMessage {
  success: boolean;
  data?: T;
  error?: ErrorDetails;
  requestId: string;
}

// Application-specific message contracts
interface SummaryMessageMap {
  // Page summarization workflow
  'content.extract': {
    request: { selectors?: string[]; filters?: ContentFilter[] };
    response: { content: PageContent; metadata: ExtractionMetadata };
  };
  
  'background.summarize': {
    request: { content: PageContent; options: SummaryOptions };
    response: { summary: string; usage: ApiUsage };
  };
  
  'popup.displaySummary': {
    request: { summary: string; metadata: SummaryMetadata };
    response: { displayed: boolean };
  };
  
  // Settings management
  'background.getSettings': {
    request: {};
    response: { settings: AppSettings };
  };
  
  'background.updateSettings': {
    request: { settings: Partial<AppSettings> };
    response: { success: boolean; updated: AppSettings };
  };
  
  // Data management
  'storage.save': {
    request: { summary: SummaryData };
    response: { id: string; saved: boolean };
  };
  
  'storage.query': {
    request: { filters: QueryFilters; pagination: Pagination };
    response: { results: SummaryData[]; total: number };
  };
}
```

#### コンテキスト認識通信システム
```typescript
enum ContextType {
  POPUP = 'popup',
  CONTENT = 'content', 
  BACKGROUND = 'background',
  OPTIONS = 'options'
}

class ContextAwareMessageBus {
  private context: ContextType;
  private handlers = new Map<string, MessageHandler>();
  private pendingRequests = new Map<string, PendingRequest>();
  
  constructor(context: ContextType) {
    this.context = context;
    this.setupMessageListener();
  }
  
  async send<T extends keyof SummaryMessageMap>(
    type: T,
    data: SummaryMessageMap[T]['request'],
    target?: ContextType
  ): Promise<SummaryMessageMap[T]['response']> {
    const message: RequestMessage<SummaryMessageMap[T]['request']> = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      source: this.context,
      target
    };
    
    return this.sendWithTimeout(message, 30000);
  }
  
  private async sendWithTimeout<T>(
    message: RequestMessage<T>,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error(`Message timeout: ${message.type}`));
      }, timeout);
      
      this.pendingRequests.set(message.id, {
        resolve,
        reject,
        timeoutId,
        type: message.type,
        timestamp: message.timestamp
      });
      
      this.routeMessage(message);
    });
  }
  
  private async routeMessage(message: RequestMessage) {
    try {
      switch (this.context) {
        case ContextType.POPUP:
          // Popup can send to background
          chrome.runtime.sendMessage(message);
          break;
          
        case ContextType.CONTENT:
          // Content can send to background
          chrome.runtime.sendMessage(message);
          break;
          
        case ContextType.BACKGROUND:
          // Background can send to specific tabs or broadcast
          if (message.target === ContextType.CONTENT) {
            const tabs = await chrome.tabs.query({ active: true });
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id!, message);
            }
          } else {
            // Broadcast to all contexts
            chrome.runtime.sendMessage(message);
          }
          break;
      }
    } catch (error) {
      this.handleSendError(message, error as Error);
    }
  }
}
```

#### エラーハンドリング・リトライ機構
```typescript
interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

class ResilientMessageBus extends ContextAwareMessageBus {
  private retryConfig: RetryConfig = {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    retryableErrors: [
      'Could not establish connection',
      'The message port closed',
      'Extension context invalidated'
    ]
  };
  
  async sendWithRetry<T extends keyof SummaryMessageMap>(
    type: T,
    data: SummaryMessageMap[T]['request'],
    attempt: number = 1
  ): Promise<SummaryMessageMap[T]['response']> {
    try {
      return await this.send(type, data);
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (this.shouldRetry(errorMessage, attempt)) {
        const backoffTime = this.retryConfig.backoffMs * 
          Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
        
        await this.sleep(backoffTime);
        return this.sendWithRetry(type, data, attempt + 1);
      }
      
      throw error;
    }
  }
  
  private shouldRetry(errorMessage: string, attempt: number): boolean {
    if (attempt >= this.retryConfig.maxAttempts) return false;
    
    return this.retryConfig.retryableErrors.some(
      retryableError => errorMessage.includes(retryableError)
    );
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### パフォーマンス最適化システム
```typescript
class OptimizedMessageBus extends ResilientMessageBus {
  private messageQueue: QueuedMessage[] = [];
  private batchSize = 10;
  private batchTimeout = 100; // ms
  private compressionEnabled = true;
  
  async batchSend<T extends keyof SummaryMessageMap>(
    messages: Array<{
      type: T;
      data: SummaryMessageMap[T]['request'];
    }>
  ): Promise<Array<SummaryMessageMap[T]['response']>> {
    if (messages.length === 1) {
      return [await this.send(messages[0].type, messages[0].data)];
    }
    
    const batchMessage = {
      type: 'batch',
      messages: messages,
      timestamp: Date.now()
    };
    
    if (this.compressionEnabled && this.needsCompression(batchMessage)) {
      batchMessage.messages = await this.compressMessages(messages);
    }
    
    return this.send('batch' as any, batchMessage as any);
  }
  
  enableStreaming<T extends keyof SummaryMessageMap>(
    type: T,
    data: SummaryMessageMap[T]['request'],
    onChunk: (chunk: any) => void
  ): Promise<void> {
    const streamId = crypto.randomUUID();
    
    this.onMessage('stream.chunk', (chunk) => {
      if (chunk.streamId === streamId) {
        onChunk(chunk.data);
      }
    });
    
    return this.send('stream.start' as any, {
      streamId,
      type,
      data
    } as any);
  }
  
  private needsCompression(message: any): boolean {
    const serialized = JSON.stringify(message);
    return serialized.length > 1024; // 1KB threshold
  }
  
  private async compressMessages(messages: any[]): Promise<any[]> {
    // Simple compression logic (in real implementation, use proper compression)
    return messages.map(msg => ({
      ...msg,
      data: this.compressData(msg.data)
    }));
  }
}
```

### 実装ガイドライン

#### 型定義の管理戦略
```typescript
// types/messages.ts - 中央集権型の型定義管理
export interface MessageDefinitions {
  // Content extraction messages
  [MessageType.EXTRACT_CONTENT]: {
    request: ContentExtractionRequest;
    response: ContentExtractionResponse;
  };
  
  // API communication messages
  [MessageType.SUMMARIZE_REQUEST]: {
    request: SummarizeRequest;
    response: SummarizeResponse;
  };
  
  // UI state messages
  [MessageType.UPDATE_UI_STATE]: {
    request: UIStateUpdate;
    response: UIStateResponse;
  };
  
  // Error handling messages
  [MessageType.ERROR_REPORT]: {
    request: ErrorReport;
    response: ErrorAcknowledgement;
  };
}

// Runtime validation
export const validateMessage = <T extends keyof MessageDefinitions>(
  type: T,
  data: unknown
): data is MessageDefinitions[T]['request'] => {
  // JSON Schema validation or custom validation logic
  return MessageValidator.validate(type, data);
};
```

#### デバッグ・監視機能
```typescript
class MessageDebugger {
  private static instance: MessageDebugger;
  private logs: MessageLog[] = [];
  private enabled = process.env.NODE_ENV === 'development';
  
  logMessage(direction: 'sent' | 'received', message: any) {
    if (!this.enabled) return;
    
    this.logs.push({
      timestamp: Date.now(),
      direction,
      type: message.type,
      size: JSON.stringify(message).length,
      source: message.source,
      target: message.target,
      success: message.success !== false
    });
    
    // Keep only recent logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500);
    }
  }
  
  getPerformanceMetrics() {
    const recent = this.logs.filter(
      log => Date.now() - log.timestamp < 60000
    );
    
    return {
      totalMessages: recent.length,
      averageSize: recent.reduce((sum, log) => sum + log.size, 0) / recent.length,
      errorRate: recent.filter(log => !log.success).length / recent.length,
      messagesByType: this.groupBy(recent, 'type')
    };
  }
}
```

## 検証チェックポイント

### 型安全性検証
- [ ] すべてのメッセージタイプがTypeScriptで定義されているか
- [ ] 実行時の型検証が適切に実装されているか
- [ ] IDE補完とリファクタリングが正常に動作するか
- [ ] コンパイル時エラーが適切に検出されるか

### パフォーマンス検証
- [ ] メッセージ送信が1秒以内に完了するか
- [ ] 大量メッセージ処理でメモリリークが発生しないか
- [ ] バッチ処理が適切に動作するか
- [ ] ストリーミング通信が安定して動作するか

### エラーハンドリング検証
- [ ] ネットワーク断絶時の適切なリトライが実行されるか
- [ ] タイムアウト時の適切なエラー通知があるか
- [ ] Service Worker休眠時の通信が正常に復旧するか
- [ ] 無効なメッセージの適切な拒否が行われるか

### セキュリティ検証
- [ ] メッセージの送信者検証が実装されているか
- [ ] 機密データの暗号化が適切に行われているか
- [ ] Content Security Policyに準拠しているか
- [ ] 権限外コンテキストからのメッセージが拒否されるか

🎨🎨🎨 EXITING CREATIVE PHASE: Message Passing設計完了 