import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Android用のLayoutAnimation有効化
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter } from 'expo-router';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../src/lib/firebase';
import { useTemplates } from '../src/hooks/useTemplates';
import { useCategories } from '../src/hooks/useCategories';
import { useCards } from '../src/hooks/useCards';
import { Category, CardTemplate } from '../src/types';
import { calculateSimilarity } from '../src/utils/habitSimilarity';
import { checkDuplicate } from '../src/utils/cardDuplicateChecker';
import { SuccessAnimation } from '../src/components/SuccessAnimation';

// Step定義
type Step = 1 | 2 | 3;

export default function CreateCustomCardScreen() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);

    // Step 1: 習慣名
    const [habitName, setHabitName] = useState('');

    // Step 2: 類似検索結果
    const { templates } = useTemplates();
    const [similarTemplates, setSimilarTemplates] = useState<CardTemplate[]>([]);

    // Step 3: カテゴリ選択
    const { getL1Categories, getL2Categories, getL3Categories, loading: loadingCategories } = useCategories();
    const [l1Categories, setL1Categories] = useState<Category[]>([]);
    const [l2Categories, setL2Categories] = useState<Category[]>([]);
    const [l3Categories, setL3Categories] = useState<Category[]>([]);

    const [selectedL1, setSelectedL1] = useState<string | null>(null);
    const [selectedL2, setSelectedL2] = useState<string | null>(null);
    const [selectedL3, setSelectedL3] = useState<string | null>(null);

    // アイコン選択（360種類以上、カテゴリ別）
    const [selectedIcon, setSelectedIcon] = useState<string>('📝');
    const iconCategories = [
        { label: '記録・基本', icons: ['📝', '✅', '✔️', '⭐', '🌟', '✨', '💫', '🎯', '🏆', '🥇', '🏅', '📌', '📍', '💡', '🔔', '📣', '💬', '🔒', '🗓️', '📅', '🎖️', '🏵️', '📋', '📎', '🔑', '🗝️', '🔐', '🔓', '💯', '🔢', '🔤', '🔡', '🔠', '📍', '🎪', '🎟️', '🎫', '🏷️', '📑', '🗒️'] },
        { label: '健康・運動', icons: ['💪', '🏃', '🚶', '🧘', '🏋️', '🚴', '🏊', '⚽', '🎾', '🧗', '🤸', '🤼', '🏌️', '🏄', '🤾', '🧖', '🎿', '⛳', '🥊', '🤽', '🏇', '⛷️', '🏂', '🪂', '🤺', '🥋', '🛹', '🛼', '🏈', '🏀', '🏐', '🏒', '🥍', '🏑', '🥏', '🎳', '🏓', '🥅', '⛸️', '🤿'] },
        { label: '食事・栄養', icons: ['🍎', '🥗', '🥦', '💧', '🍳', '🍙', '☕', '🍵', '🥤', '🍽️', '🍇', '🍌', '🥑', '🥕', '🥬', '🍊', '🍓', '🥚', '🍖', '🥛', '🍞', '🥐', '🥨', '🧀', '🥩', '🍗', '🌮', '🌯', '🥙', '🍜', '🍲', '🍛', '🍱', '🥘', '🫕', '🥗', '🍿', '🧂', '🫒', '🧄'] },
        { label: '睡眠・休息', icons: ['🌙', '😴', '🛏️', '⏰', '🌅', '🌄', '💤', '🛌', '🌃', '🌌', '🌘', '🌜', '🌛', '⭐', '🕯️', '🧭', '🏝️', '🧘', '💆', '🛀', '🌠', '🌉', '🌆', '🌇', '🏖️', '⛱️', '🌴', '🎑', '🌕', '🌖', '🌗', '🌑', '🌒', '🌓', '🌔', '🌝', '🌞', '☄️', '🪐', '🌍'] },
        { label: '学習・仕事', icons: ['📚', '📖', '✍️', '💻', '🎓', '📊', '📈', '💼', '🔬', '🧠', '📝', '📁', '📂', '📧', '📱', '⌨️', '🖥️', '📰', '📡', '🧮', '🔭', '🔍', '🔎', '📐', '📏', '✂️', '📎', '🖊️', '🖋️', '✒️', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '🗃️', '🗄️'] },
        { label: 'お金', icons: ['💰', '💵', '💳', '🏦', '📉', '🐷', '💴', '💶', '💷', '💸', '🪙', '💱', '🧾', '📀', '📋', '📌', '🏧', '💹', '📊', '📈', '🧮', '🪪', '💳', '🎰', '🎲', '💎', '👛', '👜', '💼', '🧳'] },
        { label: '人間関係', icons: ['🤝', '👨‍👩‍👧', '💕', '❤️', '💬', '📞', '👋', '🙏', '👪', '👨‍👩‍👦', '👫', '👬', '👭', '🧑‍🤝‍🧑', '💌', '💍', '🎁', '🎉', '🤗', '💖', '💗', '💓', '💞', '💝', '💘', '💟', '❣️', '💔', '🫂', '👥', '👤', '🗣️', '👂', '👀', '🫶', '🤲', '👐', '🙌', '👏', '🤜'] },
        { label: '趣味・創作', icons: ['🎨', '🎵', '🎸', '📷', '🎮', '🎬', '📺', '🌳', '🌸', '🌻', '🎹', '🎺', '🥁', '🎻', '🎷', '🎼', '🎭', '🖌️', '🖍️', '🧵', '🪡', '🧶', '🎪', '🎡', '🎢', '🎠', '🎰', '🎲', '🧩', '🪀', '🪁', '🃏', '🀄', '🎴', '📸', '📹', '🎥', '📽️', '🎞️', '📻'] },
        { label: '生活・家事', icons: ['🏠', '🧹', '🧷', '🧺', '👕', '🪴', '🚿', '🪥', '🧴', '🧼', '🚽', '🛁', '🪒', '🧄', '🪣', '🛋️', '🛒', '🥣', '🍽️', '🪑', '🚪', '🪟', '🛖', '🏡', '🏘️', '🏚️', '🧊', '🪤', '🪠', '🧻', '🪞', '🪆', '🛏️', '🛎️', '🧳', '⏲️', '🕰️', '⌛', '⏳', '🧲'] },
        { label: '自然・天気', icons: ['🌿', '🍀', '🌵', '🌲', '🌱', '🌺', '🌷', '🌹', '🌼', '🌾', '🌤️', '☀️', '🌥️', '⛅', '🌦️', '🌈', '☔', '❄️', '🌊', '🌋', '🍁', '🍂', '🍃', '🌾', '🌻', '🌸', '💐', '🌺', '🌼', '🌷', '⛄', '☃️', '🌨️', '🌧️', '⛈️', '🌩️', '💨', '💧', '💦', '🌬️'] },
        { label: '動物', icons: ['🐶', '🐱', '🐰', '🐹', '🦊', '🐻', '🐼', '🐨', '🦁', '🐯', '🐘', '🦒', '🦓', '🦍', '🐦', '🦉', '🦋', '🐝', '🐢', '🐠', '🐟', '🐬', '🐳', '🦈', '🐙', '🦑', '🦐', '🦞', '🦀', '🐌', '🦂', '🦟', '🪲', '🐞', '🦗', '🪳', '🕷️', '🐍', '🦎', '🐊'] },
        { label: 'その他', icons: ['🔥', '⚡', '🌈', '☀️', '🍀', '🎁', '🎉', '💎', '🦋', '🐕', '🚀', '✈️', '🏛️', '🗼', '🎰', '🎲', '♻️', '🔮', '🌍', '🌎', '🌏', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏜️', '🏝️', '🛸', '🚁', '🚂', '🚗', '🚕', '🚌', '🚎', '🏎️', '🚲', '🛵'] },
    ];

    // 最終確認 - 公開設定
    const [isPublic, setIsPublic] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const { cards: userCards } = useCards();

    // ヘルプ表示
    const [showCheerHelp, setShowCheerHelp] = useState(false);
    const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Step 1 -> 2: 検索実行
    const handleSearch = () => {
        if (!habitName.trim()) {
            Alert.alert('エラー', '習慣の名前を入力してください');
            return;
        }

        // テンプレートのみから類似度検索
        const allCandidates = [...templates];
        const scored = allCandidates.map(t => ({
            template: t,
            score: calculateSimilarity(habitName, t.title_ja),
        }));

        // スコアが0.3以上のものを類似とみなす
        const filtered = scored.filter(s => s.score > 0.3);
        filtered.sort((a, b) => b.score - a.score);
        const top5 = filtered.slice(0, 5).map(s => s.template);

        setSimilarTemplates(top5);

        // 類似が見つかったらStep 2へ、見つからなければStep 3（作成）へ直行
        if (top5.length > 0) {
            setStep(2);
        } else {
            handleProceedToCreate();
        }
    };

    // Step 2: テンプレートを使用
    const handleUseTemplate = (template: CardTemplate) => {
        router.push({
            pathname: '/select-card',
            params: { l1: template.category_l1 }
        });
    };

    // Step 2 -> 3: オリジナル作成へ
    const handleProceedToCreate = () => {
        const l1 = getL1Categories();
        setL1Categories(l1);
        setStep(3);
    };

    // Step 3: カテゴリ選択ロジック
    const handleSelectL1 = (id: string) => {
        // 即座に選択状態を反映（青色表示）
        setSelectedL1(id);
        setSelectedL2(null);
        setSelectedL3(null);
        const l2 = getL2Categories(id);
        setL2Categories(l2);
        setL3Categories([]);
        // 150ms後にアニメーション（選択状態を見せてから折りたたむ）
        setTimeout(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }, 150);
    };

    const handleSelectL2 = (id: string) => {
        // 即座に選択状態を反映（青色表示）
        setSelectedL2(id);
        // L3を自動的に :other に設定
        const autoL3 = `${id}:other`;
        setSelectedL3(autoL3);
        const l3 = getL3Categories(id);
        setL3Categories(l3);
        // 150ms後にアニメーション（選択状態を見せてから折りたたむ）
        setTimeout(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }, 150);
    };

    const handleSelectL3 = (id: string) => {
        setSelectedL3(id);
    };

    // 最終作成
    const handleCreateCustom = async () => {
        if (!selectedL1 || !selectedL2) {
            Alert.alert('エラー', 'カテゴリを選択してください');
            return;
        }

        // タイトルの正規化（前後の空白を削除）
        const normalizedTitle = habitName.trim();
        if (!normalizedTitle) {
            Alert.alert('エラー', '習慣の名前を入力してください');
            return;
        }

        // L3が未設定の場合は自動設定
        const finalL3 = selectedL3 || `${selectedL2}:other`;

        // 重複チェック
        const duplicateCheck = checkDuplicate(
            normalizedTitle,
            selectedL1,
            selectedL2,
            finalL3,
            userCards
        );

        if (duplicateCheck.duplicateType === 'exact') {
            Alert.alert(
                '既に存在します',
                `「${duplicateCheck.duplicateCard?.title}」は既に追加されています。`,
                [{ text: 'OK' }]
            );
            return;
        }

        if (duplicateCheck.duplicateType === 'similar') {
            Alert.alert(
                '似た習慣があります',
                `「${duplicateCheck.duplicateCard?.title}」と似ています。\nそれでも追加しますか？`,
                [
                    { text: 'キャンセル', style: 'cancel' },
                    { text: '追加する', onPress: () => performCreate(normalizedTitle, finalL3) }
                ]
            );
            return;
        }

        // カード作成上限チェック（50枚）
        const activeCards = userCards.filter(c => c.status === 'active');
        if (activeCards.length >= 50) {
            Alert.alert(
                'カード上限',
                'カードは最大50枚まで作成できます。\n不要なカードをアーカイブしてください。',
                [{ text: 'OK' }]
            );
            return;
        }

        await performCreate(normalizedTitle, finalL3);
    };

    const performCreate = async (title: string, categoryL3: string) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            setSubmitting(true);
            const now = Timestamp.now();
            await addDoc(collection(db, 'cards'), {
                owner_uid: currentUser.uid,
                category_l1: selectedL1,
                category_l2: selectedL2,
                category_l3: categoryL3,
                title,
                icon: selectedIcon,
                template_id: 'custom',
                is_custom: true,
                is_public: isPublic,
                current_streak: 0,
                longest_streak: 0,
                total_logs: 0,
                last_log_date: '',
                status: 'active',
                archived_at: null,
                reminder_enabled: false,
                reminder_time: null,
                created_at: now,
                updated_at: now,
            });
            setShowSuccess(true);
        } catch (e) {
            console.error(e);
            Alert.alert('エラー', '作成に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSuccessFinish = () => {
        setShowSuccess(false);
        router.replace('/(tabs)/home');
    };

    // --- UI Components for Steps ---

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.questionText}>どんな習慣を続けたいですか？</Text>
            <TextInput
                style={styles.input}
                placeholder="例: プログラミング学習、毎朝のヨガ"
                value={habitName}
                onChangeText={setHabitName}
                autoFocus
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleSearch}>
                <Text style={styles.primaryButtonText}>次へ（類似を検索）</Text>
            </TouchableOpacity>
            <View style={styles.hintBox}>
                <Text style={styles.hintTitle}>💡 ヒント</Text>
                <Text style={styles.hintText}>
                    似た習慣がすでにあれば、同じカテゴリの仲間とつながりやすくなります。
                </Text>
            </View>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.questionText}>他の人はこんなカードを登録しています</Text>
            <Text style={styles.subText}>「{habitName}」での検索結果</Text>

            {similarTemplates.length > 0 ? (
                <ScrollView style={styles.resultList}>
                    {similarTemplates.map(item => (
                        <View key={item.template_id} style={styles.resultItem}>
                            <View style={styles.resultInfo}>
                                <Text style={styles.resultIcon}>{item.icon}</Text>
                                <View>
                                    <Text style={styles.resultTitle}>{item.title_ja}</Text>
                                    <Text style={styles.resultCategory}>{item.category_l1}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.useButton} onPress={() => handleUseTemplate(item)}>
                                <Text style={styles.useButtonText}>これを使う</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <View style={styles.noResult}>
                    <Text style={styles.noResultText}>類似する習慣は見つかりませんでした</Text>
                </View>
            )}

            <View style={styles.divider} />

            <TouchableOpacity style={styles.secondaryButton} onPress={handleProceedToCreate}>
                <Text style={styles.secondaryButtonText}>
                    {similarTemplates.length > 0 ? '見つからないので新しく作成' : '新しく作成する'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderStep3 = () => (
        <ScrollView style={styles.stepContainer} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* 入力サマリー */}
            <View style={styles.summaryCard}>
                <Text style={styles.summaryIcon}>{selectedIcon}</Text>
                <View style={styles.summaryContent}>
                    <Text style={styles.summaryTitle}>{habitName}</Text>
                    <Text style={styles.summarySubtitle}>
                        {selectedL1 && l1Categories.find(c => c.category_id === selectedL1)?.name_ja}
                        {selectedL2 && ` > ${l2Categories.find(c => c.category_id === selectedL2)?.name_ja || ''}`}
                    </Text>
                </View>
            </View>

            {/* 大カテゴリ - 未選択なら展開、選択済みなら折りたたみ */}
            {!selectedL1 ? (
                <>
                    <Text style={styles.categoryLabel}>この習慣はどのカテゴリ？</Text>
                    <View style={styles.categoryGrid}>
                        {l1Categories.map(cat => (
                            <TouchableOpacity
                                key={cat.category_id}
                                style={[styles.categoryCard, selectedL1 === cat.category_id && styles.categoryCardSelected]}
                                onPress={() => handleSelectL1(cat.category_id)}
                            >
                                <Text style={styles.categoryCardIcon}>{cat.icon}</Text>
                                <Text style={[styles.categoryCardText, selectedL1 === cat.category_id && styles.categoryCardTextSelected]}>
                                    {cat.name_ja}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            ) : (
                /* 大カテゴリ選択済み - コンパクト表示 */
                <TouchableOpacity
                    style={styles.categoryCompact}
                    onPress={() => {
                        setSelectedL1(null);
                        setSelectedL2(null);
                    }}
                >
                    <View style={styles.categoryCompactContent}>
                        <Text style={styles.categoryCompactIcon}>
                            {l1Categories.find(c => c.category_id === selectedL1)?.icon}
                        </Text>
                        <View>
                            <Text style={styles.categoryCompactText}>
                                {l1Categories.find(c => c.category_id === selectedL1)?.name_ja}
                            </Text>
                            <Text style={styles.categoryCompactHint}>タップして変更</Text>
                        </View>
                    </View>
                    <Text style={styles.categoryCompactArrow}>✏️</Text>
                </TouchableOpacity>
            )}

            {/* 中カテゴリ - L1選択済み & L2未選択なら展開 */}
            {selectedL1 && !selectedL2 && (
                <>
                    <Text style={styles.categoryLabel}>もう少し詳しく選んでください</Text>
                    <View style={styles.categoryGrid}>
                        {l2Categories.map(cat => (
                            <TouchableOpacity
                                key={cat.category_id}
                                style={[styles.subcategoryCard, selectedL2 === cat.category_id && styles.subcategoryCardSelected]}
                                onPress={() => handleSelectL2(cat.category_id)}
                            >
                                <Text style={[styles.subcategoryCardText, selectedL2 === cat.category_id && styles.subcategoryCardTextSelected]}>
                                    {cat.name_ja}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            {/* 中カテゴリ選択済み - コンパクト表示 */}
            {selectedL2 && (
                <TouchableOpacity
                    style={styles.subcategoryCompact}
                    onPress={() => {
                        setSelectedL2(null);
                    }}
                >
                    <Text style={styles.subcategoryCompactText}>
                        {l2Categories.find(c => c.category_id === selectedL2)?.name_ja}
                    </Text>
                    <Text style={styles.categoryCompactHint}>タップして変更</Text>
                </TouchableOpacity>
            )}

            {/* アイコン選択 - L1選択時から裏で事前読み込み */}
            <View style={[styles.finalSection, !selectedL2 && styles.hiddenPreload]}>
                <Text style={styles.label}>アイコン</Text>
                <ScrollView style={styles.iconScrollView} nestedScrollEnabled>
                    {iconCategories.map(category => (
                        <View key={category.label} style={styles.iconCategoryBlock}>
                            <Text style={styles.iconCategoryLabel}>{category.label}</Text>
                            <View style={styles.iconGrid}>
                                {category.icons.map((icon: string, index: number) => (
                                    <TouchableOpacity
                                        key={`${category.label}-${index}`}
                                        style={[styles.iconOption, selectedIcon === icon && styles.iconOptionSelected]}
                                        onPress={() => setSelectedIcon(icon)}
                                    >
                                        <Text style={styles.iconOptionText}>{icon}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))}
                </ScrollView>

                {/* 公開設定 - L2選択済みのみ表示 */}
                {selectedL2 && (
                    <>
                        <Text style={styles.label}>公開設定</Text>

                        {/* チアシステムに参加 */}
                        <View style={styles.settingRow}>
                            <TouchableOpacity
                                style={styles.settingMain}
                                onPress={() => setIsPublic(!isPublic)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, isPublic && styles.checkboxChecked]}>
                                    {isPublic && <Text style={styles.checkmark}>✓</Text>}
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={styles.rowLabel}>チアシステムに参加</Text>
                                    <Text style={styles.rowSubtext}>他の人からエールをもらえ、この習慣を採用できるようになります</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.helpButton} onPress={() => setShowCheerHelp(!showCheerHelp)}>
                                <Text style={styles.helpButtonText}>?</Text>
                            </TouchableOpacity>
                        </View>
                        {showCheerHelp && (
                            <View style={styles.helpTooltip}>
                                <Text style={styles.helpTooltipText}>
                                    ONにすると、同じカテゴリの習慣を頑張っている人からエール（応援）を受け取れます。あなたの習慣名とニックネームが表示されます。
                                </Text>
                            </View>
                        )}

                        {/* プライバシー情報展開 */}
                        <TouchableOpacity
                            style={styles.privacyToggle}
                            onPress={() => setShowPrivacyInfo(!showPrivacyInfo)}
                        >
                            <Text style={styles.privacyToggleText}>
                                {showPrivacyInfo ? '▼' : '▶'} プライバシーについて
                            </Text>
                        </TouchableOpacity>
                        {showPrivacyInfo && (
                            <View style={styles.privacyCard}>
                                <Text style={styles.privacyTitle}>🔒 あなたのプライバシー</Text>
                                <Text style={styles.privacyItem}>• 習慣の記録内容（日時・回数）は公開されません</Text>
                                <Text style={styles.privacyItem}>• 設定はいつでもカード詳細画面から変更できます</Text>
                                <Text style={styles.privacyItem}>• ニックネームは設定画面で自由に変更可能です</Text>
                                <Text style={styles.privacyItem}>• OFFにすると完全プライベートモードになります</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.primaryButton, submitting && styles.disabledButton]}
                            onPress={handleCreateCustom}
                            disabled={submitting}
                        >
                            <Text style={styles.primaryButtonText}>この習慣を始める</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => {
                    if (step > 1) setStep((s) => s - 1 as Step);
                    else router.back();
                }}>
                    <Text style={styles.backButton}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>オリジナルを作成</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Step Indicator */}
            <View style={styles.stepIndicator}>
                {[1, 2, 3].map((s) => (
                    <View key={s} style={styles.stepIndicatorRow}>
                        <View style={[styles.stepDot, step >= s && styles.stepDotActive]} />
                        {s < 3 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
                    </View>
                ))}
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </KeyboardAvoidingView>
            <SuccessAnimation
                visible={showSuccess}
                onFinish={handleSuccessFinish}
                title="作成しました！"
                subtitle="新しい習慣を始めましょう"
                source={require('../assets/success-check-fill-FPiuzFU9Hy.json')}
            />
        </SafeAreaView >
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
    stepContainer: {
        flex: 1,
        padding: 24,
    },
    questionText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 24,
        textAlign: 'center',
    },
    subText: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        marginBottom: 24,
    },
    input: {
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    primaryButton: {
        backgroundColor: '#4A90E2',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    hintBox: {
        backgroundColor: '#F0F7FF',
        padding: 16,
        borderRadius: 12,
        marginTop: 24,
    },
    hintTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4A90E2',
        marginBottom: 8,
    },
    hintText: {
        fontSize: 14,
        color: '#4A90E2',
        lineHeight: 20,
    },
    // Step 2 Styles
    resultList: {
        maxHeight: '60%',
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    resultInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    resultIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
    },
    resultCategory: {
        fontSize: 12,
        color: '#999999',
        marginTop: 2,
    },
    useButton: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    useButtonText: {
        color: '#4CAF50',
        fontWeight: '600',
        fontSize: 12,
    },
    noResult: {
        padding: 24,
        alignItems: 'center',
    },
    noResultText: {
        color: '#999999',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: 24,
    },
    secondaryButton: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#666666',
        fontSize: 16,
        textDecorationLine: 'underline',
    },
    // Step 3 Styles
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        marginTop: 12,
        color: '#333333',
    },
    chipContainer: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    chipSelected: {
        backgroundColor: '#E3F2FD',
        borderColor: '#4A90E2',
    },
    chipText: {
        color: '#666666',
    },
    chipTextSelected: {
        color: '#4A90E2',
        fontWeight: '600',
    },
    finalSection: {
        marginTop: 24,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#4A90E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    checkboxChecked: {
        backgroundColor: '#4A90E2',
    },
    checkmark: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    rowText: {
        flex: 1,
    },
    rowLabel: {
        fontSize: 16,
        color: '#333333',
        fontWeight: '500',
    },
    rowSubtext: {
        fontSize: 12,
        color: '#666666',
        marginTop: 2,
    },
    disabledButton: {
        opacity: 0.5,
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16,
    },
    iconOption: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    iconOptionSelected: {
        backgroundColor: '#E3F2FD',
        borderColor: '#4A90E2',
    },
    iconOptionText: {
        fontSize: 24,
    },
    iconScrollView: {
        maxHeight: 250,
        marginBottom: 16,
    },
    iconCategoryBlock: {
        marginBottom: 12,
    },
    iconCategoryLabel: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 6,
        fontWeight: '600',
    },
    // Step Indicator
    stepIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
    },
    stepIndicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#E0E0E0',
    },
    stepDotActive: {
        backgroundColor: '#4A90E2',
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 4,
    },
    stepLineActive: {
        backgroundColor: '#4A90E2',
    },
    // Summary Card
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F7FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E3F2FD',
    },
    summaryIcon: {
        fontSize: 40,
        marginRight: 16,
    },
    summaryContent: {
        flex: 1,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 4,
    },
    summarySubtitle: {
        fontSize: 14,
        color: '#666666',
    },
    // Setting Row with Help
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    settingMain: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    helpButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E8E8E8',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    helpButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#666666',
    },
    helpTooltip: {
        backgroundColor: '#FFF9E6',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        marginLeft: 36,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    helpTooltipText: {
        fontSize: 13,
        color: '#666666',
        lineHeight: 18,
    },
    // Privacy Info
    privacyToggle: {
        paddingVertical: 12,
        marginTop: 8,
    },
    privacyToggleText: {
        fontSize: 14,
        color: '#4A90E2',
        fontWeight: '500',
    },
    privacyCard: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    privacyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 12,
    },
    privacyItem: {
        fontSize: 13,
        color: '#666666',
        lineHeight: 22,
    },
    // Category Grid
    categoryLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 16,
        marginTop: 8,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    categoryCard: {
        width: '48%',
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E0E0E0',
    },
    categoryCardSelected: {
        backgroundColor: '#E3F2FD',
        borderColor: '#4A90E2',
    },
    categoryCardIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    categoryCardText: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        fontWeight: '500',
    },
    categoryCardTextSelected: {
        color: '#4A90E2',
        fontWeight: 'bold',
    },
    subcategoryCard: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    subcategoryCardSelected: {
        backgroundColor: '#E3F2FD',
        borderColor: '#4A90E2',
        borderWidth: 2,
    },
    subcategoryCardText: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
    },
    subcategoryCardTextSelected: {
        color: '#4A90E2',
        fontWeight: 'bold',
    },
    // Category Compact (collapsed view)
    categoryCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F0F7FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#4A90E2',
    },
    categoryCompactContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    categoryCompactIcon: {
        fontSize: 28,
        marginRight: 12,
    },
    categoryCompactText: {
        fontSize: 15,
        color: '#333333',
        fontWeight: '600',
    },
    categoryCompactHint: {
        fontSize: 12,
        color: '#4A90E2',
        marginTop: 2,
    },
    categoryCompactArrow: {
        fontSize: 18,
    },
    subcategoryCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#4A90E2',
    },
    subcategoryCompactText: {
        fontSize: 15,
        color: '#333333',
        fontWeight: '500',
    },
    hiddenPreload: {
        position: 'absolute',
        left: -9999,
        top: -9999,
        opacity: 0,
    },
});
