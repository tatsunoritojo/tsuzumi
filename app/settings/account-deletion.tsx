import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Alert,
    TextInput,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { deleteUser } from 'firebase/auth';
import { auth, setAccountBeingDeleted } from '../../src/lib/firebase';

export default function AccountDeletionScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');

    const REQUIRED_TEXT = '削除';

    const handleDelete = async () => {
        if (confirmationText !== REQUIRED_TEXT) {
            Alert.alert('エラー', `確認のため「${REQUIRED_TEXT}」と入力してください`);
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        try {
            setLoading(true);

            // アカウント削除実行
            setAccountBeingDeleted(true);
            await deleteUser(user);
            // onAuthStateChanged が null を検知し、削除完了画面を表示する
        } catch (error: unknown) {
            setAccountBeingDeleted(false);
            console.error(error);
            const firebaseError = error as { code?: string; message?: string };
            if (firebaseError.code === 'auth/requires-recent-login') {
                Alert.alert('エラー', 'セキュリティのため、再ログインが必要です。一度ログアウトして再ログインしてから再度お試しください。');
            } else {
                Alert.alert('エラー', 'アカウントの削除に失敗しました: ' + (firebaseError.message || '不明なエラー'));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backButton}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>アカウント削除</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.warningBox}>
                    <Text style={styles.warningIcon}>⚠️</Text>
                    <Text style={styles.warningTitle}>重要：必ずお読みください</Text>
                    <Text style={styles.warningText}>
                        アカウントを削除すると、以下のデータが永久に失われます。この操作は取り消せません。
                    </Text>
                    <View style={styles.list}>
                        <Text style={styles.listItem}>・すべての習慣カード</Text>
                        <Text style={styles.listItem}>・記録したログと統計データ</Text>
                        <Text style={styles.listItem}>・獲得したエールと履歴</Text>
                    </View>
                </View>

                <Text style={styles.instruction}>
                    削除を確認するため、下に「{REQUIRED_TEXT}」と入力してください。
                </Text>

                <TextInput
                    style={styles.input}
                    value={confirmationText}
                    onChangeText={setConfirmationText}
                    placeholder={REQUIRED_TEXT}
                    placeholderTextColor="#999999"
                />

                <TouchableOpacity
                    style={[
                        styles.deleteButton,
                        (confirmationText !== REQUIRED_TEXT || loading) && styles.deleteButtonDisabled
                    ]}
                    onPress={handleDelete}
                    disabled={confirmationText !== REQUIRED_TEXT || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.deleteButtonText}>アカウントを削除する</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
    content: {
        padding: 24,
    },
    warningBox: {
        backgroundColor: '#FFEBEE',
        padding: 20,
        borderRadius: 12,
        marginBottom: 32,
        alignItems: 'center',
    },
    warningIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    warningTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#D32F2F',
        marginBottom: 12,
    },
    warningText: {
        fontSize: 14,
        color: '#333333',
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 16,
    },
    list: {
        width: '100%',
        paddingHorizontal: 16,
    },
    listItem: {
        fontSize: 14,
        color: '#D32F2F',
        marginBottom: 8,
        fontWeight: '500',
    },
    instruction: {
        fontSize: 16,
        color: '#333333',
        marginBottom: 16,
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 32,
        textAlign: 'center',
    },
    deleteButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    deleteButtonDisabled: {
        backgroundColor: '#EF9A9A',
    },
    deleteButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
