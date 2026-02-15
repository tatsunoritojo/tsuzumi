# Phase 10-B 完了報告書

**フェーズ名**: Phase 10-B セキュリティ修正  
**完了日**: 2025年12月8日  
**ステータス**: ✅ 完了

---

## 1. 実装概要

Phase 10-Aで一時的に緩和されていたFirestoreセキュリティルールを修正し、内部テスト前のセキュリティを強化しました。

### 主な修正

| 修正箇所 | 変更内容 |
|----------|----------|
| reactions | `from_uid="system"` 偽装防止（クライアントは自分のUIDのみ許可） |
| cards | 非公開カード保護（本人または公開カードのみ読み取り可能） |
| categories | メンテナンス用delete許可を削除（読み取りのみ） |

---

## 2. 変更ファイル

| ファイル | 変更内容 |
|----------|----------|
| `firestore.rules` | セキュリティルール全体を更新 |
| `docs/1_Strategy_and_Design/mvp_specification.md` | セキュリティルールセクション更新 |

---

## 3. セキュリティルール詳細

### 3.1 reactions: from_uid偽装防止

**変更前**:
```javascript
allow create: if request.auth != null;
// → クライアントから from_uid="system" で偽装可能
```

**変更後**:
```javascript
allow create: if request.auth != null 
  && request.resource.data.from_uid == request.auth.uid;
// → クライアントは自分のUIDのみ許可
// → from_uid="system" は Cloud Functions (Admin SDK) のみ
```

### 3.2 cards: 非公開カード保護

**変更前**:
```javascript
allow read: if request.auth != null;
// → 非公開カード（is_public=false）も閲覧可能
```

**変更後**:
```javascript
allow read: if request.auth != null && (
  resource.data.owner_uid == request.auth.uid ||
  resource.data.is_public == true ||
  resource.data.is_public_for_cheers == true
);
// → 本人または公開カードのみ読み取り可能
```

### 3.3 categories: メンテナンス用delete許可削除

**変更前**:
```javascript
allow read, delete: if true;
// → メンテナンス用の一時緩和
```

**変更後**:
```javascript
allow read: if request.auth != null;
allow write: if false;
// → 読み取りのみ、書き込みは完全禁止
```

---

## 4. デプロイ手順

1. Firebase Console → Firestore → ルール
2. `firestore.rules` の内容を貼り付け
3. 「公開」をクリック

---

## 5. 検証観点

### セキュリティテスト

| テストケース | 期待結果 |
|-------------|----------|
| クライアントから from_uid="system" でreaction作成 | **拒否される** |
| クライアントから from_uid=自分のUID でreaction作成 | 成功 |
| 他ユーザーの非公開カードを取得 | **拒否される** |
| 他ユーザーの公開カードを取得 | 成功 |

### 機能継続テスト

| テストケース | 期待結果 |
|-------------|----------|
| 端末A → 端末B エール送信 | 成功 |
| AIエール受信 | 成功（Cloud Functions経由） |
| お気に入り登録/解除 | 成功 |

---

## 6. 注意事項

- Cloud Functions は Admin SDK を使用するため、セキュリティルールをバイパス
- AIエール（from_uid="system"）は引き続き正常に動作
- 既存データの構造は変更なし

---

## 改訂履歴

| バージョン | 日付 | 変更内容 |
|------------|------|----------|
| 1.0 | 2025-12-08 | 初版作成 |
| 1.1 | 2026-02-15 | 以降、アプリタイトルを「Habit Tracker」から「Tsuzumi」に変更。リポジトリ名・パッケージ名・ドキュメント等を一括更新。 |
