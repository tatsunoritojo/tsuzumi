// src/types/index.ts
// MVP仕様書に基づいたデータ型定義

import { Timestamp } from 'firebase/firestore';

// ========================================
// User（ユーザー）
// ========================================
export type User = {
  uid: string;
  display_name: string | null; // ニックネーム（1〜20文字、null=未設定）
  created_at: Timestamp;
  last_login_at: Timestamp;
  settings: UserSettings;
};

export type UserSettings = {
  cheer_frequency: 'high' | 'medium' | 'low' | 'off';
  push_enabled: boolean;
  timezone: string; // "Asia/Tokyo"
  sleep_time?: string | null; // "23:00" 等。日付境界 = sleep_time + 1時間

  // Phase 7: エール通知設定
  notification_mode: 'realtime' | 'batch'; // リアルタイム or まとめて通知
  batch_times: string[]; // まとめて通知の配信時刻 例: ["12:00", "18:00", "22:00"]
  quiet_hours_enabled: boolean; // お休みモード（デフォルト: true）
  quiet_hours_start: string; // お休み開始時刻（デフォルト: "23:00"）
  quiet_hours_end: string; // お休み終了時刻（デフォルト: "07:00"）

  // FCMトークン
  fcm_token?: string | null; // デバイストークン
};

// ========================================
// Card（習慣カード）
// ========================================
export type Card = {
  card_id: string;
  owner_uid: string;

  // カテゴリ（3階層）
  category_l1: string; // 例: "health"
  category_l2: string; // 例: "exercise"
  category_l3: string; // 例: "muscle_training"

  // カード情報
  title: string;
  icon?: string; // 絵文字アイコン（テンプレートから継承 or カスタム選択）
  template_id: string;
  is_custom: boolean; // MVP: 常にfalse

  // 公開設定: チアシステムに参加（エール受信 + 採用許可）
  is_public: boolean;

  // 統計（非正規化）
  current_streak: number;
  longest_streak: number;
  total_logs: number;
  last_log_date: string; // "YYYY-MM-DD"

  // Phase 9: ステータス管理と通知
  status: 'active' | 'archived';
  archived_at?: Timestamp | null;
  reminder_enabled?: boolean;
  reminder_time?: string | null; // "HH:mm"

  created_at: Timestamp;
  updated_at: Timestamp;
};

// ========================================
// Log（達成ログ）
// ========================================
export type Log = {
  log_id: string;
  card_id: string;
  owner_uid: string;

  date: string; // "YYYY-MM-DD"
  logged_at: Timestamp;
};

// ========================================
// Category（カテゴリマスタ）
// ========================================
export type Category = {
  category_id: string;
  level: 1 | 2 | 3;
  parent_id: string | null;

  name_ja: string;
  name_en: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
};

// ========================================
// CardTemplate（カードテンプレート）
// ========================================
export type CardTemplate = {
  template_id: string;

  category_l1: string;
  category_l2: string;
  category_l3: string;

  title_ja: string;
  title_en: string;
  description_ja: string | null;

  icon: string;
  sort_order: number;
  is_official: boolean; // MVP: 常にtrue
  is_active: boolean;
  created_at: Timestamp;
};

// ========================================
// MatchingPool（マッチングプール）
// ========================================
export type MatchingPool = {
  category_l3: string;
  category_l3_name_ja?: string;
  active_cards: MatchingPoolCard[];
  updated_at: Timestamp;
};

export type MatchingPoolCard = {
  card_id: string;
  owner_uid: string;
  title?: string;
  current_streak: number;
  last_log_date: string;
  total_logs?: number;
  is_comeback?: boolean;
};

// ========================================
// Reaction（エール）
// ========================================
export type Reaction = {
  reaction_id: string;

  from_uid: string; // システムエール: "system"
  to_uid: string;
  to_card_id: string;

  type: ReactionType;

  // Phase 7: システムエール拡張
  reason?: CheerReason; // エール送信理由（システムエールのみ）
  message?: string; // エール文言（システムエールのみ）
  scheduled_for?: Timestamp | null; // まとめて通知用の配信予定時刻
  delivered?: boolean; // 配信済みフラグ

  // Phase 9: カード情報の非正規化（通知画面用）
  card_title?: string; // カードタイトル
  card_category_name?: string; // カテゴリ名（日本語）

  created_at: Timestamp;
  is_read: boolean;
};

export type ReactionType = 'cheer' | 'amazing' | 'support';

// Phase 7: エール送信理由
export type CheerReason = 'record' | 'streak_break' | 'long_absence' | 'random' | 'manual';

// リアクション表示情報
export type ReactionInfo = {
  type: ReactionType;
  label: string;
  icon: string;
  description: string;
};

// リアクションマスタ
export const REACTIONS: Record<ReactionType, ReactionInfo> = {
  cheer: {
    type: 'cheer',
    label: 'ナイス継続',
    icon: '💪',
    description: '継続そのものへの励まし。基礎リアクション。',
  },
  amazing: {
    type: 'amazing',
    label: 'すごい！',
    icon: '⭐',
    description: '節目・成長へのお祝い。ハイライト時に。',
  },
  support: {
    type: 'support',
    label: '一緒にがんばろ',
    icon: '🤝',
    description: '伴走感・仲間感。同じカテゴリで頑張っている共感。',
  },
};

// ========================================
// CheerState（エール状態管理）- Phase 7
// ========================================
export type CheerState = {
  user_uid: string;

  // 1日あたりの送信カウント
  daily_count: number;
  daily_count_date: string; // "YYYY-MM-DD"

  // パターン②用：週あたりの送信カウント
  weekly_streak_break_count: number;
  weekly_streak_break_reset_date: string; // 週の開始日 "YYYY-MM-DD"

  // パターン④用：最終ランダムエール日時
  last_random_cheer_at: Timestamp | null;

  // パターン③用：カード別の長期離脱エール送信履歴
  long_absence_cheers: {
    [card_id: string]: {
      count: number; // 送信回数（最大3）
      last_sent_at: Timestamp;
    };
  };

  // ユーザーの主要記録時間帯（学習結果）
  primary_recording_hour: number | null; // 0-23、nullはデータ不足

  updated_at: Timestamp;
};

// ========================================
// CheerSendState（人間エール送信状態）- Phase 8
// ========================================
export type CheerSendState = {
  user_uid: string;
  daily_send_count: number;
  daily_send_date: string;
  sent_pairs: SentPair[];
  updated_at: Timestamp;
};

export type SentPair = {
  to_card_id: string;
  sent_at: Timestamp;
};

// ========================================
// Favorite（お気に入り）- Phase 10-A
// ========================================
export type Favorite = {
  doc_id: string;              // auto-generated
  owner_uid: string;           // お気に入り登録した人のUID
  target_uid: string;          // お気に入り対象のUID
  target_card_id: string;      // 対象のカードID
  category_l3: string;         // マッチングカテゴリ（検索用）
  created_at: Timestamp;
};

// ========================================
// カテゴリL1マスタ
// ========================================
export type CategoryL1Id = 'health' | 'learning' | 'lifestyle' | 'creative' | 'mindfulness';

export const CATEGORY_L1_INFO: Record<CategoryL1Id, { name_ja: string; name_en: string }> = {
  health: { name_ja: '健康', name_en: 'Health' },
  learning: { name_ja: '学習', name_en: 'Learning' },
  lifestyle: { name_ja: '生活習慣', name_en: 'Lifestyle' },
  creative: { name_ja: '創作', name_en: 'Creative' },
  mindfulness: { name_ja: 'マインドフルネス', name_en: 'Mindfulness' },
};
