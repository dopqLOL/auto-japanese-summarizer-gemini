/**
 * Auto Japanese Summarizer - Popup UI Controller
 * Implementation of Progressive Disclosure & Adaptive Design
 */

class PopupController {
  constructor() {
    this.state = {
      currentState: 'idle', // idle, loading, preview, error
      isExpanded: false,
      currentTab: null,
      summaryData: null
    };
    
    this.elements = {};
    this.messageHandler = null;
    this.init();
  }

  /**
   * Initialize popup controller
   */
  async init() {
    try {
      this.setupElements();
      this.setupEventListeners();
      await this.loadInitialData();
      await this.checkApiStatus();
      console.log('Popup controller initialized');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      this.showError('初期化に失敗しました。拡張機能を再読み込みしてください。');
    }
  }

  /**
   * Setup DOM element references
   */
  setupElements() {
    this.elements = {
      // Core UI elements
      currentUrl: document.getElementById('current-url'),
      pageMeta: document.getElementById('page-meta'),
      summarizeBtn: document.getElementById('summarize-btn'),
      timeEstimate: document.getElementById('time-estimate'),
      
      // Progress elements
      progressSection: document.getElementById('progress-section'),
      progressFill: document.getElementById('progress-fill'),
      progressText: document.getElementById('progress-text'),
      
      // Preview elements
      summaryPreview: document.getElementById('summary-preview'),
      previewContent: document.getElementById('preview-content'),
      saveBtn: document.getElementById('save-btn'),
      copyBtn: document.getElementById('copy-btn'),
      exportBtn: document.getElementById('export-btn'),
      
      // Error elements
      errorSection: document.getElementById('error-section'),
      errorText: document.getElementById('error-text'),
      retryBtn: document.getElementById('retry-btn'),
      
      // Expandable section
      expandToggle: document.getElementById('expand-toggle'),
      expandableSection: document.getElementById('expandable-section'),
      historyBtn: document.getElementById('history-btn'),
      exportAllBtn: document.getElementById('export-all-btn'),
      advancedSettingsBtn: document.getElementById('advanced-settings-btn'),
      
      // Header and footer
      settingsIcon: document.getElementById('settings-icon'),
      apiStatus: document.getElementById('api-status')
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Primary action
    this.elements.summarizeBtn?.addEventListener('click', () => this.handleSummarize());
    
    // Preview actions
    this.elements.saveBtn?.addEventListener('click', () => this.handleSave());
    this.elements.copyBtn?.addEventListener('click', () => this.handleCopy());
    this.elements.exportBtn?.addEventListener('click', () => this.handleExport());
    
    // Error handling
    this.elements.retryBtn?.addEventListener('click', () => this.handleRetry());
    
    // Expandable section
    this.elements.expandToggle?.addEventListener('click', () => this.toggleExpandableSection());
    
    // Secondary actions
    this.elements.historyBtn?.addEventListener('click', () => this.openHistoryPage());
    this.elements.exportAllBtn?.addEventListener('click', () => this.handleExportAll());
    this.elements.advancedSettingsBtn?.addEventListener('click', () => this.openSettingsPage());
    
    // Header actions
    this.elements.settingsIcon?.addEventListener('click', () => this.openSettingsPage());
    
    // Keyboard support
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    
    // Message listener for background communication
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true; // Keep message channel open
    });
  }

  /**
   * Load initial page data
   */
  async loadInitialData() {
    try {
      // Get current tab information
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        this.state.currentTab = tab;
        this.updatePageInfo(tab);
      } else {
        this.elements.summarizeBtn.disabled = true;
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showError('ページ情報の取得に失敗しました。');
      this.elements.summarizeBtn.disabled = true;
    }
  }

  /**
   * Check API configuration status
   */
  async checkApiStatus() {
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'CHECK_API_STATUS',
        timestamp: Date.now(),
        source: 'popup',
        target: 'background',
        payload: {}
      };
      const response = await chrome.runtime.sendMessage(message);

      if (response && response.payload && response.payload.success && response.payload.data && response.payload.data.isConfigured) {
        this.updateApiStatus('設定済み', 'success');
        if(this.state.currentTab) this.elements.summarizeBtn.disabled = false;
      } else {
        this.updateApiStatus('未設定', 'warning');
        this.elements.summarizeBtn.disabled = true;
      }
    } catch (error) {
      console.error('Failed to check API status:', error);
      this.updateApiStatus('エラー', 'error');
      this.elements.summarizeBtn.disabled = true;
    }
  }

  /**
   * Update page information display
   */
  updatePageInfo(tab) {
    if (!tab || !tab.url) {
        this.elements.currentUrl.textContent = '不明なページ';
        this.elements.pageMeta.textContent = '情報なし';
        return;
    }
    const url = new URL(tab.url);
    const domain = url.hostname;
    const path = url.pathname;
    
    this.elements.currentUrl.textContent = domain + (path !== '/' ? path : '');
    this.elements.pageMeta.textContent = `${tab.title ? '準備完了' : 'ページ情報取得中'}`;
  }

  /**
   * Update API status display
   */
  updateApiStatus(status, type) {
    this.elements.apiStatus.textContent = `API: ${status}`;
    this.elements.apiStatus.className = `api-status status-${type}`;
  }

  /**
   * Handle summarize button click
   */
  async handleSummarize() {
    if (this.state.currentState === 'loading' || !this.state.currentTab) return;
    
    try {
      this.setState('loading');
      
      const message = {
        id: this.generateMessageId(),
        type: 'START_SUMMARIZATION',
        timestamp: Date.now(),
        source: 'popup',
        target: 'background',
        payload: { 
          tabId: this.state.currentTab.id,
          url: this.state.currentTab.url,
          includeMetadata: true 
        }
      };
      const response = await chrome.runtime.sendMessage(message);

      if (response && response.payload && response.payload.success) {
        // Progressはメッセージ経由で受信するのでここでは直接処理しない
      } else {
        const errorMessage = (response && response.payload && response.payload.error && response.payload.error.message) || '要約処理の開始に失敗しました。';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Summarization failed:', error);
      this.showError(error.message || '要約処理中にエラーが発生しました。');
    }
  }

  /**
   * Handle summarization progress updates (via message listener)
   */
  handleSummarizationProgress(data) {
    if (!data) return;
    if (data.status === 'extracting') {
      this.updateProgress(20, 'テキストを抽出中...');
    } else if (data.status === 'processing') {
      this.updateProgress(60, 'AI要約を生成中...');
    } else if (data.status === 'complete') {
      this.updateProgress(100, '完了');
    } else if (data.status === 'error') {
      this.showError(data.error || '要約処理中にエラーが発生しました。');
    }
  }

  /**
   * Update progress display
   */
  updateProgress(percentage, text) {
    this.elements.progressFill.style.width = `${percentage}%`;
    this.elements.progressText.textContent = text;
  }

  /**
   * Show summary preview
   */
  showSummaryPreview(summaryData) {
    this.state.summaryData = summaryData;
    this.setState('preview');
    
    const formattedSummary = this.formatSummary(summaryData);
    this.elements.previewContent.innerHTML = formattedSummary;
  }

  /**
   * Format summary for display
   */
  formatSummary(summaryData) {
    if (!summaryData || !summaryData.content) {
      return '<p>要約を生成できませんでした。</p>';
    }

    let html = `<div class="summary-content-wrapper">`;
    
    if (summaryData.title) {
      html += `<h4 class="summary-title">${this.escapeHtml(summaryData.title)}</h4>`;
    }
    
    const paragraphs = summaryData.content.split('\n').filter(p => p.trim() !== '');
    paragraphs.forEach(p => {
        html += `<p class="summary-paragraph">${this.escapeHtml(p)}</p>`;
    });
    
    if (summaryData.metadata) {
      html += `<div class="summary-metadata">`;
      html += `<small>文字数: ${summaryData.metadata.length || 'N/A'} | `;
      html += `処理時間: ${summaryData.metadata.processingTime ? parseFloat(summaryData.metadata.processingTime).toFixed(2) : 'N/A'}秒</small>`;
      html += `</div>`;
    }
    
    html += `</div>`;
    return html;
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Handle save button click
   */
  async handleSave() {
    if (!this.state.summaryData) return;
    
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'SAVE_SUMMARY',
        timestamp: Date.now(),
        source: 'popup',
        target: 'background',
        payload: this.state.summaryData 
      };
      const response = await chrome.runtime.sendMessage(message);

      if (response && response.payload && response.payload.success) {
        this.showNotification('要約を保存しました', 'success');
      } else {
        const errorMessage = (response && response.payload && response.payload.error && response.payload.error.message) || '保存に失敗しました。';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to save summary:', error);
      this.showNotification('保存に失敗しました', 'error');
    }
  }

  /**
   * Handle copy button click
   */
  async handleCopy() {
    if (!this.state.summaryData || !this.state.summaryData.content) return;
    
    try {
      await navigator.clipboard.writeText(this.state.summaryData.content);
      this.showNotification('クリップボードにコピーしました', 'success');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      this.showNotification('コピーに失敗しました', 'error');
    }
  }

  /**
   * Handle export button click
   */
  async handleExport() {
    if (!this.state.summaryData) return;
    
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'EXPORT_SUMMARY',
        timestamp: Date.now(),
        source: 'popup',
        target: 'background',
        payload: {
          summary: this.state.summaryData,
          format: 'markdown'
        }
      };
      const response = await chrome.runtime.sendMessage(message);

      if (response && response.payload && response.payload.success) {
        this.showNotification('エクスポートしました', 'success');
      } else {
        const errorMessage = (response && response.payload && response.payload.error && response.payload.error.message) || 'エクスポートに失敗しました。';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to export summary:', error);
      this.showNotification('エクスポートに失敗しました', 'error');
    }
  }

  /**
   * Handle retry button click
   */
  handleRetry() {
    this.setState('idle');
    this.checkApiStatus().then(() => {
        if (!this.elements.summarizeBtn.disabled) {
            this.handleSummarize();
        }
    });
  }

  /**
   * Toggle expandable section
   */
  toggleExpandableSection() {
    this.state.isExpanded = !this.state.isExpanded;
    
    const toggle = this.elements.expandToggle;
    const section = this.elements.expandableSection;
    
    if (this.state.isExpanded) {
      toggle.setAttribute('aria-expanded', 'true');
      section.classList.add('expanded');
      section.setAttribute('aria-hidden', 'false');
      toggle.querySelector('.toggle-text').textContent = '機能を閉じる';
    } else {
      toggle.setAttribute('aria-expanded', 'false');
      section.classList.remove('expanded');
      section.setAttribute('aria-hidden', 'true');
      toggle.querySelector('.toggle-text').textContent = 'その他の機能';
    }
  }

  /**
   * Open history page
   */
  openHistoryPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/storage/saved.html')
    });
    window.close();
  }

  /**
   * Open settings page
   */
  openSettingsPage() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  /**
   * Handle export all functionality
   */
  async handleExportAll() {
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'EXPORT_ALL_SUMMARIES',
        timestamp: Date.now(),
        source: 'popup',
        target: 'background',
        payload: { format: 'zip' }
      };
      const response = await chrome.runtime.sendMessage(message);

      if (response && response.payload && response.payload.success) {
        this.showNotification('全ての要約をエクスポートしました', 'success');
      } else {
        const errorMessage = (response && response.payload && response.payload.error && response.payload.error.message) || 'エクスポートに失敗しました。';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to export all summaries:', error);
      this.showNotification('エクスポートに失敗しました', 'error');
    }
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboard(event) {
    if (event.key === 'Enter') {
      const focused = document.activeElement;
      if (focused && (focused.tagName === 'BUTTON' || (focused.tagName === 'A' && focused.classList.contains('header-button')))) {
        focused.click();
      }
    }
    
    if (event.key === 'Escape') {
      if (this.state.isExpanded) {
        this.toggleExpandableSection();
      } else {
        // Optionally close popup: window.close(); 
        // However, this might be too aggressive.
      }
    }
  }

  /**
   * Handle messages from background script
   */
  handleMessage(message, sendResponse) {
    if (!message || !message.type) {
        console.warn('Received malformed message:', message);
        sendResponse({ success: false, error: 'Malformed message' });
        return;
    }

    switch (message.type) {
      case 'SUMMARIZATION_PROGRESS_RESPONSE':
        if(message.payload && message.payload.data){
             this.handleSummarizationProgress(message.payload.data);
        }
        sendResponse({ success: true, received: true });
        break;
        
      case 'SUMMARIZATION_COMPLETE_RESPONSE':
        if(message.payload && message.payload.data){
            this.showSummaryPreview(message.payload.data);
        }
        sendResponse({ success: true, received: true });
        break;
        
      case 'SUMMARIZATION_ERROR_RESPONSE':
         if(message.payload && message.payload.error){
            this.showError(message.payload.error.message || '要約中に不明なエラーが発生しました。');
        }
        sendResponse({ success: true, received: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type for popup' });
    }
  }

  /**
   * Set current state and update UI
   */
  setState(newState) {
    this.state.currentState = newState;
    this.updateUIForState();
  }

  /**
   * Update UI based on current state
   */
  updateUIForState() {
    this.elements.progressSection.style.display = 'none';
    this.elements.summaryPreview.style.display = 'none';
    this.elements.errorSection.style.display = 'none';
    
    const summarizeBtnText = this.elements.summarizeBtn.querySelector('.button-text');

    switch (this.state.currentState) {
      case 'idle':
        this.elements.summarizeBtn.disabled = this.elements.apiStatus.textContent.includes('未設定') || !this.state.currentTab;
        if(summarizeBtnText) summarizeBtnText.textContent = '要約開始';
        break;
        
      case 'loading':
        this.elements.summarizeBtn.disabled = true;
        if(summarizeBtnText) summarizeBtnText.textContent = '処理中...';
        this.elements.progressSection.style.display = 'block';
        this.updateProgress(0, '準備中...');
        break;
        
      case 'preview':
        this.elements.summarizeBtn.disabled = false;
        if(summarizeBtnText) summarizeBtnText.textContent = '再実行';
        this.elements.summaryPreview.style.display = 'block';
        break;
        
      case 'error':
        this.elements.summarizeBtn.disabled = false;
        if(summarizeBtnText) summarizeBtnText.textContent = '要約開始';
        this.elements.errorSection.style.display = 'block';
        break;
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.setState('error');
    this.elements.errorText.textContent = message || '不明なエラーが発生しました。';
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const notificationArea = document.getElementById('notification-area') || this.createNotificationArea();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    notificationArea.appendChild(notification);
    
    requestAnimationFrame(() => {
        notification.classList.add('visible');
    });

    setTimeout(() => {
      notification.classList.remove('visible');
      setTimeout(() => {
        notification.remove();
        if (notificationArea.childElementCount === 0) {
            // notificationArea.remove(); // Optionally remove area if empty
        }
      }, 500);
    }, 3000);
  }

  createNotificationArea() {
    let area = document.getElementById('notification-area');
    if (!area) {
        area = document.createElement('div');
        area.id = 'notification-area';
        area.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        document.body.appendChild(area);
    }
    return area;
  }
  
  /**
   * Generates a unique message ID.
   */
  generateMessageId() {
    return `popup-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// Add slideIn/Out animation styles for notifications
const style = document.createElement('style');
style.textContent = `
  .notification {
    background: #333;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    font-size: 13px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    transform: translateX(110%);
    opacity: 0;
    transition: transform 0.4s ease-out, opacity 0.4s ease-out;
  }
  .notification.visible {
    transform: translateX(0);
    opacity: 1;
  }
  .notification-success { background-color: #48bb78; }
  .notification-error { background-color: #f56565; }
  .notification-info { background-color: #667eea; }

  .status-api.status-success { color: var(--success-color); }
  .status-api.status-warning { color: var(--warning-color); }
  .status-api.status-error { color: var(--error-color); }
`;
document.head.appendChild(style); 