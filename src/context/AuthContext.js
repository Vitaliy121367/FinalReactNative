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

import { loginRequest, registerRequest } from '../tools/api/auth';
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
    const [loading, setLoading] = useState(true);

    // Восстановление сессии при запуске приложения.
    useEffect(() => {
        let active = true;

        const restoreSession = async () => {
            try {
                const [savedToken, savedUser] = await Promise.all([
                    SecureStore.getItemAsync(TOKEN_KEY),
                    AsyncStorage.getItem(USER_KEY),
                ]);

                let parsedUser = null;

                if (savedUser) {
                    try {
                        parsedUser = JSON.parse(savedUser);
                    } catch {
                        parsedUser = null;
                    }
                }

                if (active) {
                    if (savedToken && parsedUser) {
                        setToken(savedToken);
                        setUser(parsedUser);
                    } else {
                        setToken(null);
                        setUser(null);
                    }
                }
            } catch (error) {
                console.error('Error restoring session:', error);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        restoreSession();

        return () => {
            active = false;
        };
    }, []);

    const saveSession = useCallback(async (newToken, newUser) => {
        await SecureStore.setItemAsync(TOKEN_KEY, newToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));

        setToken(newToken);
        setUser(newUser);
    }, []);

    const login = useCallback(async (email, password) => {
        const data = await loginRequest(email.trim(), password);

        await saveSession(data.token, data.user);

        return data.user;
    }, [saveSession]);

    const register = useCallback(async ({
        firstName,
        lastName,
        email,
        password,
    }) => {
        await registerRequest({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            password,
        });

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

    useEffect(() => {
        setUnauthorizedHandler(logout);
    }, [logout]);

    const value = useMemo(() => ({
        user,
        token,
        loading,
        login,
        register,
        logout,
    }), [user, token, loading, login, register, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
