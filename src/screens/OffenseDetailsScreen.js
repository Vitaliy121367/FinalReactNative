import React, { useContext, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import AppContext from '../context';
import { getImageSource, isPending } from '../components/OffenseCard';
import { refreshOffense } from '../tools/api/offensesData';

export default function OffenseDetailsScreen({ route }) {
    const { theme } = useContext(AppContext);
    const isLight = theme === 'light';

    const colors = {
        background: isLight ? '#ffffff' : '#121212',
        text: isLight ? '#000000' : '#ffffff',
        muted: isLight ? '#666666' : '#aaaaaa',
        placeholder: isLight ? '#dddddd' : '#2c2c2c',
    };

    // Одразу показуємо запис зі списку, у фоні намагаємось оновити його
    const [offense, setOffense] = useState(route.params.offense);

    useEffect(() => {
        let active = true;
        refreshOffense(route.params.offense).then((fresh) => {
            if (active && fresh) {
                setOffense(fresh);
            }
        });
        return () => {
            active = false;
        };
    }, [route.params.offense]);

    const source = getImageSource(offense);
    const hasCoords = offense.latitude != null && offense.longitude != null;

    return (
        <ScrollView style={{ backgroundColor: colors.background }}>
            {source ? (
                <Image source={source} style={styles.image} resizeMode="cover" />
            ) : (
                <View style={[styles.image, styles.placeholder, { backgroundColor: colors.placeholder }]}>
                    <Ionicons name="image-outline" size={48} color={colors.muted} />
                </View>
            )}

            <View style={styles.body}>
                {isPending(offense) && (
                    <View style={styles.badge}>
                        <Ionicons name="cloud-offline-outline" size={14} color="#b26a00" />
                        <Text style={styles.badgeText}>Очікує відправки на сервер</Text>
                    </View>
                )}

                <Text style={[styles.description, { color: colors.text }]}>
                    {offense.description}
                </Text>

                <View style={styles.row}>
                    <Ionicons name="time-outline" size={18} color={colors.muted} />
                    <Text style={[styles.meta, { color: colors.muted }]}>
                        {format(new Date(offense.date), 'dd.MM.yyyy, HH:mm')}
                    </Text>
                </View>

                {hasCoords && (
                    <View style={styles.row}>
                        <Ionicons name="location-outline" size={18} color={colors.muted} />
                        <Text style={[styles.meta, { color: colors.muted }]}>
                            {Number(offense.latitude).toFixed(5)}, {Number(offense.longitude).toFixed(5)}
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    image: {
        width: '100%',
        aspectRatio: 4 / 3,
    },
    placeholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        padding: 16,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#ffe9c2',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginBottom: 12,
    },
    badgeText: {
        fontSize: 13,
        color: '#b26a00',
        marginLeft: 5,
    },
    description: {
        fontSize: 17,
        lineHeight: 24,
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    meta: {
        fontSize: 14,
        marginLeft: 8,
    },
});