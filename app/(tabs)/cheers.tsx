// app/(tabs)/cheers.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { useCheerSuggestions } from '../../src/hooks/useCheerSuggestions';
import { useUserDisplayName } from '../../src/hooks/useUserDisplayName';
import { useFavorites } from '../../src/hooks/useFavorites';
import { sendCheer, undoCheer } from '../../src/services/cheerSendService';
import { useSettings } from '../../src/hooks/useSettings';
import { FavoriteButton } from '../../src/components/FavoriteButton';

type ActionType = 'cheer' | 'amazing' | 'support';

// カード作成者表示コンポーネント（敬称略）
const CardCreator: React.FC<{ uid: string }> = ({ uid }) => {
  const displayName = useUserDisplayName(uid);
  return <Text style={styles.creatorName}>{displayName}</Text>;
};

export default function CheersScreen() {
  const { suggestions, loading, error, refresh, removeSuggestion } = useCheerSuggestions();
  const { isFavorite, addFavorite, removeFavorite, favoriteCount } = useFavorites();
  const { settings } = useSettings();
  const [undoState, setUndoState] = useState<{
    visible: boolean;
    reactionId: string;
    cardId: string;
    message: string;
  } | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // セクション分け: お気に入り vs その他
  const { favoriteSuggestions, otherSuggestions } = useMemo(() => {
    const favorites = suggestions.filter((s) => isFavorite(s.card_id));
    const others = suggestions.filter((s) => !isFavorite(s.card_id));
    return { favoriteSuggestions: favorites, otherSuggestions: others };
  }, [suggestions, isFavorite]);

  // お気に入り切り替え
  const handleToggleFavorite = async (
    cardId: string,
    ownerUid: string,
    categoryL3: string
  ) => {
    if (isFavorite(cardId)) {
      const result = await removeFavorite(cardId);
      if (result.success) {
        showToast('お気に入りから解除しました');
      }
    } else {
      if (favoriteCount >= 10) {
        showToast('お気に入りは10人までです');
        return;
      }
      const result = await addFavorite(ownerUid, cardId, categoryL3);
      if (result.success) {
        showToast('お気に入りに追加しました');
      } else if (result.error === 'LIMIT_REACHED') {
        showToast('お気に入りは10人までです');
      }
    }
  };

  // トースト表示
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // アンドゥスナックバーの表示制御
  useEffect(() => {
    if (undoState?.visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // 3秒後に自動非表示
      const timer = setTimeout(() => {
        hideUndo();
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (!undoState?.visible && undoState) {
          setUndoState(null);
        }
      });
    }
  }, [undoState?.visible]);

  const hideUndo = () => {
    setUndoState((prev) => (prev ? { ...prev, visible: false } : null));
  };

  const handleSendCheer = async (cardId: string, type: ActionType, toUid: string) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      const reactionId = await sendCheer(user.uid, cardId, toUid, type, settings.sleep_time, settings.timezone);

      // UI更新（カードをリストから消す）
      removeSuggestion(cardId);

      // アンドゥスナックバー表示
      let label = '';
      switch (type) {
        case 'cheer': label = '💪 ナイス継続'; break;
        case 'amazing': label = '⭐ すごい！'; break;
        case 'support': label = '🤝 一緒にがんばろ'; break;
      }

      setUndoState({
        visible: true,
        reactionId,
        cardId,
        message: `${label} を送信しました`,
      });

    } catch (e: any) {
      console.error('sendCheer error:', e);
      if (e.message === 'DAILY_LIMIT_REACHED') {
        Alert.alert('制限', '1日の送信上限（10件）に達しました');
      } else if (e.message === 'ALREADY_SENT_TODAY') {
        Alert.alert('制限', 'このカードには24時間以内に送信済みです');
      } else {
        Alert.alert('エラー', '送信に失敗しました');
      }
    }
  };

  const handleUndo = async () => {
    if (!undoState) return;

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    try {
      await undoCheer(undoState.reactionId, user.uid, undoState.cardId, settings.sleep_time, settings.timezone);
      hideUndo();
      Alert.alert('取り消し', 'エールを取り消しました');
      refresh(); // リストを再取得してカードを復活させる
    } catch (e) {
      Alert.alert('エラー', '取り消しに失敗しました');
    }
  };

  const ActionButton = ({ type, onPress }: { type: ActionType; onPress: () => void }) => {
    let emoji = '';
    let label = '';
    let bgColor = '';

    switch (type) {
      case 'cheer':
        emoji = '💪';
        label = '継続';
        bgColor = '#E3F2FD';
        break;
      case 'amazing':
        emoji = '⭐';
        label = 'すごい';
        bgColor = '#FFF3E0';
        break;
      case 'support':
        emoji = '🤝';
        label = '一緒にがんばろ';
        bgColor = '#E8F5E9';
        break;
    }

    return (
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: bgColor }]} onPress={onPress}>
        <Text style={styles.actionEmoji}>{emoji}</Text>
        <Text style={styles.actionLabel}>{label}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>仲間を探しています...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>エールを送る</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.description}>
          同じ習慣をがんばる仲間に{'\n'}エールを送りませんか？
        </Text>

        {suggestions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>😊</Text>
            <Text style={styles.emptyTitle}>今日はここまで</Text>
            <Text style={styles.emptyText}>
              エールを送れる仲間が見つかりませんでした。{'\n'}
              カードを公開設定にすると{'\n'}仲間とつながりやすくなります。
            </Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
              <Text style={styles.refreshBtnText}>再読み込み</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* お気に入りの仲間セクション */}
            {favoriteSuggestions.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>★ お気に入りの仲間</Text>
                {favoriteSuggestions.map((card) => (
                  <View key={card.card_id} style={[styles.card, styles.favoriteCard]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.categoryName}>
                          ★ {card.category_name_ja.replace('（その他）', '')} の仲間
                          {card.is_comeback && <Text style={styles.comebackBadge}> 再開！</Text>}
                        </Text>
                        <FavoriteButton
                          isFavorite={true}
                          onToggle={() => handleToggleFavorite(card.card_id, card.owner_uid, card.category_l3)}
                        />
                      </View>
                      <CardCreator uid={card.owner_uid} />
                      <Text style={styles.cardStats}>
                        連続 {card.current_streak}日
                      </Text>
                    </View>
                    <View style={styles.actions}>
                      <ActionButton type="cheer" onPress={() => handleSendCheer(card.card_id, 'cheer', card.owner_uid)} />
                      <ActionButton type="amazing" onPress={() => handleSendCheer(card.card_id, 'amazing', card.owner_uid)} />
                      <ActionButton type="support" onPress={() => handleSendCheer(card.card_id, 'support', card.owner_uid)} />
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* その他の仲間セクション */}
            {otherSuggestions.length > 0 && (
              <>
                {favoriteSuggestions.length > 0 && (
                  <Text style={styles.sectionHeader}>その他の仲間</Text>
                )}
                {otherSuggestions.map((card) => (
                  <View key={card.card_id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.categoryName}>
                          {card.category_name_ja.replace('（その他）', '')} の仲間
                          {card.is_comeback && <Text style={styles.comebackBadge}> 再開！</Text>}
                        </Text>
                        <FavoriteButton
                          isFavorite={false}
                          onToggle={() => handleToggleFavorite(card.card_id, card.owner_uid, card.category_l3)}
                        />
                      </View>
                      <CardCreator uid={card.owner_uid} />
                      <Text style={styles.cardStats}>
                        連続 {card.current_streak}日
                      </Text>
                    </View>
                    <View style={styles.actions}>
                      <ActionButton type="cheer" onPress={() => handleSendCheer(card.card_id, 'cheer', card.owner_uid)} />
                      <ActionButton type="amazing" onPress={() => handleSendCheer(card.card_id, 'amazing', card.owner_uid)} />
                      <ActionButton type="support" onPress={() => handleSendCheer(card.card_id, 'support', card.owner_uid)} />
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {suggestions.length > 0 && (
          <TouchableOpacity style={styles.skipBtn} onPress={refresh}>
            <Text style={styles.skipBtnText}>他の仲間を探す</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Undo Snackbar */}
      {undoState && (
        <Animated.View style={[styles.snackbar, { opacity: fadeAnim }]}>
          <Text style={styles.snackbarText}>{undoState.message}</Text>
          <TouchableOpacity onPress={handleUndo}>
            <Text style={styles.undoText}>取り消す</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* トースト */}
      {toastMessage && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8E93',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  description: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 16,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  comebackBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  cardStats: {
    fontSize: 14,
    color: '#8E8E93',
  },
  creatorName: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  refreshBtnText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  skipBtn: {
    alignSelf: 'center',
    padding: 16,
  },
  skipBtnText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  snackbar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#333333',
    borderRadius: 30, // Pill shape
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  snackbarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  undoText: {
    color: '#FF9500',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666666',
    marginTop: 16,
    marginBottom: 12,
  },
  favoriteCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 32,
    right: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
