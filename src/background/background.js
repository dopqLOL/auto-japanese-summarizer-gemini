/**
 * Background Service Worker
 * Chrome Extension V3メインService Worker
 */

// 必要なスクリプトをインポート
importScripts('./message-handler.js');
importScripts('../storage/encrypted-storage.js');

class BackgroundService {
  constructor() {
    this.geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    this.initializeService();
  }

  /**
   * サービスの初期化
   */
  async initializeService() {
    console.log('Background Service Worker initialized');
    
    // メッセージハンドラーの登録
    this.registerMessageHandlers();
    
    // 拡張機能インストール時の処理
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details);
    });

    // 拡張機能起動時の処理
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });
  }

  /**
   * インストール時の処理
   */
  async handleInstall(details) {
    console.log('Extension installed:', details);
    
    if (details.reason === 'install') {
      // 初回インストール時の処理
      await this.performInitialSetup();
    } else if (details.reason === 'update') {
      // アップデート時の処理
      await this.performUpdateSetup(details.previousVersion);
    }
  }

  /**
   * 起動時の処理
   */
  async handleStartup() {
    console.log('Extension startup');
    // 必要に応じて初期化処理
  }

  /**
   * 初期セットアップ
   */
  async performInitialSetup() {
    try {
      // 暗号化ストレージの初期化
      await encryptedStorage.initializeEncryption();
      
      // デフォルト設定の保存
      const defaultSettings = {
        defaultSummaryLength: 'medium',
        defaultSummaryStyle: 'structured',
        autoSave: true,
        theme: 'auto',
        language: 'japanese',
        privacy: {
          saveToHistory: true,
          encryptionEnabled: true,
          dataRetentionDays: 30
        }
      };
      
      await encryptedStorage.saveSettings(defaultSettings);
      
      console.log('Initial setup completed');
    } catch (error) {
      console.error('Initial setup failed:', error);
    }
  }

  /**
   * アップデートセットアップ
   */
  async performUpdateSetup(previousVersion) {
    try {
      // バージョン固有のマイグレーション処理
      console.log(`Updated from version ${previousVersion}`);
      
      // 必要に応じてデータマイグレーション
      // await this.migrateData(previousVersion);
      
    } catch (error) {
      console.error('Update setup failed:', error);
    }
  }

  /**
   * メッセージハンドラーの登録
   */
  registerMessageHandlers() {
    // CHECK_API_STATUS ハンドラーを追加
    messageHandler.registerHandler('CHECK_API_STATUS', async (message, sender) => {
      try {
        const settings = await encryptedStorage.getSettings();
        const apiKey = settings && settings.apiKey; // apiKeyが存在するかどうかを確認
        return { isConfigured: !!apiKey }; // APIキーがあれば true、なければ false
      } catch (error) {
        console.error('Error checking API status:', error);
        // エラーが発生した場合は、設定されていないとみなすか、エラーを詳細に返す
        return { isConfigured: false, error: 'Failed to retrieve API status' }; 
      }
    });

    // コンテンツ抽出ハンドラー
    messageHandler.registerHandler('EXTRACT_CONTENT', async (message, sender) => {
      return await this.handleContentExtraction(message, sender);
    });

    // 要約生成ハンドラー
    messageHandler.registerHandler('SUMMARIZE_CONTENT', async (message, sender) => {
      return await this.handleSummarization(message, sender);
    });

    // 設定取得ハンドラー
    messageHandler.registerHandler('GET_SETTINGS', async (message, sender) => {
      return await this.handleGetSettings(message, sender);
    });

    // 設定更新ハンドラー
    messageHandler.registerHandler('UPDATE_SETTINGS', async (message, sender) => {
      return await this.handleUpdateSettings(message, sender);
    });

    // 要約保存ハンドラー
    messageHandler.registerHandler('SAVE_SUMMARY', async (message, sender) => {
      return await this.handleSaveSummary(message, sender);
    });

    // 要約検索ハンドラー
    messageHandler.registerHandler('SEARCH_SUMMARIES', async (message, sender) => {
      return await this.handleSearchSummaries(message, sender);
    });
    
    // データエクスポートハンドラー
    messageHandler.registerHandler('EXPORT_DATA', async (message, sender) => {
      return await this.handleExportData(message, sender);
    });
    
    // データインポートハンドラー
    messageHandler.registerHandler('IMPORT_DATA', async (message, sender) => {
      return await this.handleImportData(message, sender);
    });
    
    // データ削除ハンドラー
    messageHandler.registerHandler('CLEAR_DATA', async (message, sender) => {
      return await this.handleClearData(message, sender);
    });
    
    // 要約削除ハンドラー
    messageHandler.registerHandler('DELETE_SUMMARY', async (message, sender) => {
      return await this.handleDeleteSummary(message, sender);
    });
  }

  /**
   * コンテンツ抽出の処理
   */
  async handleContentExtraction(message, sender) {
    try {
      const { url, extractionMethod } = message.payload;
      
      // タブからのコンテンツ抽出を指示
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('Active tab not found');
      }

      // Content Scriptにメッセージを送信
      const extractionRequest = {
        id: this.generateMessageId(),
        type: 'EXTRACT_PAGE_CONTENT',
        timestamp: Date.now(),
        source: 'background',
        target: 'content',
        payload: {
          method: extractionMethod,
          url: tab.url
        }
      };

      const response = await chrome.tabs.sendMessage(tab.id, extractionRequest);
      
      if (response && response.payload && response.payload.success) {
        return response.payload.content;
      } else {
        throw new Error('Content extraction failed');
      }
      
    } catch (error) {
      console.error('Content extraction error:', error);
      throw {
        code: 'CONTENT_EXTRACTION_ERROR',
        message: 'Failed to extract content from page',
        details: error.message
      };
    }
  }

  /**
   * 要約生成の処理
   */
  async handleSummarization(message, sender) {
    try {
      const { content, title, url, options } = message.payload;
      
      // API設定の取得
      const settings = await encryptedStorage.getSettings();
      const apiKey = settings.apiKey;
      
      if (!apiKey) {
        throw {
          code: 'API_KEY_MISSING',
          message: 'Gemini API key is not configured',
          details: 'Please set your API key in the settings'
        };
      }

      // Gemini APIリクエストの構築
      const requestBody = {
        contents: [{
          parts: [{
            text: this.buildSummarizationPrompt(content, title, options)
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 1,
          maxOutputTokens: this.getMaxTokensForLength(options.length),
          stopSequences: []
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      // API呼び出し
      const apiResponse = await this.callGeminiApi(apiKey, requestBody);
      
      if (!apiResponse.candidates || apiResponse.candidates.length === 0) {
        throw new Error('No summary generated by API');
      }

      const summaryText = apiResponse.candidates[0].content.parts[0].text;
      
      // 要約結果の構築
      const summary = {
        content: summaryText,
        title: title,
        url: url,
        timestamp: Date.now(),
        options: options
      };

      return summary;
      
    } catch (error) {
      console.error('Summarization error:', error);
      
      if (error.code) {
        throw error;
      } else {
        throw {
          code: 'SUMMARIZATION_ERROR',
          message: 'Failed to generate summary',
          details: error.message
        };
      }
    }
  }

  /**
   * 要約プロンプトの構築
   */
  buildSummarizationPrompt(content, title, options) {
    const lengthInstructions = {
      'short': '200文字以下の簡潔な要約',
      'medium': '300-500文字程度の適度な詳細を含む要約',
      'long': '500-800文字の詳細な要約'
    };

    const styleInstructions = {
      'bullet': '• 箇条書き形式で重要なポイントを整理',
      'paragraph': '段落形式で流れの良い文章として',
      'structured': '見出しと内容を構造化して'
    };

    const prompt = `
以下のウェブページの内容を日本語で要約してください。

**タイトル**: ${title}

**要約の長さ**: ${lengthInstructions[options.length]}
**要約の形式**: ${styleInstructions[options.style]}

**重要な指示**:
- 内容の核心を正確に把握してください
- 事実と意見を明確に区別してください
- 重複する情報は統合してください
- 読みやすく自然な日本語で記述してください
- 原文にない情報は追加しないでください

**ページ内容**:
${content}

**要約**:`;

    return prompt;
  }

  /**
   * 長さに応じた最大トークン数の取得
   */
  getMaxTokensForLength(length) {
    const tokenLimits = {
      'short': 300,
      'medium': 600,
      'long': 1000
    };
    
    return tokenLimits[length] || 600;
  }

  /**
   * Gemini API呼び出し
   */
  async callGeminiApi(apiKey, requestBody) {
    try {
      const response = await fetch(`${this.geminiApiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`API request failed: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
      }

      return await response.json();
      
    } catch (error) {
      console.error('Gemini API call failed:', error);
      
      if (error.message.includes('API key')) {
        throw {
          code: 'INVALID_API_KEY',
          message: 'Invalid or expired API key',
          details: error.message
        };
      } else if (error.message.includes('429')) {
        throw {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API rate limit exceeded',
          details: 'Please try again later'
        };
      } else {
        throw {
          code: 'API_ERROR',
          message: 'API request failed',
          details: error.message
        };
      }
    }
  }

  /**
   * 設定取得の処理
   */
  async handleGetSettings(message, sender) {
    try {
      const settings = await encryptedStorage.getSettings();
      return settings;
    } catch (error) {
      console.error('Get settings error:', error);
      throw {
        code: 'SETTINGS_ERROR',
        message: 'Failed to get settings',
        details: error.message
      };
    }
  }

  /**
   * 設定更新の処理
   */
  async handleUpdateSettings(message, sender) {
    try {
      const { settings } = message.payload;
      await encryptedStorage.saveSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('Update settings error:', error);
      throw {
        code: 'SETTINGS_UPDATE_ERROR',
        message: 'Failed to update settings',
        details: error.message
      };
    }
  }

  /**
   * 要約保存の処理
   */
  async handleSaveSummary(message, sender) {
    try {
      const { summary } = message.payload;
      const savedId = await encryptedStorage.saveSummary(summary);
      return { savedId };
    } catch (error) {
      console.error('Save summary error:', error);
      throw {
        code: 'SAVE_ERROR',
        message: 'Failed to save summary',
        details: error.message
      };
    }
  }

  /**
   * 要約検索の処理
   */
  async handleSearchSummaries(message, sender) {
    try {
      const { query, filters } = message.payload;
      
      let summaries;
      if (query) {
        summaries = await encryptedStorage.searchSummaries(query);
      } else {
        summaries = await encryptedStorage.getAllSummaries();
      }

      // フィルター適用
      if (filters) {
        if (filters.url) {
          summaries = summaries.filter(s => s.url === filters.url);
        }
        
        if (filters.dateRange) {
          const start = new Date(filters.dateRange.start);
          const end = new Date(filters.dateRange.end);
          summaries = summaries.filter(s => {
            const timestamp = s.timestamp;
            return timestamp >= start.getTime() && timestamp <= end.getTime();
          });
        }
      }

      return summaries;
    } catch (error) {
      console.error('Search summaries error:', error);
      throw {
        code: 'SEARCH_ERROR',
        message: 'Failed to search summaries',
        details: error.message
      };
    }
  }

  /**
   * メッセージIDの生成
   */
  generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * データエクスポート処理
   */
  async handleExportData(message, sender) {
    try {
      const exportData = await encryptedStorage.exportData();
      return exportData;
    } catch (error) {
      console.error('Export data error:', error);
      throw {
        code: 'EXPORT_ERROR',
        message: 'データのエクスポートに失敗しました',
        details: error.message
      };
    }
  }

  /**
   * データインポート処理
   */
  async handleImportData(message, sender) {
    try {
      const { data } = message.payload;
      if (!data) {
        throw new Error('No data provided for import');
      }
      
      await encryptedStorage.importData(data);
      return { success: true };
    } catch (error) {
      console.error('Import data error:', error);
      throw {
        code: 'IMPORT_ERROR',
        message: 'データのインポートに失敗しました',
        details: error.message
      };
    }
  }

  /**
   * データ削除処理
   */
  async handleClearData(message, sender) {
    try {
      await encryptedStorage.clearAllData();
      return { success: true };
    } catch (error) {
      console.error('Clear data error:', error);
      throw {
        code: 'CLEAR_DATA_ERROR',
        message: 'データの削除に失敗しました',
        details: error.message
      };
    }
  }

  /**
   * 要約削除処理
   */
  async handleDeleteSummary(message, sender) {
    try {
      const { id } = message.payload;
      if (!id) {
        throw new Error('Summary ID is required');
      }
      
      await encryptedStorage.deleteSummary(id);
      return { success: true };
    } catch (error) {
      console.error('Delete summary error:', error);
      throw {
        code: 'DELETE_SUMMARY_ERROR',
        message: '要約の削除に失敗しました',
        details: error.message
      };
    }
  }
}

// サービス初期化
const backgroundService = new BackgroundService(); 