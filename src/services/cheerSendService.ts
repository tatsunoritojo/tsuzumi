// src/services/cheerSendService.ts
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    setDoc,
    serverTimestamp,
    Timestamp,
    writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    Card,
    CheerSendState,
    MatchingPool,
    MatchingPoolCard,
    ReactionType,
} from '../types';
import { getAppToday } from '../utils/dateUtils';

/**
 * 送信済みチェック用のヘルパー型
 */
export type CheerSuggestion = MatchingPoolCard & {
    category_l3: string;
    category_name_ja: string;
};

// 1日の送信上限
const DAILY_SEND_LIMIT = 10;

/**
 * エール提案を取得
 * @param userId 自分のUID
 * @returns 提案リスト（最大3件）
 */
export async function getCheerSuggestions(userId: string): Promise<CheerSuggestion[]> {
    try {
        // 1. ユーザーの公開カードを取得して、自分のカテゴリL3を特定
        const cardsRef = collection(db, 'cards');
        const q = query(
            cardsRef,
            where('owner_uid', '==', userId),
            where('is_public_for_cheers', '==', true)
        );
        const querySnapshot = await getDocs(q);

        // カテゴリL3を抽出（重複排除）
        const categoryL3s = new Set<string>();
        querySnapshot.forEach((doc) => {
            const data = doc.data() as Card;
            if (data.category_l3) {
                categoryL3s.add(data.category_l3);
            }
        });

        if (categoryL3s.size === 0) {
            return [];
        }

        // 2. 送信状態を取得（過去24時間以内に送信済みの除外用）
        const sendState = await getOrCreateCheerSendState(userId);
        const recentlySentCardIds = new Set<string>();
        const now = new Date();

        sendState.sent_pairs.forEach((pair) => {
            const sentTime = pair.sent_at.toDate();
            const diffHours = (now.getTime() - sentTime.getTime()) / (1000 * 60 * 60);
            if (diffHours < 24) {
                recentlySentCardIds.add(pair.to_card_id);
            }
        });

        // 3. 各カテゴリのマッチングプールから候補を取得
        const suggestions: CheerSuggestion[] = [];

        // 並行処理で取得
        const promises = Array.from(categoryL3s).map(async (categoryL3) => {
            const poolRef = doc(db, 'matching_pools', categoryL3);
            const poolSnap = await getDoc(poolRef);

            if (poolSnap.exists()) {
                const poolData = poolSnap.data() as MatchingPool;
                const candidates = poolData.active_cards || [];

                // フィルタリング
                candidates.forEach((card) => {
                    // 自分自身を除外
                    if (card.owner_uid === userId) return;
                    // 最近送信済みを除外
                    if (recentlySentCardIds.has(card.card_id)) return;

                    suggestions.push({
                        ...card,
                        category_l3: categoryL3,
                        category_name_ja: poolData.category_l3_name_ja || '習慣の仲間',
                    });
                });
            }
        });

        await Promise.all(promises);

        // 4. シャッフルして上位3件を返す
        return shuffleArray(suggestions).slice(0, 3);
    } catch (error) {
        console.error('getCheerSuggestions error:', error);
        return [];
    }
}

/**
 * エール送信
 */
