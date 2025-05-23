# 🎨🎨🎨 ENTERING CREATIVE PHASE: ALGORITHM DESIGN - コンテンツ抽出アルゴリズム

## コンポーネント説明
Webページから要約に適したメインコンテンツを効率的に抽出するアルゴリズム。ノイズ（広告、ナビゲーション、フッターなど）を除去し、記事本文、段落構造、見出し階層を識別して構造化されたコンテンツを取得する高精度抽出システムです。

## 要件と制約

### 機能要件
- **コンテンツ識別**: メイン記事とサイドバー・広告の自動判別
- **構造保持**: 見出し・段落・リストの階層構造維持
- **ノイズ除去**: ナビゲーション・広告・フッターの除外
- **多様性対応**: ニュースサイト・ブログ・技術文書・学術論文への対応
- **メタデータ抽出**: タイトル・著者・公開日・URL等の付加情報取得

### 技術制約
- **DOM API制約**: Content Script内でのDOM操作パフォーマンス
- **メモリ制限**: 大規模ページでのメモリ使用量最適化
- **実行時間制限**: 3秒以内でのコンテンツ抽出完了
- **権限制約**: Content Security Policy準拠

### 精度要件
- **抽出精度**: 95%以上のメインコンテンツ識別率
- **誤検知率**: 5%以下のノイズ混入率
- **構造維持率**: 90%以上の見出し・段落構造保持
- **多言語対応**: 日本語・英語を中心とした言語判別

## 設計オプション分析

### オプション1: ルールベース・ヒューリスティック抽出
```javascript
class RuleBasedExtractor {
  constructor() {
    this.contentSelectors = [
      'article', 'main', '.content', '.post-content',
      '.entry-content', '.article-body', '.story-body'
    ];
    
    this.noiseSelectors = [
      'nav', 'header', 'footer', 'aside', '.sidebar',
      '.advertisement', '.social-share', '.related-posts'
    ];
    
    this.scoreWeights = {
      textLength: 0.3,
      paragraphCount: 0.2,
      linkDensity: -0.4,
      classNameScore: 0.3,
      positionScore: 0.2
    };
  }
  
  extractContent(document) {
    const candidates = this.findCandidateElements(document);
    const scored = candidates.map(el => ({
      element: el,
      score: this.calculateScore(el)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return this.cleanContent(scored[0]?.element);
  }
  
  calculateScore(element) {
    const textLength = this.getTextLength(element);
    const paragraphCount = element.querySelectorAll('p').length;
    const linkDensity = this.calculateLinkDensity(element);
    const classNameScore = this.evaluateClassName(element);
    const positionScore = this.calculatePositionScore(element);
    
    return (
      textLength * this.scoreWeights.textLength +
      paragraphCount * this.scoreWeights.paragraphCount +
      linkDensity * this.scoreWeights.linkDensity +
      classNameScore * this.scoreWeights.classNameScore +
      positionScore * this.scoreWeights.positionScore
    );
  }
}
```

**プロス:**
- 実装の簡潔性と理解しやすさ
- 高速な実行性能
- デバッグとチューニングの容易性
- 特定サイトへのカスタマイズ可能性

**コンス:**
- サイト構造変更への脆弱性
- 新しいレイアウトパターンへの対応困難
- 精度の頭打ち
- 手動チューニングの必要性

