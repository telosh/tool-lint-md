import fs from "fs";
import path from "path";
import matter from "gray-matter";
import * as glob from "glob";

/**
 * Zenn Frontmatter Linter
 *
 * このスクリプトは、Zenn向けの記事(articles)および本(books)のフロントマタープロパティを
 * 検証・整形するためのツールです。
 *
 * 機能:
 * 1. フロントマタープロパティの必須チェック (コンテンツタイプ別)
 * 2. プロパティの順序チェック
 * 3. 自動修正機能 (--fixオプション付きで実行時)
 * 4. カスタム設定ファイルのサポート
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
    book: ["title", "summary", "published"],
    default: ["title", "published"]
  },
  
  // 検索パターン
  contentPattern: "articles/**/*.md",
  
  // コンテンツタイプ判定パターン
  contentTypePatterns: {
    article: ["articles/"],
    book: ["books/"]
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
  
  for (const [type, patterns] of Object.entries(typePatterns)) {
    if (Array.isArray(patterns) && patterns.some(pattern => filePath.includes(pattern))) {
      return type;
    }
  }

  // デフォルトタイプを返す
  return "default";
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

    return {
      file: filePath,
      contentType,
      missing,
      wrongOrder: !isInCorrectOrder,
      currentOrder: currentProps,
    };
  } catch (error) {
    console.error(`${filePath} の処理中にエラーが発生しました:`, error);
    return null;
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
 * メイン処理
 */
function main() {
  console.log('Zenn フロントマターリンターを実行しています...');
  
  // --fixオプションの確認
  const fix = process.argv.includes("--fix");
  
  // 記事と本のファイルを検索
  const contentPatterns = [
    config.contentPattern || "articles/**/*.md",
    "books/**/*.md"  // 本のチャプターも検証
  ];
  
  let mdFiles: string[] = [];
  
  contentPatterns.forEach(pattern => {
    const files = glob.glob.sync(pattern);
    mdFiles = [...mdFiles, ...files];
  });

  if (mdFiles.length === 0) {
    console.log(`警告: Zenn記事または本のファイルが見つかりませんでした。"articles/"および"books/"ディレクトリが存在しているか確認してください。`);
    return;
  }

  let hasErrors = false;
  const results: LintResult[] = [];

  // 各ファイルの検証
  mdFiles.forEach((file) => {
    const result = lintZennFrontmatter(file);
    if (!result) return;

    if (result.missing.length > 0 || result.wrongOrder) {
      results.push(result);
      hasErrors = true;

      // --fixオプションが指定されていれば自動修正
      if (fix && result.wrongOrder) {
        sortFrontmatter(file);
      }
    }
  });

  // 結果の出力
  if (results.length > 0) {
    console.log(`\n${results.length} 個のファイルにフロントマターの問題があります:`);
    
    results.forEach((result) => {
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
    });
    
    if (!fix) {
      console.log(
        "\n--fix オプションを付けて実行すると、フロントマターのプロパティ順序を自動修正できます。"
      );
    }
  } else {
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