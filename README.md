# MDX フロントマターリンター

MDXファイルのフロントマタープロパティを検証・整形するためのツールです。

## 機能

- フロントマタープロパティの必須チェック (コンテンツタイプ別)
- プロパティの順序チェック
- 自動修正機能 (`--fix` オプション付きで実行時)
- カスタム設定ファイルによる柔軟なカスタマイズ

## インストール

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/tool-lint-mdx.git
cd tool-lint-mdx

# 依存関係のインストール
npm install
```

## 使用方法

### 基本的な使い方

```bash
# フロントマターの検証のみ
npm run lint:mdx

# フロントマターの検証と自動修正
npm run lint:mdx:fix
```

### 直接実行

```bash
# 検証のみ
npx ts-node scripts/lint-mdx.ts

# 自動修正
npx ts-node scripts/lint-mdx.ts --fix
```

## カスタマイズ

`mdx-lint.config.json` ファイルを作成することで、リンターの動作をカスタマイズできます。

### 設定例

```json
{
  "propertyOrder": [
    "title",
    "date",
    "description",
    "tags",
    "category",
    "image",
    "recommended",
    "status",
    "draft"
  ],
  "requiredProperties": {
    "blog": ["title", "date", "description", "tags", "category", "image", "status"],
    "snippet": ["title", "date", "description", "tags", "status"],
    "default": ["title", "date", "description"]
  },
  "contentPattern": "content/**/*.mdx",
  "contentTypePatterns": {
    "blog": ["/blog/", "\\blog\\"],
    "snippet": ["/snippet/", "\\snippet\\"]
  }
}
```

### 設定オプション

| オプション | 説明 |
|------------|------|
| `propertyOrder` | フロントマタープロパティの推奨順序 |
| `requiredProperties` | コンテンツタイプ別の必須プロパティ |
| `contentPattern` | MDXファイルの検索パターン |
| `contentTypePatterns` | コンテンツタイプ判定用のパターン |

## ライセンス
MIT?