### オプション2: 機械学習・特徴量ベース抽出
```javascript
class MLBasedExtractor {
  constructor() {
    this.model = new ContentClassificationModel();
    this.featureExtractor = new DOMFeatureExtractor();
  }
  
  async extractContent(document) {
    const elements = this.getAllElements(document);
    const features = await Promise.all(
      elements.map(el => this.featureExtractor.extract(el))
    );
    
    const predictions = await this.model.predict(features);
    const contentElements = elements.filter(
      (el, i) => predictions[i].isContent > 0.7
    );
    
    return this.assembleContent(contentElements);
  }
  
  extractFeatures(element) {
    return {
      // Structural features
      tagName: element.tagName.toLowerCase(),
      depth: this.getDepth(element),
      siblingCount: element.parentNode?.children.length || 0,
      childCount: element.children.length,
      
      // Content features
      textLength: this.getTextLength(element),
      wordCount: this.getWordCount(element),
      sentenceCount: this.getSentenceCount(element),
      linkDensity: this.calculateLinkDensity(element),
      
      // Style features
      fontSize: this.getFontSize(element),
      isVisible: this.isVisible(element),
      backgroundColor: this.getBackgroundColor(element),
      
      // Semantic features
      hasContentKeywords: this.hasContentKeywords(element),
      hasNavigationKeywords: this.hasNavigationKeywords(element),
      languageConfidence: this.detectLanguage(element)
    };
  }
}
```

**プロス:**
- 高い抽出精度の可能性
- 新パターンへの自動適応
- 多様なサイトへの汎用性
- 継続的な精度向上

**コンス:**
- モデル学習の複雑性
- ブラウザ環境での実行困難
- リソース消費量の増大
- 予測不可能な動作

### オプション3: Mozilla Readability・最適化アプローチ
```javascript
class ReadabilityBasedExtractor {
  constructor() {
    this.readability = new Readability();
    this.preprocessors = [
      new AdBlockPreprocessor(),
      new StructureNormalizer(),
      new LanguageDetector()
    ];
    this.postprocessors = [
      new ContentCleaner(),
      new StructureEnhancer(),
      new MetadataExtractor()
    ];
  }
  
  extractContent(document) {
    // Preprocessing
    let processedDoc = document.cloneNode(true);
    for (const preprocessor of this.preprocessors) {
      processedDoc = preprocessor.process(processedDoc);
    }
    
    // Core extraction
    const article = this.readability.parse(processedDoc);
    
    if (!article) {
      return this.fallbackExtraction(document);
    }
    
    // Postprocessing
    let content = article.content;
    for (const postprocessor of this.postprocessors) {
      content = postprocessor.process(content, article);
    }
    
    return {
      content: content,
      title: article.title,
      byline: article.byline,
      excerpt: article.excerpt,
      length: article.length,
      dir: article.dir,
      lang: article.lang
    };
  }
  
  fallbackExtraction(document) {
    // Simple heuristic fallback
    const candidates = document.querySelectorAll(
      'p, article, .content, .post, .entry'
    );
    
    let bestCandidate = null;
    let maxScore = 0;
    
    candidates.forEach(candidate => {
      const score = this.calculateSimpleScore(candidate);
      if (score > maxScore) {
        maxScore = score;
        bestCandidate = candidate;
      }
    });
    
    return this.cleanAndStructure(bestCandidate);
  }
}
```

**プロス:**
- 実証済みの高い精度
- 幅広いサイト対応
- アクティブな開発・メンテナンス
- カスタマイズと拡張性

**コンス:**
- 外部ライブラリ依存
- バンドルサイズの増加
- ライセンス考慮事項
- カスタマイズの複雑性

