# Tsuzumi v2 改修仕様書

## 概要

本文書は、Tsuzumi アプリケーションの完全レビューに基づき、基礎設計の破綻リスクを解消し、安定的な運用を実現するための改修仕様を定義する。

---

## 1. 認証基盤

### 1.1 移行コード方式（新規実装）

**目的:** 匿名認証を維持しつつ、機種変更時のデータ移行を可能にする。

**仕様:**
- ユーザーが設定画面から「移行コード」を発行できる
- コードは一意のランダム文字列（例: 8桁英数字）
- 有効期限: 発行から14日間
- 旧端末は新端末で復元が完了するまで引き続き利用可能
- 新端末でコードを入力すると、旧 UID のデータを新 UID に紐付け直す
- 復元完了時点で旧端末の匿名アカウントを無効化する
- 移行コード未発行の状態でアプリ削除 → Firebase Auth `onUserDeleted` により全データ削除
- 移行コード発行済みの状態でアプリ削除 → 14日間データを保持し、期限切れ後に削除

**データモデル:**

```
Collection: migration_codes/{code}
Fields:
  code: string           // 移行コード（ドキュメントID）
  source_uid: string     // 発行元の UID
  created_at: Timestamp  // 発行日時
  expires_at: Timestamp  // 有効期限（created_at + 14日）
  status: 'active' | 'used' | 'expired'
  used_by_uid: string | null   // 復元先の UID（使用後に設定）
  used_at: Timestamp | null
```

**Cloud Functions:**
- `cleanupExpiredMigrationCodes`: 日次 cron。期限切れコードを検出し、`status: 'expired'` に更新。関連ユーザーデータを削除
- `onUserDeleted` の改修: `migration_codes` に `source_uid` が一致する `active` コードが存在する場合、データ削除をスキップ

**クライアント:**
- 設定画面に「データ移行」セクションを追加
- 発行画面: コード表示 + 有効期限 + コピーボタン
- 復元画面: コード入力フィールド + 復元ボタン（onboarding 完了画面からもアクセス可能）

### 1.2 認証状態監視（新規実装）

**目的:** トークン無効化、移行による無効化をリアルタイムに検知する。

**仕様:**
- `_layout.tsx` に `onAuthStateChanged` リスナーを追加
- 認証が無効化された場合:
  - 移行による無効化 → 「このアカウントは別の端末に移行されました」メッセージを表示
  - その他の無効化 → 自動で `signInAnonymously()` を再試行
  - 再試行失敗 → エラーメッセージ表示
- セッション中のトークンリフレッシュ失敗時も同様のフローを適用

### 1.3 アカウント削除後の状態回復

**目的:** `deleteUser()` 後のアプリ状態崩壊を防止する。

**仕様:**
- `deleteUser()` 成功後、`onAuthStateChanged` が `null` を検知
- 「アカウントが削除されました。アプリを再起動してください」画面を表示
- 再起動ボタンは配置しない（OS レベルの再起動を促す）
- 再起動後、`_layout.tsx` の既存フローで新規匿名アカウントが自動作成される

### 1.4 Firebase Auth 障害時のリトライ（実装済み）

**仕様:**
- エラー画面に「再試行」ボタンを追加
- ボタン押下で `ensureAnonymousLoginAndUser()` + `initializeNotifications()` を再実行
- 失敗時はエラーメッセージを更新して再表示

**ステータス:** 実装完了（`app/_layout.tsx`）

---

## 2. データモデル改修

### 2.1 公開フラグの統合

**目的:** `is_public` / `is_public_for_cheers` / `is_public_for_template` の三重定義を解消し、既存バグ2件を修正する。

**修正される既存バグ:**
1. `edit-card.tsx` が `is_public`（常に `false`）しか読み書きせず、公開設定の編集が機能していない
2. `checkStreakBreak` / `sendRandomCheer` が `is_public == true` でクエリするが、作成画面が常に `false` を書き込むため AI チアが一切機能していない

**仕様:**
- `is_public_for_cheers` と `is_public_for_template` を廃止
- `is_public` を唯一の公開フラグとして使用
- 意味: 「このカードをチアシステムに参加させる（他ユーザーからのエール受信 + 採用を許可）」

**データマイグレーション:**
- 既存カードに対して `is_public = is_public_for_cheers || is_public_for_template` を適用
- マイグレーションスクリプトを作成し、一括更新を実行

**影響ファイル:**

