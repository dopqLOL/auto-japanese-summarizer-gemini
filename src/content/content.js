/**
 * Content Script - Hybrid Multi-Stage Text Extraction
 * Implementation of creative design decisions from memory-bank/creative/
 */

class ContentExtractor {
  constructor() {
    this.isInitialized = false;
    this.extractionCache = new Map();
    this.init();
  }

  init() {
    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'EXTRACT_CONTENT') {
        this.handleContentExtractionRequest(request, sendResponse);
        return true; // Keep message channel open for async response
      }
    });

    this.isInitialized = true;
    console.log('Japanese Text Summarizer Content Script initialized');
  }

  /**
   * Handle content extraction requests
   * @param {Object} request - Message request object
   * @param {Function} sendResponse - Response callback
   */
  async handleContentExtractionRequest(request, sendResponse) {
    try {
      const extractedText = await this.extractTextContent(request.options || {});
      
      sendResponse({
        success: true,
        data: {
          text: extractedText,
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString(),
          extractionMethod: 'hybrid-multi-stage'
        }
      });
    } catch (error) {
      console.error('Content extraction failed:', error);
      sendResponse({
        success: false,
        error: error.message,
        data: null
      });
    }
  }

  /**
   * Hybrid Multi-Stage Text Extraction
   * Stage 1: Semantic Content Detection
   * Stage 2: Structured Content Extraction  
   * Stage 3: Fallback Text Extraction
   * Stage 4: Text Quality Enhancement
   */
  async extractTextContent(options = {}) {
    const cacheKey = this.generateCacheKey(options);
    
    // Check cache first
    if (this.extractionCache.has(cacheKey)) {
      return this.extractionCache.get(cacheKey);
    }

    // Stage 1: Semantic Content Detection
    let extractedText = this.semanticContentDetection();
    
    // Stage 2: Structured Content Extraction (if Stage 1 insufficient)
    if (!this.isTextQualitySufficient(extractedText)) {
      extractedText = this.structuredContentExtraction();
    }
    
    // Stage 3: Fallback Text Extraction (if Stage 2 insufficient)
    if (!this.isTextQualitySufficient(extractedText)) {
      extractedText = this.fallbackTextExtraction();
    }
    
    // Stage 4: Text Quality Enhancement
    const enhancedText = this.enhanceTextQuality(extractedText, options);
    
    // Cache result
    this.extractionCache.set(cacheKey, enhancedText);
    
    return enhancedText;
  }

  /**
   * Stage 1: Semantic Content Detection
   * Prioritize main content areas using semantic HTML
   */
  semanticContentDetection() {
    const semanticSelectors = [
      'main',
      'article', 
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content'
    ];

    for (const selector of semanticSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = this.extractTextFromElement(element);
        if (this.isTextQualitySufficient(text)) {
          return text;
        }
      }
    }

    return '';
  }

  /**
   * Stage 2: Structured Content Extraction
   * Target common content patterns
   */
  structuredContentExtraction() {
    const contentSelectors = [
      'h1, h2, h3, h4, h5, h6',
      'p',
      '.description',
      '.summary',
      '.excerpt',
      '.lead',
      'blockquote'
    ];

    let extractedText = '';
    
    contentSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = this.extractTextFromElement(element);
        if (text.trim().length > 10) { // Minimum length filter
          extractedText += text + '\n\n';
        }
      });
    });

    return extractedText.trim();
  }

  /**
   * Stage 3: Fallback Text Extraction
   * Extract all visible text as last resort
   */
  fallbackTextExtraction() {
    // Remove script and style elements
    const excludeElements = document.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .menu');
    excludeElements.forEach(el => el.remove());

    // Get body text
    return document.body ? this.extractTextFromElement(document.body) : '';
  }

  /**
   * Stage 4: Text Quality Enhancement
   * Clean and normalize extracted text
   */
  enhanceTextQuality(text, options = {}) {
    if (!text) return '';

    let enhanced = text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove repeated newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim each line
      .split('\n').map(line => line.trim()).join('\n')
      // Remove empty lines
      .replace(/^\s*\n/gm, '')
      .trim();

    // Apply length limits if specified
    if (options.maxLength && enhanced.length > options.maxLength) {
      enhanced = enhanced.substring(0, options.maxLength) + '...';
    }

    // Ensure minimum content quality
    if (enhanced.length < 50) {
      // Try one more time with a broader approach
      enhanced = this.broadTextExtraction();
    }

    return enhanced;
  }

  /**
   * Extract text from a specific element
   * @param {Element} element - DOM element
   * @returns {string} - Extracted text
   */
  extractTextFromElement(element) {
    if (!element) return '';

    // Clone element to avoid modifying original
    const clone = element.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'noscript',
      '.advertisement', '.ads', '.sidebar',
      '.navigation', '.nav', '.menu',
      '.social-share', '.related-posts',
      '.comments', '.comment-form'
    ];
    
    unwantedSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    return clone.textContent || clone.innerText || '';
  }

  /**
   * Broad text extraction for minimum content scenarios
   */
  broadTextExtraction() {
    const allTextElements = document.querySelectorAll('p, div, span, td, th, li, h1, h2, h3, h4, h5, h6');
    let text = '';
    
    allTextElements.forEach(element => {
      const elementText = element.textContent || element.innerText || '';
      if (elementText.trim().length > 20) {
        text += elementText.trim() + '\n';
      }
    });

    return text.trim();
  }

  /**
   * Check if extracted text meets quality standards
   * @param {string} text - Text to evaluate
   * @returns {boolean} - Quality assessment
   */
  isTextQualitySufficient(text) {
    if (!text || typeof text !== 'string') return false;
    
    const trimmedText = text.trim();
    
    // Minimum length requirement
    if (trimmedText.length < 100) return false;
    
    // Check for actual content (not just whitespace/punctuation)
    const meaningfulChars = trimmedText.replace(/[\s\n\r\t.,!?;:]/g, '');
    if (meaningfulChars.length < 50) return false;
    
    // Check for Japanese content (since this is a Japanese summarizer)
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    const hasJapanese = japanesePattern.test(trimmedText);
    
    // If there's Japanese content, prefer it
    if (hasJapanese && trimmedText.length > 50) return true;
    
    // For non-Japanese content, higher standards
    return trimmedText.length > 200;
  }

  /**
   * Generate cache key for extraction options
   */
  generateCacheKey(options) {
    return `${window.location.href}:${JSON.stringify(options)}:${document.lastModified}`;
  }

  /**
   * Clear extraction cache
   */
  clearCache() {
    this.extractionCache.clear();
  }

  /**
   * Get extraction statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.extractionCache.size,
      url: window.location.href,
      title: document.title
    };
  }
}

// Initialize content extractor
const contentExtractor = new ContentExtractor();

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentExtractor;
} 