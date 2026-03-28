// src/lib/firebase.ts
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInAnonymously,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
// 環境変数から読み込み（EXPO_PUBLIC_ プレフィックスが必要）
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!;
}

// 認証状態を永続化
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);

/**
 * アプリ起動時に呼び出す関数：
 * - 匿名ログイン
 * - users/{uid} ドキュメントの新規作成 or last_login_at 更新
 */
export const ensureAnonymousLoginAndUser = async () => {
  // console.log('ensureAnonymousLoginAndUser: start');

  // まだログインしていなければ匿名ログイン
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const user = auth.currentUser;
  // console.log('ensureAnonymousLoginAndUser: user = ', user?.uid);

  if (!user) return;

  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // console.log('ensureAnonymousLoginAndUser: create user doc');
    await setDoc(userRef, {
      uid: user.uid,
      created_at: serverTimestamp(),
      last_login_at: serverTimestamp(),
      settings: {
        cheer_frequency: 'medium',
        push_enabled: true,
        timezone: 'Asia/Tokyo',
        // Phase 7: エール通知設定のデフォルト値
        notification_mode: 'realtime',
        batch_times: [],
        quiet_hours_enabled: true,
        quiet_hours_start: '23:00',
        quiet_hours_end: '07:00',
        fcm_token: null,
      },
    });
  } else {
    // console.log('ensureAnonymousLoginAndUser: update last_login_at');
    await setDoc(
      userRef,
      {
        last_login_at: serverTimestamp(),
      },
      { merge: true },
    );
  }

  // console.log('ensureAnonymousLoginAndUser: done');
};

/**
 * アカウント削除フラグ。
 * deleteUser() 前に true にセットすることで、
 * onAuthStateChanged が「削除による無効化」と判定できる。
 */
export let isAccountBeingDeleted = false;
export function setAccountBeingDeleted(value: boolean) {
  isAccountBeingDeleted = value;
}