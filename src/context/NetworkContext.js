import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuth } from './AuthContext';
import { getUnsyncedCount } from '../tools/database/database';
import { syncPending } from '../tools/sync/sync';

const RETRY_INTERVAL = 30000; // повторна спроба, поки є невідправлені записи

const NetworkContext = createContext({
    isOnline: true,
    pendingCount: 0,
    syncing: false,
    syncVersion: 0,
    syncNow: async () => {},
    refreshPending: async () => {},
});

export function NetworkProvider({ children }) {
    const { token, user } = useAuth();
    const userId = user?.id ?? null;

    const [isOnline, setIsOnline] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    // Збільшується після кожної синхронізації, що щось відправила.
    // Екрани додають його в залежності, щоб перезавантажити дані
    const [syncVersion, setSyncVersion] = useState(0);

    const syncingRef = useRef(false);

    // Лічильник «Не синхронізовано: N» (без акаунта черги немає)
    const refreshPending = useCallback(async () => {
        if (userId == null) {
            setPendingCount(0);
            return;
        }
        try {
            setPendingCount(await getUnsyncedCount(userId));
        } catch (error) {
            console.warn('Error counting pending offenses:', error);
        }
    }, [userId]);

    const syncNow = useCallback(async () => {
        if (syncingRef.current || !token || userId == null) {
            return;
        }

        syncingRef.current = true;
        setSyncing(true);

        try {
            const result = await syncPending({ token, userId });
            if (result.sent > 0) {
                setSyncVersion((v) => v + 1);
            }
        } catch (error) {
            console.warn('Sync error:', error);
        } finally {
            syncingRef.current = false;
            setSyncing(false);
            await refreshPending();
        }
    }, [token, userId, refreshPending]);

    // Стан мережі. isInternetReachable не враховуємо: сервер може бути в локальній
    // мережі без виходу в інтернет. Справжню доступність покаже сам запит
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsOnline(state.isConnected !== false);
        });
        return unsubscribe;
    }, []);

    // Запуск: при старті, після входу в акаунт і щоразу, коли з'являється зв'язок
    useEffect(() => {
        refreshPending();
        if (isOnline) {
            syncNow();
        }
    }, [isOnline, syncNow, refreshPending]);

    // Повернення додатка з фону
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                refreshPending();
                syncNow();
            }
        });
        return () => subscription.remove();
    }, [syncNow, refreshPending]);

    // Якщо мережа є, але сервер був недоступний, пробуємо знову
    useEffect(() => {
        if (!isOnline || pendingCount === 0 || !token) {
            return undefined;
        }
        const id = setInterval(syncNow, RETRY_INTERVAL);
        return () => clearInterval(id);
    }, [isOnline, pendingCount, token, syncNow]);

    const value = useMemo(
        () => ({ isOnline, pendingCount, syncing, syncVersion, syncNow, refreshPending }),
        [isOnline, pendingCount, syncing, syncVersion, syncNow, refreshPending]
    );

    return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

// const { isOnline, pendingCount, syncNow } = useNetwork();
export const useNetwork = () => useContext(NetworkContext);

export default NetworkContext;