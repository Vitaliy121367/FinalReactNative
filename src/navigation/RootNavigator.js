import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';

import { useAuth } from '../context/AuthContext';
import CustomDrawerContent from '../components/CustomDrawerContent';
import MainTabs from './MainTabs';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';

const Drawer = createDrawerNavigator();

// Кореневий навігатор. NavigationContainer уже є в App.js, тут його не потрібно
export default function RootNavigator() {
    const { user } = useAuth();

    return (
        <Drawer.Navigator
            initialRouteName="Main"
            drawerContent={(props) => <CustomDrawerContent {...props} />}
        >
            {/* Main має бути першим: після входу екрани SignIn/SignUp зникають,
                і навігатор автоматично відкриває перший доступний екран */}
            <Drawer.Screen
                name="Main"
                component={MainTabs}
                options={{ title: 'Законослухняний громадянин', drawerLabel: 'Головна' }}
            />

            {/* Вхід і реєстрація доступні лише гостям */}
            {!user && (
                <>
                    <Drawer.Screen
                        name="SignIn"
                        component={SignInScreen}
                        options={{ title: 'Вхід', drawerLabel: 'Вхід' }}
                    />
                    <Drawer.Screen
                        name="SignUp"
                        component={SignUpScreen}
                        options={{ title: 'Реєстрація', drawerLabel: 'Реєстрація' }}
                    />
                </>
            )}
        </Drawer.Navigator>
    );
}