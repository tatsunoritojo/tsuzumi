// app/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import LottieView from 'lottie-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { ensureAnonymousLoginAndUser, auth, isAccountBeingDeleted } from '../src/lib/firebase';
import { initializeNotifications, setupNotificationListeners } from '../src/lib/notifications';

// Error Boundary: コンポーネントクラッシュ時にアプリ全体が落ちるのを防ぐ
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const { default: crashlytics } = require('@react-native-firebase/crashlytics');
      crashlytics().recordError(error);
    } catch {
      // Crashlytics が利用不可の場合（Expo Go等）は無視
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              backgroundColor: '#FFFFFF',
            }}
          >
            <Text style={{ fontSize: 48, marginBottom: 16 }}>!</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 }}>
              予期しないエラーが発生しました
            </Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 }}>
              アプリを再起動してください
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#4A90E2',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
              onPress={() => this.setState({ hasError: false, error: null })}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>再試行</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <RootLayoutInner />
    </ErrorBoundary>
  );
}

// 認証無効化の種別
type AuthInvalidReason = 'migrated' | 'deleted' | null;

function RootLayoutInner() {
  const [ready, setReady] = useState(false);
  const [userTapped, setUserTapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInvalid, setAuthInvalid] = useState<AuthInvalidReason>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // 初回の onAuthStateChanged(null) を初期化中として無視するためのフラグ
  const initializedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      try {
        await ensureAnonymousLoginAndUser();
        await initializeNotifications();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Firebase初期化に失敗しました');
      } finally {
        initializedRef.current = true;
        setReady(true);
      }
    };

    run();

    // 認証状態監視リスナー (1.2)
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!initializedRef.current) return; // 初期化完了前は無視

      if (user === null) {
        // アカウント削除による無効化
        if (isAccountBeingDeleted) {
          setAuthInvalid('deleted');
          return;
        }

        // その他の無効化 → 自動で signInAnonymously() を再試行
        try {
          await signInAnonymously(auth);
        } catch {
          setError('認証セッションが無効になりました。アプリを再起動してください。');
        }
      }
    });

    // Phase 7: 通知リスナーのセットアップ
    const cleanupNotificationListeners = setupNotificationListeners();

    return () => {
      unsubscribeAuth();
      cleanupNotificationListeners();
    };
  }, []);

  // Firebase準備完了後にタップヒントをすぐにフェードイン
  useEffect(() => {
    if (ready) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [ready]);

  if (!ready || !userTapped) {
    // Firebase 初期化中 or ユーザーがタップするまで待機
    // バックグラウンドでロード完了していればいつでもタップ可能
    const canProceed = ready;

    return (
      <SafeAreaProvider>
        <TouchableOpacity
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
          }}
          onPress={() => {
            if (canProceed) {
              setUserTapped(true);
            }
          }}
          activeOpacity={canProceed ? 0.7 : 1}
          disabled={!canProceed}
        >
          <LottieView
            source={require('../assets/Welcome.json')}
            autoPlay
            loop={false}
            style={{ width: 250, height: 250 }}
            resizeMode="contain"
            onAnimationFinish={() => {}}
          />

          {canProceed && (
            <Animated.View
              style={{
                opacity: fadeAnim,
                position: 'absolute',
                bottom: 100,
                alignItems: 'center',
              }}
            >
              {/* ガイドテキスト - 上部に配置 */}
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: '#666666',
                  marginBottom: 16,
                  zIndex: 1,
                }}
              >
                タップして開始
              </Text>

              {/* Circle grow エフェクト */}
              <LottieView
                source={require('../assets/Circle grow.json')}
                autoPlay
                loop={true}
                style={{
                  width: 240,
                  height: 240,
                }}
                resizeMode="contain"
              />
            </Animated.View>
          )}
        </TouchableOpacity>
      </SafeAreaProvider>
    );
  }

  // 認証が無効化された場合の画面 (1.2, 1.3)
  if (authInvalid) {
    const message =
      authInvalid === 'migrated'
        ? 'このアカウントは別の端末に移行されました'
        : 'アカウントが削除されました。アプリを再起動してください';

    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Text style={{ fontSize: 48, marginBottom: 16 }}>
            {authInvalid === 'migrated' ? '📱' : '👋'}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 }}>
            {authInvalid === 'migrated' ? 'アカウント移行済み' : 'アカウント削除完了'}
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
            {message}
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // エラーが発生した場合はエラー画面を表示
  if (error) {
    const handleRetry = async () => {
      setError(null);
      setReady(false);
      setUserTapped(false);
      try {
        await ensureAnonymousLoginAndUser();
        await initializeNotifications();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Firebase初期化に失敗しました');
      } finally {
        initializedRef.current = true;
        setReady(true);
      }
    };

    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FF0000', marginBottom: 10 }}>
            エラーが発生しました
          </Text>
          <Text style={{ fontSize: 14, color: '#333333', textAlign: 'center', marginBottom: 24 }}>
            {error}
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: '#4A90E2',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
            onPress={handleRetry}
          >
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>再試行</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  // SafeAreaProviderで全画面をラップし、各画面でSafeAreaViewを使用可能にする
  // 各画面は react-native-safe-area-context の SafeAreaView を個別に使用する
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

