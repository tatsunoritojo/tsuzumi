/**
 * マイグレーションスクリプト: is_public フラグ統合
 *
 * 既存カードに対して is_public = is_public_for_cheers || is_public_for_template を適用し、
 * 旧フィールドを削除する。
 *
 * 実行: npx tsx scripts/migratePublicFlags.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccount = require(path.resolve(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrate() {
  console.log('=== is_public フラグ統合マイグレーション開始 ===');

  const cardsSnapshot = await db.collection('cards').get();
  console.log(`対象カード数: ${cardsSnapshot.size}`);

  let updated = 0;
  let skipped = 0;
  const batchSize = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of cardsSnapshot.docs) {
    const data = doc.data();

    const oldCheers = data.is_public_for_cheers === true;
    const oldTemplate = data.is_public_for_template === true;
    const newIsPublic = oldCheers || oldTemplate;

    // 既に統合済み（旧フィールドが存在しない）ならスキップ
    if (!('is_public_for_cheers' in data) && !('is_public_for_template' in data)) {
      skipped++;
      continue;
    }

    batch.update(doc.ref, {
      is_public: newIsPublic,
      is_public_for_cheers: admin.firestore.FieldValue.delete(),
      is_public_for_template: admin.firestore.FieldValue.delete(),
    });

    updated++;
    batchCount++;

    if (batchCount >= batchSize) {
      await batch.commit();
      console.log(`  バッチ commit: ${updated} 件完了`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`=== 完了: ${updated} 件更新、${skipped} 件スキップ ===`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('マイグレーションエラー:', err);
  process.exit(1);
});
