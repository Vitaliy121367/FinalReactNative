import React, { useContext, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Button,
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useHeaderHeight } from '@react-navigation/elements';

import AppContext from '../context';
import { useAuth } from '../context/AuthContext';

export default function SignInScreen({ navigation }) {
    const { theme } = useContext(AppContext);
    const { login } = useAuth();

    // Висота заголовка Drawer: без неї відступ над клавіатурою рахується неточно
    const headerHeight = useHeaderHeight();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Посилання на поле пароля, щоб кнопка «Далі» на клавіатурі переходила до нього
    const passwordRef = useRef(null);

    const isLight = theme === 'light';

    const colors = {
        background: isLight ? '#ffffff' : '#000000',
        text: isLight ? '#000000' : '#ffffff',
        border: isLight ? '#cccccc' : '#555555',
        button: isLight ? '#2196F3' : '#904ee3',
        link: isLight ? '#2196F3' : '#b388f5',
    };

    const inputStyle = [
        styles.input,
        {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: colors.border,
        },
    ];

    const handleLogin = async () => {
        // Захист від повторного натискання
        if (submitting) {
            return;
        }

        if (!email.trim() || !password) {
            Alert.alert('Помилка', 'Введіть email та пароль');
            return;
        }

        setSubmitting(true);

        try {
            await login(email, password);
            // Навігація не потрібна: після входу екран SignIn зникає
            // (він показується лише гостям), і Drawer відкриває Main
        } catch (error) {
            Alert.alert(
                'Помилка входу',
                error.message || 'Не вдалося увійти. Перевірте дані та інтернет'
            );
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.background }}
            // 'padding' потрібен і на Android: у режимі edge-to-edge вікно
            // не стискається саме, тож клавіатура перекриває поля
            behavior="padding"
            keyboardVerticalOffset={headerHeight}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={[styles.title, { color: colors.text }]}>Вхід</Text>

                <TextInput
                    style={inputStyle}
                    placeholder="Email"
                    placeholderTextColor="#888"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                />

                <TextInput
                    ref={passwordRef}
                    style={inputStyle}
                    placeholder="Пароль"
                    placeholderTextColor="#888"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                />

                <View style={styles.buttonWrapper}>
                    {submitting ? (
                        <ActivityIndicator size="small" color={colors.button} />
                    ) : (
                        <Button title="Увійти" color={colors.button} onPress={handleLogin} />
                    )}
                </View>

                <Pressable onPress={() => navigation.navigate('SignUp')}>
                    <Text style={[styles.link, { color: colors.link }]}>
                        Немає акаунта? Зареєструватися
                    </Text>
                </Pressable>

                <StatusBar style="auto" />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        width: '80%',
        marginBottom: 10,
    },
    buttonWrapper: {
        width: '80%',
        marginTop: 5,
        marginBottom: 15,
    },
    link: {
        fontSize: 14,
    },
});