### オプション4: ハイブリッド・多段階抽出
```javascript
class HybridContentExtractor {
  constructor() {
    this.extractors = [
      new SemanticHTMLExtractor(),    // HTML5セマンティック要素
      new ReadabilityExtractor(),     // Mozilla Readability
      new HeuristicExtractor(),       // ルールベース
      new VisionBasedExtractor()      // 視覚的レイアウト分析
    ];
    
    this.confidenceThreshold = 0.8;
    this.consensusThreshold = 0.6;
  }
  
  async extractContent(document) {
    const results = await Promise.all(
      this.extractors.map(extractor => 
        this.runWithTimeout(extractor.extract(document), 2000)
      )
    );
    
    const validResults = results.filter(r => r && r.confidence > 0.3);
    
    if (validResults.length === 0) {
      return this.emergencyFallback(document);
    }
    
    // Confidence-based selection
    const highConfidenceResult = validResults.find(
      r => r.confidence > this.confidenceThreshold
    );
    
    if (highConfidenceResult) {
      return this.enhanceResult(highConfidenceResult);
    }
    
    // Consensus-based merging
    return this.mergeResults(validResults);
  }
  
  mergeResults(results) {
    const contentBlocks = new Map();
    
    results.forEach(result => {
      result.blocks.forEach(block => {
        const signature = this.getBlockSignature(block);
        if (!contentBlocks.has(signature)) {
          contentBlocks.set(signature, { block, votes: 0 });
        }
        contentBlocks.get(signature).votes++;
      });
    });
    
    const consensusBlocks = Array.from(contentBlocks.values())
      .filter(item => item.votes / results.length >= this.consensusThreshold)
      .map(item => item.block)
      .sort((a, b) => a.position - b.position);
    
    return {
      content: this.assembleBlocks(consensusBlocks),
      confidence: this.calculateMergedConfidence(consensusBlocks, results),
      metadata: this.mergeMetadata(results)
    };
  }
}
```

**プロス:**
- 複数手法の補完による高精度
- 失敗時のフォールバック機能
- 手法別の最適化可能性
- 将来的な手法追加対応

**コンス:**
- 実装の複雑性
- 計算コストの増大
- デバッグの困難性
- 一貫性のない結果の可能性

## 推奨アプローチ: オプション4（ハイブリッド・多段階抽出）

### 選択理由
1. **精度最適化**: 複数アルゴリズムの長所を活用した最高精度実現
2. **ロバスト性**: 単一手法の失敗時における安定した代替機能
3. **適応性**: 多様なWebサイト構造への柔軟な対応
4. **将来性**: 新しい抽出手法の追加・入れ替えが容易
5. **品質保証**: 複数手法の合意による結果の信頼性向上

### 詳細アルゴリズム設計

#### セマンティックHTML抽出器
```javascript
class SemanticHTMLExtractor {
  constructor() {
    this.semanticSelectors = {
      primary: ['article', 'main'],
      secondary: ['section', '.content', '.post-content'],
      supporting: ['header', 'aside', 'footer'],
      metadata: ['time', '.author', '.byline', '.published']
    };
  }
  
  extract(document) {
    const result = {
      content: null,
      confidence: 0,
      metadata: {},
      structure: []
    };
    
    // Primary semantic elements
    const primaryElements = this.findElements(document, this.semanticSelectors.primary);
    if (primaryElements.length > 0) {
      result.content = this.selectBestElement(primaryElements);
      result.confidence = 0.9;
      result.structure = this.extractStructure(result.content);
      return result;
    }
    
    // Secondary semantic elements
    const secondaryElements = this.findElements(document, this.semanticSelectors.secondary);
    if (secondaryElements.length > 0) {
      result.content = this.selectBestElement(secondaryElements);
      result.confidence = 0.7;
      result.structure = this.extractStructure(result.content);
      return result;
    }
    
    result.confidence = 0.1;
    return result;
  }
  
  extractStructure(element) {
    const structure = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          return ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'BLOCKQUOTE']
            .includes(node.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      structure.push({
        type: node.tagName.toLowerCase(),
        text: node.textContent.trim(),
        level: node.tagName.startsWith('H') ? parseInt(node.tagName[1]) : 0,
        position: this.getElementPosition(node)
      });
    }
    
    return structure;
  }
}
```