| ファイル | 変更内容 |
|---|---|
| `src/types/index.ts` | `is_public_for_cheers`, `is_public_for_template` フィールド削除 |
| `app/select-card.tsx` | 公開カード表示セクション削除、toggle を1つに統合 |
| `app/create-custom-card.tsx` | チェックボックス2つ → 1つに統合 |
| `app/edit-card.tsx` | 変更不要（既に `is_public` のみ使用） |
| `src/hooks/usePublicCards.ts` | 削除（類似検索が必要な場合は `is_public` クエリに変更） |
| `src/services/cheerSendService.ts` | `is_public_for_cheers` → `is_public` |
| `src/components/CreateCardConfirmDialog.tsx` | toggle 2つ → 1つに統合 |
| `functions/src/services/updateMatchingPools.ts` | 2クエリ → 1クエリに簡素化 |
| `functions/src/index.ts` | `is_public \|\| is_public_for_cheers` → `is_public` のみ |
| `firestore.rules` | 3条件の OR → `is_public` のみ |

### 2.2 カード作成フローの再設計

**目的:** 他人の公開カードの発見を、カード作成画面からチア画面に移し、自然な文脈で習慣を採用できるようにする。

**仕様:**
- **カード作成画面:** テンプレート（管理者作成）+ 自作のみを表示。他人の公開カードは表示しない
- **チア画面:** 既存のチア送信UIに「この習慣を始める」ボタンを追加
- 「採用」時の挙動: 相手のカード情報（`title`, `category_l1/l2/l3`, `icon`）をプリセットした状態でカード作成画面に遷移し、ユーザーがカスタマイズ可能
- 採用されたカードの `template_id` は `'adopted'`、`is_custom` は `false`

### 2.3 `User.stats` の廃止

**目的:** 更新コードが存在せず永久に乖離する非正規化データを廃止する。

**仕様:**
- `users/{uid}` ドキュメントから `stats` フィールドを削除
- `UserStats` 型を廃止
- 統計が必要な箇所では `logs` / `cards` / `reactions` コレクションから都度集計する
- `statsService.ts` を集計の唯一のエントリポイントとして維持・改修

### 2.4 カード削除の完全カスケード

**目的:** カード削除時の連鎖的データ不整合を完全に解消する。

**仕様:**

**バッチ分割:**
- Firestore バッチの500件上限を考慮し、削除対象を500件ずつ分割して処理
- 各バッチの commit を順次実行

**cleanup 対象の追加（既存の logs, reactions に加えて）:**

| データ | cleanup 方法 |
|---|---|
| `cheer_state.long_absence_cheers[card_id]` | 該当エントリを削除 |
| `cheer_send_state.sent_pairs` 内の該当カード | 該当エントリを削除 |
| `favorites` 内の `target_card_id` 一致レコード | ドキュメント削除 |
| `matching_pools` 内の該当カード | 既存処理を維持（トランザクション） |

**`onUserDeleted` も同様に改修:**
- バッチ分割を適用
- `cheer_send_state/{uid}` の削除を追加（現在 cleanup 対象外）

### 2.5 孤立データ防止（オフライン同期対策）

**目的:** オフライン書き込みとカード削除の競合による孤立データを防止する。

**仕様:**
- **リアルタイム防御:** `onLogCreated` でカードの存在チェックを行い、存在しなければログを自動削除
- **定期クリーンアップ:** 日次 cron で孤立ログ（`card_id` が存在しないカードを参照）を検出・削除

---

## 3. 日付境界とタイムゾーン

### 3.1 就寝時間ベースの日付境界

**目的:** UTC/JST 混在によるタイムゾーン問題を根本解決し、ユーザーの生活リズムに合った日付区切りを提供する。

**仕様:**
- ユーザーが onboarding で「大体何時ごろに寝ますか？」に回答
- 内部的には「就寝時間 + 1時間」を日付境界として使用
- デフォルト: 0:00（就寝時間未設定時）
- タイムゾーン: デフォルト JST（Asia/Tokyo）を自動適用。設定画面から変更可能

**適用範囲（アプリ全体の日付境界）:**
- ログの日付判定
- ストリーク計算
- 「今日のチア」の区切り
- 統計の日次集計
- Cloud Functions の各種 cron 処理

**実装:**
- 日付生成ユーティリティ関数 `getAppToday(sleepTime, timezone)` を作成
- 全箇所（`logService`, `statsService`, `cheerSendService`, `gamification`, Cloud Functions）でこのユーティリティを使用
- `new Date().toISOString().split('T')[0]` の直接使用を全面禁止

**ユーザー設定データモデル変更:**

```
users/{uid}.settings:
  sleep_time: string       // "23:00" 等。新規追加
  timezone: string         // "Asia/Tokyo"（既存、デフォルト維持）
  // cheer_frequency, push_enabled 等は既存のまま
```

### 3.2 ストリーク計算の統一

**目的:** `logService.ts` と `gamification.ts` で異なるストリーク定義を統一する。

**仕様:**
- ストリーク計算ロジックを1箇所に集約（`logService.ts` に統合、`gamification.ts` の独自実装を削除）
- 定義: 日付境界（就寝時間ベース）を基準に、連続してログが存在する日数
- 日付境界を過ぎていなければ前日のログでもストリーク継続
- `gamification.ts` はストリーク値を `logService` から受け取ってバッジ判定のみ行う

