# Zenn Frontmatter Linter

このツールは、Zenn向けの記事（articles）および本（books）のフロントマタープロパティを検証・整形するためのNode.jsスクリプトです。

## 機能

1. フロントマタープロパティの必須チェック (コンテンツタイプ別)
2. プロパティの順序チェック
3. 自動修正機能 (--fixオプション付きで実行時)
4. カスタム設定ファイルのサポート

## 使用方法

### インストール

このリポジトリをクローンして依存関係をインストールします。

```bash
git clone https://github.com/your-username/zenn-frontmatter-linter.git
cd zenn-frontmatter-linter
npm install
```

### 実行方法

- 検証のみ（問題のある箇所を表示）:
```bash
npm run lint:zenn
```

- 自動修正（問題を検出して修正）:
```bash
npm run lint:zenn:fix
```

### 設定ファイル

デフォルトの設定は`zenn-lint.config.json`に保存されています。このファイルをカスタマイズして、独自の要件に合わせて設定を変更できます。

#### 設定例
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
    "book": ["title", "summary", "published"],
    "default": ["title", "published"]
  },
  "contentPattern": "articles/**/*.md",
  "contentTypePatterns": {
    "article": ["articles/"],
    "book": ["books/"]
  }
}
```

## Zennの記事・本のフロントマターについて

Zennの記事(articles)と本(books)では、以下のようなフロントマターが必要です。

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

### 本（book）のチャプターのフロントマター
```yaml
---
title: "チャプタータイトル"
---
```

## ライセンス

ISC 