import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useNetwork } from '../../context/NetworkContext';

// Компактний індикатор стану: Офлайн / Синхронізація / Не синхронізовано: N.
// Коли все відправлено і зв'язок є, нічого не показує.
// Натискання на «Не синхронізовано» запускає синхронізацію вручну
export default function OfflineBanner() {
    const { isOnline, pendingCount, syncing, syncNow } = useNetwork();

    if (isOnline && pendingCount === 0 && !syncing) {
        return null;
    }

    let label;
    if (syncing) {
        label = 'Синхронізація...';
    } else if (!isOnline) {
        label = pendingCount > 0 ? `Офлайн · не синхр.: ${pendingCount}` : 'Офлайн';
    } else {
        label = `Не синхронізовано: ${pendingCount}`;
    }

    return (
        <Pressable
            style={styles.banner}
            onPress={syncNow}
            disabled={!isOnline || syncing}
        >
            {syncing ? (
                <ActivityIndicator size="small" color="#b26a00" />
            ) : (
                <Ionicons
                    name={isOnline ? 'cloud-upload-outline' : 'cloud-offline-outline'}
                    size={14}
                    color="#b26a00"
                />
            )}
            <Text style={styles.text}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffe9c2',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    text: {
        fontSize: 12,
        color: '#b26a00',
        marginLeft: 5,
    },
});