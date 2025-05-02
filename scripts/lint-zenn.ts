import fs from "fs";
import path from "path";
import matter from "gray-matter";
import * as glob from "glob";
import yaml from "js-yaml";

/**
 * Zenn Frontmatter Linter
 *
 * このスクリプトは、Zenn向けの記事(articles)および本(books)のフロントマタープロパティを
 * 検証・整形するためのツールです。
 *
 * 機能:
 * 1. フロントマタープロパティの必須チェック (コンテンツタイプ別)
 * 2. プロパティの順序チェック
 * 3. slugの形式チェック
 * 4. 本のconfig.yamlのチェック
 * 5. 章の番号付けとファイル名のチェック
 * 6. 自動修正機能 (--fixオプション付きで実行時)
 * 7. カスタム設定ファイルのサポート
 *
 * 使用方法:
 * - 検証のみ: npm run lint:zenn または ts-node scripts/lint-zenn.ts
 * - 自動修正: npm run lint:zenn:fix または ts-node scripts/lint-zenn.ts --fix
 */

// 設定インターフェース
interface LintConfig {
  propertyOrder: string[];
  requiredProperties: {
    [key: string]: string[];
  };
  bookConfigRequiredProperties: string[];
  contentPattern: string;
  contentTypePatterns: {
    [key: string]: string[];
  };
}

// デフォルト設定
const DEFAULT_CONFIG: LintConfig = {
  // フロントマタープロパティの推奨順序
  propertyOrder: [
    "title",
    "emoji",
    "type",
    "topics",
    "published",
    "published_at"
  ],
  
  // コンテンツタイプ別の必須プロパティ
  requiredProperties: {
    article: ["title", "emoji", "type", "topics", "published"],
    bookChapter: ["title"],
    default: ["title", "published"]
  },
  
  // 本のconfig.yamlの必須プロパティ
  bookConfigRequiredProperties: [
    "title",
    "summary",
    "topics",
    "published",
    "price",
    "chapters"
  ],
  
  // 検索パターン
  contentPattern: "articles/**/*.md",
  
  // コンテンツタイプ判定パターン
  contentTypePatterns: {
    article: ["articles/"],
    bookChapter: ["books/"]
  }
};

// 設定の読み込み
let config: LintConfig = DEFAULT_CONFIG;
try {
  if (fs.existsSync('./zenn-lint.config.json')) {
    const userConfig = JSON.parse(fs.readFileSync('./zenn-lint.config.json', 'utf8'));
    config = { ...DEFAULT_CONFIG, ...userConfig };
    console.log('カスタム設定ファイルを読み込みました');
  }
} catch (error) {
  console.error('設定ファイルの読み込みに失敗しました:', error);
}

// 検証結果を表すインターフェース
interface LintResult {
  file: string; // ファイルパス
  contentType: string; // コンテンツタイプ
  missing: string[]; // 不足しているプロパティのリスト
  wrongOrder: boolean; // 順序が正しくないかどうか
  currentOrder: string[]; // 現在のプロパティ順序
  invalidSlug?: boolean; // スラッグが無効かどうか
  slugError?: string; // スラッグエラーの詳細
}

// 本のconfig.yamlの検証結果
interface BookConfigLintResult {
  dir: string; // 本のディレクトリパス
  missing: string[]; // 不足しているプロパティのリスト
  missingConfigFile: boolean; // config.yamlが存在しないかどうか
  invalidChapters?: boolean; // チャプター設定が無効かどうか
  chaptersError?: string; // チャプターエラーの詳細
  duplicateChapterSlug?: boolean; // 重複したチャプタースラッグがあるかどうか
  duplicateChapterNames?: string[]; // 重複したチャプター名のリスト
}

// フロントマターデータの型定義
interface FrontmatterData {
  [key: string]: unknown;
}

/**
 * ファイルパスからコンテンツタイプを判定する
 * @param filePath ファイルパス
 * @returns コンテンツタイプ (設定ファイルで定義されたもの、またはデフォルト)
 */
function getContentType(filePath: string): string {
  const typePatterns = config.contentTypePatterns || {};
  
  // Windows向けにファイルパスの区切り文字を統一
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  for (const [type, patterns] of Object.entries(typePatterns)) {
    if (Array.isArray(patterns) && patterns.some(pattern => normalizedPath.includes(pattern))) {
      return type;
    }
  }

  // デフォルトタイプを返す
  return "default";
}

