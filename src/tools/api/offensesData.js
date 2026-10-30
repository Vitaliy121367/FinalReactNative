import {
    fetchDays,
    fetchOffensesByDate,
    fetchOffenseById,
    fetchLocations,
    fetchOffensesByLocation,
    createOffense,
} from '../api/offenses';
import {
    getDaysByMonth,
    getOffensesByDate,
    getOffenseById,
    getLocations,
    getOffensesByLocation,
    saveOffenses,
    getUnsynced,
    markSynced,
} from '../database/database';

// Єдине місце, де вирішується «сервер чи локальна БД».
// Онлайн: дані сервера + локальні записи, які ще не відправлені.
//         Усе, що прийшло із сервера, кешується в SQLite.
// Офлайн (isNetworkError): лише локальна БД (власні записи + кеш сервера).
// Інші помилки (500 тощо) прокидаються далі, екран покаже їх текст.

const isNetworkError = (error) => {
    return (
        error?.isNetworkError === true ||
        error instanceof TypeError ||
        error?.message?.includes('Network request failed') ||
        error?.message?.includes('Failed to fetch')
    );
};

const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);

// ---------------------------------------------------------------------------
// Кешування відповідей сервера
// ---------------------------------------------------------------------------

// Записи в БД йдуть по черзі: saveOffenses використовує транзакцію, а дві
// одночасні транзакції на одному підключенні дають помилку
let saveQueue = Promise.resolve();

const cacheOffenses = (offenses) => {
    if (!offenses || offenses.length === 0) {
        return Promise.resolve();
    }

    saveQueue = saveQueue
        .then(() => saveOffenses(offenses))
        .catch((e) => console.error('Error caching offenses:', e));

    return saveQueue;
};

// Фонове завантаження записів усіх днів місяця, щоб календар і списки
// працювали офлайн. Не частіше ніж раз на PREFETCH_TTL для кожного місяця
const PREFETCH_TTL = 2 * 60 * 1000;
const prefetchedAt = {};

const prefetchMonth = async (monthStr, days) => {
    const last = prefetchedAt[monthStr];
    if (last && Date.now() - last < PREFETCH_TTL) {
        return;
    }
    prefetchedAt[monthStr] = Date.now();

    try {
        for (const day of days) {
            const offenses = await fetchOffensesByDate(day);
            await cacheOffenses(offenses);
        }
    } catch (error) {
        // Не вдалося — наступне відкриття місяця спробує ще раз
        delete prefetchedAt[monthStr];
    }
};

// ---------------------------------------------------------------------------
// Читання
// ---------------------------------------------------------------------------

// monthStr = YYYY-MM -> { days: ["2026-10-05", ...], offline }
export const loadDays = async (monthStr) => {
    const local = await getDaysByMonth(monthStr).catch(() => []);

    try {
        const server = await fetchDays(monthStr);

        // У фоні кешуємо записи цих днів (без await, екран не чекає)
        prefetchMonth(monthStr, server);

        return { days: [...new Set([...server, ...local])], offline: false };
    } catch (error) {
        if (!isNetworkError(error)) {
            throw error;
        }
        return { days: local, offline: true };
    }
};

// dateStr = YYYY-MM-DD -> { offenses: [...], offline }
export const loadOffensesByDate = async (dateStr) => {
    const local = await getOffensesByDate(dateStr).catch(() => []);

    try {
        const server = await fetchOffensesByDate(dateStr);

        // Зберігаємо для офлайну (у фоні)
        cacheOffenses(server);

        // Локальні записи, яких ще немає на сервері (за clientId відсіюємо дублі)
        const known = new Set(server.map((o) => o.clientId).filter(Boolean));
        const pending = local.filter((o) => !o.synced && !known.has(o.clientId));

        return { offenses: [...pending, ...server].sort(byDateDesc), offline: false };
    } catch (error) {
        if (!isNetworkError(error)) {
            throw error;
        }
        return { offenses: local, offline: true };
    }
};

// Свіжа версія одного запису (для екрана деталей). null, якщо оновити не вдалося
export const refreshOffense = async (offense) => {
    try {
        if (offense.isLocal) {
            return await getOffenseById(offense.id);
        }

        // Для записів, прочитаних із локального кешу, id — локальний,
        // а id на сервері лежить у serverId
        const serverId = offense.serverId ?? offense.id;
        const fresh = await fetchOffenseById(serverId);

        cacheOffenses([fresh]);
        return fresh;
    } catch (error) {
        return null;
    }
};

// Координати округлюємо до 4 знаків, так само як на сервері
const round4 = (n) => Math.round(Number(n) * 1e4) / 1e4;

// -> { locations: [{ latitude, longitude, count }], offline }
// Онлайн: точки сервера + ще не відправлені локальні записи.
// Офлайн: точки з локальної БД (власні записи + кеш сервера)
export const loadLocations = async () => {
    try {
        const server = await fetchLocations();

        const merged = new Map();
        const add = (lat, lng, count) => {
            const key = `${round4(lat)},${round4(lng)}`;
            const item = merged.get(key) || { latitude: round4(lat), longitude: round4(lng), count: 0 };
            item.count += count;
            merged.set(key, item);
        };

        server.forEach((p) => add(p.latitude, p.longitude, p.count));

        const pending = await getUnsynced().catch(() => []);
        pending
            .filter((o) => o.latitude != null && o.longitude != null)
            .forEach((o) => add(o.latitude, o.longitude, 1));

        return { locations: [...merged.values()], offline: false };
    } catch (error) {
        if (!isNetworkError(error)) {
            throw error;
        }
        const local = await getLocations().catch(() => []);
        return { locations: local, offline: true };
    }
};

// -> { offenses: [...], offline }  (записи в точці мапи)
export const loadOffensesByLocation = async (lat, lng) => {
    const local = await getOffensesByLocation(lat, lng).catch(() => []);

    try {
        const server = await fetchOffensesByLocation(lat, lng);

        cacheOffenses(server);

        const known = new Set(server.map((o) => o.clientId).filter(Boolean));
        const pending = local.filter((o) => !o.synced && !known.has(o.clientId));

        return { offenses: [...pending, ...server].sort(byDateDesc), offline: false };
    } catch (error) {
        if (!isNetworkError(error)) {
            throw error;
        }
        return { offenses: local, offline: true };
    }
};

// ---------------------------------------------------------------------------
// Синхронізація
// ---------------------------------------------------------------------------

let syncing = false;

// Відправляє на сервер записи, створені офлайн. Викликати, коли з'явився інтернет
// (і при вході в додаток). Повертає { synced, failed }
export const syncPending = async (token, userId) => {
    if (syncing || !token) {
        return { synced: 0, failed: 0 };
    }

    syncing = true;
    let synced = 0;
    let failed = 0;

    try {
        const rows = await getUnsynced(userId);

        for (const row of rows) {
            try {
                const { offense } = await createOffense(
                    {
                        description: row.description,
                        date: row.date,
                        latitude: row.latitude,
                        longitude: row.longitude,
                        imageBase64: row.image,
                        clientId: row.clientId,
                    },
                    token
                );

                await markSynced(row.id, offense);
                synced++;
            } catch (error) {
                if (isNetworkError(error)) {
                    break; // зв'язку знову немає, решту відправимо пізніше
                }
                failed++;
            }
        }
    } finally {
        syncing = false;
    }

    return { synced, failed };
};