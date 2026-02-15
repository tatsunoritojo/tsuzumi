# Tsuzumi

習慣トラッキングアプリ - React Native (Expo) + Firebase

---

## ⚠️ このドキュメントについて

**技術的な詳細（ディレクトリ構造、データフロー、関数ロジック等）は [Codebook](docs/CODEBOOK.md) に集約されました。**

本READMEは、環境構築と開発の始め方に焦点を当てています。
アーキテクチャや仕様の詳細を確認したい場合は、必ず **`docs/CODEBOOK.md`** を参照してください。

---

## 📋 目次

- [プロジェクト概要](#プロジェクト概要)
- [Codebook (技術仕様)](#codebook-技術仕様)
- [環境構築](#環境構築)
- [開発の始め方](#開発の始め方)
- [トラブルシューティング](#トラブルシューティング)

---

## プロジェクト概要

Tsuzumi は、ユーザーが日々の習慣を記録・管理できるモバイルアプリケーションです。

> [!TIP]
> **仕様の詳細**: `docs/CODEBOOK.md` および `docs/1_Strategy_and_Design/mvp_specification.md` を参照

### 主な機能

- **ユーザー認証**: Firebase 匿名認証によるユーザー管理
- **カード管理**: 22種類の習慣テンプレート、公開/非公開設定
- **ログ記録**: ワンタップ記録、リアルタイム同期、ストリーク計算
- **統計表示**: 週次・月次の達成状況可視化
- **エール機能**:
  - **AIエール**: 記録直後や継続途切れ時に自動配信
  - **Humanエール**: ユーザー同士でスタンプ（💪⭐🤝）を送り合う
- **設定**: 通知頻度、お休みモード、まとめ通知

---

## Codebook (技術仕様)

本プロジェクトの技術スタック、ディレクトリ構造、データフロー、セキュリティルール等の詳細は、**Codebook** に記載されています。

👉 **[Access Codebook](docs/CODEBOOK.md)**

### Codebookの構成
1. **Overview**: 技術スタックと概要
2. **Directory Structure**: `app`, `src`, `functions` の詳細マップ
3. **Data Flow & Architecture**: Client-Server間のデータ連携
4. **Key Logic Mapping**: 機能ごとのコードの場所
5. **Data Models**: Firestoreスキーマと型定義
6. **Security Rules**: 権限周りの設定

---

## 環境構築

### 必要な環境

- **Node.js**: 20.19.4 以上
- **npm**: 最新版
- **Expo Go アプリ**: iOS/Android 実機にインストール

### セットアップ手順

#### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd habit-tracker
```

#### 2. 依存関係のインストール

```bash
npm install --legacy-peer-deps
```

> **注意**: `--legacy-peer-deps` フラグが必要です。React 19 と一部のパッケージの peer dependency の競合を回避するため。

#### 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成：

```bash
cp .env.example .env
```

`.env` に Firebase の設定を記入（`EXPO_PUBLIC_` プレフィックス必須）。

> **重要**: `.env` ファイルは Git にコミットしないでください。

---

## 開発の始め方

### 開発サーバーの起動

```bash
npx expo start --clear
```

### 実機での確認

1. iOS/Android 実機に Expo Go アプリをインストール
2. ターミナルに表示される QR コードをスキャン

### よく使うコマンド

```bash
# 開発サーバー起動
npm start

# テスト実行
npm test

# Firestore に初期データを投入
npm run seed:categories
npm run seed:templates
```

---

## トラブルシューティング

### エラー: "Unable to resolve module"

**原因**: 依存関係が不足している

**解決策**:
```bash
rm -rf node_modules
npm install --legacy-peer-deps
npx expo start --clear
```

### エラー: "java.lang.String cannot be cast to java.lang.Boolean"

**原因**: Expo Go のキャッシュの問題

**解決策**:
1. 実機で Expo Go のアプリデータとキャッシュをクリア
2. PC 側で `npx expo start --clear` を実行

### Firebase の環境変数が読み込まれない

**原因**: `.env` ファイルが作成されていない、または環境変数名が間違っている

**解決策**:
- `.env.example` を参照して `.env` を作成
- 環境変数名は必ず `EXPO_PUBLIC_` プレフィックスが必要

---
