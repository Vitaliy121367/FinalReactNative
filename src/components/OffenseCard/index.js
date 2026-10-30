import React, { useContext } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import AppContext from '../../context/index';

// Джерело картинки: url з хмари (сервер) або base64 (локальний запис)
export const getImageSource = (offense) => {
    if (offense?.url) {
        return { uri: offense.url };
    }
    if (offense?.isLocal && offense.image) {
        const img = offense.image;
        return { uri: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` };
    }
    return null;
};

// id сервера й локальної БД можуть збігатися, тому ключ містить джерело
export const offenseKey = (offense) =>
    `${offense.isLocal ? 'local' : 'server'}-${offense.id}`;

export const isPending = (offense) => Boolean(offense?.isLocal && !offense.synced);

export default function OffenseCard({ offense, onPress }) {
    const { theme } = useContext(AppContext);
    const isLight = theme === 'light';

    const colors = {
        card: isLight ? '#f5f5f5' : '#1e1e1e',
        border: isLight ? '#e0e0e0' : '#333333',
        text: isLight ? '#000000' : '#ffffff',
        muted: isLight ? '#666666' : '#aaaaaa',
        placeholder: isLight ? '#dddddd' : '#2c2c2c',
    };

    const source = getImageSource(offense);

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.card,
                {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                },
            ]}
        >
            {source ? (
                <Image source={source} style={styles.image} />
            ) : (
                <View style={[styles.image, styles.placeholder, { backgroundColor: colors.placeholder }]}>
                    <Ionicons name="image-outline" size={28} color={colors.muted} />
                </View>
            )}

            <View style={styles.info}>
                <Text style={[styles.description, { color: colors.text }]} numberOfLines={3}>
                    {offense.description}
                </Text>

                <View style={styles.footer}>
                    <Text style={[styles.time, { color: colors.muted }]}>
                        {format(new Date(offense.date), 'HH:mm')}
                    </Text>

                    {isPending(offense) && (
                        <View style={styles.badge}>
                            <Ionicons name="cloud-offline-outline" size={12} color="#b26a00" />
                            <Text style={styles.badgeText}>Очікує відправки</Text>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
    },
    image: {
        width: 84,
        height: 84,
        borderRadius: 8,
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
    },
    description: {
        fontSize: 15,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    time: {
        fontSize: 13,
        marginRight: 10,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffe9c2',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    badgeText: {
        fontSize: 11,
        color: '#b26a00',
        marginLeft: 3,
    },
});