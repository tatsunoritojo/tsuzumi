import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Switch,
    Modal,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

export default function EditCardScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isPublic, setIsPublic] = useState(false);

    // Reminder state
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderTime, setReminderTime] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (id) {
            loadCard();
        }
    }, [id]);

    const loadCard = async () => {
        try {
            if (!id) return;
            const docRef = doc(db, 'cards', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTitle(data.title);
                setIsPublic(data.is_public ?? false);

                // Load reminder settings
                if (data.reminder_enabled) {
                    setReminderEnabled(true);
                    if (data.reminder_time) {
                        const [hours, minutes] = data.reminder_time.split(':').map(Number);
                        const date = new Date();
                        date.setHours(hours, minutes, 0, 0);
                        setReminderTime(date);
                    }
                }
            } else {
                Alert.alert('エラー', 'カードが見つかりません');
                router.back();
            }
        } catch (e) {
            console.error(e);
            Alert.alert('エラー', '読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('エラー', 'タイトルを入力してください');
            return;
        }

        try {
            setSaving(true);
            if (!id) return;

            const timeStr = `${reminderTime.getHours().toString().padStart(2, '0')}:${reminderTime.getMinutes().toString().padStart(2, '0')}`;

            await updateDoc(doc(db, 'cards', id), {
                title: title.trim(),
                is_public: isPublic,
                reminder_enabled: reminderEnabled,
                reminder_time: reminderEnabled ? timeStr : null,
                updated_at: Timestamp.now(),
            });

            Alert.alert('完了', '変更を保存しました');
            router.back();
        } catch (e) {
            console.error(e);
            Alert.alert('エラー', '保存に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }

        if (selectedDate) {
            setReminderTime(selectedDate);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backButton}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>カード編集</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={[styles.saveButton, saving && styles.disabledText]}>保存</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <ScrollView>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>習慣の名前</Text>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="習慣の名前を入力"
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <View>
                            <Text style={styles.rowTitle}>公開設定</Text>
                            <Text style={styles.rowSubtitle}>他のユーザーにこの習慣を公開する</Text>
                        </View>
                        <Switch
                            value={isPublic}
                            onValueChange={setIsPublic}
                            trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                            thumbColor={'#FFFFFF'}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <View>
                            <Text style={styles.rowTitle}>リマインダー通知</Text>
                            <Text style={styles.rowSubtitle}>記録忘れ防止の通知を受け取る</Text>
                        </View>
                        <Switch
                            value={reminderEnabled}
                            onValueChange={setReminderEnabled}
                            trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
                            thumbColor={'#FFFFFF'}
                        />
                    </View>

                    {reminderEnabled && (
                        <View style={styles.timeSection}>
                            <Text style={styles.label}>通知時刻</Text>
                            <TouchableOpacity
                                style={styles.timeButton}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Text style={styles.timeButtonText}>
                                    {`${reminderTime.getHours().toString().padStart(2, '0')}:${reminderTime.getMinutes().toString().padStart(2, '0')}`}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Time Picker */}
            {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker
                    value={reminderTime}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={handleTimeChange}
                />
            )}

            {Platform.OS === 'ios' && showTimePicker && (
                <Modal transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowTimePicker(false)}
                    >
                        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                                    <Text style={styles.modalCancel}>キャンセル</Text>
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>時刻を選択</Text>
                                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                                    <Text style={styles.modalDone}>完了</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={reminderTime}
                                mode="time"
                                display="spinner"
                                onChange={handleTimeChange}
                                style={styles.picker}
                            />
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        fontSize: 28,
        color: '#333333',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333333',
    },
    saveButton: {
        fontSize: 16,
        color: '#4A90E2',
        fontWeight: 'bold',
    },
    disabledText: {
        color: '#CCCCCC',
    },
    content: {
        flex: 1,
        padding: 24,
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333333',
    },
    input: {
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 16,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
    },
    rowSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 4,
    },
    timeSection: {
        marginBottom: 24,
    },
    timeButton: {
        backgroundColor: '#F0F7FF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#4A90E2',
    },
    timeButtonText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#4A90E2',
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
});
