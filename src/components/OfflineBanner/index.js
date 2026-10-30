import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function NetworkStatus() {
    const [isOnline, setIsOnline] = useState(false);

    useEffect(() => {
        // Получаем начальное состояние сети
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(
                state.isConnected === true &&
                state.isInternetReachable !== false
            );
        });

        return () => unsubscribe();
    }, []);

    return (
        <View style={styles.container}>
            <Text style={{ color: isOnline ? '#22C55E' : '#EF4444', marginRight: 10, fontSize:16 }}>
                {
                    isOnline ? "Online" : "Offline"
                }
            </Text>
            <View
                style={[
                    styles.indicator,
                    { backgroundColor: isOnline ? '#22C55E' : '#EF4444' }
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20
    },

    indicator: {
        width: 15,
        height: 15,
        borderRadius: 50,
    },

    text: {
        fontSize: 14,
        fontWeight: '600',
    },
});