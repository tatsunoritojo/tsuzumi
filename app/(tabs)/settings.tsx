// app/(tabs)/settings.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Switch, TouchableOpacity, Linking, Alert, Modal, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../../src/hooks/useSettings';
import { useUserProfile } from '../../src/hooks/useUserProfile';
import { auth } from '../../src/lib/firebase';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, loading, updateSettings } = useSettings();
  const { displayName, loading: loadingProfile, updateDisplayName } = useUserProfile();
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [showBatchTimePicker, setShowBatchTimePicker] = useState(false);
  const [showQuietStartPicker, setShowQuietStartPicker] = useState(false);
  const [showQuietEndPicker, setShowQuietEndPicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());
  const [showUserId, setShowUserId] = useState(false);

  const handleNotificationToggle = async (value: boolean) => {
    try {
      await updateSettings({ push_enabled: value });
    } catch (error) {
      Alert.alert('エラー', '設定の更新に失敗しました');
    }
  };

  const handleNotificationModeChange = async (mode: 'realtime' | 'batch') => {
    try {
      await updateSettings({ notification_mode: mode });
    } catch (error) {
      Alert.alert('エラー', '設定の更新に失敗しました');
    }
  };

  const handleBatchTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowBatchTimePicker(false);
      if (event.type === 'set' && selectedDate) {
        const timeStr = `${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`;
        const currentTimes = settings.batch_times || [];

        if (currentTimes.length >= 3) {
          Alert.alert('上限に達しました', 'まとめて通知の時刻は最大3つまで設定できます');
          return;
        }

        if (currentTimes.includes(timeStr)) {
          Alert.alert('重複しています', 'この時刻は既に設定されています');
          return;
        }

        updateSettings({ batch_times: [...currentTimes, timeStr].sort() });
      }
    } else {
      // iOS: just update tempTime
      if (selectedDate) {
        setTempTime(selectedDate);
      }
    }
  };

  const handleBatchTimeConfirm = () => {
    const timeStr = `${tempTime.getHours().toString().padStart(2, '0')}:${tempTime.getMinutes().toString().padStart(2, '0')}`;
    const currentTimes = settings.batch_times || [];

    if (currentTimes.length >= 3) {
      Alert.alert('上限に達しました', 'まとめて通知の時刻は最大3つまで設定できます');
      setShowBatchTimePicker(false);
      return;
    }

    if (currentTimes.includes(timeStr)) {
      Alert.alert('重複しています', 'この時刻は既に設定されています');
      setShowBatchTimePicker(false);
      return;
    }

    updateSettings({ batch_times: [...currentTimes, timeStr].sort() });
    setShowBatchTimePicker(false);
  };

  const handleRemoveBatchTime = (timeToRemove: string) => {
    const currentTimes = settings.batch_times || [];
    updateSettings({ batch_times: currentTimes.filter(t => t !== timeToRemove) });
  };

  const handleQuietStartChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowQuietStartPicker(false);
      if (event.type === 'set' && selectedDate) {
        const timeStr = `${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`;
        updateSettings({ quiet_hours_start: timeStr });
      }
    } else {
      // iOS: just update tempTime
      if (selectedDate) {
        setTempTime(selectedDate);
      }
    }
  };

  const handleQuietStartConfirm = () => {
    const timeStr = `${tempTime.getHours().toString().padStart(2, '0')}:${tempTime.getMinutes().toString().padStart(2, '0')}`;
    updateSettings({ quiet_hours_start: timeStr });
    setShowQuietStartPicker(false);
  };

  const handleQuietEndChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowQuietEndPicker(false);
      if (event.type === 'set' && selectedDate) {
        const timeStr = `${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`;
        updateSettings({ quiet_hours_end: timeStr });
      }
    } else {
      // iOS: just update tempTime
      if (selectedDate) {
        setTempTime(selectedDate);
      }
    }
  };

  const handleQuietEndConfirm = () => {
    const timeStr = `${tempTime.getHours().toString().padStart(2, '0')}:${tempTime.getMinutes().toString().padStart(2, '0')}`;
    updateSettings({ quiet_hours_end: timeStr });
    setShowQuietEndPicker(false);
  };

  const parseTimeString = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('エラー', 'リンクを開けませんでした');
    });
  };

  const handleNicknameEdit = () => {
    setNicknameInput(displayName || '');
    setShowNicknameModal(true);
  };

  const handleNicknameSave = async () => {
    if (nicknameInput.trim().length < 1) {
      Alert.alert('エラー', 'ニックネームは1文字以上入力してください');
      return;
    }
    if (nicknameInput.length > 20) {
      Alert.alert('エラー', 'ニックネームは20文字以内で入力してください');
      return;
    }

    const success = await updateDisplayName(nicknameInput.trim());
    if (success) {
      setShowNicknameModal(false);
      Alert.alert('成功', 'ニックネームを更新しました');
    } else {
      Alert.alert('エラー', '更新に失敗しました');
    }
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* 通知設定セクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>エール通知</Text>

          {/* エール通知トグル */}
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>エール通知</Text>
              <Text style={styles.rowSubtitle}>応援メッセージの通知を受け取る</Text>
            </View>
            <Switch
              value={settings.push_enabled}
              onValueChange={(value) => handleNotificationToggle(value)}
              trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
              thumbColor={'#FFFFFF'}
              disabled={loading}
            />
          </View>

          {settings.push_enabled && (
            <>
              {/* 通知方法 */}
              <View style={styles.rowColumn}>
                <Text style={styles.rowTitle}>通知方法</Text>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => handleNotificationModeChange('realtime')}
                >
                  <View style={styles.radioButton}>
                    {(settings.notification_mode || 'realtime') === 'realtime' && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <View style={styles.radioContent}>
                    <Text style={styles.radioTitle}>リアルタイム</Text>
                    <Text style={styles.radioSubtitle}>エールが届いたらすぐに通知</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => handleNotificationModeChange('batch')}
                >
                  <View style={styles.radioButton}>
                    {settings.notification_mode === 'batch' && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                  <View style={styles.radioContent}>
                    <Text style={styles.radioTitle}>まとめて通知</Text>
                    <Text style={styles.radioSubtitle}>選んだ時刻にまとめてお知らせ</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* まとめて通知の配信時刻 */}
              {settings.notification_mode === 'batch' && (
                <View style={styles.rowColumn}>
                  <Text style={styles.rowTitle}>まとめて通知の配信時刻</Text>
                  <View style={styles.batchTimesContainer}>
                    {(settings.batch_times || []).map((time) => (
                      <View key={time} style={styles.timeChip}>
                        <Text style={styles.timeChipText}>{time}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveBatchTime(time)}
                          style={styles.timeChipRemove}
                        >
                          <Text style={styles.timeChipRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    {(settings.batch_times || []).length < 3 && (
                      <TouchableOpacity
                        style={styles.addTimeButton}
                        onPress={() => {
                          setTempTime(new Date());
                          setShowBatchTimePicker(true);
                        }}
                      >
                        <Text style={styles.addTimeButtonText}>+ 時刻を追加</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* お休みモード */}
              <View style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>お休みモード</Text>
                  <Text style={styles.rowSubtitle}>
                    この時間帯のエール通知は止めて、あとでまとめてお届けします
                  </Text>
                </View>
                <Switch
                  value={settings.quiet_hours_enabled ?? true}
                  onValueChange={(value) => updateSettings({ quiet_hours_enabled: value })}
                  trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                  thumbColor={'#FFFFFF'}
                  disabled={loading}
                />
              </View>

              {/* お休みモード時間帯 */}
              {settings.quiet_hours_enabled && (
                <View style={styles.rowColumn}>
                  <Text style={styles.rowTitle}>時間帯</Text>
                  <View style={styles.timeRangeContainer}>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => {
                        setTempTime(parseTimeString(settings.quiet_hours_start || '23:00'));
                        setShowQuietStartPicker(true);
                      }}
                    >
                      <Text style={styles.timeButtonText}>
                        {settings.quiet_hours_start || '23:00'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.timeRangeSeparator}>〜</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => {
                        setTempTime(parseTimeString(settings.quiet_hours_end || '07:00'));
                        setShowQuietEndPicker(true);
                      }}
                    >
                      <Text style={styles.timeButtonText}>
                        {settings.quiet_hours_end || '07:00'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* エール頻度 */}
              <View style={styles.row}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>エール頻度</Text>
                  <Text style={styles.rowSubtitle}>通知を受け取る頻度を設定</Text>
                </View>
                <View style={styles.frequencyContainer}>
                  {(['low', 'medium', 'high'] as const).map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.frequencyButton,
                        settings.cheer_frequency === freq && styles.frequencyButtonActive
                      ]}
                      onPress={() => updateSettings({ cheer_frequency: freq })}
                    >
                      <Text style={[
                        styles.frequencyText,
                        settings.cheer_frequency === freq && styles.frequencyTextActive
                      ]}>
                        {freq === 'low' ? '少なめ' : freq === 'medium' ? '普通' : '多め'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* データ管理セクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>データ管理</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/archived-cards')}
          >
            <Text style={styles.rowTitle}>アーカイブした習慣</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* プロフィールセクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プロフィール</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={handleNicknameEdit}
            disabled={loadingProfile}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>ニックネーム</Text>
              <Text style={styles.rowSubtitle}>
                {displayName || '未設定'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/favorites')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>お気に入りの仲間</Text>
              <Text style={styles.rowSubtitle}>
                エール提案で優先表示されます
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* アカウントセクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowUserId(!showUserId)}
            activeOpacity={0.7}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>ユーザーID</Text>
              <Text style={styles.rowSubtitle}>
                {showUserId ? auth.currentUser?.uid : 'タップして表示'}
              </Text>
            </View>
            <Text style={styles.chevron}>{showUserId ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/settings/account-deletion')}
          >
            <Text style={[styles.rowTitle, { color: '#FF3B30' }]}>アカウント削除</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* アプリについてセクション */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリについて</Text>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>バージョン</Text>
            <Text style={styles.rowValue}>{appVersion}</Text>
          </View>
          <TouchableOpacity style={styles.row} onPress={() => openLink('https://tatsunoritojo.github.io/tsuzumi/terms.html')}>
            <Text style={styles.rowTitle}>利用規約</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => openLink('https://tatsunoritojo.github.io/tsuzumi/privacy-policy.html')}>
            <Text style={styles.rowTitle}>プライバシーポリシー</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Time Pickers */}
      {/* Android: Native picker dialogs */}
      {Platform.OS === 'android' && showBatchTimePicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleBatchTimeChange}
        />
      )}

      {Platform.OS === 'android' && showQuietStartPicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleQuietStartChange}
        />
      )}

      {Platform.OS === 'android' && showQuietEndPicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleQuietEndChange}
        />
      )}

      {/* iOS: Modal pickers */}
      {Platform.OS === 'ios' && showBatchTimePicker && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowBatchTimePicker(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowBatchTimePicker(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowBatchTimePicker(false)}>
                  <Text style={styles.modalCancel}>キャンセル</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>時刻を選択</Text>
                <TouchableOpacity onPress={handleBatchTimeConfirm}>
                  <Text style={styles.modalDone}>完了</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) setTempTime(selectedDate);
                }}
                style={styles.picker}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {Platform.OS === 'ios' && showQuietStartPicker && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowQuietStartPicker(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowQuietStartPicker(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowQuietStartPicker(false)}>
                  <Text style={styles.modalCancel}>キャンセル</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>開始時刻</Text>
                <TouchableOpacity onPress={handleQuietStartConfirm}>
                  <Text style={styles.modalDone}>完了</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) setTempTime(selectedDate);
                }}
                style={styles.picker}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {Platform.OS === 'ios' && showQuietEndPicker && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowQuietEndPicker(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowQuietEndPicker(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowQuietEndPicker(false)}>
                  <Text style={styles.modalCancel}>キャンセル</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>終了時刻</Text>
                <TouchableOpacity onPress={handleQuietEndConfirm}>
                  <Text style={styles.modalDone}>完了</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) setTempTime(selectedDate);
                }}
                style={styles.picker}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Nickname Edit Modal */}
      <Modal
        visible={showNicknameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNicknameModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNicknameModal(false)}
        >
          <View
            style={styles.nicknameModalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.nicknameModalTitle}>ニックネームを編集</Text>
            <TextInput
              style={styles.nicknameInput}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              placeholder="ニックネームを1〜20文字で入力"
              maxLength={20}
              autoFocus
            />
            <Text style={styles.nicknameCharCount}>
              {nicknameInput.length}/20文字
            </Text>
            <View style={styles.nicknameModalButtons}>
              <TouchableOpacity
                style={[styles.nicknameModalButton, styles.nicknameModalButtonCancel]}
                onPress={() => setShowNicknameModal(false)}
              >
                <Text style={styles.nicknameModalButtonTextCancel}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nicknameModalButton, styles.nicknameModalButtonSave]}
                onPress={handleNicknameSave}
              >
                <Text style={styles.nicknameModalButtonTextSave}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6E6E73',
    marginLeft: 16,
    marginBottom: 8,
    marginTop: -24,
    paddingTop: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  rowColumn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  rowContent: {
    flex: 1,
    marginRight: 16,
  },
  rowTitle: {
    fontSize: 17,
    color: '#000000',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 17,
    color: '#8E8E93',
  },
  chevron: {
    fontSize: 20,
    color: '#C7C7CC',
    fontWeight: '600',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A90E2',
  },
  radioContent: {
    flex: 1,
  },
  radioTitle: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  radioSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  batchTimesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90E2',
    borderRadius: 16,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
  },
  timeChipText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timeChipRemove: {
    marginLeft: 6,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeChipRemoveText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  addTimeButton: {
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addTimeButtonText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timeButton: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
  },
  timeButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  timeRangeSeparator: {
    fontSize: 16,
    color: '#8E8E93',
    marginHorizontal: 12,
  },
  frequencyContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 2,
  },
  frequencyButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  frequencyButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  frequencyText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  frequencyTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  modalCancel: {
    fontSize: 17,
    color: '#8E8E93',
  },
  modalDone: {
    fontSize: 17,
    color: '#4A90E2',
    fontWeight: '600',
  },
  picker: {
    backgroundColor: '#FFFFFF',
  },
  nicknameModalContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 32,
    borderRadius: 16,
    padding: 24,
  },
  nicknameModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  nicknameInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  nicknameCharCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'right',
  },
  nicknameModalButtons: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  nicknameModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nicknameModalButtonCancel: {
    backgroundColor: '#F2F2F7',
  },
  nicknameModalButtonSave: {
    backgroundColor: '#4A90E2',
  },
  nicknameModalButtonTextCancel: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
  nicknameModalButtonTextSave: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
