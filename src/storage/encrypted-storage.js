/**
 * Encrypted Storage System
 * AES-256-GCM暗号化を使用したセキュアなストレージ
 */

class EncryptedStorage {
  constructor() {
    this.storageKeys = {
      SETTINGS: 'jas_settings',
      SUMMARIES: 'jas_summaries',
      ENCRYPTED_API_KEY: 'jas_encrypted_api_key',
      SECURITY_CONFIG: 'jas_security_config',
      LAST_SYNC: 'jas_last_sync',
      VERSION: 'jas_version'
    };

    this.defaultSettings = {
      apiKey: '',
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

    this.encryptionConfig = {
      algorithm: 'AES-GCM',
      keyLength: 256,
      ivLength: 12,
      tagLength: 16
    };

    this.initializeEncryption();
  }

  /**
   * 暗号化システムの初期化
   */
  async initializeEncryption() {
    try {
      let securityConfig = await this.getSecurityConfig();
      
      if (!securityConfig) {
        // 新しいマスターキーを生成
        const masterKey = await this.generateMasterKey();
        securityConfig = {
          masterKey: masterKey,
          algorithm: this.encryptionConfig.algorithm,
          created: Date.now(),
          version: '1.0'
        };
        
        await this.setSecurityConfig(securityConfig);
      }
      
      this.masterKey = securityConfig.masterKey;
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw new Error('Encryption initialization failed');
    }
  }

  /**
   * マスターキーの生成
   */
  async generateMasterKey() {
    const key = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: this.encryptionConfig.keyLength
      },
      true,
      ['encrypt', 'decrypt']
    );

