import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

type CategoryCardProps = {
    icon: string;
    name: string;
    description?: string;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
};

export const CategoryCard = ({ icon, name, description, onPress, style }: CategoryCardProps) => {
    return (
        <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.content}>
                <Text style={styles.icon}>{icon}</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.name}>{name}</Text>
                    {description && <Text style={styles.description}>{description}</Text>}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        fontSize: 32,
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: '#666666',
    },
});
