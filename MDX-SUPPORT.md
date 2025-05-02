# MDXサポートのための開発計画

このドキュメントは、現在のZenn Frontmatter Linterに**MDX**ファイルサポートを追加するための開発計画を提案します。

## MDXとは

MDX（Markdown + JSX）は、Markdownファイル内でJSXコンポーネントを直接使用できるようにするフォーマットです。
ReactやVueなどのフレームワークと組み合わせて、よりリッチなコンテンツを作成することが可能です。

### MDXの例

```mdx
---
title: サンプルブログ記事
date: 2023-05-03T00:00:00.000Z
description: これはテスト用のサンプル記事です
tags:
  - test
  - sample
category: テスト
image: /images/sample.jpg
status: published
---

# これはMDXサンプルです

<CustomComponent prop="value">
  これはJSXコンポーネント内のコンテンツです。
</CustomComponent>

普通のMarkdownテキストと**混在**できます。

{/* JSXのコメントも使えます */}

```

## MDXリンターの実装計画

### 1. 必要なパッケージの追加

```bash
npm install @mdx-js/mdx gray-matter
```

### 2. リンター機能の拡張

- ファイル検索パターンを拡張して `*.mdx` ファイルをサポート
- MDX特有のフロントマターのパターンやプロパティの追加

### 3. 設定ファイルの調整

```json
{
  "propertyOrder": [
    "title",
    "date",
    "description",
    "tags",
    "category",
    "image",
    "status",
    "draft"
  ],
  "requiredProperties": {
    "blog": ["title", "date", "description", "tags"],
    "snippets": ["title", "description", "tags"],
    "default": ["title", "description"]
  },
  "contentPattern": "{content,posts,src}/**/*.{md,mdx}",
  "contentTypePatterns": {
    "blog": ["/blog/", "\\blog\\"],
    "snippet": ["/snippets/", "\\snippets\\"]
  }
}
```

### 4. MDX固有の検証ルール

- JSXコンポーネントの使用状況の検証
- インポート宣言のチェック
- MDX形式の正当性チェック

### 5. Zennリンターとの共存

- コマンドライン引数で使い分け
  - `--mdx`: MDXファイルのリント
  - `--zenn`: Zenn用Markdownファイルのリント
  - デフォルトは現在の設定ファイルに基づいて自動判定

### 6. テストの拡張

- MDXファイル用のテストケースの追加
- 既存のZenn用テストとの分離

## 実装スケジュール

1. 調査と計画: 1週間
2. 基本実装（MDXパース機能）: 1週間
3. リント機能の実装: 2週間
4. テストケースの作成と実行: 1週間
5. ドキュメント更新: 2日

## 参考資料

- [MDX公式ドキュメント](https://mdxjs.com/)
- [gray-matter](https://github.com/jonschlinkert/gray-matter) - フロントマターパーサー
- [remark-mdx](https://github.com/mdx-js/mdx/tree/main/packages/remark-mdx) - MDXパーサー 