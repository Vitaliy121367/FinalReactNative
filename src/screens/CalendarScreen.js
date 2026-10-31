import React, { useCallback, useContext, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import AppContext from '../context';
import { loadDays } from '../tools/api/offensesData';
import { useNetwork } from '../context/NetworkContext';
import Header from '../components/Header';
import NetworkStatus from '../components/OfflineBanner';
import {clearLocalData} from "../tools/database/database";

const MONTHS = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const pad = (n) => String(n).padStart(2, '0');

export default function CalendarScreen({ navigation }) {
    const { theme } = useContext(AppContext);
    const { syncVersion } = useNetwork();
    const isLight = theme === 'light';

    const colors = {
        background: isLight ? '#ffffff' : '#121212',
        text: isLight ? '#000000' : '#ffffff',
        muted: isLight ? '#888888' : '#999999',
        accent: isLight ? '#2196F3' : '#904ee3',
        today: '#ff9800', // сьогодні: окремий колір, щоб не плутати з днями з правопорушеннями
    };

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth()); // 0–11
    const [markedDays, setMarkedDays] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [offline, setOffline] = useState(false);
    const [error, setError] = useState(null);

    const monthKey = `${year}-${pad(month + 1)}`;

    // Перезавантажуємо дні при зміні місяця і щоразу, коли екран знову в фокусі
    // (наприклад, після додавання правопорушення або синхронізації)
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            setLoading(true);

            loadDays(monthKey)
                .then(({ days, offline: isOffline }) => {
                    if (cancelled) return;
                    setMarkedDays(new Set(days));
                    setOffline(isOffline);
                    setError(null);
                })
                .catch((e) => {
                    if (cancelled) return;
                    setMarkedDays(new Set());
                    setError(e.message || 'Не вдалося завантажити дані');
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });

            return () => {
                cancelled = true;
            };
        }, [monthKey, syncVersion])
    );

    const goPrev = () => {
        if (month === 0) {
            setMonth(11);
            setYear(year - 1);
        } else {
            setMonth(month - 1);
        }
    };

    const goNext = () => {
        if (month === 11) {
            setMonth(0);
            setYear(year + 1);
        } else {
            setMonth(month + 1);
        }
    };

    // Тижні місяця; тиждень починається з понеділка
    const weeks = useMemo(() => {
        const offset = (new Date(year, month, 1).getDay() + 6) % 7;
        const total = new Date(year, month + 1, 0).getDate();

        const cells = Array(offset).fill(null);
        for (let d = 1; d <= total; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);

        const result = [];
        for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
        return result;
    }, [year, month]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                }}
            >
                <Header />
                <NetworkStatus />
            </View>

            <View style={styles.monthRow}>
                <Pressable onPress={goPrev} hitSlop={12}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </Pressable>

                <Text style={[styles.monthTitle, { color: colors.text }]}>
                    {MONTHS[month]} {year}
                </Text>

                <Pressable onPress={goNext} hitSlop={12}>
                    <Ionicons name="chevron-forward" size={26} color={colors.text} />
                </Pressable>
            </View>

            <View style={styles.weekRow}>
                {WEEKDAYS.map((name) => (
                    <Text key={name} style={[styles.weekday, { color: colors.muted }]}>
                        {name}
                    </Text>
                ))}
            </View>

            {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekRow}>
                    {week.map((day, dayIndex) => {
                        if (!day) {
                            return <View key={dayIndex} style={styles.cell} />;
                        }

                        const dateStr = `${monthKey}-${pad(day)}`;
                        const marked = markedDays.has(dateStr);
                        const isToday = dateStr === todayStr;

                        return (
                            <Pressable
                                key={dayIndex}
                                style={styles.cell}
                                onPress={() => navigation.navigate('DayOffenses', { date: dateStr })}
                            >
                                <View
                                    style={[
                                        styles.dayCircle,
                                        marked && { backgroundColor: colors.accent },
                                        // Сьогодні без записів: заливка; з записами: заливка акценту + обідок
                                        isToday && !marked && { backgroundColor: colors.today },
                                        isToday && marked && { borderWidth: 3, borderColor: colors.today },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            color: marked || isToday ? '#ffffff' : colors.text,
                                            fontWeight: marked || isToday ? 'bold' : 'normal',
                                        }}
                                    >
                                        {day}
                                    </Text>
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            ))}

            <View style={styles.status}>
                {loading ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                ) : error ? (
                    <Text style={styles.error}>{error}</Text>
                ) : (
                    <Text style={[styles.hint, { color: colors.muted }]}>
                        Дні з правопорушеннями позначені кольором. Сьогодні виділено оранжевим
                    </Text>
                )}

                {offline && !loading && (
                    <Text style={[styles.offline, { color: colors.muted }]}>
                        Офлайн: показано лише збережені на пристрої записи
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    monthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    monthTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    weekRow: {
        flexDirection: 'row',
    },
    weekday: {
        width: `${100 / 7}%`,
        textAlign: 'center',
        fontSize: 13,
        marginBottom: 6,
    },
    cell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayCircle: {
        width: '80%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    status: {
        marginTop: 16,
        alignItems: 'center',
        minHeight: 40,
    },
    hint: {
        fontSize: 13,
        textAlign: 'center',
    },
    offline: {
        fontSize: 12,
        marginTop: 6,
        textAlign: 'center',
    },
    error: {
        color: '#d32f2f',
        textAlign: 'center',
    },
});