    const exportedKey = await crypto.subtle.exportKey('raw', key);
    return Array.from(new Uint8Array(exportedKey));
  }

  /**
   * データの暗号化
   */
  async encryptData(data) {
    try {
      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(jsonString);

      // IVの生成
      const iv = crypto.getRandomValues(new Uint8Array(this.encryptionConfig.ivLength));

      // マスターキーをCryptoKeyにインポート
      const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(this.masterKey),
        'AES-GCM',
        false,
        ['encrypt']
      );

      // 暗号化実行
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        dataBuffer
      );

      // 結果をBase64エンコード
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const combinedArray = new Uint8Array(iv.length + encryptedArray.length);
      combinedArray.set(iv);
      combinedArray.set(encryptedArray, iv.length);

      return btoa(String.fromCharCode(...combinedArray));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * データの復号化
   */
  async decryptData(encryptedData) {
    try {
      // Base64デコード
      const combinedArray = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      // IVと暗号化データを分離
      const iv = combinedArray.slice(0, this.encryptionConfig.ivLength);
      const encryptedArray = combinedArray.slice(this.encryptionConfig.ivLength);

      // マスターキーをCryptoKeyにインポート
      const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(this.masterKey),
        'AES-GCM',
        false,
        ['decrypt']
      );

      // 復号化実行
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encryptedArray
      );

      // デコードしてJSONパース
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedBuffer);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * APIキーの暗号化保存
   */
  async setEncryptedApiKey(apiKey) {
    try {
      const encryptedApiKey = await this.encryptData({ apiKey: apiKey });
      await this.setStorageItem(this.storageKeys.ENCRYPTED_API_KEY, encryptedApiKey);
    } catch (error) {
      console.error('Failed to save encrypted API key:', error);
      throw error;
    }
  }

  /**
   * APIキーの復号化取得
   */
  async getEncryptedApiKey() {
    try {
      const encryptedApiKey = await this.getStorageItem(this.storageKeys.ENCRYPTED_API_KEY);
      if (!encryptedApiKey) {
        return null;
      }

      const decryptedData = await this.decryptData(encryptedApiKey);
      return decryptedData.apiKey;
    } catch (error) {
      console.error('Failed to retrieve encrypted API key:', error);
      return null;
    }
  }

  /**
   * 設定の保存
   */
  async saveSettings(settings) {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      
      // APIキーは別途暗号化保存
      if (settings.apiKey !== undefined) {
        await this.setEncryptedApiKey(settings.apiKey);
        delete updatedSettings.apiKey;
      }

      await this.setStorageItem(this.storageKeys.SETTINGS, updatedSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * 設定の取得
   */
  async getSettings() {
    try {
      const settings = await this.getStorageItem(this.storageKeys.SETTINGS);
      const apiKey = await this.getEncryptedApiKey();
      
      const finalSettings = {
        ...this.defaultSettings,
        ...settings,
        apiKey: apiKey || ''
      };

      return finalSettings;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return this.defaultSettings;
    }
  }

  /**
   * 要約の保存
   */
  async saveSummary(summary) {
    try {
      const summaries = await this.getAllSummaries();
      
      // IDが未設定の場合は生成
      if (!summary.id) {
        summary.id = this.generateSummaryId();
      }

      // 既存の要約を更新または新規追加
      const existingIndex = summaries.findIndex(s => s.id === summary.id);
      if (existingIndex >= 0) {
        summaries[existingIndex] = summary;
      } else {
        summaries.push(summary);
      }

      // データ保持期間チェック
      const settings = await this.getSettings();
      if (settings.privacy.dataRetentionDays > 0) {
        const cutoffDate = Date.now() - (settings.privacy.dataRetentionDays * 24 * 60 * 60 * 1000);
        const filteredSummaries = summaries.filter(s => s.timestamp > cutoffDate);
        await this.setStorageItem(this.storageKeys.SUMMARIES, filteredSummaries);
      } else {
        await this.setStorageItem(this.storageKeys.SUMMARIES, summaries);
      }

      return summary.id;
    } catch (error) {
      console.error('Failed to save summary:', error);
      throw error;
    }
  }

  /**
   * 要約の取得
   */
  async getSummary(id) {
    try {
      const summaries = await this.getAllSummaries();
      return summaries.find(s => s.id === id) || null;
    } catch (error) {
      console.error('Failed to get summary:', error);
      return null;
    }
  }

  /**
   * 全要約の取得
   */
  async getAllSummaries() {
    try {
      const summaries = await this.getStorageItem(this.storageKeys.SUMMARIES);
      return summaries || [];
    } catch (error) {
      console.error('Failed to get all summaries:', error);
      return [];
    }
  }

  /**
   * 要約の削除
   */
  async deleteSummary(id) {
    try {
      const summaries = await this.getAllSummaries();
      const filteredSummaries = summaries.filter(s => s.id !== id);
      
      if (filteredSummaries.length !== summaries.length) {
        await this.setStorageItem(this.storageKeys.SUMMARIES, filteredSummaries);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete summary:', error);
      throw error;
    }
  }

  /**
   * 要約の検索
   */
  async searchSummaries(query) {
    try {
      const summaries = await this.getAllSummaries();
      const lowercaseQuery = query.toLowerCase();
      
      return summaries.filter(summary => {
        return summary.title.toLowerCase().includes(lowercaseQuery) ||
               summary.content.toLowerCase().includes(lowercaseQuery) ||
               summary.url.toLowerCase().includes(lowercaseQuery) ||
               (summary.tags && summary.tags.some(tag => 
                 tag.toLowerCase().includes(lowercaseQuery)
               ));
      });
    } catch (error) {
      console.error('Failed to search summaries:', error);
      return [];
    }
  }

  /**
   * URLによる要約の取得
   */
  async getSummariesByUrl(url) {
    try {
      const summaries = await this.getAllSummaries();
      return summaries.filter(s => s.url === url);
    } catch (error) {
      console.error('Failed to get summaries by URL:', error);
      return [];
    }
  }

  /**
   * 日付範囲による要約の取得
   */
  async getSummariesByDateRange(start, end) {
    try {
      const summaries = await this.getAllSummaries();
      const startTime = start.getTime();
      const endTime = end.getTime();
      
      return summaries.filter(s => 
        s.timestamp >= startTime && s.timestamp <= endTime
      );
    } catch (error) {
      console.error('Failed to get summaries by date range:', error);
      return [];
    }
  }

  /**
   * データのエクスポート
   */
  async exportData() {
    try {
      const settings = await this.getSettings();
      const summaries = await this.getAllSummaries();
      
      const exportData = {
        version: '1.0',
        timestamp: Date.now(),
        settings: { ...settings, apiKey: '' }, // APIキーは除外
        summaries: summaries
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * データのインポート
   */
  async importData(data) {
    try {
      const parsedData = JSON.parse(data);
      
      if (parsedData.settings) {
        await this.saveSettings(parsedData.settings);
      }
      
      if (parsedData.summaries && Array.isArray(parsedData.summaries)) {
        await this.setStorageItem(this.storageKeys.SUMMARIES, parsedData.summaries);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * 全データのクリア
   */
  async clearAllData() {
    try {
      const keysToRemove = Object.values(this.storageKeys);
      await chrome.storage.local.remove(keysToRemove);
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * セキュリティ設定の保存
   */
  async setSecurityConfig(config) {
    await this.setStorageItem(this.storageKeys.SECURITY_CONFIG, config);
  }

  /**
   * セキュリティ設定の取得
   */
  async getSecurityConfig() {
    return await this.getStorageItem(this.storageKeys.SECURITY_CONFIG);
  }

  /**
   * ストレージアイテムの保存
   */
  async setStorageItem(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * ストレージアイテムの取得
   */
  async getStorageItem(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
        }
      });
    });
  }

  /**
   * 要約IDの生成
   */
  generateSummaryId() {
    return 'summary_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// グローバルインスタンス
const encryptedStorage = new EncryptedStorage();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EncryptedStorage;
} 