// ストレージ関連型定義

export interface AppSettings {
  apiKey: string;
  defaultSummaryLength: 'short' | 'medium' | 'long';
  defaultSummaryStyle: 'bullet' | 'paragraph' | 'structured';
  autoSave: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: 'japanese';
  privacy: {
    saveToHistory: boolean;
    encryptionEnabled: boolean;
    dataRetentionDays: number;
  };
}

export interface SummaryItem {
  id: string;
  title: string;
  url: string;
  content: string;
  originalText: string;
  timestamp: number;
  options: {
    length: string;
    style: string;
    language: string;
  };
  metadata: {
    extractionMethod: string;
    quality: {
      readability: number;
      completeness: number;
      structure: number;
      relevance: number;
    };
    processingTime: number;
  };
  tags?: string[];
  favorite: boolean;
}

export interface StorageData {
  settings: AppSettings;
  summaries: SummaryItem[];
  lastSync: number;
  version: string;
}

// 暗号化ストレージインターフェース
export interface EncryptedStorage {
  // APIキーの暗号化保存
  setEncryptedApiKey(apiKey: string): Promise<void>;
  getEncryptedApiKey(): Promise<string | null>;
  
  // 設定の保存・取得
  saveSettings(settings: Partial<AppSettings>): Promise<void>;
  getSettings(): Promise<AppSettings>;
  
  // 要約データの管理
  saveSummary(summary: SummaryItem): Promise<string>;
  getSummary(id: string): Promise<SummaryItem | null>;
  getAllSummaries(): Promise<SummaryItem[]>;
  deleteSummary(id: string): Promise<boolean>;
  
  // 検索・フィルタリング
  searchSummaries(query: string): Promise<SummaryItem[]>;
  getSummariesByUrl(url: string): Promise<SummaryItem[]>;
  getSummariesByDateRange(start: Date, end: Date): Promise<SummaryItem[]>;
  
  // データ管理
  exportData(): Promise<string>;
  importData(data: string): Promise<boolean>;
  clearAllData(): Promise<void>;
}

// セキュリティ設定
export interface SecurityConfig {
  encryptionKey: string;
  algorithm: 'AES-256-GCM';
  saltLength: 16;
  ivLength: 12;
  tagLength: 16;
}

// ストレージキー定数
export const STORAGE_KEYS = {
  SETTINGS: 'jas_settings',
  SUMMARIES: 'jas_summaries',
  ENCRYPTED_API_KEY: 'jas_encrypted_api_key',
  SECURITY_CONFIG: 'jas_security_config',
  LAST_SYNC: 'jas_last_sync',
  VERSION: 'jas_version'
} as const;

// デフォルト設定
export const DEFAULT_SETTINGS: AppSettings = {
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

// バリデーション関数型
export type SettingsValidator = (settings: Partial<AppSettings>) => {
  isValid: boolean;
  errors: string[];
};

export type SummaryValidator = (summary: Partial<SummaryItem>) => {
  isValid: boolean;
  errors: string[];
}; 