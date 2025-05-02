# Zenn Frontmatter Linter

Zenn向けの記事(articles)および本(books)のフロントマタープロパティを検証・整形するためのツールです。

> **注意**: このツールは**MDX**ファイル用ではなく、**Zenn形式のMarkdown**ファイル用のリンターです。

## 機能

1. フロントマタープロパティの必須チェック (コンテンツタイプ別)
2. プロパティの順序チェック
3. slugの形式チェック
4. 本のconfig.yamlのチェック
5. 章の番号付けとファイル名のチェック
6. 自動修正機能 (`--fix` オプション付きで実行時)
7. カスタム設定ファイルのサポート
8. テスト機能 (`--test` オプションで実行可能)

## MDとMDXの違い

- **MD (Markdown)**: 軽量マークアップ言語で、プレーンテキストに簡単な書式を追加するもの
- **MDX**: JSXをMarkdownに組み込んだもので、React コンポーネントをMarkdown内で使用可能

このツールは**Zenn形式のMarkdown**ファイル専用です。MDXファイルには対応していません。

## インストール

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/zenn-frontmatter-linter.git
cd zenn-frontmatter-linter

# 依存関係のインストール
npm install
```

## 使用方法

### 基本的な使い方

```bash
# フロントマターの検証のみ
npm run lint:zenn

# フロントマターの検証と自動修正
npm run lint:zenn:fix

# テストモードでの実行
npx ts-node scripts/lint-zenn.ts --test
```

### 直接実行

```bash
# 検証のみ
npx ts-node scripts/lint-zenn.ts

# 自動修正
npx ts-node scripts/lint-zenn.ts --fix
```

## Zennの記事・本のフロントマター

### 記事（article）のフロントマター
```yaml
---
title: "記事のタイトル"
emoji: "😸" # アイキャッチとして使われる絵文字（1文字）
type: "tech" # tech: 技術記事 / idea: アイデア記事
topics: ["markdown", "zenn", "npm"] # タグ（1〜5つまで）
published: true # 公開設定（falseで下書き）
published_at: 2023-06-15 # 公開日時（省略可能）
---
```

### 本の設定ファイル（config.yaml）
```yaml
title: "本のタイトル"
summary: "本の紹介文"
topics: ["markdown", "zenn", "npm"] # トピック（5つまで）
published: true # 公開設定（falseで下書き）
price: 0 # 無料の場合は0、有料の場合は500〜5000
chapters:
  - title: "チャプター1のタイトル"
    file: chapter1.md
  - title: "チャプター2のタイトル"
    file: chapter2.md
```

## カスタマイズ

`zenn-lint.config.json` ファイルを作成することで、リンターの動作をカスタマイズできます。

### 設定例

```json
{
  "propertyOrder": [
    "title",
    "emoji",
    "type",
    "topics",
    "published",
    "published_at"
  ],
  "requiredProperties": {
    "article": ["title", "emoji", "type", "topics", "published"],
    "bookChapter": ["title"],
    "default": ["title", "published"]
  },
  "bookConfigRequiredProperties": [
    "title",
    "summary",
    "topics",
    "published",
    "price",
    "chapters"
  ],
  "contentPattern": "articles/**/*.md",
  "contentTypePatterns": {
    "article": ["articles/"],
    "bookChapter": ["books/"]
  }
}
```

### 設定オプション

| オプション | 説明 |
|------------|------|
| `propertyOrder` | フロントマタープロパティの推奨順序 |
| `requiredProperties` | コンテンツタイプ別の必須プロパティ |
| `bookConfigRequiredProperties` | 本のconfig.yamlの必須プロパティ |
| `contentPattern` | Markdownファイルの検索パターン |
| `contentTypePatterns` | コンテンツタイプ判定用のパターン |

## 検証内容

1. 記事のフロントマターの必須プロパティと順序
2. 記事のスラッグ（ファイル名）の有効性
3. 本のconfig.yamlの必須プロパティ
4. 本のチャプター構成の正しさ
5. 本のチャプターのフロントマター
6. チャプターのファイル名が数字.スラッグ.md形式に準拠しているか
7. 重複したチャプタースラッグがないか

## ライセンス
MIT