/**
 * スラッグが有効かチェックする
 * Zennのスラッグは a-z0-9、ハイフン(-)、アンダースコア(_) の12〜50字の組み合わせ
 * @param slug チェックするスラッグ
 * @returns 有効な場合はtrue、そうでない場合はfalse
 */
function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9_-]{12,50}$/;
  return slugRegex.test(slug);
}

/**
 * ファイル名がチャプター番号形式かどうかをチェックする
 * 形式: 数字.スラッグ.md
 * @param fileName ファイル名
 * @returns 
 */
function isNumberedChapterFileName(fileName: string): boolean {
  const chapterNumberPattern = /^\d+\.[a-z0-9_-]+\.md$/;
  return chapterNumberPattern.test(fileName);
}

/**
 * ファイルパスからスラッグを抽出する
 * @param filePath ファイルパス
 * @returns スラッグ
 */
function extractSlugFromPath(filePath: string): string {
  // ファイル名を取得（拡張子なし）
  const fileName = path.basename(filePath, path.extname(filePath));
  return fileName;
}

/**
 * 番号付きチャプターファイル名からスラッグ部分を抽出する
 * 例: "1.intro.md" -> "intro"
 * @param fileName ファイル名
 * @returns スラッグ部分
 */
function extractSlugFromNumberedChapter(fileName: string): string {
  // 数字.スラッグ.md の形式から、スラッグ部分を抽出
  const match = fileName.match(/^\d+\.([a-z0-9_-]+)\.md$/);
  if (match && match[1]) {
    return match[1];
  }
  return fileName;
}

/**
 * マークダウンファイルのフロントマターを検証する
 * @param filePath 検証対象のファイルパス
 * @returns 検証結果、またはエラー時はnull
 */
function lintZennFrontmatter(filePath: string): LintResult | null {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const { data } = matter(content);

    const contentType = getContentType(filePath);
    const requiredProps = config.requiredProperties[contentType] || [];

    // 必須プロパティのチェック
    const missing = requiredProps.filter((prop: string) => !(prop in data));

    // プロパティ順序のチェック
    const currentProps = Object.keys(data);
    const propertyOrder = config.propertyOrder || [];

    // 順序チェック
    const isInCorrectOrder = currentProps.every((prop, index, arr) => {
      if (index === 0) return true;

      const prevProp = arr[index - 1];
      const prevPropIndex = propertyOrder.indexOf(prevProp);
      const currentPropIndex = propertyOrder.indexOf(prop);

      // リストにないプロパティは順序チェックの対象外
      if (prevPropIndex === -1 || currentPropIndex === -1) return true;

      return prevPropIndex < currentPropIndex;
    });

    let result: LintResult = {
      file: filePath,
      contentType,
      missing,
      wrongOrder: !isInCorrectOrder,
      currentOrder: currentProps,
    };

    // articlesディレクトリ内のファイルの場合、スラッグをチェック
    if (contentType === 'article') {
      const slug = extractSlugFromPath(filePath);
      if (!isValidSlug(slug)) {
        result.invalidSlug = true;
        result.slugError = `スラッグ "${slug}" は無効です。a-z0-9、ハイフン(-)、アンダースコア(_)の12〜50字の組み合わせにする必要があります。`;
      }
    }

    return result;
  } catch (error) {
    console.error(`${filePath} の処理中にエラーが発生しました:`, error);
    return null;
  }
}

/**
 * 本のconfig.yamlファイルを検証する
 * @param bookDir 本のディレクトリパス
 * @returns 検証結果
 */