export async function sendCheer(
    fromUid: string,
    toCardId: string,
    toUid: string,
    type: ReactionType,
    sleepTime?: string | null,
    timezone?: string,
): Promise<string> {
    const batch = writeBatch(db);

    // 1. 送信制限チェック
    const sendState = await getOrCreateCheerSendState(fromUid, sleepTime, timezone);
    const dateStr = getTodayString(sleepTime, timezone);

    // 1日上限チェック
    if (sendState.daily_send_date === dateStr && sendState.daily_send_count >= DAILY_SEND_LIMIT) {
        throw new Error('DAILY_LIMIT_REACHED');
    }

    // 同一ペア24時間制限チェック
    const now = new Date();
    const recentlySent = sendState.sent_pairs.find((p) => {
        if (p.to_card_id !== toCardId) return false;
        const sentTime = p.sent_at.toDate();
        const diffHours = (now.getTime() - sentTime.getTime()) / (1000 * 60 * 60);
        return diffHours < 24;
    });

    if (recentlySent) {
        throw new Error('ALREADY_SENT_TODAY');
    }

    // 2. カード情報を取得（非正規化用）
    const cardRef = doc(db, 'cards', toCardId);
    const cardSnap = await getDoc(cardRef);
    let cardTitle = '習慣カード';
    let cardCategoryName = '習慣';

    if (cardSnap.exists()) {
        const cardData = cardSnap.data() as Card;
        cardTitle = cardData.title;

        // カテゴリ名を取得
        if (cardData.category_l3) {
            const catRef = doc(db, 'categories', cardData.category_l3);
            const catSnap = await getDoc(catRef);
            if (catSnap.exists()) {
                cardCategoryName = catSnap.data().name_ja || '習慣';
            }
        }
    }

    // 3. Reaction作成
    const reactionRef = doc(collection(db, 'reactions'));
    const reactionId = reactionRef.id;

    batch.set(reactionRef, {
        reaction_id: reactionId,
        from_uid: fromUid,
        to_uid: toUid,
        to_card_id: toCardId,
        type: type,
        reason: 'manual',
        message: null,
        card_title: cardTitle,
        card_category_name: cardCategoryName,
        created_at: serverTimestamp(),
        scheduled_for: null,
        delivered: false,
        is_read: false,
    });

    // 3. 送信状態更新
    const sendStateRef = doc(db, 'cheer_send_state', fromUid);

    // sent_pairsの更新: 古いものを削除し、新しいものを追加
    const activePairs = sendState.sent_pairs.filter(p => {
        const sentTime = p.sent_at.toDate();
        const diffHours = (now.getTime() - sentTime.getTime()) / (1000 * 60 * 60);
        return diffHours < 24; // 24時間以内のものだけ残す
    });

    activePairs.push({
        to_card_id: toCardId,
        sent_at: Timestamp.fromDate(now),
    });

    const isNewDay = sendState.daily_send_date !== dateStr;
    const newCount = isNewDay ? 1 : sendState.daily_send_count + 1;

    batch.set(sendStateRef, {
        user_uid: fromUid,
        daily_send_count: newCount,
        daily_send_date: dateStr,
        sent_pairs: activePairs,
        updated_at: serverTimestamp(),
    }, { merge: true });

    await batch.commit();
    return reactionId;
}

/**
 * アンドゥ（送信取り消し）
 */
export async function undoCheer(
    reactionId: string,
    fromUid: string,
    toCardId: string,
    sleepTime?: string | null,
    timezone?: string,
): Promise<void> {
    const batch = writeBatch(db);

    // Reaction削除
    const reactionRef = doc(db, 'reactions', reactionId);
    batch.delete(reactionRef);

    // 送信状態の巻き戻し（カウント減算などは複雑なので、sent_pairsから削除だけする）
    // 厳密なカウント管理より、再送信制限の解除を優先
    // ここでは簡易的に「直近の送信ペア」を削除する更新を行う
    const sendStateRef = doc(db, 'cheer_send_state', fromUid);
    const sendStateSnap = await getDoc(sendStateRef);

    if (sendStateSnap.exists()) {
        const data = sendStateSnap.data() as CheerSendState;
        const updatedPairs = data.sent_pairs.filter(p => p.to_card_id !== toCardId);

        // カウントを戻すには日付の一致確認が必要だが、アンドゥは直後に行われる前提なので
        // 単純にカウント-1してもよいが、整合性が崩れるリスクがあるため、
        // MVPとしては「ペア履歴から削除＝再送信可能にする」にとどめるのが安全。
        // もし1日上限に厳格ならカウントも戻すべき。
        // ここではカウントも戻す。

        if (data.daily_send_count > 0 && data.daily_send_date === getTodayString(sleepTime, timezone)) {
            batch.update(sendStateRef, {
                daily_send_count: data.daily_send_count - 1,
                sent_pairs: updatedPairs,
                updated_at: serverTimestamp(),
            });
        } else {
            batch.update(sendStateRef, {
                sent_pairs: updatedPairs,
                updated_at: serverTimestamp(),
            });
        }
    }

    await batch.commit();
}

/**
 * 送信状態を取得または初期化
 */
export async function getOrCreateCheerSendState(
    userId: string,
    sleepTime?: string | null,
    timezone?: string,
): Promise<CheerSendState> {
    const ref = doc(db, 'cheer_send_state', userId);
    const snap = await getDoc(ref);

    if (snap.exists()) {
        return snap.data() as CheerSendState;
    }

    // 初期化
    const initialState: CheerSendState = {
        user_uid: userId,
        daily_send_count: 0,
        daily_send_date: getTodayString(sleepTime, timezone),
        sent_pairs: [],
        updated_at: Timestamp.now(),
    };

    // ここではsetしない（最初の送信時にsetするか、必要ならここでする）
    // 読み取り専用で使うケースもあるので、保存はしないが型として返す
    return initialState;
}

/**
 * 配列シャッフル
 */
function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

/**
 * YYYY-MM-DD 文字列取得（日付境界対応）
 */
function getTodayString(sleepTime?: string | null, timezone?: string): string {
    return getAppToday(sleepTime, timezone);
}
