import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
} from 'react-native-reanimated';

interface SuccessAnimationProps {
    visible: boolean;
    onFinish: () => void;
    /** Text to display as the main title */
    title?: string;
    /** Text to display as the subtitle */
    subtitle?: string;
    /** Lottie JSON source (require(path)) */
    source?: React.ComponentProps<typeof LottieView>['source'];
    /** If provided, renders inside the floating circle above text. If null, shows nothing. Defaults to '✨' */
    iconContent?: React.ReactNode;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
    visible,
    onFinish,
    title = '成功！',
    subtitle = '',
    source,
    iconContent = <Text style={styles.icon}>✨</Text>
}) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: opacity.value,
        };
    });

    useEffect(() => {
        if (visible) {
            scale.value = 0;
            opacity.value = 0;

            // Start animation
            scale.value = withSequence(
                withSpring(1.2),
                withSpring(1)
            );
            opacity.value = withSpring(1);

            // Finish after delay
            const timeout = setTimeout(() => {
                onFinish();
            }, 3500); // Slightly longer for fuller appreciation

            return () => clearTimeout(timeout);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <TouchableOpacity
                style={styles.container}
                activeOpacity={1}
                onPress={onFinish}
            >
                <View style={styles.content}>
                    {/* Lottie Animation Layer */}
                    <View style={styles.lottieContainer}>
                        {source && (
                            <LottieView
                                source={source}
                                autoPlay
                                loop={false}
                                style={styles.lottie}
                                resizeMode="cover"
                            />
                        )}
                    </View>

                    {/* Reanimated Text Layer */}
                    <Animated.View style={[styles.textContainer, animatedStyle]}>
                        {iconContent && (
                            <View style={styles.iconCircle}>
                                {iconContent}
                            </View>
                        )}
                        <Text style={styles.title}>{title}</Text>
                        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                    </Animated.View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
    },
    lottieContainer: {
        position: 'absolute',
        width: 400,
        height: 400,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lottie: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        alignItems: 'center',
        zIndex: 10,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    icon: {
        fontSize: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});
