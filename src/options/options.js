/**
 * Auto Japanese Summarizer - Options Controller
 * アコーディオン型・階層表示方式実装
 */

class OptionsController {
  constructor() {
    this.state = {
      settings: null,
      apiKeyVisible: false,
      dirtyFields: new Set(),
      testingConnection: false,
      lastSavedTime: null
    };
    
    this.elements = {};
    this.init();
  }

  /**
   * 初期化処理
   */
  async init() {
    try {
      this.setupElements();
      this.setupEventListeners();
      await this.loadSettings();
      this.updateUIState();
      console.log('Options controller initialized');
    } catch (error) {
      console.error('Failed to initialize options controller:', error);
      this.showError('設定の初期化中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }

  /**
   * 要素の参照を取得
   */
  setupElements() {
    // APIセクションの要素
    this.elements.apiKey = document.getElementById('api-key');
    this.elements.toggleApiVisibility = document.getElementById('toggle-api-visibility');
    this.elements.testConnection = document.getElementById('test-connection');
    this.elements.apiFeedback = document.getElementById('api-feedback');
    this.elements.apiIndicator = document.getElementById('api-indicator');
    this.elements.connectionState = document.getElementById('connection-state');
    this.elements.responseTime = document.getElementById('response-time');
    this.elements.lastCheck = document.getElementById('last-check');
    
    // 要約セクションの要素
    this.elements.summaryLength = document.getElementById('summary-length');
    this.elements.summaryStyle = document.getElementById('summary-style');
    this.elements.outputFormat = document.getElementById('output-format');
    this.elements.includeKeywords = document.getElementById('include-keywords');
    this.elements.includeMetadata = document.getElementById('include-metadata');
    this.elements.autoSave = document.getElementById('auto-save');
    
    // データ管理セクションの要素
    this.elements.totalSummaries = document.getElementById('total-summaries');
    this.elements.storageUsage = document.getElementById('storage-usage');
    this.elements.lastSaved = document.getElementById('last-saved');
    this.elements.openSavedSummaries = document.getElementById('open-saved-summaries');
    this.elements.exportAllData = document.getElementById('export-all-data');
    this.elements.importData = document.getElementById('import-data');
    this.elements.clearAllData = document.getElementById('clear-all-data');
    this.elements.backupEnabled = document.getElementById('backup-enabled');
    this.elements.syncEnabled = document.getElementById('sync-enabled');
    this.elements.dataIndicator = document.getElementById('data-indicator');
    
    // 表示セクションの要素
    this.elements.themeSelect = document.getElementById('theme-select');
    this.elements.fontSize = document.getElementById('font-size');
    this.elements.showNotifications = document.getElementById('show-notifications');
    this.elements.showKeyboardShortcuts = document.getElementById('show-keyboard-shortcuts');
    this.elements.minimizePopup = document.getElementById('minimize-popup');
    
    // その他の要素
    this.elements.saveButton = document.getElementById('save-settings');
    this.elements.saveStatus = document.getElementById('save-status');
    this.elements.importFile = document.getElementById('import-file');
    
    // セクションヘッダー
    this.elements.sectionHeaders = document.querySelectorAll('.section-header');
    
    // ステップ表示
    this.elements.apiStep = document.getElementById('api-step');
    this.elements.summaryStep = document.getElementById('summary-step');
    this.elements.readyStep = document.getElementById('ready-step');
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // APIキー関連
    this.elements.apiKey.addEventListener('input', () => this.handleInputChange('apiKey'));
    this.elements.toggleApiVisibility.addEventListener('click', () => this.toggleApiKeyVisibility());
    this.elements.testConnection.addEventListener('click', () => this.testApiConnection());
    
    // セクションヘッダークリック
    this.elements.sectionHeaders.forEach(header => {
      header.addEventListener('click', () => this.toggleSection(header));
    });
    
    // データインポート/エクスポート
    this.elements.exportAllData.addEventListener('click', () => this.exportAllData());
    this.elements.importData.addEventListener('click', () => this.elements.importFile.click());
    this.elements.importFile.addEventListener('change', (e) => this.handleFileImport(e));
    this.elements.clearAllData.addEventListener('click', () => this.handleClearAllData());
    
    // 保存済み要約を開く
    this.elements.openSavedSummaries.addEventListener('click', () => this.openSavedSummaries());
    
    // 設定変更のイベント登録
    const settingsInputs = [
      { element: this.elements.summaryLength, name: 'defaultSummaryLength' },
      { element: this.elements.summaryStyle, name: 'defaultSummaryStyle' },
      { element: this.elements.outputFormat, name: 'outputFormat' },
      { element: this.elements.themeSelect, name: 'theme' },
      { element: this.elements.fontSize, name: 'fontSize' }
    ];
    
    const settingsCheckboxes = [
      { element: this.elements.includeKeywords, name: 'includeKeywords' },
      { element: this.elements.includeMetadata, name: 'includeMetadata' },
      { element: this.elements.autoSave, name: 'autoSave' },
      { element: this.elements.backupEnabled, name: 'backupEnabled' },
      { element: this.elements.syncEnabled, name: 'syncEnabled' },
      { element: this.elements.showNotifications, name: 'showNotifications' },
      { element: this.elements.showKeyboardShortcuts, name: 'showKeyboardShortcuts' },
      { element: this.elements.minimizePopup, name: 'minimizePopup' }
    ];
    
    settingsInputs.forEach(item => {
      item.element.addEventListener('change', () => this.handleInputChange(item.name));
    });
    
    settingsCheckboxes.forEach(item => {
      item.element.addEventListener('change', () => this.handleInputChange(item.name));
    });
    
    // 保存ボタン
    this.elements.saveButton.addEventListener('click', () => this.saveSettings());
  }

  /**
   * 設定の読み込み
   */
  async loadSettings() {
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'GET_SETTINGS',
        timestamp: Date.now(),
        source: 'options',
        target: 'background',
        payload: {}
      };
      
      const response = await chrome.runtime.sendMessage(message);
      
      if (!response || !response.payload || !response.payload.success) {
        throw new Error('Failed to load settings');
      }
      
      this.state.settings = response.payload.data;
      this.populateFormFields();
      
      // データ使用量の取得
      await this.loadStorageStats();
      
      return true;
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showError('設定の読み込みに失敗しました');
      return false;
    }
  }

  /**
   * ストレージ統計の取得
   */
  async loadStorageStats() {
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'SEARCH_SUMMARIES',
        timestamp: Date.now(),
        source: 'options',
        target: 'background',
        payload: { query: '' }
      };
      
      const response = await chrome.runtime.sendMessage(message);
      
      if (!response || !response.payload || !response.payload.success) {
        throw new Error('Failed to load storage stats');
      }
      
      const summaries = response.payload.data;
      const count = summaries.length;
      
      // 件数表示の更新
      this.elements.totalSummaries.textContent = `${count}件`;
      this.elements.dataIndicator.textContent = `${count}件保存`;
      
      // ストレージ使用量の計算
      const storageEstimate = JSON.stringify(summaries).length / 1024;
      this.elements.storageUsage.textContent = `${Math.round(storageEstimate)} KB`;
      
      // 最終保存日の表示
      if (count > 0) {
        const latestSummary = summaries.reduce((latest, current) => 
          new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
        );
        const lastSavedDate = new Date(latestSummary.timestamp);
        this.elements.lastSaved.textContent = lastSavedDate.toLocaleDateString('ja-JP');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to load storage stats:', error);
      return false;
    }
  }

