import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Запити до сервера: src/tools/api/auth.js
//   loginRequest(email, password)  -> { token, user }
//   registerRequest(data)          -> { user }
import { loginRequest, registerRequest } from '../tools/api/auth';

// Обробник 401 (прострочений токен): src/tools/api/client.js
import { setUnauthorizedHandler } from '../tools/api/client';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const AuthContext = createContext({
    user: null,
    token: null,
    loading: true,
    login: async () => {},
    register: async () => {},
    logout: async () => {},
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    // true, поки відновлюється збережена сесія
    const [loading, setLoading] = useState(true);

    // Відновлення сесії під час запуску додатка.
    // Працює й без інтернету: токен і профіль лежать на пристрої
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const [savedToken, savedUser] = await Promise.all([
                    SecureStore.getItemAsync(TOKEN_KEY),
                    AsyncStorage.getItem(USER_KEY),
                ]);

                if (savedToken && savedUser) {
                    setToken(savedToken);
                    setUser(JSON.parse(savedUser));
                }
            } catch (error) {
                console.error('Error restoring session:', error);
            } finally {
                setLoading(false);
            }
        };

        restoreSession();
    }, []);

    // Токен зберігаємо в захищеному сховищі, профіль в AsyncStorage
    const saveSession = async (newToken, newUser) => {
        await SecureStore.setItemAsync(TOKEN_KEY, newToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    };

    const login = useCallback(async (email, password) => {
        const data = await loginRequest(email.trim(), password);
        await saveSession(data.token, data.user);
        return data.user;
    }, []);

    const register = useCallback(async ({ firstName, lastName, email, password }) => {
        await registerRequest({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            password,
        });
        // Після реєстрації одразу входимо в акаунт
        return login(email, password);
    }, [login]);

    const logout = useCallback(async () => {
        try {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await AsyncStorage.removeItem(USER_KEY);
        } catch (error) {
            console.error('Error during logout:', error);
        } finally {
            setToken(null);
            setUser(null);
        }
    }, []);

    // Якщо сервер відповів 401 на запит з токеном, виходимо з акаунта
    useEffect(() => {
        setUnauthorizedHandler(logout);
    }, [logout]);

    const value = useMemo(
        () => ({ user, token, loading, login, register, logout }),
        [user, token, loading, login, register, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Зручний хук: const { user, token, login, logout } = useAuth();
export const useAuth = () => useContext(AuthContext);

export default AuthContext;