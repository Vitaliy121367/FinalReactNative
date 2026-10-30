import React, { useCallback, useContext, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import AppContext from '../context';
import OffenseCard, { offenseKey } from '../components/OffenseCard';
import { loadOffensesByDate } from '../tools/api/offensesData';
import { useNetwork } from '../context/NetworkContext';

export default function DayOffensesScreen({ route, navigation }) {
    const { date } = route.params;
    const { theme } = useContext(AppContext);
    const { syncVersion } = useNetwork();
    const isLight = theme === 'light';

    const colors = {
        background: isLight ? '#ffffff' : '#121212',
        text: isLight ? '#000000' : '#ffffff',
        muted: isLight ? '#888888' : '#999999',
        accent: isLight ? '#2196F3' : '#904ee3',
    };

    const [offenses, setOffenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [offline, setOffline] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        try {
            const result = await loadOffensesByDate(date);
            setOffenses(result.offenses);
            setOffline(result.offline);
            setError(null);
        } catch (e) {
            setError(e.message || 'Не вдалося завантажити дані');
        }
    }, [date]);

    // Оновлюємо список щоразу, коли екран знову в фокусі
    useFocusEffect(
        useCallback(() => {
            let active = true;
            setLoading(true);
            load().finally(() => active && setLoading(false));
            return () => {
                active = false;
            };
        }, [load, syncVersion])
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    if (loading && offenses.length === 0) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {offline && (
                <Text style={[styles.offline, { color: colors.muted }]}>
                    Офлайн: показано лише збережені на пристрої записи
                </Text>
            )}

            <FlatList
                data={offenses}
                keyExtractor={offenseKey}
                renderItem={({ item }) => (
                    <OffenseCard
                        offense={item}
                        onPress={() => navigation.navigate('OffenseDetails', { offense: item })}
                    />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                contentContainerStyle={styles.list}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                ListEmptyComponent={
                    <Text style={[styles.empty, { color: error ? '#d32f2f' : colors.muted }]}>
                        {error || 'За цей день правопорушень немає'}
                    </Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        padding: 12,
        flexGrow: 1,
    },
    offline: {
        fontSize: 12,
        textAlign: 'center',
        paddingTop: 8,
    },
    empty: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 15,
    },
});