  /**
   * フォームフィールドに値を設定
   */
  populateFormFields() {
    const settings = this.state.settings;
    
    // APIキー
    if (settings.apiKey) {
      this.elements.apiKey.value = settings.apiKey;
      this.elements.testConnection.disabled = false;
      this.elements.apiIndicator.textContent = '設定済み';
      this.updateStepStatus('api', 'complete');
    } else {
      this.elements.apiIndicator.textContent = '未設定';
      this.updateStepStatus('api', 'active');
    }
    
    // 要約設定
    this.elements.summaryLength.value = settings.defaultSummaryLength || 'medium';
    this.elements.summaryStyle.value = settings.defaultSummaryStyle || 'structured';
    this.elements.outputFormat.value = settings.outputFormat || 'markdown';
    
    // チェックボックス
    this.elements.includeKeywords.checked = settings.includeKeywords !== false;
    this.elements.includeMetadata.checked = settings.includeMetadata === true;
    this.elements.autoSave.checked = settings.autoSave !== false;
    
    // 表示設定
    this.elements.themeSelect.value = settings.theme || 'auto';
    this.elements.fontSize.value = settings.fontSize || 'medium';
    
    // 追加のチェックボックス
    this.elements.backupEnabled.checked = settings.backupEnabled !== false;
    this.elements.syncEnabled.checked = settings.syncEnabled === true;
    this.elements.showNotifications.checked = settings.showNotifications !== false;
    this.elements.showKeyboardShortcuts.checked = settings.showKeyboardShortcuts === true;
    this.elements.minimizePopup.checked = settings.minimizePopup === true;
    
    // 準備状況
    if (settings.apiKey) {
      this.updateStepStatus('ready', 'complete');
    }
  }

