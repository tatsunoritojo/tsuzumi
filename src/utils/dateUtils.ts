// src/utils/dateUtils.ts
// 日付境界ユーティリティ — アプリ全体の日付判定を統一する

/**
 * ユーザーの就寝時間とタイムゾーンに基づいて「アプリ上の今日」を返す。
 *
 * 日付境界 = sleepTime + 1時間。
 * 境界を過ぎていなければ前日扱い（深夜の記録を「今日の分」として扱う）。
 *
 * @param sleepTime "HH:mm" 形式の就寝時間。null/undefined = 境界 0:00（標準の日付変更）
 * @param timezone  IANA タイムゾーン文字列。デフォルト "Asia/Tokyo"
 * @returns "YYYY-MM-DD" 形式の日付文字列
 */
export function getAppToday(
  sleepTime?: string | null,
  timezone: string = 'Asia/Tokyo',
): string {
  return getAppDate(new Date(), sleepTime, timezone);
}

/**
 * 任意の Date オブジェクトを「アプリ上の日付」に変換する。
 */
export function getAppDate(
  date: Date,
  sleepTime?: string | null,
  timezone: string = 'Asia/Tokyo',
): string {
  const { year, month, day, hour, minute } = getDatePartsInTimezone(date, timezone);

  const boundaryMinutes = calcBoundaryMinutes(sleepTime);
  const currentMinutes = hour * 60 + minute;

  if (boundaryMinutes === 0) {
    // 標準の日付変更（0:00）— 調整不要
    return formatDate(year, month, day);
  }

  if (boundaryMinutes <= 720) {
    // 早朝境界（1:00〜12:00）: 境界前なら前日扱い
    if (currentMinutes < boundaryMinutes) {
      return shiftDay(year, month, day, -1);
    }
    return formatDate(year, month, day);
  }

  // 夜間境界（例: 23:00）: 境界以降なら翌日扱い
  if (currentMinutes >= boundaryMinutes) {
    return shiftDay(year, month, day, +1);
  }
  return formatDate(year, month, day);
}

/**
 * タイムゾーン対応の「今週の開始日（月曜日）」を返す。
 */
export function getWeekStartDate(
  sleepTime?: string | null,
  timezone: string = 'Asia/Tokyo',
): string {
  const todayStr = getAppToday(sleepTime, timezone);
  const date = new Date(todayStr + 'T12:00:00'); // noon to avoid DST issues
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setDate(date.getDate() + diff);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * タイムゾーン対応の「今月の開始日（1日）」を返す。
 */
export function getMonthStartDate(
  sleepTime?: string | null,
  timezone: string = 'Asia/Tokyo',
): string {
  const todayStr = getAppToday(sleepTime, timezone);
  return todayStr.slice(0, 7) + '-01';
}

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

function calcBoundaryMinutes(sleepTime?: string | null): number {
  if (!sleepTime) return 0;
  const [h, m] = sleepTime.split(':').map(Number);
  // boundary = sleepTime + 1 hour
  const boundaryHour = (h + 1) % 24;
  return boundaryHour * 60 + m;
}

function getDatePartsInTimezone(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find((p) => p.type === 'year')!.value, 10),
    month: parseInt(parts.find((p) => p.type === 'month')!.value, 10),
    day: parseInt(parts.find((p) => p.type === 'day')!.value, 10),
    hour: parseInt(parts.find((p) => p.type === 'hour')!.value, 10),
    minute: parseInt(parts.find((p) => p.type === 'minute')!.value, 10),
  };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftDay(year: number, month: number, day: number, offset: number): string {
  const d = new Date(year, month - 1, day + offset);
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