---

## 4. Onboarding 再設計

### 4.1 フロー

**目的:** 初回起動時に必要な設定をガイドし、アプリ全体の UX を向上させる。

**ステップ:**

1. **ようこそ**
   - アプリの一言紹介
   - Lottie アニメーション

2. **お名前を教えてください**（任意・スキップ可）
   - テキスト入力フィールド
   - 説明: 「応援メッセージに表示される名前です。設定しない場合は『匿名ユーザー』と表示されます」
   - 補足: 「あとから設定画面でいつでも変更できます」

3. **大体何時ごろに寝ますか？**（任意・スキップ可）
   - 時刻ピッカーまたは選択肢（22時 / 23時 / 0時 / 1時 / 2時 / 3時以降）
   - 説明: 「深夜に記録した習慣を"今日の分"として正しく扱うために使います。例えば23時に寝る方は、23時までの記録がその日の分として計算されます」
   - 補足: 「あとから設定画面でいつでも変更できます」

4. **通知を許可しますか？**（OS許可ダイアログ）
   - 説明: 「習慣のリマインダーや、仲間からの応援メッセージを受け取るために使います」
   - 補足: 「あとから端末の設定アプリでいつでも変更できます」

5. **準備完了**
   - 設定サマリを表示（名前、就寝時間、通知）
   - 「あとからすべて設定画面で変更できます」を明示
   - 「始める」ボタンでホーム画面へ遷移

### 4.2 設定画面の対応改修

- 表示名、就寝時間、通知設定の各項目を設定画面に配置
- 各項目にその設定が何に影響するかの説明文を付記
- データ移行セクション（1.1）を追加

---

## 5. Cloud Functions のスケーラビリティ

### 5.1 フラグベース設計への移行

**目的:** 全ユーザースキャンを廃止し、対象ユーザーのみを処理する。

**仕様:**

**`checkStreakBreak`（毎日9:00）:**
- 現状: `db.collection('users').get()` で全ユーザー取得
- 改修: ログ記録時に `cards` ドキュメントに `needs_streak_check: true` を設定。cron は `where('needs_streak_check', '==', true)` でクエリし、処理後にフラグを解除

**`deliverBatchNotifications`（毎時）:**
- 現状: `db.collection('users').get()` で全ユーザー取得
- 改修: `users` ドキュメントに `has_pending_batch_notifications: true` フラグを設定（`onHumanCheerSent` / システムチア作成時にバッチモードユーザーに対して設定）。cron は該当ユーザーのみ処理

**`sendRandomCheer`（6時間ごと）:**
- 現状: `.limit(100)` で先頭100人のみ
- 改修: `users` ドキュメントに `last_random_cheer_at` フィールドを追加。cron は `where('last_random_cheer_at', '<', 24hAgo)` + `where('settings.cheer_frequency', '!=', 'off')` で対象を絞り込み、処理後にタイムスタンプを更新

---

## 6. 状態管理アーキテクチャ

### 6.1 React Context によるリスナー共有

**目的:** 同一クエリへのリスナー重複を解消し、Firestore 読み取りコストを削減する。

**仕様:**

**共有対象の Provider:**

| Provider | 提供データ | リスナー対象 |
|---|---|---|
| `CardsProvider` | ユーザーの全カード | `cards` where `owner_uid == uid` |
| `ReactionsProvider` | 受信リアクション | `reactions` where `to_uid == uid` |
| `StatsProvider` | ログデータ + 集計結果 | `logs` where `owner_uid == uid` |
| `SettingsProvider` | ユーザー設定 | `users/{uid}` 単一ドキュメント |
| `CategoriesProvider` | カテゴリマスタ | `categories` where `is_active == true`（※一度取得後はキャッシュ。リアルタイムリスナー不要） |

**配置:** `_layout.tsx` の `RootLayoutInner` 内、認証完了後に Provider をネスト

**各 hook の改修:**
- `useCards` → `CardsContext` から取得
- `useReactions` → `ReactionsContext` から取得
- `useStats` → `StatsContext` から取得（スナップショットデータを直接集計、再クエリ廃止）
- `useSettings` → `SettingsContext` から取得
- `useCategories` → `CategoriesContext` から取得（`onSnapshot` → `getDocs` + キャッシュに変更）

### 6.2 `useStats` の読み取り増幅解消

**目的:** スナップショットデータを捨てて再クエリする無駄を排除する。

**仕様:**
- `StatsProvider` が `logs` コレクションの `onSnapshot` を保持
- スナップショットのコールバックで受け取ったドキュメント群から直接集計を実行
- `statsService.calculateUserStats` は `getDocs` を呼ばず、渡されたドキュメント配列から計算する純粋関数に変更
- 集計結果を Context 経由で全画面に提供

