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

### 記事のファイル名（スラッグ）
ファイル名は記事のスラッグとして使用されます。スラッグは以下の条件を満たす必要があります：
- 英小文字（a-z）、数字（0-9）、ハイフン（-）、アンダースコア（_）のみを使用
- 12〜50文字の長さ
- 例: `how-to-use-zenn-cli.md`, `react_state_management_2023.md`

### 本の構成
Zennの本は以下のディレクトリ構造が必要です：

```
books/
└── 本のスラッグ/
    ├── config.yaml # 本の設定ファイル
    ├── chapter1.md # チャプター1
    ├── chapter2.md # チャプター2
    └── ...
```

### 本のチャプター順序の指定方法

Zennでは以下の2つの方法でチャプターの順序を指定できます：

#### 1. config.yamlでチャプターを指定

```yaml
title: "本のタイトル"
# ...他の設定...
chapters:
  - title: "チャプター1のタイトル"
    file: chapter1.md
  - title: "チャプター2のタイトル"
    file: chapter2.md
```

#### 2. ファイル名で番号を指定

`config.yaml`の`chapters`を空の配列にした場合、ファイル名の番号でチャプターの順序を指定できます：

```yaml
title: "本のタイトル"
# ...他の設定...
chapters: []
```

この場合、ファイル名は以下の形式にする必要があります：

```
books/
└── 本のスラッグ/
    ├── config.yaml
    ├── 1.intro.md     # 最初のチャプター
    ├── 2.setup.md     # 2番目のチャプター 
    └── 3.advanced.md  # 3番目のチャプター
```

**注意**: 複数のチャプターで同じスラッグ（ファイル名の番号の後の部分）を使用することはできません。

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

### 本のチャプターのフロントマター
```yaml
---
title: "チャプタータイトル"
---
```

## このリンターで検証できること

1. 記事のフロントマターの必須プロパティと順序
2. 記事のスラッグ（ファイル名）の有効性
3. 本のconfig.yamlの必須プロパティ
4. 本のチャプター構成の正しさ
5. 本のチャプターのフロントマター
6. チャプターのファイル名が数字.スラッグ.md形式に準拠しているか
7. 重複したチャプタースラッグがないか

## ライセンス

ISC 