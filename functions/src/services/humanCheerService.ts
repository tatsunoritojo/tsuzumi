// functions/src/services/humanCheerService.ts
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { isQuietHours } from './cheerService';

/**
 * 人間からのエールが送信された時の処理
 */
export async function onHumanCheerSentLogic(
    snap: functions.firestore.QueryDocumentSnapshot,
    context: functions.EventContext
): Promise<any> {
    const reaction = snap.data();
    const db = admin.firestore();

    // AIエールは別処理（Phase 7で実装済み）なので無視
    // ※インデックスでフィルタするのが効率的だが、ここでは関数内でガード
    if (reaction.from_uid === 'system') {
        return null;
    }

    const { to_uid, to_card_id, type } = reaction;

    try {
        // 1. 受信者の情報を取得
        const toUserSnap = await db.collection('users').doc(to_uid).get();
        if (!toUserSnap.exists) {
            console.log(`onHumanCheerSent: 受信ユーザーが存在しません uid=${to_uid}`);
            return null;
        }
        const toUserData = toUserSnap.data();
        if (!toUserData) return null;

        // 2. お休みモード判定
        // 設定がない場合はデフォルトOFFまたは既存設定に従う
        const settings = toUserData.settings || {};

        if (isQuietHours(settings)) {
            console.log(`onHumanCheerSent: お休みモード中のため遅延送信 uid=${to_uid}`);
            // scheduled_forを設定して後で配信
            // 翌朝の開始時刻（またはお休みモード終了時刻）に設定
            const nextDelivery = getNextQuietHourEnd(settings);

            await snap.ref.update({
                scheduled_for: admin.firestore.Timestamp.fromDate(nextDelivery),
                delivered: false
            });
            return null;
        }

        // 3. 通知モード判定
        if (settings.notification_mode === 'batch') {
            console.log(`onHumanCheerSent: まとめて通知モードのため遅延送信 uid=${to_uid}`);
            // 次のバッチ配信時刻を取得
            const nextBatchTime = getNextBatchTime(settings.batch_times);

            await snap.ref.update({
                scheduled_for: admin.firestore.Timestamp.fromDate(nextBatchTime),
                delivered: false
            });
            return null;
        }

        // 4. リアルタイム通知送信
        // メッセージ構築: カード情報を取得してカテゴリ名を入れる
        const cardSnap = await db.collection('cards').doc(to_card_id).get();
        const cardData = cardSnap.exists ? cardSnap.data() : null;

        // カテゴリ名取得
        let categoryName = '習慣';
        if (cardData && cardData.category_l3) {
            const catSnap = await db.collection('categories').doc(cardData.category_l3).get();
            if (catSnap.exists) {
                categoryName = catSnap.data()?.name_ja || '習慣';
            }
        }

        // 文字列構築
        // type: cheer -> 💪 継続、amazing -> ⭐ すごい、support -> 🤝 一緒
        const typeLabel = getTypeLabel(type);
        const title = `${categoryName}の仲間からエール`;
        const body = `${typeLabel}が届きました！`;

        await sendHumanPushNotification(to_uid, title, body, settings.fcm_token);

        // 5. 配信済みフラグ更新
        await snap.ref.update({
            delivered: true,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`onHumanCheerSent: 送信完了 uid=${to_uid}`);
        return null;

    } catch (error) {
        console.error('onHumanCheerSent error:', error);
        return null; // エラー時もPromiseを返す
    }
}

/**
 * リアクション種別のラベル取得
 */
function getTypeLabel(type: string): string {
    switch (type) {
        case 'cheer': return '💪 ナイス継続';
        case 'amazing': return '⭐ すごい！';
        case 'support': return '🤝 一緒にがんばろ';
        default: return 'エール';
    }
}

/**
 * お休みモード終了時刻（翌朝）を取得
 */
function getNextQuietHourEnd(settings: any): Date {
    const now = new Date();
    const [endHour, endMinute] = (settings.quiet_hours_end || '07:00').split(':').map(Number);

    const nextEnd = new Date(now);
    nextEnd.setHours(endHour, endMinute, 0, 0);

    // もし終了時刻が現在より前なら、明日の終了時刻
    if (nextEnd <= now) {
        nextEnd.setDate(nextEnd.getDate() + 1);
    }

    return nextEnd;
}

/**
 * 次のバッチ配信時刻を取得
 */
function getNextBatchTime(batchTimes: string[] = []): Date {
    const now = new Date();
    const times = batchTimes.length > 0 ? batchTimes : ['08:00', '12:00', '20:00']; // デフォルト

    // 現在時刻以降で最も近い時刻を探す
    let nextTime: Date | null = null;

    // ソートしておく
    const sortedTimes = [...times].sort();

    for (const timeStr of sortedTimes) {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date(now);
        d.setHours(h, m, 0, 0);

        if (d > now) {
            nextTime = d;
            break;
        }
    }

    // 今日の中に候補がなければ、明日の最初の時刻
    if (!nextTime) {
        const [h, m] = sortedTimes[0].split(':').map(Number);
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(h, m, 0, 0);
        nextTime = d;
    }

    return nextTime;
}

/**
 * 人間エール用プッシュ通知
 */
async function sendHumanPushNotification(userId: string, title: string, body: string, fcmToken?: string) {
    if (!fcmToken) return;

    try {
        await admin.messaging().send({
            token: fcmToken,
            notification: {
                title,
                body,
            },
            data: {
                type: 'human_cheer',
            },
        });
    } catch (e) {
        console.error(`Push notification failed for ${userId}`, e);
    }
}
