import { createOffense } from '../api/offenses';
import { getUnsynced, markSynced } from '../database/database';

// Відправляє на сервер усі записи з synced = 0 (найстаріші першими).
// Повторна відправка безпечна: сервер за clientId не створює дублікатів
// і повертає існуючий запис, тож після обриву зв'язку під час відправки
// наступна синхронізація просто позначить запис відправленим.
//
// Повертає { sent, failed, stopped }:
//   sent    — скільки записів відправлено
//   failed  — скільки відхилено сервером (залишаються в черзі, пропускаємо їх)
//   stopped — 'network' (зник зв'язок), 'auth' (токен недійсний) або null
export const syncPending = async ({ token, userId }) => {
    const result = { sent: 0, failed: 0, stopped: null };

    if (!token || userId == null) {
        return result;
    }

    const rows = await getUnsynced(userId);

    for (const row of rows) {
        try {
            const { offense } = await createOffense(
                {
                    description: row.description,
                    date: row.date,
                    latitude: row.latitude,
                    longitude: row.longitude,
                    imageBase64: row.image ?? null,
                    clientId: row.clientId,
                },
                token
            );

            // Запам'ятовуємо serverId і посилання на фото (Cloudinary)
            await markSynced(row.id, offense);
            result.sent += 1;
        } catch (error) {
            if (error.isNetworkError) {
                result.stopped = 'network';
                break;
            }
            if (error.status === 401) {
                // Токен недійсний: client.js сам виконає вихід з акаунта
                result.stopped = 'auth';
                break;
            }
            // Сервер відхилив саме цей запис (наприклад, 400/413): пропускаємо,
            // щоб він не блокував решту черги
            console.warn(`Sync: record ${row.id} rejected:`, error.message);
            result.failed += 1;
        }
    }

    return result;
};