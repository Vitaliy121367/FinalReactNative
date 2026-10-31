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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen({ navigation }) {
    const { theme } = useContext(AppContext);
    const { register } = useAuth();

    // Висота заголовка Drawer: без цього відступ над клавіатурою рахується неточно
    const headerHeight = useHeaderHeight();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Посилання на поля, щоб кнопка «Далі» на клавіатурі переходила до наступного
    const lastNameRef = useRef(null);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const confirmRef = useRef(null);

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

    // Повертає текст помилки або null, якщо дані коректні.
    // Правила збігаються з перевірками на сервері
    const validate = () => {
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
            return 'Заповніть усі поля';
        }
        if (!EMAIL_REGEX.test(email.trim())) {
            return 'Некоректний email';
        }
        if (password.length < 6) {
            return 'Пароль має містити щонайменше 6 символів';
        }
        if (password !== confirmPassword) {
            return 'Паролі не збігаються';
        }
        return null;
    };

    const handleRegister = async () => {
        // Захист від повторного натискання
        if (submitting) {
            return;
        }

        const validationError = validate();
        if (validationError) {
            Alert.alert('Помилка', validationError);
            return;
        }

        setSubmitting(true);

        try {
            // register() реєструє користувача і одразу виконує вхід.
            // Після цього екран зникає (він показується лише гостям),
            // тож явна навігація не потрібна
            await register({ firstName, lastName, email, password });
        } catch (error) {
            Alert.alert(
                'Помилка реєстрації',
                error.message || 'Не вдалося зареєструватися. Перевірте інтернет'
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
                <Text style={[styles.title, { color: colors.text }]}>Реєстрація</Text>

                <TextInput
                    style={inputStyle}
                    placeholder="Ім'я"
                    placeholderTextColor="#888"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                />

                <TextInput
                    ref={lastNameRef}
                    style={inputStyle}
                    placeholder="Прізвище"
                    placeholderTextColor="#888"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                />

                <TextInput
                    ref={emailRef}
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
                    placeholder="Пароль (мінімум 6 символів)"
                    placeholderTextColor="#888"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                />

                <TextInput
                    ref={confirmRef}
                    style={inputStyle}
                    placeholder="Повторіть пароль"
                    placeholderTextColor="#888"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                />

                <View style={styles.buttonWrapper}>
                    {submitting ? (
                        <ActivityIndicator size="small" color={colors.button} />
                    ) : (
                        <Button
                            title="Зареєструватися"
                            color={colors.button}
                            onPress={handleRegister}
                        />
                    )}
                </View>

                <Pressable onPress={() => navigation.navigate('SignIn')}>
                    <Text style={[styles.link, { color: colors.link }]}>
                        Вже є акаунт? Увійти
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