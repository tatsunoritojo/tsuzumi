import { Log, Card } from '../types';
import { calculateCurrentStreak } from '../services/logService';

export type Badge = {
    id: string;
    name: string;
    icon: string;
    description: string;
    achieved: boolean;
    condition_value: number;
};

export const BADGE_DEFINITIONS: Omit<Badge, 'achieved'>[] = [
    { id: 'bronze', name: '3日継続', icon: '🥉', description: '3日連続で達成しました！', condition_value: 3 },
    { id: 'silver', name: '7日継続', icon: '🥈', description: '7日連続で達成しました！', condition_value: 7 },
    { id: 'gold', name: '21日継続', icon: '🥇', description: '21日連続で達成しました！習慣化の達人です！', condition_value: 21 },
    { id: 'resume', name: '復活の一歩', icon: '❤️‍🔥', description: '中断を乗り越えて3日連続達成！おかえりなさい！', condition_value: 3 },
    { id: 'diamond', name: '100回記録', icon: '💎', description: '累計100回記録しました！素晴らしい継続力です！', condition_value: 100 },
];

/**
 * バッジ判定。ストリーク計算は logService に委譲。
 */
export function getBadges(
    card: Card,
    logs: Log[],
    sleepTime?: string | null,
    timezone?: string,
): Badge[] {
    const badges = BADGE_DEFINITIONS.map(def => ({ ...def, achieved: false }));

    // logService の統一ストリーク計算を使用
    const logDates = [...logs]
        .filter(l => l.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(l => new Date(l.date));
    const currentStreak = calculateCurrentStreak(logDates, sleepTime, timezone);

    if (currentStreak >= 3) badges.find(b => b.id === 'bronze')!.achieved = true;
    if (currentStreak >= 7) badges.find(b => b.id === 'silver')!.achieved = true;
    if (currentStreak >= 21) badges.find(b => b.id === 'gold')!.achieved = true;

    // Resume logic (Gap + 3 days streak)
    const uniqueDates = new Set(logs.map(l => l.date)).size;
    if (currentStreak >= 3 && uniqueDates > currentStreak) {
        badges.find(b => b.id === 'resume')!.achieved = true;
    }

    // Total logs logic
    const totalLogs = logs.length;
    if (totalLogs >= 100) badges.find(b => b.id === 'diamond')!.achieved = true;

    return badges;
}