function lintBookConfig(bookDir: string): BookConfigLintResult {
  const configPath = path.join(bookDir, 'config.yaml');
  const result: BookConfigLintResult = {
    dir: bookDir,
    missing: [],
    missingConfigFile: false
  };

  if (!fs.existsSync(configPath)) {
    result.missingConfigFile = true;
    return result;
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const configData = yaml.load(configContent) as Record<string, unknown>;

    // 必須プロパティのチェック
    const missingProps = [];
    for (const prop of config.bookConfigRequiredProperties) {
      if (!(prop in configData)) {
        missingProps.push(prop);
      }
    }
    
    result.missing = missingProps;

    // chaptersの配列形式チェック
    if ('chapters' in configData) {
      const chapters = configData.chapters;
      
      // chapters が配列かどうかチェック
      if (chapters !== null && typeof chapters !== 'undefined' && !Array.isArray(chapters)) {
        result.invalidChapters = true;
        result.chaptersError = 'chaptersプロパティは配列である必要があります。';
        return result;
      }
      
      // chapters が空配列の場合は、番号付きファイル名での順序付けを使用する
      // これは有効な使用方法なのでエラーとしない
      if (Array.isArray(chapters) && chapters.length === 0) {
        // ファイル名の番号での順序付けをチェック
        checkNumberedChapterFiles(bookDir, result);
        return result;
      }
      
      // chapters に要素がある場合は、各チャプターを検証
      if (Array.isArray(chapters) && chapters.length > 0) {
        // 各チャプターがfile, titleプロパティを持っているかチェック
        const invalidChapter = chapters.find((chapter: any) => 
          typeof chapter !== 'object' || !('file' in chapter) || !('title' in chapter)
        );
        
        if (invalidChapter) {
          result.invalidChapters = true;
          result.chaptersError = '各チャプターは file および title プロパティを持つ必要があります。';
        }
        
        // 重複したスラッグがないかチェック
        const slugs = new Set<string>();
        const duplicateSlugs: string[] = [];
        
        if (Array.isArray(chapters)) {
          chapters.forEach((chapter: any) => {
            if (chapter && chapter.file) {
              const slug = path.basename(chapter.file, path.extname(chapter.file));
              if (slugs.has(slug)) {
                duplicateSlugs.push(slug);
              } else {
                slugs.add(slug);
              }
            }
          });
        }
        
        if (duplicateSlugs.length > 0) {
          result.duplicateChapterSlug = true;
          result.duplicateChapterNames = duplicateSlugs;
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`${configPath} の処理中にエラーが発生しました:`, error);
    result.missing = config.bookConfigRequiredProperties; // 全てのプロパティが不足しているとみなす
    return result;
  }
}

/**
 * 番号付きチャプターファイルをチェックする
 * @param bookDir 本のディレクトリパス
 * @param result 検証結果
 */
function checkNumberedChapterFiles(bookDir: string, result: BookConfigLintResult): void {
  // ディレクトリ内のmdファイルを取得
  const mdFiles = fs.readdirSync(bookDir)
    .filter(file => file.endsWith('.md'))
    .sort();
  
  if (mdFiles.length === 0) {
    result.invalidChapters = true;
    result.chaptersError = 'チャプターとなるMarkdownファイルが見つかりません。';
    return;
  }
  
  // 全てのファイルが番号付き形式かチェック
  const nonNumberedFiles = mdFiles.filter(file => !isNumberedChapterFileName(file));
  
  if (nonNumberedFiles.length > 0 && nonNumberedFiles.length !== mdFiles.length) {
    result.invalidChapters = true;
    result.chaptersError = '一部のファイルのみが番号付き形式（数字.スラッグ.md）になっています。全てのファイルを統一してください。';
    return;
  }
  
  // 重複したスラッグがないかチェック
  const slugs = new Set<string>();
  const duplicateSlugs: string[] = [];
  
  mdFiles.forEach(file => {
    if (isNumberedChapterFileName(file)) {
      const slug = extractSlugFromNumberedChapter(file);
      if (slugs.has(slug)) {
        duplicateSlugs.push(slug);
      } else {
        slugs.add(slug);
      }
    }
  });
  
  if (duplicateSlugs.length > 0) {
    result.duplicateChapterSlug = true;
    result.duplicateChapterNames = duplicateSlugs;
    result.invalidChapters = true;
    result.chaptersError = '複数のチャプターで同じスラッグが使用されています: ' + duplicateSlugs.join(', ');
  }
}

/**
 * マークダウンファイルのフロントマタープロパティを推奨順序に並べ替える
 * @param filePath 対象ファイルのパス
 */
function sortFrontmatter(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const { data, content: mdContent } = matter(content);
    const propertyOrder = config.propertyOrder || [];

    // 推奨順序に基づいた新しいオブジェクトを作成
    const sortedData: FrontmatterData = {};

    // まず推奨順序のプロパティを追加
    propertyOrder.forEach((prop) => {
      if (prop in data) {
        sortedData[prop] = data[prop];
      }
    });

    // 次にリストにないプロパティを追加
    Object.keys(data).forEach((prop) => {
      if (!(prop in sortedData)) {
        sortedData[prop] = data[prop];
      }
    });

    // ファイルに書き戻す
    const newContent = matter.stringify(mdContent, sortedData);
    fs.writeFileSync(filePath, newContent);

    console.log(`✅ ${path.basename(filePath)} の順序を修正しました`);
  } catch (error) {
    console.error(`${filePath} の修正中にエラーが発生しました:`, error);
  }
}

/**
 * booksディレクトリ内の各本ディレクトリを取得する
 * @returns 本ディレクトリの配列
 */
function getBookDirectories(): string[] {
  if (!fs.existsSync('books')) {
    return [];
  }

  const entries = fs.readdirSync('books', { withFileTypes: true });
  
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join('books', entry.name));
}

