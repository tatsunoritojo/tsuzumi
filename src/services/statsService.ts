// src/services/statsService.ts
// ユーザー統計計算サービス

import {
  collection,
  query,
  where,
  getDocs,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Log } from '../types';
import { getWeekStartDate, getMonthStartDate } from '../utils/dateUtils';

export interface StatsResult {
  weekDays: number;  // 今週の達成日数
  monthDays: number; // 今月の達成日数
}

/**
 * ユーザーの統計を計算
 * @param ownerUid ユーザーUID
 * @param sleepTime 就寝時間（日付境界計算用）
 * @param timezone タイムゾーン
 * @returns 今週・今月の達成日数
 */
export async function calculateUserStats(
  ownerUid: string,
  sleepTime?: string | null,
  timezone?: string,
): Promise<StatsResult> {
  try {
    const weekStartStr = getWeekStartDate(sleepTime, timezone);
    const monthStartStr = getMonthStartDate(sleepTime, timezone);

    // ユーザーの全ログを取得
    const logsQuery = query(
      collection(db, 'logs'),
      where('owner_uid', '==', ownerUid)
    );

    const logsSnapshot: QuerySnapshot<DocumentData> = await getDocs(logsQuery);
    const logs = logsSnapshot.docs.map((doc) => doc.data() as Log);

    // 今週のログをフィルタ
    const weekLogs = logs.filter((log) => log.date >= weekStartStr);

    // 今月のログをフィルタ
    const monthLogs = logs.filter((log) => log.date >= monthStartStr);

    // ユニークな日付をカウント（複数のカードで同じ日に記録しても1日とカウント）
    const weekDays = new Set(weekLogs.map((log) => log.date)).size;
    const monthDays = new Set(monthLogs.map((log) => log.date)).size;

    return {
      weekDays,
      monthDays,
    };
  } catch (error) {
    console.error('統計計算エラー:', error);
    throw error;
  }
}
