// Message Passing型定義
export interface MessageBase {
  id: string;
  timestamp: number;
  source: 'popup' | 'content' | 'background';
  target: 'popup' | 'content' | 'background';
}

// コンテンツ抽出関連メッセージ
export interface ContentExtractionRequest extends MessageBase {
  type: 'EXTRACT_CONTENT';
  payload: {
    url: string;
    extractionMethod: 'semantic' | 'readability' | 'heuristic' | 'vision';
  };
}

export interface ContentExtractionResponse extends MessageBase {
  type: 'CONTENT_EXTRACTED';
  payload: {
    success: boolean;
    content?: {
      title: string;
      text: string;
      url: string;
      extractionMethod: string;
      quality: {
        readability: number;
        completeness: number;
        structure: number;
        relevance: number;
      };
    };
    error?: string;
  };
}

// 要約生成関連メッセージ
export interface SummarizeRequest extends MessageBase {
  type: 'SUMMARIZE_CONTENT';
  payload: {
    content: string;
    title: string;
    url: string;
    options: {
      length: 'short' | 'medium' | 'long';
      style: 'bullet' | 'paragraph' | 'structured';
      language: 'japanese';
    };
  };
}

export interface SummarizeResponse extends MessageBase {
  type: 'SUMMARY_GENERATED';
  payload: {
    success: boolean;
    summary?: {
      content: string;
      title: string;
      url: string;
      timestamp: number;
      options: {
        length: string;
        style: string;
        language: string;
      };
    };
    error?: string;
  };
}

// ストレージ関連メッセージ
export interface SaveSummaryRequest extends MessageBase {
  type: 'SAVE_SUMMARY';
  payload: {
    summary: {
      id: string;
      content: string;
      title: string;
      url: string;
      timestamp: number;
      options: any;
    };
  };
}

export interface SaveSummaryResponse extends MessageBase {
  type: 'SUMMARY_SAVED';
  payload: {
    success: boolean;
    savedId?: string;
    error?: string;
  };
}

// 設定関連メッセージ
export interface GetSettingsRequest extends MessageBase {
  type: 'GET_SETTINGS';
}

export interface GetSettingsResponse extends MessageBase {
  type: 'SETTINGS_RETRIEVED';
  payload: {
    success: boolean;
    settings?: {
      apiKey: string;
      defaultLength: string;
      defaultStyle: string;
      autoSave: boolean;
    };
    error?: string;
  };
}

export interface UpdateSettingsRequest extends MessageBase {
  type: 'UPDATE_SETTINGS';
  payload: {
    settings: {
      apiKey?: string;
      defaultLength?: string;
      defaultStyle?: string;
      autoSave?: boolean;
    };
  };
}

export interface UpdateSettingsResponse extends MessageBase {
  type: 'SETTINGS_UPDATED';
  payload: {
    success: boolean;
    error?: string;
  };
}

// ユニオン型
export type Message = 
  | ContentExtractionRequest
  | ContentExtractionResponse
  | SummarizeRequest
  | SummarizeResponse
  | SaveSummaryRequest
  | SaveSummaryResponse
  | GetSettingsRequest
  | GetSettingsResponse
  | UpdateSettingsRequest
  | UpdateSettingsResponse;

// エラーハンドリング
export interface ErrorMessage extends MessageBase {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}

// メッセージレスポンス
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
} 