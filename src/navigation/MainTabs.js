import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import CalendarStack from "./CalendarStack";

const Tab = createBottomTabNavigator();

// Тимчасова заглушка. Замінюється на справжні екрани по мірі їх створення
function Placeholder({ title }) {
    const { colors } = useTheme();

    return (
        <View
            style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.background,
            }}
        >
            <Text style={{ color: colors.text, fontSize: 18 }}>{title}</Text>
        </View>
    );
}

// TODO: замінити на ../screens/MapScreen
const MapTab = () => <Placeholder title="Мапа" />;

// TODO: замінити на ../screens/AddOffenseScreen
const AddTab = () => <Placeholder title="Нове правопорушення" />;

export default function MainTabs() {
    const { user } = useAuth();

    return (
        <Tab.Navigator
            // Заголовок із кнопкою меню показує Drawer, тому тут він не потрібен
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen
                name="CalendarTab"
                component={CalendarStack}
                options={{
                    title: 'Календар',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar-outline" color={color} size={size} />
                    ),
                }}
            />

            <Tab.Screen
                name="MapTab"
                component={MapTab}
                options={{
                    title: 'Мапа',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="map-outline" color={color} size={size} />
                    ),
                }}
            />

            {/* Фіксація правопорушень доступна лише залогіненим */}
            {user && (
                <Tab.Screen
                    name="AddTab"
                    component={AddTab}
                    options={{
                        title: 'Додати',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="add-circle-outline" color={color} size={size} />
                        ),
                    }}
                />
            )}
        </Tab.Navigator>
    );
}