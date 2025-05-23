/**
 * Auto Japanese Summarizer - Saved Summaries Controller
 * 要約管理画面の機能実装
 */

class SavedSummariesController {
  constructor() {
    this.state = {
      summaries: [],
      filteredSummaries: [],
      viewMode: 'grid', // 'grid' または 'list'
      sortOrder: 'newest',
      dateFilter: 'all',
      searchQuery: '',
      customDateRange: {
        from: null,
        to: null
      },
      currentSummary: null,
      summaryToDelete: null,
      isLoading: true
    };

    this.elements = {};
    this.init();
  }

  /**
   * 初期化
   */
  async init() {
    try {
      this.setupElements();
      this.setupEventListeners();
      await this.loadSummaries();
      this.updateUIState();
      console.log('Saved summaries controller initialized');
    } catch (error) {
      console.error('Failed to initialize saved summaries controller:', error);
      this.showError('要約の読み込み中にエラーが発生しました');
    }
  }

  /**
   * 要素の参照を取得
   */
  setupElements() {
    // 検索・フィルターコントロール
    this.elements.searchInput = document.getElementById('search-input');
    this.elements.searchButton = document.getElementById('search-button');
    this.elements.dateFilter = document.getElementById('date-filter');
    this.elements.customDateRange = document.getElementById('custom-date-range');
    this.elements.dateFrom = document.getElementById('date-from');
    this.elements.dateTo = document.getElementById('date-to');
    this.elements.applyDateRange = document.getElementById('apply-date-range');
    this.elements.sortOrder = document.getElementById('sort-order');
    
    // ビューコントロール
    this.elements.gridViewButton = document.getElementById('grid-view-button');
    this.elements.listViewButton = document.getElementById('list-view-button');
    this.elements.resultsCount = document.getElementById('results-count');
    
    // サマリーコンテナ
    this.elements.summariesContainer = document.getElementById('summaries-container');
    this.elements.emptyState = document.getElementById('empty-state');
    this.elements.loadingState = document.getElementById('loading-state');
    
    // ヘッダーボタン
    this.elements.syncButton = document.getElementById('sync-button');
    this.elements.exportAllButton = document.getElementById('export-all-button');
    this.elements.settingsButton = document.getElementById('settings-button');
    
    // 空の状態のボタン
    this.elements.createSummaryButton = document.getElementById('create-summary-button');
    this.elements.importDataButton = document.getElementById('import-data-button');
    this.elements.importFile = document.getElementById('import-file');
    
    // サマリーモーダル
    this.elements.summaryModal = document.getElementById('summary-modal');
    this.elements.modalTitle = document.getElementById('modal-title');
    this.elements.modalUrl = document.getElementById('modal-url');
    this.elements.modalDate = document.getElementById('modal-date');
    this.elements.modalKeywords = document.getElementById('modal-keywords');
    this.elements.modalContent = document.getElementById('modal-content');
    this.elements.modalClose = document.getElementById('modal-close');
    this.elements.modalEdit = document.getElementById('modal-edit');
    this.elements.modalExport = document.getElementById('modal-export');
    this.elements.modalDelete = document.getElementById('modal-delete');
    
    // 削除確認モーダル
    this.elements.deleteModal = document.getElementById('delete-modal');
    this.elements.deleteModalClose = document.getElementById('delete-modal-close');
    this.elements.deleteCancel = document.getElementById('delete-cancel');
    this.elements.deleteConfirm = document.getElementById('delete-confirm');
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // 検索
    this.elements.searchButton.addEventListener('click', () => this.handleSearch());
    this.elements.searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });
    
    // フィルター
    this.elements.dateFilter.addEventListener('change', (e) => this.handleDateFilterChange(e));
    this.elements.applyDateRange.addEventListener('click', () => this.applyCustomDateRange());
    this.elements.sortOrder.addEventListener('change', (e) => this.handleSortOrderChange(e));
    
    // ビュー切り替え
    this.elements.gridViewButton.addEventListener('click', () => this.setViewMode('grid'));
    this.elements.listViewButton.addEventListener('click', () => this.setViewMode('list'));
    
    // ヘッダーボタン
    this.elements.syncButton.addEventListener('click', () => this.refreshSummaries());
    this.elements.exportAllButton.addEventListener('click', () => this.exportAllSummaries());
    this.elements.settingsButton.addEventListener('click', () => this.openOptionsPage());
    
    // 空の状態のボタン
    this.elements.createSummaryButton.addEventListener('click', () => this.createNewSummary());
    this.elements.importDataButton.addEventListener('click', () => this.elements.importFile.click());
    this.elements.importFile.addEventListener('change', (e) => this.handleFileImport(e));
    
    // モーダルイベント
    this.elements.modalClose.addEventListener('click', () => this.closeSummaryModal());
    this.elements.modalEdit.addEventListener('click', () => this.editCurrentSummary());
    this.elements.modalExport.addEventListener('click', () => this.exportCurrentSummary());
    this.elements.modalDelete.addEventListener('click', () => this.showDeleteConfirmation());
    
    // 削除確認モーダル
    this.elements.deleteModalClose.addEventListener('click', () => this.closeDeleteModal());
    this.elements.deleteCancel.addEventListener('click', () => this.closeDeleteModal());
    this.elements.deleteConfirm.addEventListener('click', () => this.deleteCurrentSummary());
    
    // モーダルのオーバーレイクリックで閉じる
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeSummaryModal();
        this.closeDeleteModal();
      }
    });
  }

  /**
   * 要約の読み込み
   */
  async loadSummaries() {
    try {
      this.setLoading(true);
      
      const message = {
        id: this.generateMessageId(),
        type: 'SEARCH_SUMMARIES',
        timestamp: Date.now(),
        source: 'saved',
        target: 'background',
        payload: { query: '' }
      };
      
      const response = await chrome.runtime.sendMessage(message);
      
      if (!response || !response.payload || !response.payload.success) {
        throw new Error('Failed to load summaries');
      }
      
      this.state.summaries = response.payload.data || [];
      this.applySortAndFilter();
      
      return true;
    } catch (error) {
      console.error('Failed to load summaries:', error);
      this.showError('要約の読み込みに失敗しました');
      return false;
    } finally {
      this.setLoading(false);
    }
  }
  
  /**
   * ローディング状態の設定
   */
  setLoading(isLoading) {
    this.state.isLoading = isLoading;
    
    if (isLoading) {
      this.elements.loadingState.style.display = 'flex';
      this.elements.summariesContainer.style.display = 'none';
      this.elements.emptyState.style.display = 'none';
    } else {
      this.elements.loadingState.style.display = 'none';
      
      if (this.state.filteredSummaries.length === 0) {
        this.elements.summariesContainer.style.display = 'none';
        this.elements.emptyState.style.display = 'flex';
      } else {
        this.elements.summariesContainer.style.display = 'grid';
        this.elements.emptyState.style.display = 'none';
      }
    }
  }

  /**
   * UI状態の更新
   */
  updateUIState() {
    // 要約件数の表示
    const count = this.state.filteredSummaries.length;
    this.elements.resultsCount.textContent = `${count}件の要約`;
    
    // ビューモードの切り替え
    if (this.state.viewMode === 'grid') {
      this.elements.summariesContainer.classList.remove('summaries-list');
      this.elements.summariesContainer.classList.add('summaries-grid');
      this.elements.gridViewButton.classList.add('active');
      this.elements.listViewButton.classList.remove('active');
    } else {
      this.elements.summariesContainer.classList.remove('summaries-grid');
      this.elements.summariesContainer.classList.add('summaries-list');
      this.elements.gridViewButton.classList.remove('active');
      this.elements.listViewButton.classList.add('active');
    }
    
    // 要約の表示
    this.renderSummaries();
  }

  /**
   * 要約の表示
   */
  renderSummaries() {
    this.elements.summariesContainer.innerHTML = '';
    
    if (this.state.filteredSummaries.length === 0) {
      this.elements.summariesContainer.style.display = 'none';
      this.elements.emptyState.style.display = 'flex';
      return;
    }
    
    this.elements.summariesContainer.style.display = this.state.viewMode === 'grid' ? 'grid' : 'flex';
    this.elements.emptyState.style.display = 'none';
    
    this.state.filteredSummaries.forEach(summary => {
      if (this.state.viewMode === 'grid') {
        this.renderGridCard(summary);
      } else {
        this.renderListCard(summary);
      }
    });
  }

  /**
   * グリッドカードを表示
   */
  renderGridCard(summary) {
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.dataset.id = summary.id;
    
    const formattedDate = new Date(summary.timestamp).toLocaleDateString('ja-JP');
    const keywords = summary.keywords || [];
    
    card.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">${this.escapeHtml(summary.title || '無題')}</h3>
        <div class="card-meta">
          <span class="card-date">${formattedDate}</span>
        </div>
      </div>
      <div class="card-content">
        <p class="card-summary">${this.escapeHtml(summary.content.substring(0, 200))}${summary.content.length > 200 ? '...' : ''}</p>
      </div>
      ${keywords.length > 0 ? `
        <div class="card-tags">
          ${keywords.slice(0, 3).map(kw => `<span class="tag">${this.escapeHtml(kw)}</span>`).join('')}
          ${keywords.length > 3 ? `<span class="tag">+${keywords.length - 3}</span>` : ''}
        </div>
      ` : ''}
      <div class="card-footer">
        <button class="card-button view-button" data-action="view" title="詳細表示">
          <span>👁️</span>
        </button>
        <button class="card-button export-button" data-action="export" title="エクスポート">
          <span>📤</span>
        </button>
        <button class="card-button delete-button" data-action="delete" title="削除">
          <span>🗑️</span>
        </button>
      </div>
    `;
    
    // カード全体のクリックで詳細表示
    card.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action]')) {
        this.openSummaryDetail(summary.id);
      }
    });
    
    // 各ボタンのアクション
    card.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = button.dataset.action;
        
        switch (action) {
          case 'view':
            this.openSummaryDetail(summary.id);
            break;
          case 'export':
            this.exportSummary(summary.id);
            break;
          case 'delete':
            this.confirmDelete(summary.id);
            break;
        }
      });
    });
    
    this.elements.summariesContainer.appendChild(card);
  }

  /**
   * リストカードを表示
   */
  renderListCard(summary) {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.dataset.id = summary.id;
    
    const formattedDate = new Date(summary.timestamp).toLocaleDateString('ja-JP');
    
    card.innerHTML = `
      <div class="list-card-color"></div>
      <div class="list-card-content">
        <h3 class="list-card-title">${this.escapeHtml(summary.title || '無題')}</h3>
        <p class="list-card-summary">${this.escapeHtml(summary.content.substring(0, 100))}${summary.content.length > 100 ? '...' : ''}</p>
      </div>
      <div class="list-card-actions">
        <span class="list-card-date">${formattedDate}</span>
        <button class="card-button view-button" data-action="view" title="詳細表示">
          <span>👁️</span>
        </button>
        <button class="card-button export-button" data-action="export" title="エクスポート">
          <span>📤</span>
        </button>
        <button class="card-button delete-button" data-action="delete" title="削除">
          <span>🗑️</span>
        </button>
      </div>
    `;
    
    // カード全体のクリックで詳細表示
    card.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action]')) {
        this.openSummaryDetail(summary.id);
      }
    });
    
    // 各ボタンのアクション
    card.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = button.dataset.action;
        
        switch (action) {
          case 'view':
            this.openSummaryDetail(summary.id);
            break;
          case 'export':
            this.exportSummary(summary.id);
            break;
          case 'delete':
            this.confirmDelete(summary.id);
            break;
        }
      });
    });
    
    this.elements.summariesContainer.appendChild(card);
  }
  
  /**
   * 並び替えとフィルターの適用
   */
  applySortAndFilter() {
    this.applyFilter();
    this.applySort();
    this.updateUIState();
  }

  /**
   * フィルターの適用
   */
  applyFilter() {
    let filtered = [...this.state.summaries];
    
    // 検索クエリでフィルター
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(summary => {
        return (
          (summary.title && summary.title.toLowerCase().includes(query)) ||
          (summary.content && summary.content.toLowerCase().includes(query)) ||
          (summary.keywords && summary.keywords.some(kw => kw.toLowerCase().includes(query))) ||
          (summary.url && summary.url.toLowerCase().includes(query))
        );
      });
    }
    
    // 日付でフィルター
    if (this.state.dateFilter !== 'all') {
      const now = new Date();
      let fromDate;
      
      switch (this.state.dateFilter) {
        case 'today':
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 7);
          break;
        case 'month':
          fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'custom':
          if (this.state.customDateRange.from) {
            fromDate = new Date(this.state.customDateRange.from);
            fromDate.setHours(0, 0, 0, 0);
          }
          break;
      }
      
      let toDate;
      if (this.state.dateFilter === 'custom' && this.state.customDateRange.to) {
        toDate = new Date(this.state.customDateRange.to);
        toDate.setHours(23, 59, 59, 999);
      } else {
        toDate = new Date(now);
        toDate.setHours(23, 59, 59, 999);
      }
      
      if (fromDate) {
        filtered = filtered.filter(summary => {
          const summaryDate = new Date(summary.timestamp);
          return summaryDate >= fromDate && summaryDate <= toDate;
        });
      }
    }
    
    this.state.filteredSummaries = filtered;
  }

  /**
   * 並び替えの適用
   */
  applySort() {
    switch (this.state.sortOrder) {
      case 'newest':
        this.state.filteredSummaries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        break;
      case 'oldest':
        this.state.filteredSummaries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        break;
      case 'title-asc':
        this.state.filteredSummaries.sort((a, b) => {
          const titleA = (a.title || '無題').toLowerCase();
          const titleB = (b.title || '無題').toLowerCase();
          return titleA.localeCompare(titleB, 'ja');
        });
        break;
      case 'title-desc':
        this.state.filteredSummaries.sort((a, b) => {
          const titleA = (a.title || '無題').toLowerCase();
          const titleB = (b.title || '無題').toLowerCase();
          return titleB.localeCompare(titleA, 'ja');
        });
        break;
    }
  }

  /**
   * 検索処理
   */
  handleSearch() {
    this.state.searchQuery = this.elements.searchInput.value.trim();
    this.applySortAndFilter();
  }

  /**
   * 日付フィルター変更処理
   */
  handleDateFilterChange(e) {
    this.state.dateFilter = e.target.value;
    
    if (this.state.dateFilter === 'custom') {
      this.elements.customDateRange.style.display = 'flex';
    } else {
      this.elements.customDateRange.style.display = 'none';
      this.applySortAndFilter();
    }
  }

  /**
   * カスタム日付範囲の適用
   */
  applyCustomDateRange() {
    const fromValue = this.elements.dateFrom.value;
    const toValue = this.elements.dateTo.value;
    
    this.state.customDateRange.from = fromValue ? new Date(fromValue) : null;
    this.state.customDateRange.to = toValue ? new Date(toValue) : null;
    
    this.applySortAndFilter();
  }

  /**
   * 並び順変更処理
   */
  handleSortOrderChange(e) {
    this.state.sortOrder = e.target.value;
    this.applySortAndFilter();
  }

  /**
   * ビューモードの設定
   */
  setViewMode(mode) {
    this.state.viewMode = mode;
    this.updateUIState();
  }

  /**
   * 要約の再読み込み
   */
  async refreshSummaries() {
    await this.loadSummaries();
  }

  /**
   * すべての要約をエクスポート
   */
  async exportAllSummaries() {
    try {
      const message = {
        id: this.generateMessageId(),
        type: 'EXPORT_DATA',
        timestamp: Date.now(),
        source: 'saved',
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
      
      this.showToast('データをエクスポートしました');
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('エクスポートに失敗しました', 'error');
    }
  }

  /**
   * 特定の要約をエクスポート
   */
  async exportSummary(summaryId) {
    try {
      const summary = this.state.summaries.find(s => s.id === summaryId);
      if (!summary) {
        throw new Error('Summary not found');
      }
      
      const jsonString = JSON.stringify(summary, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const date = new Date().toISOString().split('T')[0];
      const sanitizedTitle = (summary.title || '無題').replace(/[^\w\s]/gi, '_').substring(0, 30);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `summary-${sanitizedTitle}-${date}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      
      this.showToast('要約をエクスポートしました');
    } catch (error) {
      console.error('Export summary failed:', error);
      this.showToast('要約のエクスポートに失敗しました', 'error');
    }
  }

  /**
   * 設定画面を開く
   */
  openOptionsPage() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * 新しい要約を作成
   */
  createNewSummary() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/popup.html') });
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
            source: 'saved',
            target: 'background',
            payload: {
              data: jsonData
            }
          };
          
          const response = await chrome.runtime.sendMessage(message);
          
          if (!response || !response.payload || !response.payload.success) {
            throw new Error('Failed to import data');
          }
          
          this.showToast('データをインポートしました');
          await this.loadSummaries();
        } catch (error) {
          console.error('Import error:', error);
          this.showToast('データのインポートに失敗しました', 'error');
        }
      };
      
      reader.onerror = () => {
        this.showToast('ファイルの読み込みに失敗しました', 'error');
      };
      
      reader.readAsText(file);
      // ファイル入力をリセット
      event.target.value = '';
    } catch (error) {
      console.error('File import error:', error);
      this.showToast('インポート処理に失敗しました', 'error');
    }
  }

  /**
   * 要約詳細モーダルを開く
   */
  openSummaryDetail(summaryId) {
    const summary = this.state.summaries.find(s => s.id === summaryId);
    if (!summary) {
      this.showToast('要約データが見つかりません', 'error');
      return;
    }
    
    this.state.currentSummary = summary;
    
    // モーダルにデータを設定
    this.elements.modalTitle.textContent = summary.title || '無題';
    
    if (summary.url) {
      this.elements.modalUrl.href = summary.url;
      this.elements.modalUrl.textContent = summary.url;
    } else {
      this.elements.modalUrl.href = '#';
      this.elements.modalUrl.textContent = 'URLがありません';
    }
    
    this.elements.modalDate.textContent = new Date(summary.timestamp).toLocaleString('ja-JP');
    
    // キーワードを表示
    this.elements.modalKeywords.innerHTML = '';
    if (summary.keywords && summary.keywords.length > 0) {
      summary.keywords.forEach(keyword => {
        const tag = document.createElement('span');
        tag.className = 'keyword-tag';
        tag.textContent = keyword;
        this.elements.modalKeywords.appendChild(tag);
      });
    } else {
      const noKeywords = document.createElement('span');
      noKeywords.className = 'no-keywords';
      noKeywords.textContent = 'キーワードなし';
      this.elements.modalKeywords.appendChild(noKeywords);
    }
    
    // 要約内容を表示
    this.elements.modalContent.textContent = summary.content;
    
    // モーダルを表示
    this.elements.summaryModal.setAttribute('aria-hidden', 'false');
  }

  /**
   * 要約詳細モーダルを閉じる
   */
  closeSummaryModal() {
    this.elements.summaryModal.setAttribute('aria-hidden', 'true');
    this.state.currentSummary = null;
  }

  /**
   * 現在の要約を編集
   */
  editCurrentSummary() {
    if (!this.state.currentSummary) return;
    
    // ここで編集モードに切り替える処理を実装
    // 今回のスコープ外なので、未実装
    this.showToast('編集機能は近日公開予定です');
  }

  /**
   * 現在の要約をエクスポート
   */
  exportCurrentSummary() {
    if (!this.state.currentSummary) return;
    this.exportSummary(this.state.currentSummary.id);
  }

  /**
   * 削除確認を表示
   */
  showDeleteConfirmation() {
    if (!this.state.currentSummary) return;
    this.state.summaryToDelete = this.state.currentSummary;
    this.elements.deleteModal.setAttribute('aria-hidden', 'false');
  }

  /**
   * 削除確認モーダルを閉じる
   */
  closeDeleteModal() {
    this.elements.deleteModal.setAttribute('aria-hidden', 'true');
    this.state.summaryToDelete = null;
  }

  /**
   * 要約削除の確認
   */
  confirmDelete(summaryId) {
    const summary = this.state.summaries.find(s => s.id === summaryId);
    if (!summary) return;
    
    this.state.summaryToDelete = summary;
    this.elements.deleteModal.setAttribute('aria-hidden', 'false');
  }

  /**
   * 現在の要約を削除
   */
  async deleteCurrentSummary() {
    if (!this.state.summaryToDelete) return;
    
    try {
      const summaryId = this.state.summaryToDelete.id;
      
      const message = {
        id: this.generateMessageId(),
        type: 'DELETE_SUMMARY',
        timestamp: Date.now(),
        source: 'saved',
        target: 'background',
        payload: {
          id: summaryId
        }
      };
      
      const response = await chrome.runtime.sendMessage(message);
      
      if (!response || !response.payload || !response.payload.success) {
        throw new Error('Failed to delete summary');
      }
      
      // UIから要約を削除
      this.state.summaries = this.state.summaries.filter(s => s.id !== summaryId);
      this.applySortAndFilter();
      this.closeDeleteModal();
      this.closeSummaryModal();
      
      this.showToast('要約を削除しました');
    } catch (error) {
      console.error('Delete failed:', error);
      this.showToast('削除に失敗しました', 'error');
    }
  }

  /**
   * トースト通知を表示
   */
  showToast(message, type = 'success') {
    // 今回のスコープ外なので簡易実装としてアラートを使用
    alert(message);
  }

  /**
   * HTMLエスケープ
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * メッセージIDの生成
   */
  generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * エラーの表示
   */
  showError(message) {
    console.error(message);
    // 今回のスコープ外なので簡易実装としてアラートを使用
    alert('エラー: ' + message);
  }
}

// インスタンス化
document.addEventListener('DOMContentLoaded', () => {
  window.savedSummariesController = new SavedSummariesController();
}); 