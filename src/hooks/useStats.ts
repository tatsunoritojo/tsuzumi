// src/hooks/useStats.ts
// ユーザー統計を取得するカスタムフック

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { calculateUserStats, StatsResult } from '../services/statsService';
import { useSettings } from './useSettings';

export function useStats() {
  const [stats, setStats] = useState<StatsResult>({ weekDays: 0, monthDays: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setLoading(false);
      setError(new Error('ユーザーが認証されていません'));
      return;
    }

    // ログの変更をリアルタイムで監視
    const logsQuery = query(
      collection(db, 'logs'),
      where('owner_uid', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      async () => {
        // ログが変更されたら統計を再計算
        try {
          const userStats = await calculateUserStats(
            currentUser.uid,
            settings.sleep_time,
            settings.timezone,
          );
          setStats(userStats);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('統計取得エラー:', err);
          setError(err as Error);
          setLoading(false);
        }
      },
      (err) => {
        console.error('統計監視エラー:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // クリーンアップ
    return () => unsubscribe();
  }, [settings.sleep_time, settings.timezone]);

  return { stats, loading, error };
}
