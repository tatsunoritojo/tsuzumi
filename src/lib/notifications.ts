// src/lib/notifications.ts
// プッシュ通知関連のロジック

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { router } from 'expo-router';

// 通知の表示設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * プッシュ通知のパーミッションを要求し、FCMトークンを取得
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Expo Go環境ではスキップ（SDK 53以降、通知機能が削除されている）
  if (!Device.isDevice) {
    console.log('実機でないため、プッシュ通知はスキップします');
    return null;
  }

  // Development Build以外ではスキップ
  const isExpoGo = process.env.EXPO_PUBLIC_IS_DEV_BUILD !== 'true';
  if (isExpoGo) {
    console.log('Expo Go環境のため、プッシュ通知はスキップします（Development Buildが必要）');
    return null;
  }

  // 実機でのみ通知を有効化
  if (Device.isDevice) {
    // パーミッションを確認
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // パーミッションがない場合は要求
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // パーミッションが拒否された場合
    if (finalStatus !== 'granted') {
      console.log('プッシュ通知のパーミッションが拒否されました');
      return null;
    }

    // FCMトークンを取得
    try {
      // Expo Project IDを使用（Firebase Project IDではない）
      const pushToken = await Notifications.getExpoPushTokenAsync();
      token = pushToken.data;
      // console.log('FCMトークン取得成功:', token);
    } catch (error) {
      console.log('FCMトークン取得失敗 (Project ID未設定の可能性があります):', error);
      return null;
    }
  }

  // Androidの場合、通知チャンネルを設定
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

/**
 * FCMトークンをFirestoreに保存
 */
export async function saveFCMTokenToFirestore(token: string): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('ユーザーが認証されていません');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      'settings.fcm_token': token,
    });

    console.log('FCMトークンをFirestoreに保存しました');
  } catch (error) {
    console.error('FCMトークン保存エラー:', error);
  }
}

/**
 * プッシュ通知の初期化とトークン登録
 */
export async function initializeNotifications(): Promise<void> {
  try {
    // Expo Go環境ではスキップ
    const isExpoGo = process.env.EXPO_PUBLIC_IS_DEV_BUILD !== 'true' && !Device.isDevice;
    if (isExpoGo || !Device.isDevice) {
      console.log('プッシュ通知初期化をスキップしました（Expo Go または エミュレータ環境）');
      return;
    }

    const token = await registerForPushNotificationsAsync();
    if (token) {
      await saveFCMTokenToFirestore(token);
    } else {
      console.log('FCMトークンが取得できませんでした（Expo Go環境の可能性）');
    }
  } catch (error) {
    console.error('通知初期化エラー:', error);
    // エラーでもアプリは継続
  }
}

/**
 * 通知受信リスナーを設定
 */
export function setupNotificationListeners() {
  // フォアグラウンドで通知を受信した時
  const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    // console.log('通知を受信:', notification);
  });

  // 通知をタップした時
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    try {
      if (data?.type === 'human_cheer' || data?.type === 'batch_cheer' || data?.type === 'generic') {
        router.push('/notifications');
      } else {
        router.push('/(tabs)/home');
      }
    } catch {
      // ナビゲーション準備完了前の場合は無視
    }
  });

  // クリーンアップ関数を返す
  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}
