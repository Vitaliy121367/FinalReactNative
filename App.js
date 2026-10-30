import 'react-native-gesture-handler';

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AppContext from './src/context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#fff',
    text: '#000',
    primary: '#1e90ff',
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#121212',
    text: '#fff',
    primary: '#904ee3',
  },
};

// Екран завантаження, поки читаються тема та збережена сесія
function LoadingScreen({ theme }) {
  const isLight = theme === 'light';

  return (
      <View
          style={[
            styles.loading,
            { backgroundColor: isLight ? '#ffffff' : '#000000' },
          ]}
      >
        <Text style={[styles.title, { color: isLight ? '#000000' : '#ffffff' }]}>
          Loading...
        </Text>
      </View>
  );
}

// Внутрішня частина додатка: її контексти вже доступні
function AppContent() {
  const { theme } = useContext(AppContext);
  const { loading: authLoading } = useAuth();

  // Чекаємо, поки AuthContext відновить сесію, щоб Drawer одразу
  // показав правильні екрани (гостьові або для залогіненого)
  if (authLoading) {
    return <LoadingScreen theme={theme} />;
  }

  return (
      <NavigationContainer
          theme={theme === 'light' ? CustomLightTheme : CustomDarkTheme}
      >
        <RootNavigator />
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      </NavigationContainer>
  );
}

export default function App() {
  const [theme, setTheme] = useState('light');
  const [themeLoading, setThemeLoading] = useState(true);

  // Завантаження збереженої теми
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');

        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setThemeLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Збереження теми після кожної зміни (але не до завершення завантаження)
  useEffect(() => {
    if (themeLoading) {
      return;
    }

    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem('theme', theme);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    };

    saveTheme();
  }, [theme, themeLoading]);

  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);

  if (themeLoading) {
    return <LoadingScreen theme={theme} />;
  }

  return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppContext.Provider value={themeValue}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </AppContext.Provider>
      </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});