#### 視覚ベース抽出器
```javascript
class VisionBasedExtractor {
  constructor() {
    this.visualFeatures = {
      textDensity: 0.3,
      fontSize: 0.2,
      positioning: 0.2,
      whitespace: 0.15,
      contrast: 0.15
    };
  }
  
  extract(document) {
    const elements = this.getAllTextElements(document);
    const visualMap = this.createVisualMap(elements);
    
    const contentRegions = this.identifyContentRegions(visualMap);
    const bestRegion = this.selectBestContentRegion(contentRegions);
    
    return {
      content: bestRegion.element,
      confidence: bestRegion.score,
      visualMetrics: bestRegion.metrics,
      boundingBox: bestRegion.boundingBox
    };
  }
  
  createVisualMap(elements) {
    return elements.map(element => {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      return {
        element,
        boundingBox: rect,
        textDensity: this.calculateTextDensity(element, rect),
        fontSize: parseFloat(computedStyle.fontSize),
        fontWeight: computedStyle.fontWeight,
        lineHeight: parseFloat(computedStyle.lineHeight),
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        marginTop: parseFloat(computedStyle.marginTop),
        marginBottom: parseFloat(computedStyle.marginBottom),
        padding: parseFloat(computedStyle.padding),
        isVisible: rect.width > 0 && rect.height > 0,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      };
    });
  }
  
  identifyContentRegions(visualMap) {
    const regions = [];
    const gridSize = 100; // 100px grid
    const grid = new Map();
    
    // Group elements by grid position
    visualMap.forEach(item => {
      const gridX = Math.floor(item.centerX / gridSize);
      const gridY = Math.floor(item.centerY / gridSize);
      const key = `${gridX},${gridY}`;
      
      if (!grid.has(key)) {
        grid.set(key, []);
      }
      grid.get(key).push(item);
    });
    
    // Analyze each grid cell
    grid.forEach((items, key) => {
      const region = this.analyzeGridRegion(items);
      if (region.score > 0.3) {
        regions.push(region);
      }
    });
    
    return regions;
  }
  
  analyzeGridRegion(items) {
    const totalText = items.reduce((sum, item) => 
      sum + (item.element.textContent?.length || 0), 0);
    const avgFontSize = items.reduce((sum, item) => 
      sum + item.fontSize, 0) / items.length;
    const densityScore = totalText / (items.length * 100);
    
    return {
      items,
      totalText,
      avgFontSize,
      densityScore,
      score: this.calculateRegionScore(items, totalText, avgFontSize, densityScore)
    };
  }
}
```

#### コンテンツ品質評価器
```javascript
class ContentQualityAssessment {
  constructor() {
    this.qualityMetrics = {
      readability: 0.25,
      completeness: 0.25,
      structure: 0.25,
      relevance: 0.25
    };
  }
  
  assessQuality(content, metadata) {
    const assessment = {
      readability: this.assessReadability(content),
      completeness: this.assessCompleteness(content, metadata),
      structure: this.assessStructure(content),
      relevance: this.assessRelevance(content, metadata),
      overallScore: 0,
      issues: [],
      recommendations: []
    };
    
    assessment.overallScore = Object.entries(this.qualityMetrics)
      .reduce((score, [metric, weight]) => 
        score + assessment[metric] * weight, 0);
    
    this.generateRecommendations(assessment);
    
    return assessment;
  }
  
  assessReadability(content) {
    const text = this.extractText(content);
    const sentences = this.splitSentences(text);
    const words = this.splitWords(text);
    
    if (sentences.length === 0 || words.length === 0) return 0;
    
    // Simplified readability metrics
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = this.countSyllables(words) / words.length;
    
    // Flesch Reading Ease (simplified)
    const fleschScore = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
    
    return Math.max(0, Math.min(1, fleschScore / 100));
  }
  
  assessCompleteness(content, metadata) {
    const hasTitle = metadata.title && metadata.title.length > 10;
    const hasSubstantialContent = content.textContent.length > 500;
    const hasStructure = content.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
    const hasParagraphs = content.querySelectorAll('p').length > 2;
    
    const completenessFactors = [hasTitle, hasSubstantialContent, hasStructure, hasParagraphs];
    return completenessFactors.filter(Boolean).length / completenessFactors.length;
  }
  
  assessStructure(content) {
    const headings = Array.from(content.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const paragraphs = Array.from(content.querySelectorAll('p'));
    const lists = Array.from(content.querySelectorAll('ul, ol'));
    
    let structureScore = 0;
    
    // Heading hierarchy
    if (headings.length > 0) {
      const hasHierarchy = this.checkHeadingHierarchy(headings);
      structureScore += hasHierarchy ? 0.3 : 0.1;
    }
    
    // Content ratio
    const contentRatio = paragraphs.length / (content.children.length || 1);
    structureScore += contentRatio * 0.4;
    
    // List usage
    if (lists.length > 0) {
      structureScore += 0.2;
    }
    
    // Link density (lower is better for main content)
    const linkDensity = content.querySelectorAll('a').length / paragraphs.length;
    structureScore += linkDensity < 0.3 ? 0.1 : 0;
    
    return Math.min(1, structureScore);
  }
}
```

