import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    StatusBar,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { useCards } from '../src/hooks/useCards';
import { DeleteCardDialog } from '../src/components/DeleteCardDialog';
import { Card } from '../src/types';

export default function ArchivedCardsScreen() {
    const router = useRouter();
    const { cards, loading } = useCards();
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    // アーカイブされたカードのみ抽出
    const archivedCards = cards.filter((c) => c.status === 'archived');

    const handleRestore = async (card: Card) => {
        Alert.alert(
            '復元しますか？',
            `「${card.title}」をホーム画面に戻します。`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '復元する',
                    onPress: async () => {
                        try {
                            await updateDoc(doc(db, 'cards', card.card_id), {
                                status: 'active',
                                updated_at: Timestamp.now(),
                            });
                            Alert.alert('完了', 'カードを復元しました');
                        } catch (e) {
                            console.error(e);
                            Alert.alert('エラー', '復元に失敗しました');
                        }
                    }
                }
            ]
        );
    };

    const handleDeletePress = (card: Card) => {
        setSelectedCard(card);
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedCard) return;
        try {
            await deleteDoc(doc(db, 'cards', selectedCard.card_id));
            setShowDeleteDialog(false);
            Alert.alert('完了', 'カードを完全に削除しました');
        } catch (e) {
            console.error(e);
            Alert.alert('エラー', '削除に失敗しました');
        }
    };

    const renderItem = ({ item }: { item: Card }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <Text style={styles.cardIcon}>📦</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardDate}>アーカイブ日: {item.archived_at?.toDate().toLocaleDateString()}</Text>
                    <View style={styles.statsContainer}>
                        <Text style={styles.statsText}>累計 {item.total_logs || 0}回</Text>
                        <Text style={styles.statsTextDivider}>|</Text>
                        <Text style={styles.statsText}>最長 {item.longest_streak || 0}日連続</Text>
                    </View>
                </View>
            </View>
            <View style={styles.actionContainer}>
                <TouchableOpacity
                    style={styles.restoreButton}
                    onPress={() => handleRestore(item)}
                >
                    <Text style={styles.restoreText}>復元</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeletePress(item)}
                >
                    <Text style={styles.deleteText}>削除</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

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
                <Text style={styles.headerTitle}>アーカイブ一覧</Text>
                <View style={{ width: 40 }} />
            </View>

            {archivedCards.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>アーカイブされたカードはありません</Text>
                </View>
            ) : (
                <FlatList
                    data={archivedCards}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.card_id}
                    contentContainerStyle={styles.listContent}
                />
            )}

            <DeleteCardDialog
                visible={showDeleteDialog}
                cardTitle={selectedCard?.title || ''}
                onClose={() => setShowDeleteDialog(false)}
                onDelete={handleDeleteConfirm}
                // No archive option in archive screen
                onArchive={undefined}
            />
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
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
    },
    cardDate: {
        fontSize: 12,
        color: '#999999',
        marginTop: 2,
    },
    statsContainer: {
        flexDirection: 'row',
        marginTop: 4,
        alignItems: 'center',
    },
    statsText: {
        fontSize: 12,
        color: '#4A90E2',
        fontWeight: '500',
    },
    statsTextDivider: {
        fontSize: 12,
        color: '#CCCCCC',
        marginHorizontal: 8,
    },
    actionContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    restoreButton: {
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    restoreText: {
        color: '#2196F3',
        fontSize: 14,
        fontWeight: '600',
    },
    deleteButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
    deleteText: {
        color: '#E53935',
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#999999',
        fontSize: 16,
    },
});
