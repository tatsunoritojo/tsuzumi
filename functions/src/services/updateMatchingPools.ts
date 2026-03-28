// functions/src/services/updateMatchingPools.ts
import * as admin from 'firebase-admin';

// マッチングプールに保存するカード情報の型
interface MatchingCard {
    card_id: string;
    owner_uid: string;
    title: string; // 内部参照用（クライアントには返さない場合もあるが、マッチングプールには含める）
    current_streak: number;
    last_log_date: string;
    total_logs: number;
    is_comeback: boolean;
}

/**
 * マッチングプールを更新する関数
 * 30分ごとに実行され、カテゴリごとのアクティブユーザープールを再構築する
 */
export async function updateMatchingPoolsLogic() {
    const db = admin.firestore();
    console.log('updateMatchingPoolsLogic: 開始');

    try {
        // 1. 全カテゴリL3を取得
        // categoriesコレクションから取得する
        const categoriesSnapshot = await db.collection('categories').get();

        // カテゴリごとの処理（並行処理も可能だが、Firestoreの負荷を考慮して直列または制限付き並行で実行）
        for (const categoryDoc of categoriesSnapshot.docs) {
            const categoryData = categoryDoc.data();
            const categoryId = categoryDoc.id; // L3 ID
            const categoryNameJa = categoryData.name_ja || '習慣';

            // 2. 該当カテゴリの公開カードを取得（is_public のみ）
            const publicCardsSnapshot = await db
                .collection('cards')
                .where('category_l3', '==', categoryId)
                .where('is_public', '==', true)
                .get();

            if (publicCardsSnapshot.size === 0) {
                continue; // 公開カードがないカテゴリはスキップ
            }

            // 3. 直近7日以内に記録があるものをフィルタ
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

            const activeCards: MatchingCard[] = [];

            for (const cardDoc of publicCardsSnapshot.docs) {
                const card = cardDoc.data();
                if (!card) continue;
                if (!card.last_log_date || card.last_log_date < sevenDaysAgoStr) {
                    continue;
                }

                // 4. 再開フラグを設定（3日以上空いて記録）
                // checkIsComebackロジックの実装
                // 簡易実装: ここでは履歴を追うのは重いため、別途判断が必要だが、
                // 現状のカード情報だけで判断するのは難しいかもしれない。
                // card.last_log_date とその前のログの日差分が必要。
                // ただし、毎回ログを引くのは高コスト。
                // ここでは、updateMatchingPoolsはバッチ処理なので、
                // 一旦 is_comeback は false とする（または別途計算ロジックを入れるか）
                // 要件書には `is_comeback: checkIsComeback(card)` とある。
                // cardオブジェクトに情報がない場合、logsサブコレクションを引く必要があるか、
                // ログ記録時にcardにis_comebackフラグを更新しておくのがベストプラクティス。
                // 現状のデータモデルにはないので、今回は簡易的に判定するか、
                // 「3日以上空いて再開」は「前回の記録から3日以上経過」を意味するが、
                // last_log_dateは「最新の記録日」。つまり、今日記録したとして、その前が3日前ならcomeback。
                // マッチングプール作成時点では「最新の記録」しかわからない。
                // 厳密な判定には直近2件のログが必要。

                // パフォーマンスを考慮し、ここではログ取得を行わず、デフォルトfalseとする。
                // ※ 本格実装時はログ記録トリガーで is_comeback をカードに持たせる改修が推奨される。
                // 今回は要件を満たすため、カードごとの直近ログ取得はコスト過多と判断し、false固定とするか、
                // Firestore読み取り数に余裕があるなら取得する。
                // 今回の要件では active_cards は最大でもカテゴリあたり数十〜数百想定なので、
                // 上位N件に絞ってログ取得も可能だが、
                // ここでは「is_comeback: false」で進める（または要件書の意図が「直近の記録が久しぶりだったか」なら、
                // logServiceでの記録時に判定してcardにフラグを持たせるべき）。
                // 既存のlogsから判定する場合:
                const isComeback = await checkIsComeback(db, card.card_id, card.last_log_date);

                activeCards.push({
                    card_id: cardDoc.id,
                    owner_uid: card.owner_uid,
                    title: card.title || '習慣',
                    current_streak: card.current_streak || 0,
                    last_log_date: card.last_log_date,
                    total_logs: card.total_logs || 0,
                    is_comeback: isComeback
                });
            }

            if (activeCards.length === 0) {
                continue;
            }

            // 5. ランダムシャッフル
            const shuffled = shuffleArray(activeCards);

            // ドキュメントサイズ制限（1MB）考慮して、最大100件程度に制限
            const limitedActiveCards = shuffled.slice(0, 100);

            // 6. matching_poolsに保存
            await db.collection('matching_pools').doc(categoryId).set({
                category_l3: categoryId,
                category_l3_name_ja: categoryNameJa,
                active_cards: limitedActiveCards,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Matching pool updated for ${categoryId}: ${limitedActiveCards.length} cards`);
        }

        console.log('updateMatchingPoolsLogic: 完了');
    } catch (error) {
        console.error('updateMatchingPoolsLogic error:', error);
    }
}

/**
 * 直近2件のログを確認して再開（3日以上のブランク）かどうかを判定
 * ※Firestore読み取りコストがかかるため注意
 */
async function checkIsComeback(db: admin.firestore.Firestore, cardId: string, lastLogDate: string): Promise<boolean> {
    try {
        // 最新のログ（lastLogDateのもの）の1つ前を取得したいが、
        // ここでは単純に「最新の記録」が「その前の記録」から3日以上空いているかを確認する
        // logsコレクションから、このカードのログを日付降順で2件取得
        const logsSnap = await db.collection('logs')
            .where('card_id', '==', cardId)
            .orderBy('logged_at', 'desc')
            .limit(2)
            .get();

        if (logsSnap.size < 2) {
            return false; // ログが不足している場合は判定不可（新規など）
        }

        const logs = logsSnap.docs;
        const latestLogDate = logs[0].data().logged_at.toDate(); // timestamp
        const previousLogDate = logs[1].data().logged_at.toDate(); // timestamp

        // 最新のログが今日（または直近）でない場合、そもそも「再開したばかり」ではないかもしれないが、
        // 「再開ユーザー」としてリストアップする要件なので、最新のエントリ間の差分を見る。

        // 差分（ミリ秒）
        const diffTime = Math.abs(latestLogDate.getTime() - previousLogDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // 差分が3日以上（例: 月曜にやって、木曜にやった場合、中2日だが差分は3日。
        // 「3日以上空いて」の定義によるが、ここでは間隔が3日以上（中2日以上）とする）
        return diffDays >= 4; // 4日差（中3日）以上を「久しぶり」とするか、3日（中2日）とするか
        // 要件書には「3日以上空いて再開」とある。
        // 例: 1日に実施、次が5日（2,3,4日休み）。これは「3日空いた」。差分は4日。
        // 例: 1日に実施、次が4日（2,3日休み）。これは「2日空いた」。差分は3日。
        // ここでは diffDays >= 4 (中3日以上) をカムバックとする。 
    } catch (e) {
        console.warn(`checkIsComeback failed for ${cardId}`, e);
        return false;
    }
}

/**
 * 配列をシャッフルする（Fisher-Yates shuffle）
 */
function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}
