import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CalendarScreen from '../screens/CalendarScreen';
import DayOffensesScreen from '../screens/DayOffensesScreen';
import OffenseDetailsScreen from '../screens/OffenseDetailsScreen';

const Stack = createNativeStackNavigator();

// 2026-10-29 -> 29.10.2026
const formatDate = (dateStr) => dateStr.split('-').reverse().join('.');

export default function CalendarStack() {
    return (
        <Stack.Navigator initialRouteName="CalendarHome">
            {/* На головному екрані заголовок уже показує Drawer */}
            <Stack.Screen
                name="CalendarHome"
                component={CalendarScreen}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="DayOffenses"
                component={DayOffensesScreen}
                options={({ route }) => ({ title: formatDate(route.params.date) })}
            />
            <Stack.Screen
                name="OffenseDetails"
                component={OffenseDetailsScreen}
                options={{ title: 'Правопорушення' }}
            />
        </Stack.Navigator>
    );
}