/**
 * テスト用のサンプルファイルを作成する
 * @param targetDir 作成先ディレクトリ
 * @returns テスト用ディレクトリのパス
 */
function createTestSamples(targetDir: string): string {
  // テスト用ディレクトリの作成
  const testDir = path.join(targetDir, 'zenn-test');
  const articlesDir = path.join(testDir, 'articles');
  const booksDir = path.join(testDir, 'books');
  const bookChaptersDir = path.join(booksDir, 'test-book');
  
  // ディレクトリが存在する場合は削除して再作成
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  fs.mkdirSync(articlesDir, { recursive: true });
  fs.mkdirSync(bookChaptersDir, { recursive: true });
  
  // 正常な記事ファイル
  const validArticle = `---
title: "正常な記事"
emoji: "📝"
type: "tech"
topics: ["zenn", "markdown"]
published: true
---

これは正常な記事です。`;

  // 問題のある記事ファイル（必須プロパティ欠落）
  const invalidArticleMissingProps = `---
title: "問題のある記事"
emoji: "⚠️"
---

必須プロパティが欠けています。`;

  // 問題のある記事ファイル（順序不正）
  const invalidArticleWrongOrder = `---
published: true
emoji: "🔄"
title: "順序が違う記事"
type: "tech"
topics: ["zenn", "test"]
---

プロパティの順序が正しくありません。`;

  // スラッグが不正な記事のファイル名は12文字未満
  const invalidSlugArticle = `---
title: "スラッグが不正な記事"
emoji: "🔤"
type: "tech"
topics: ["zenn", "test"]
published: true
---

スラッグが短すぎます。`;

  // 正常な本の設定ファイル
  const validBookConfig = `title: "正常な本"
summary: "これは正常な本のサンプルです"
topics: ["zenn", "book"]
published: true
price: 0
chapters:
  - file: 1.intro.md
    title: "はじめに"
  - file: 2.main.md
    title: "本編"
  - file: 3.conclusion.md
    title: "まとめ"
`;

  // 問題のある本の設定ファイル（必須プロパティ欠落）
  const invalidBookConfigMissingProps = `title: "問題のある本"
topics: ["zenn"]
`;

  // 正常な本のチャプターファイル
  const validChapter = `---
title: "正常なチャプター"
---

これは正常なチャプターです。`;
  
  // 問題のあるチャプターファイル（必須プロパティ欠落）
  const invalidChapter = `---
---

タイトルがありません。`;

  // ファイル作成
  fs.writeFileSync(path.join(articlesDir, 'valid-article-sample.md'), validArticle);
  fs.writeFileSync(path.join(articlesDir, 'invalid-missing-props.md'), invalidArticleMissingProps);
  fs.writeFileSync(path.join(articlesDir, 'invalid-wrong-order.md'), invalidArticleWrongOrder);
  fs.writeFileSync(path.join(articlesDir, 'bad.md'), invalidSlugArticle);
  
  fs.writeFileSync(path.join(bookChaptersDir, 'config.yaml'), validBookConfig);
  fs.writeFileSync(path.join(bookChaptersDir, '1.intro.md'), validChapter);
  fs.writeFileSync(path.join(bookChaptersDir, '2.main.md'), validChapter);
  fs.writeFileSync(path.join(bookChaptersDir, '3.conclusion.md'), invalidChapter);
  
  // 問題のある本のディレクトリ
  const invalidBookDir = path.join(booksDir, 'invalid-book');
  fs.mkdirSync(invalidBookDir, { recursive: true });
  fs.writeFileSync(path.join(invalidBookDir, 'config.yaml'), invalidBookConfigMissingProps);
  fs.writeFileSync(path.join(invalidBookDir, '1.chapter.md'), validChapter);
  
  // 設定ファイルのない本のディレクトリ
  const noConfigBookDir = path.join(booksDir, 'no-config-book');
  fs.mkdirSync(noConfigBookDir, { recursive: true });
  fs.writeFileSync(path.join(noConfigBookDir, '1.chapter.md'), validChapter);

  console.log(`テスト用サンプルを ${testDir} に作成しました`);
  
  return testDir;
}

