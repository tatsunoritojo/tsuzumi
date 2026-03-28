// src/services/logService.ts
// ログ記録とストリーク計算のサービス

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Log } from '../types';
import { getAppToday } from '../utils/dateUtils';

/**
 * ログを記録し、カードの統計を更新する
 */
export async function recordLog(
  cardId: string,
  ownerUid: string,
  sleepTime?: string | null,
  timezone?: string,
): Promise<void> {
  const now = Timestamp.now();
  const today = getAppToday(sleepTime, timezone);

  try {
    // 1. ログを作成
    const logData = {
      card_id: cardId,
      owner_uid: ownerUid,
      date: today,
      logged_at: now,
    };

    await addDoc(collection(db, 'logs'), logData);

    // 2. カードの統計を計算
    const stats = await calculateCardStats(cardId, ownerUid, sleepTime, timezone);

    // 3. カードを更新
    const cardRef = doc(db, 'cards', cardId);
    await updateDoc(cardRef, {
      current_streak: stats.currentStreak,
      longest_streak: stats.longestStreak,
      total_logs: stats.totalLogs,
      last_log_date: today,
      updated_at: now,
    });
  } catch (error) {
    console.error('ログ記録エラー:', error);
    throw error;
  }
}

/**
 * カードの統計を計算
 */
async function calculateCardStats(
  cardId: string,
  ownerUid: string,
  sleepTime?: string | null,
  timezone?: string,
): Promise<{
  currentStreak: number;
  longestStreak: number;
  totalLogs: number;
}> {
  try {
    // カードの全ログを取得
    // 注：orderByを削除してインデックス不要に
    const logsQuery = query(
      collection(db, 'logs'),
      where('card_id', '==', cardId),
      where('owner_uid', '==', ownerUid)
    );

    const logsSnapshot = await getDocs(logsQuery);
    const logs = logsSnapshot.docs
      .map((doc) => doc.data() as Log)
      .filter((log) => log.date) // dateが存在するもののみ
      .sort((a, b) => b.date!.localeCompare(a.date!)); // 降順ソート

    const totalLogs = logs.length;

    if (totalLogs === 0) {
      return { currentStreak: 0, longestStreak: 0, totalLogs: 0 };
    }

    // ログ日付をDate配列に変換（降順 = 新しい順）
    const logDates = logs.map((log) => new Date(log.date));

    // 現在のストリークを計算
    const currentStreak = calculateCurrentStreak(logDates, sleepTime, timezone);

    // 最長ストリークを計算
    const longestStreak = calculateLongestStreak(logDates);

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      totalLogs,
    };
  } catch (error) {
    console.error('統計計算エラー:', error);
    throw error;
  }
}

/**
 * 現在のストリークを計算（今日から遡って連続している日数）
 */
export function calculateCurrentStreak(
  logDates: Date[],
  sleepTime?: string | null,
  timezone?: string,
): number {
  if (logDates.length === 0) return 0;

  const todayStr = getAppToday(sleepTime, timezone);
  const today = new Date(todayStr);
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let checkDate = new Date(today);

  for (const logDate of logDates) {
    const log = new Date(logDate);
    log.setHours(0, 0, 0, 0);

    if (isSameDate(log, checkDate)) {
      streak++;
      // 次の日をチェック（1日前）
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (log < checkDate) {
      // 連続が途切れた
      break;
    }
  }

  return streak;
}

/**
 * 最長ストリークを計算（全期間で最も長かった連続日数）
 */
export function calculateLongestStreak(logDates: Date[]): number {
  if (logDates.length === 0) return 0;

  // 日付を古い順にソート
  const sortedDates = [...logDates].sort((a, b) => a.getTime() - b.getTime());

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);

    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);

    // 前の日付の翌日と比較
    const nextDay = new Date(prevDate);
    nextDay.setDate(nextDay.getDate() + 1);

    if (isSameDate(currDate, nextDay)) {
      // 連続している
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else if (!isSameDate(currDate, prevDate)) {
      // 連続が途切れた（同じ日でない場合のみリセット）
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * 2つの日付が同じ日かチェック
 */
function isSameDate(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