### 実装ガイドライン

#### パフォーマンス最適化
```javascript
class PerformanceOptimizedExtractor {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 50;
    this.timeoutMs = 3000;
  }
  
  async extract(document) {
    const cacheKey = this.generateCacheKey(document);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const result = await Promise.race([
      this.performExtraction(document),
      this.createTimeoutPromise()
    ]);
    
    this.updateCache(cacheKey, result);
    return result;
  }
  
  generateCacheKey(document) {
    // Simple hash based on URL and content structure
    const url = document.location.href;
    const headingCount = document.querySelectorAll('h1, h2, h3').length;
    const paragraphCount = document.querySelectorAll('p').length;
    
    return `${url}_${headingCount}_${paragraphCount}`;
  }
  
  createTimeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Extraction timeout')), this.timeoutMs);
    });
  }
  
  updateCache(key, result) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
  }
}
```

#### エラーハンドリング・フォールバック
```javascript
class RobustContentExtractor {
  constructor() {
    this.fallbackStrategies = [
      this.extractFromMainElement,
      this.extractFromArticleTag,
      this.extractFromLargestTextBlock,
      this.extractFromCommonSelectors,
      this.extractFromBodyContent
    ];
  }
  
  async extract(document) {
    for (let i = 0; i < this.fallbackStrategies.length; i++) {
      try {
        const result = await this.fallbackStrategies[i].call(this, document);
        
        if (this.isValidResult(result)) {
          return {
            ...result,
            extractionMethod: i + 1,
            confidence: Math.max(0.1, result.confidence - i * 0.2)
          };
        }
      } catch (error) {
        console.warn(`Extraction strategy ${i + 1} failed:`, error);
        continue;
      }
    }
    
    return this.createEmptyResult();
  }
  
  isValidResult(result) {
    return result && 
           result.content && 
           result.content.textContent.trim().length > 100 &&
           result.confidence > 0.1;
  }
  
  createEmptyResult() {
    return {
      content: null,
      confidence: 0,
      error: 'All extraction strategies failed',
      metadata: {},
      extractionMethod: 'none'
    };
  }
}
```

## 検証チェックポイント

### 精度検証
- [ ] 95%以上のメインコンテンツ識別率が達成されているか
- [ ] 5%以下のノイズ混入率が維持されているか
- [ ] 見出し・段落構造が適切に保持されているか
- [ ] 多様なサイト構造で一貫した結果が得られるか

### パフォーマンス検証
- [ ] 3秒以内でコンテンツ抽出が完了するか
- [ ] 大規模ページでメモリ使用量が適切に制御されているか
- [ ] キャッシュ機能が効率的に動作するか
- [ ] タイムアウト機能が適切に機能するか

### ロバスト性検証
- [ ] JavaScript動的コンテンツに対応できるか
- [ ] 複雑なレイアウト（multi-column等）を処理できるか
- [ ] 抽出失敗時のフォールバック機能が動作するか
- [ ] 異常なページ構造でもクラッシュしないか

### 多言語対応検証
- [ ] 日本語コンテンツが適切に処理されるか
- [ ] 英語コンテンツの精度が維持されているか
- [ ] 混在言語コンテンツが適切に処理されるか
- [ ] RTL言語（アラビア語等）での基本動作が確保されているか

🎨🎨🎨 EXITING CREATIVE PHASE: コンテンツ抽出アルゴリズム設計完了 