/**
 * テストを実行する
 */
function runTests(): void {
  console.log('Zenn フロントマターリンターのテストを実行しています...');
  
  // テスト用サンプルの作成
  const testDir = createTestSamples(process.cwd());
  
  // 元の設定を保存
  const originalContentPattern = config.contentPattern;
  const originalContentTypePatterns = { ...config.contentTypePatterns };
  
  // テスト用の設定に変更
  config.contentPattern = path.join(testDir, 'articles/**/*.md');
  config.contentTypePatterns = {
    article: [path.join(testDir, 'articles/')],
    bookChapter: [path.join(testDir, 'books/')]
  };
  
  // テスト用の引数を保存
  const originalArgv = [...process.argv];
  let exitCode = 0;
  let testPassed = true;

  console.log('\n==========================================');
  console.log('1. 検証テスト: エラーが検出されるはず');
  console.log('==========================================');
  
  // process.exitを一時的にモック
  const originalExit = process.exit;
  process.exit = ((code: number) => {
    exitCode = code;
    console.log(`Exit code: ${code}`);
    return undefined as never;
  }) as (code?: number) => never;

  try {
    // テスト用引数
    process.argv = [...originalArgv.filter(arg => arg !== '--test')];
    
    // 検証のみを実行
    runMainWithoutExit();
    
    // エラーが検出されてexit(1)が呼ばれるはず
    if (exitCode !== 1) {
      console.log('❌ テスト失敗: エラーが検出されませんでした');
      testPassed = false;
    } else {
      console.log('✅ テスト成功: 期待通りのエラーが検出されました');
    }
  } catch (e) {
    console.error('❌ テスト実行中にエラーが発生しました:', e);
    testPassed = false;
  }

  console.log('\n==========================================');
  console.log('2. 修正テスト: エラーが修正されるはず');
  console.log('==========================================');
  
  try {
    // テスト用引数
    process.argv = [...originalArgv.filter(arg => arg !== '--test'), '--fix'];
    exitCode = 0;
    
    // 修正を実行
    runMainWithoutExit();
    
    // 修正モードなので正常終了するはず
    if (exitCode !== 0) {
      console.log('❌ テスト失敗: 修正に失敗しました');
      testPassed = false;
    } else {
      console.log('✅ テスト成功: 修正が完了しました');
    }
  } catch (e) {
    console.error('❌ テスト実行中にエラーが発生しました:', e);
    testPassed = false;
  }

  console.log('\n==========================================');
  console.log('3. 再検証テスト: 一部エラーが残るはず（必須プロパティなど自動修正できないもの）');
  console.log('==========================================');
  
  try {
    // テスト用引数
    process.argv = [...originalArgv.filter(arg => arg !== '--test')];
    exitCode = 0;
    
    // 再検証を実行
    runMainWithoutExit();
    
    // エラーが検出されてexit(1)が呼ばれるはず
    if (exitCode !== 1) {
      console.log('❌ テスト失敗: 残りのエラーが検出されませんでした');
      testPassed = false;
    } else {
      console.log('✅ テスト成功: 期待通りの残りエラーが検出されました');
    }
  } catch (e) {
    console.error('❌ テスト実行中にエラーが発生しました:', e);
    testPassed = false;
  }
  
  // 設定と引数を元に戻す
  config.contentPattern = originalContentPattern;
  config.contentTypePatterns = originalContentTypePatterns;
  process.argv = originalArgv;
  process.exit = originalExit;
  
  console.log('\n==========================================');
  console.log(testPassed ? '✅ 全てのテストに成功しました！' : '❌ 一部のテストに失敗しました');
  console.log('==========================================');
  
  // テスト用ディレクトリの削除
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log(`テスト用ディレクトリを削除しました: ${testDir}`);
  } catch (e) {
    console.warn(`テスト用ディレクトリの削除に失敗しました: ${e}`);
  }
}

/**
 * process.exitを呼ばずにmain処理を実行する
 */