---

## 7. Firestore Security Rules 改修

### 7.1 修正事項

| 問題 | 改修内容 |
|---|---|
| `users/{uid}` が全認証ユーザーに読み取り可能 | 他ユーザーは `display_name` のみ読み取り可能に制限。`settings`, `stats`, `fcm_token` 等は本人のみ |
| `cheer_send_state` にフィールドバリデーションなし | 書き込み可能フィールドを `daily_send_count`, `daily_send_date`, `sent_pairs`, `updated_at` に制限 |
| `reactions` の update がフィールド制限なし | `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['is_read'])` を適用 |
| `cards` の読み取り条件 | `is_public_for_cheers`, `is_public_for_template` の条件を削除し `is_public == true` のみに |
| `migration_codes` | 新規追加。発行は本人のみ、参照は認証済みユーザー（コード入力による復元に必要） |

---

## 8. デッドコード・不整合の解消

### 8.1 削除対象

| ファイル | 対象 |
|---|---|
| `app/_layout.tsx` | `animationFinished` state |
| `app/add-card.tsx` | `retryButton`, `retryText` スタイル |
| `app/card-detail/[id].tsx` | 未使用 Firestore import 5件（`collection`, `getDocs`, `writeBatch`, `query`, `where`） |
| `app/settings/account-deletion.tsx` | 未使用 import 3件（`GoogleAuthProvider`, `reauthenticateWithCredential`, `signInWithCredential`） |
| `app/(tabs)/home.tsx` | `getCategoryIcon` 関数、`notificationCount` ハードコード |
| `src/hooks/usePublicCards.ts` | ファイル全体（公開カードのテンプレート表示廃止に伴い削除） |
| `src/types/index.ts` | `UserStats` 型、`is_public_for_cheers` / `is_public_for_template` フィールド |

### 8.2 型安全性の修正

| ファイル | 対象 |
|---|---|
| `src/types/index.ts` | `MatchingPool` に `category_l3_name_ja` フィールド追加 |
| `src/types/index.ts` | `CheerReason` に `'manual'` を追加 |
| `src/services/cheerSendService.ts` | `@ts-ignore` を削除（型修正後は不要） |
| `src/hooks/useSettings.ts` | ローカル `UserSettings` 型を削除し `src/types` の定義に統一 |
| `app/archived-cards.tsx` | `any` 型 4箇所を適切な型に修正 |
| `app/(tabs)/home.tsx` | `any` 型 2箇所を適切な型に修正 |
| `app/edit-card.tsx` | `handleTimeChange` の `any` を適切なイベント型に修正 |
| `src/components/CategoryCard.tsx` | `style?: any` → `style?: StyleProp<ViewStyle>` |
| `src/components/SuccessAnimation.tsx` | `source?: any` → 適切な Lottie source 型 |

### 8.3 `is_public` 三重定義に伴う不整合解消

- `edit-card.tsx`: 変更不要（統合後は `is_public` が正となるため自然に修正される）
- `functions/src/index.ts`: `checkStreakBreak`, `sendRandomCheer` のクエリが正しく機能するようになる

---

## 9. CI/CD 改修

### 9.1 修正事項

| 問題 | 改修内容 |
|---|---|
| Cloud Functions のテストが CI で実行されていない | `.github/workflows/test.yml` に `cd functions && npm test` ステップを追加 |
| CI で build/型チェックが実行されていない | `npx tsc --noEmit` ステップを追加 |

---

## 10. 実装優先度

### Phase 1: 基盤修正（安定運用の前提条件）

1. `onAuthStateChanged` リスナー追加（1.2）
2. アカウント削除後の状態回復（1.3）
3. 日付境界ユーティリティ作成 + UTC 直接使用の全面置換（3.1）
4. ストリーク計算の統一（3.2）
5. Firestore Security Rules 改修（7.1）
6. デッドコード削除 + 型安全性修正（8.1, 8.2）
7. CI 改修（9.1）

### Phase 2: データモデル改修

1. `is_public` フラグ統合 + データマイグレーション（2.1）
2. `User.stats` 廃止（2.3）
3. カード削除の完全カスケード（2.4）
4. 孤立データ防止（2.5）
5. `cheer_send_state` の cleanup 追加（2.4 内）

### Phase 3: アーキテクチャ改善

1. React Context によるリスナー共有（6.1）
2. `useStats` の読み取り増幅解消（6.2）
3. Cloud Functions のフラグベース設計移行（5.1）

### Phase 4: UX 改善

1. Onboarding 全面再設計（4.1）
2. 設定画面の対応改修（4.2）
3. カード作成フローの再設計（2.2）
4. チア画面への「この習慣を始める」ボタン追加（2.2）
5. 移行コード機能（1.1）
