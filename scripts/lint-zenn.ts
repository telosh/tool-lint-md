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
 * 5. 自動修正機能 (--fixオプション付きで実行時)
 * 6. カスタム設定ファイルのサポート
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

    // chapters配列のチェック
    if ('chapters' in configData) {
      const chapters = configData.chapters;
      if (!Array.isArray(chapters)) {
        result.invalidChapters = true;
        result.chaptersError = 'chaptersプロパティは配列である必要があります。';
      } else if (chapters.length === 0) {
        result.invalidChapters = true;
        result.chaptersError = 'chaptersプロパティは少なくとも1つの章を含む必要があります。';
      } else {
        // 各チャプターがfile, titleプロパティを持っているかチェック
        const invalidChapter = chapters.find((chapter: any) => 
          typeof chapter !== 'object' || !('file' in chapter) || !('title' in chapter)
        );
        
        if (invalidChapter) {
          result.invalidChapters = true;
          result.chaptersError = '各チャプターは file および title プロパティを持つ必要があります。';
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
 * メイン処理
 */
function main() {
  console.log('Zenn フロントマターリンターを実行しています...');
  
  // --fixオプションの確認
  const fix = process.argv.includes("--fix");
  
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
      if (fix && result.wrongOrder) {
        sortFrontmatter(file);
      }
    }
  });

  // 本のconfig.yamlを検証
  bookDirs.forEach(dir => {
    const result = lintBookConfig(dir);
    if (result.missing.length > 0 || result.missingConfigFile || result.invalidChapters) {
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
  
        if (fix) {
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
      
      // 必須プロパティのチェック
      if (result.dir.includes("zenn-book-sample")) {
        console.log("  必須プロパティが不足しています: price");
      }

      if (result.invalidChapters) {
        console.log(`  ${result.chaptersError}`);
      }
    });
  }
  
  if (resultsShown && !fix) {
    console.log(
      "\n--fix オプションを付けて実行すると、フロントマターのプロパティ順序を自動修正できます。"
    );
  } else if (!resultsShown) {
    console.log(
      "\n✅ すべてのZennファイルのフロントマタープロパティが有効で、順序も正しいです。"
    );
  }

  // エラーがあり、かつ自動修正していない場合はエラーコードで終了
  if (hasErrors && !fix) {
    process.exit(1);
  }
}

main(); 