function runMainWithoutExit(): void {
  // 記事ファイルの検索
  const articlePattern = config.contentPattern || "articles/**/*.md";
  const articleFiles = glob.glob.sync(articlePattern);

  // 本のチャプターファイルの検索
  const chapterFiles = glob.glob.sync("books/**/*.md");
  
  // 本のディレクトリ一覧
  const bookDirs = getBookDirectories();

  // ファイルが存在するかチェック
  if (articleFiles.length === 0 && chapterFiles.length === 0 && bookDirs.length === 0) {
    console.log(`警告: Zenn記事または本のファイルが見つかりませんでした。"articles/"および"books/"ディレクトリが存在しているか確認してください。`);
    return;
  }

  let hasErrors = false;
  const frontmatterResults: LintResult[] = [];
  const bookConfigResults: BookConfigLintResult[] = [];

  // 記事と本のチャプターのフロントマターを検証
  [...articleFiles, ...chapterFiles].forEach((file) => {
    const result = lintZennFrontmatter(file);
    if (!result) return;

    if (result.missing.length > 0 || result.wrongOrder || result.invalidSlug) {
      frontmatterResults.push(result);
      hasErrors = true;

      // --fixオプションが指定されていれば自動修正
      if (process.argv.includes("--fix") && result.wrongOrder) {
        sortFrontmatter(file);
      }
    }
  });

  // 本のconfig.yamlを検証
  bookDirs.forEach(dir => {
    const result = lintBookConfig(dir);
    if (result.missing.length > 0 || result.missingConfigFile || result.invalidChapters || result.duplicateChapterSlug) {
      bookConfigResults.push(result);
      hasErrors = true;
    }
  });

  // 結果の出力
  let resultsShown = false;

  // フロントマター検証結果の出力
  if (frontmatterResults.length > 0) {
    console.log(`\n${frontmatterResults.length} 個のファイルにフロントマターの問題があります:`);
    resultsShown = true;
    
    frontmatterResults.forEach((result) => {
      console.log(`\nファイル: ${result.file} (タイプ: ${result.contentType})`);
  
      if (result.missing.length > 0) {
        console.log(
          `  必須プロパティが不足しています: ${result.missing.join(", ")}`
        );
      }
  
      if (result.wrongOrder) {
        console.log("  フロントマタープロパティの順序が推奨と異なります");
        console.log(`  現在の順序: ${result.currentOrder.join(", ")}`);
        console.log(`  推奨順序: ${config.propertyOrder.join(", ")}`);
  
        if (process.argv.includes("--fix")) {
          console.log("  ✅ 順序を自動的に修正しました");
        }
      }

      if (result.invalidSlug) {
        console.log(`  ${result.slugError}`);
      }
    });
  }

  // 本のconfig.yaml検証結果の出力
  if (bookConfigResults.length > 0) {
    console.log(`\n${bookConfigResults.length} 個の本に設定の問題があります:`);
    resultsShown = true;
    
    bookConfigResults.forEach((result) => {
      console.log(`\n本ディレクトリ: ${result.dir}`);
      
      if (result.missingConfigFile) {
        console.log("  config.yamlファイルが見つかりません");
      }
      
      if (result.missing && result.missing.length > 0) {
        console.log(`  必須プロパティが不足しています: ${result.missing.join(", ")}`);
      }

      if (result.invalidChapters) {
        console.log(`  ${result.chaptersError}`);
      }

      if (result.duplicateChapterSlug) {
        // duplicateChapterNamesがundefinedでないことを確認
        const duplicateNames = result.duplicateChapterNames || [];
        console.log(`  複数のチャプターで同じスラッグが使用されています: ${duplicateNames.join(", ")}`);
      }
    });
  }
  
  if (resultsShown && !process.argv.includes("--fix")) {
    console.log(
      "\n--fix オプションを付けて実行すると、フロントマターのプロパティ順序を自動修正できます。"
    );
  } else if (!resultsShown) {
    console.log(
      "\n✅ すべてのZennファイルのフロントマタープロパティが有効で、順序も正しいです。"
    );
  }

  // エラーがあり、かつ自動修正していない場合はエラーコードで終了
  if (hasErrors && !process.argv.includes("--fix")) {
    process.exit(1);
  }
}

/**
 * メイン処理
 */
function main() {
  // テストモードの確認
  if (process.argv.includes("--test")) {
    runTests();
    return;
  }
  
  console.log('Zenn フロントマターリンターを実行しています...');
  
  runMainWithoutExit();
}

main(); 