  /**
   * ステップのステータスを更新
   */
  updateStepStatus(stepId, status) {
    const step = document.getElementById(`${stepId}-step`);
    if (!step) return;
    
    step.classList.remove('active', 'complete');
    step.classList.add(status);
    
    const statusElement = step.querySelector('.step-status');
    if (statusElement) {
      switch (status) {
        case 'active':
          statusElement.textContent = '設定中';
          break;
        case 'complete':
          statusElement.textContent = '完了';
          break;
        default:
          statusElement.textContent = '未完了';
      }
    }
  }
  
  /**
   * セクションの開閉
   */
  toggleSection(header) {
    const sectionId = header.getAttribute('data-section');
    const content = document.getElementById(`${sectionId}-content`);
    const collapseIcon = header.querySelector('.collapse-icon');
    
    if (content.classList.contains('expanded')) {
      content.classList.remove('expanded');
      collapseIcon.textContent = '▼';
      header.setAttribute('aria-expanded', 'false');
      content.setAttribute('aria-hidden', 'true');
    } else {
      content.classList.add('expanded');
      collapseIcon.textContent = '▲';
      header.setAttribute('aria-expanded', 'true');
      content.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * 入力変更の処理
   */
  handleInputChange(fieldName) {
    this.state.dirtyFields.add(fieldName);
    this.updateSaveButtonState();
    
    // APIキーが入力された場合、テストボタンの状態を更新
    if (fieldName === 'apiKey') {
      this.elements.testConnection.disabled = !this.elements.apiKey.value;
    }
  }

  /**
   * 保存ボタンの状態を更新
   */
  updateSaveButtonState() {
    this.elements.saveButton.disabled = this.state.dirtyFields.size === 0;
  }

  /**
   * APIキーの表示/非表示を切り替え
   */
  toggleApiKeyVisibility() {
    this.state.apiKeyVisible = !this.state.apiKeyVisible;
    this.elements.apiKey.type = this.state.apiKeyVisible ? 'text' : 'password';
    this.elements.toggleApiVisibility.querySelector('span').textContent = 
      this.state.apiKeyVisible ? '👁️‍🗨️' : '👁️';
  }

  /**
   * API接続テスト
   */
  async testApiConnection() {
    try {
      if (!this.elements.apiKey.value) {
        this.showApiFeedback('APIキーを入力してください', 'error');
        return;
      }
      
      this.state.testingConnection = true;
      this.elements.testConnection.disabled = true;
      this.elements.testConnection.innerHTML = '<span>🔄</span> テスト中...';
      this.showApiFeedback('接続テスト中...', 'info');
      
      const startTime = performance.now();
      
      // テスト用のメッセージを作成
      const message = {
        id: this.generateMessageId(),
        type: 'SUMMARIZE_CONTENT',
        timestamp: Date.now(),
        source: 'options',
        target: 'background',
        payload: {
          content: '接続テスト中です。',
          title: 'API接続テスト',
          options: {
            length: 'short',
            style: 'plain',
            apiKey: this.elements.apiKey.value
          }
        }
      };
      
      const response = await chrome.runtime.sendMessage(message);
      const endTime = performance.now();
      const responseTimeMs = Math.round(endTime - startTime);
      
      if (!response || !response.payload || !response.payload.success) {
        throw new Error(response?.payload?.error || '不明なエラー');
      }
      
      // 成功時のUI更新
      this.elements.connectionState.textContent = '接続成功';
      this.elements.responseTime.textContent = `${responseTimeMs} ms`;
      this.elements.lastCheck.textContent = new Date().toLocaleTimeString('ja-JP');
      this.updateStepStatus('api', 'complete');
      this.updateStepStatus('ready', 'complete');
      
      this.showApiFeedback('APIキーは有効です', 'success');
    } catch (error) {
      console.error('API connection test failed:', error);
      this.elements.connectionState.textContent = '接続失敗';
      this.elements.responseTime.textContent = '--';
      this.elements.lastCheck.textContent = new Date().toLocaleTimeString('ja-JP');
      
      this.showApiFeedback(`APIキーが無効です: ${error.message}`, 'error');
    } finally {
      this.state.testingConnection = false;
      this.elements.testConnection.disabled = false;
      this.elements.testConnection.innerHTML = '<span>🔄</span> テスト';
    }
  }

  /**
   * APIフィードバックの表示
   */
  showApiFeedback(message, type) {
    this.elements.apiFeedback.textContent = message;
    this.elements.apiFeedback.className = 'input-feedback';
    
    if (type) {
      this.elements.apiFeedback.classList.add(`feedback-${type}`);
    }
  }

  /**
   * 設定の保存
   */
  async saveSettings() {
    try {
      this.elements.saveButton.disabled = true;
      this.elements.saveStatus.textContent = '保存中...';
      
      const updatedSettings = {};
      
      // 変更された設定のみを収集
      if (this.state.dirtyFields.has('apiKey')) {
        updatedSettings.apiKey = this.elements.apiKey.value;
      }
      
      if (this.state.dirtyFields.has('defaultSummaryLength')) {
        updatedSettings.defaultSummaryLength = this.elements.summaryLength.value;
      }
      
      if (this.state.dirtyFields.has('defaultSummaryStyle')) {
        updatedSettings.defaultSummaryStyle = this.elements.summaryStyle.value;
      }
      
      if (this.state.dirtyFields.has('outputFormat')) {
        updatedSettings.outputFormat = this.elements.outputFormat.value;
      }
      
      if (this.state.dirtyFields.has('includeKeywords')) {
        updatedSettings.includeKeywords = this.elements.includeKeywords.checked;
      }
      
      if (this.state.dirtyFields.has('includeMetadata')) {
        updatedSettings.includeMetadata = this.elements.includeMetadata.checked;
      }
      
      if (this.state.dirtyFields.has('autoSave')) {
        updatedSettings.autoSave = this.elements.autoSave.checked;
      }
      
      if (this.state.dirtyFields.has('theme')) {
        updatedSettings.theme = this.elements.themeSelect.value;
      }
      
      if (this.state.dirtyFields.has('fontSize')) {
        updatedSettings.fontSize = this.elements.fontSize.value;
      }
      
      if (this.state.dirtyFields.has('backupEnabled')) {
        updatedSettings.backupEnabled = this.elements.backupEnabled.checked;
      }
      
      if (this.state.dirtyFields.has('syncEnabled')) {
        updatedSettings.syncEnabled = this.elements.syncEnabled.checked;
      }
      
      if (this.state.dirtyFields.has('showNotifications')) {
        updatedSettings.showNotifications = this.elements.showNotifications.checked;
      }
      
      if (this.state.dirtyFields.has('showKeyboardShortcuts')) {
        updatedSettings.showKeyboardShortcuts = this.elements.showKeyboardShortcuts.checked;
      }
      
      if (this.state.dirtyFields.has('minimizePopup')) {
        updatedSettings.minimizePopup = this.elements.minimizePopup.checked;
      }
      
      const message = {
        id: this.generateMessageId(),
        type: 'UPDATE_SETTINGS',
        timestamp: Date.now(),
        source: 'options',
        target: 'background',
        payload: {
          settings: updatedSettings
        }
      };
      
      const response = await chrome.runtime.sendMessage(message);
      
      if (!response || !response.payload || !response.payload.success) {
        throw new Error('Failed to save settings');
      }
      
      // 成功時の処理
      this.state.dirtyFields.clear();
      this.state.settings = { ...this.state.settings, ...updatedSettings };
      this.state.lastSavedTime = Date.now();
      
      this.elements.saveStatus.textContent = '設定を保存しました';
      setTimeout(() => {
        this.elements.saveStatus.textContent = '';
      }, 3000);
      
      // APIキーが保存された場合
      if (updatedSettings.apiKey) {
        this.elements.apiIndicator.textContent = '設定済み';
        if (this.elements.apiKey.value) {
          this.updateStepStatus('api', 'complete');
          this.updateStepStatus('ready', 'complete');
        }
      }
      
      this.updateUIState();
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.elements.saveStatus.textContent = '保存に失敗しました';
    } finally {
      this.updateSaveButtonState();
    }
  }

  /**
   * UIの状態を更新
   */
  updateUIState() {
    // 保存ボタンの状態
    this.elements.saveButton.disabled = this.state.dirtyFields.size === 0;
    
    // APIキーのステータス
    if (this.state.settings && this.state.settings.apiKey) {
      this.elements.testConnection.disabled = false;
      this.elements.apiIndicator.textContent = '設定済み';
    } else {
      this.elements.apiIndicator.textContent = '未設定';
    }
  }

  /**
   * すべてのデータをエクスポート
   */
  async exportAllData() {
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'EXPORT_DATA',
        timestamp: Date.now(),
        source: 'options',
        target: 'background',
        payload: {}
      };
      
      const response = await chrome.runtime.sendMessage(message);
      
      if (!response || !response.payload || !response.payload.success) {
        throw new Error('Failed to export data');
      }
      
      const exportData = response.payload.data;
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const date = new Date().toISOString().split('T')[0];
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `auto-japanese-summarizer-export-${date}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      
      this.showNotification('データをエクスポートしました');
    } catch (error) {
      console.error('Export failed:', error);
      this.showError('データのエクスポートに失敗しました');
    }
  }

  /**
   * ファイルからデータをインポート
   */
  async handleFileImport(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          
          const message = {
            id: this.generateMessageId(),
            type: 'IMPORT_DATA',
            timestamp: Date.now(),
            source: 'options',
            target: 'background',
            payload: {
              data: jsonData
            }
          };
          
          const response = await chrome.runtime.sendMessage(message);
          
          if (!response || !response.payload || !response.payload.success) {
            throw new Error('Failed to import data');
          }
          
          // インポート成功
          await this.loadSettings();
          await this.loadStorageStats();
          this.showNotification('データをインポートしました');
        } catch (error) {
          console.error('Import error:', error);
          this.showError('データのインポートに失敗しました: ' + error.message);
        }
      };
      
      reader.onerror = () => {
        this.showError('ファイルの読み込みに失敗しました');
      };
      
      reader.readAsText(file);
      // ファイル入力をリセット
      event.target.value = '';
    } catch (error) {
      console.error('File import error:', error);
      this.showError('ファイルのインポート中にエラーが発生しました');
    }
  }

  /**
   * すべてのデータを削除
   */
  async handleClearAllData() {
    if (!confirm('すべての保存データを削除してもよろしいですか？この操作は元に戻せません。')) {
      return;
    }
    
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'CLEAR_DATA',
        timestamp: Date.now(),
        source: 'options',
        target: 'background',
        payload: {}
      };
      
      const response = await chrome.runtime.sendMessage(message);
      
      if (!response || !response.payload || !response.payload.success) {
        throw new Error('Failed to clear data');
      }
      
      // 削除成功
      await this.loadStorageStats();
      this.showNotification('すべてのデータを削除しました');
    } catch (error) {
      console.error('Clear data error:', error);
      this.showError('データの削除に失敗しました');
    }
  }

  /**
   * 保存済み要約画面を開く
   */
  openSavedSummaries() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/storage/saved.html') });
  }

  /**
   * エラーメッセージの表示
   */
  showError(message) {
    console.error(message);
    this.elements.saveStatus.textContent = message;
  }

  /**
   * 通知の表示
   */
  showNotification(message) {
    this.elements.saveStatus.textContent = message;
    setTimeout(() => {
      this.elements.saveStatus.textContent = '';
    }, 3000);
  }

  /**
   * メッセージID生成
   */
  generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// インスタンス化
document.addEventListener('DOMContentLoaded', () => {
  window.optionsController = new OptionsController();
}); 