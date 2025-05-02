---
title: "Zenn CLIのインストール"
---

# Zenn CLIのインストール

この章では、Zenn CLIのインストール方法と初期設定について解説します。

## 前提条件

- Node.js v12以上がインストールされていること
- npm または yarn がインストールされていること

## インストール手順

1. プロジェクトディレクトリを作成
2. npmプロジェクトを初期化
3. Zenn CLIをインストール

```bash
# プロジェクトディレクトリを作成
mkdir zenn-content
cd zenn-content

# npm プロジェクトを初期化
npm init -y

# Zenn CLIをインストール
npm install zenn-cli
```

## 初期化

インストール後、次のコマンドで初期化を行います。

```bash
npx zenn init
```

これにより、articlesディレクトリとbooksディレクトリが作成されます。 