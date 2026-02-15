import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Dimensions,
    FlatList,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: '小さな一歩が\n未来を変える',
        description: 'Tsuzumiは、あなたの「続けたい」をサポートします。無理なく、少しずつ積み重ねましょう。',
        icon: '🌱',
    },
    {
        id: '2',
        title: '仲間からのエールで\nモチベーションUP',
        description: '同じ目標を持つ仲間とエール（応援）を送り合えます。一人じゃないから、続けられる。',
        icon: '🤝',
    },
    {
        id: '3',
        title: 'さあ、始めましょう',
        description: 'あなたの新しい習慣ライフがここから始まります。',
        icon: '🚀',
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const handleNext = async () => {
        if (currentSlideIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentSlideIndex + 1 });
        } else {
            // 完了処理
            await completeOnboarding();
        }
    };

    const completeOnboarding = async () => {
        try {
            await AsyncStorage.setItem('has_launched', 'true');
            router.replace('/(tabs)/home');
        } catch (e) {
            console.error('Onboarding error:', e);
        }
    };

    const updateCurrentSlideIndex = (e: any) => {
        const contentOffsetX = e.nativeEvent.contentOffset.x;
        const currentIndex = Math.round(contentOffsetX / width);
        setCurrentSlideIndex(currentIndex);
    };

    const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => {
        return (
            <View style={styles.slide}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>{item.icon}</Text>
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <FlatList
                ref={flatListRef}
                onMomentumScrollEnd={updateCurrentSlideIndex}
                contentContainerStyle={styles.flatListContent}
                showsHorizontalScrollIndicator={false}
                horizontal
                data={SLIDES}
                pagingEnabled
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
            />

            <View style={styles.footer}>
                {/* インジケーター */}
                <View style={styles.indicatorContainer}>
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.indicator,
                                currentSlideIndex === index && styles.indicatorActive,
                            ]}
                        />
                    ))}
                </View>

                {/* ボタン */}
                <TouchableOpacity style={styles.button} onPress={handleNext}>
                    <Text style={styles.buttonText}>
                        {currentSlideIndex === SLIDES.length - 1 ? '始める' : '次へ'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    flatListContent: {
        height: height * 0.7,
    },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        width: 120,
        height: 120,
        backgroundColor: '#F0F7FF',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    icon: {
        fontSize: 60,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333333',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 32,
    },
    description: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        height: height * 0.3,
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 50,
    },
    indicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    indicator: {
        height: 8,
        width: 8,
        backgroundColor: '#E0E0E0',
        borderRadius: 4,
        marginHorizontal: 4,
    },
    indicatorActive: {
        backgroundColor: '#4A90E2',
        width: 24,
    },
    button: {
        backgroundColor: '#4A90E2',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
