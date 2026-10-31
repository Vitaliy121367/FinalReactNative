import * as SQLite from 'expo-sqlite';

// Нова база. Стара mydatabase.db з таблицею tasks лишається нетронутою
const DB_NAME = 'offenses.db';

let dbPromise = null;

// Колонки, додані пізніше. Якщо база вже створена зі старою схемою,
// вони додаються автоматично (міграція), видаляти додаток не потрібно
const EXTRA_COLUMNS = [
    ['serverId', 'INTEGER'], // id запису на сервері (NULL, поки не відправлено)
    ['url', 'TEXT'],         // посилання на фото в Cloudinary
    ['author', 'TEXT'],      // ім'я автора (для записів, завантажених із сервера)
];

const ensureColumns = async (db) => {
    const columns = await db.getAllAsync('PRAGMA table_info(offenses)');
    const existing = columns.map((column) => column.name);

    for (const [name, type] of EXTRA_COLUMNS) {
        if (!existing.includes(name)) {
            await db.execAsync(`ALTER TABLE offenses ADD COLUMN ${name} ${type}`);
        }
    }
};

// Відкриває базу один раз і створює таблиці та індекси, якщо їх ще немає
const openAndPrepare = async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS offenses (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            image       BLOB,                       -- локальне фото (рядок base64)
            date        TEXT NOT NULL,              -- ISO-рядок: 2026-10-30T10:15:00.000Z
            userId      INTEGER,
            latitude    REAL,
            longitude   REAL,
            synced      INTEGER NOT NULL DEFAULT 0, -- 0 = не відправлено на сервер, 1 = є на сервері
            clientId    TEXT UNIQUE                 -- UUID, захист від дублів при синхронізації
        );

        -- Налаштування додатка (наприклад, останній відкритий місяць)
        CREATE TABLE IF NOT EXISTS app_settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    // Додаємо нові колонки, якщо база створена зі старою схемою
    await ensureColumns(db);

    await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_offenses_date   ON offenses (date);
        CREATE INDEX IF NOT EXISTS idx_offenses_synced ON offenses (synced);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_offenses_serverId ON offenses (serverId);
    `);

    return db;
};

// Єдине підключення на весь додаток (синглтон).
// Усі функції нижче викликають getDb(), тому окремо ініціалізувати базу не обов'язково
export const getDb = () => {
    if (!dbPromise) {
        dbPromise = openAndPrepare().catch((error) => {
            // Якщо відкрити не вдалося, наступний виклик спробує ще раз
            dbPromise = null;
            throw error;
        });
    }
    return dbPromise;
};

// Можна викликати при старті додатка, щоб база була готова заздалегідь
export const initDb = async () => {
    await getDb();
};

// ---------------------------------------------------------------------------
// Допоміжні функції
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

// Локальний день (YYYY-MM-DD) за ISO-датою, за часовим поясом пристрою
const localDay = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Межі календарного дня в ISO (ISO-рядки однакового формату порівнюються як текст)
const dayRange = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return [
        new Date(y, m - 1, d).toISOString(),
        new Date(y, m - 1, d + 1).toISOString(),
    ];
};

// Межі календарного місяця (monthStr = YYYY-MM)
const monthRange = (monthStr) => {
    const [y, m] = monthStr.split('-').map(Number);
    return [
        new Date(y, m - 1, 1).toISOString(),
        new Date(y, m, 1).toISOString(),
    ];
};

// Приводимо рядок БД до такого ж вигляду, як відповідь сервера,
// щоб ті самі компоненти (OffenseCard) показували і локальні, і серверні записи.
//   id       — локальний id (для переходу на екран деталей)
//   serverId — id на сервері (null, поки запис не відправлено)
//   image    — base64 локального фото; url — посилання Cloudinary
//   isLocal  — true, якщо запису ще немає на сервері («очікує відправки»)
const toOffense = (row) => ({
    id: row.id,
    serverId: row.serverId ?? null,
    description: row.description,
    image: row.image ?? null,
    url: row.url ?? null,
    date: row.date,
    userId: row.userId,
    latitude: row.latitude,
    longitude: row.longitude,
    clientId: row.clientId,
    author: row.author ?? null,
    synced: row.synced === 1,
    isLocal: row.serverId == null,
});

// ---------------------------------------------------------------------------
// Запис
// ---------------------------------------------------------------------------

// Зберігає правопорушення, створене без інтернету (synced = 0).
// data: { description, imageBase64, date, userId, latitude, longitude, clientId }
// Повертає id нового запису
export const saveOffense = async ({
                                      description,
                                      imageBase64,
                                      date,
                                      userId,
                                      latitude,
                                      longitude,
                                      clientId,
                                  }) => {
    const db = await getDb();

    const result = await db.runAsync(
        `INSERT INTO offenses
            (description, image, date, userId, latitude, longitude, synced, clientId)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [description, imageBase64 ?? null, date, userId ?? null, latitude ?? null, longitude ?? null, clientId]
    );

    return result.lastInsertRowId;
};

// Кешує записи, отримані із сервера, щоб їх можна було переглядати без інтернету.
// offenses — масив у форматі відповіді сервера: { id, clientId, description, url, date, ... }
// Серверний id зберігається в serverId, а не в id, щоб не затерти локальні записи.
// Якщо запис уже є локально (за clientId або serverId), він оновлюється, а не дублюється
export const saveOffenses = async (offenses) => {
    if (!offenses || offenses.length === 0) {
        return;
    }

    const db = await getDb();

    await db.withTransactionAsync(async () => {
        for (const o of offenses) {
            const existing = await db.getFirstAsync(
                `SELECT id FROM offenses
                 WHERE serverId = ? OR (clientId IS NOT NULL AND clientId = ?)`,
                [o.id, o.clientId ?? null]
            );

            const values = [
                o.id,
                o.clientId ?? null,
                o.description,
                o.url ?? null,
                o.date,
                o.userId ?? null,
                o.latitude ?? null,
                o.longitude ?? null,
                o.author ?? null,
            ];

            if (existing) {
                await db.runAsync(
                    `UPDATE offenses
                     SET serverId = ?, clientId = COALESCE(?, clientId), description = ?,
                         url = ?, date = ?, userId = ?, latitude = ?, longitude = ?,
                         author = ?, synced = 1
                     WHERE id = ?`,
                    [...values, existing.id]
                );
            } else {
                await db.runAsync(
                    `INSERT INTO offenses
                        (serverId, clientId, description, url, date, userId,
                         latitude, longitude, author, synced)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    values
                );
            }
        }
    });
};

// ---------------------------------------------------------------------------
// Синхронізація
// ---------------------------------------------------------------------------

// Записи, які ще не відправлені на сервер (найстаріші першими).
// userId потрібен, щоб після зміни акаунта не відправити чужі записи
export const getUnsynced = async (userId) => {
    const db = await getDb();

    const rows =
        userId == null
            ? await db.getAllAsync('SELECT * FROM offenses WHERE synced = 0 ORDER BY date ASC')
            : await db.getAllAsync(
                'SELECT * FROM offenses WHERE synced = 0 AND userId = ? ORDER BY date ASC',
                [userId]
            );

    return rows;
};

// Кількість невідправлених записів (для індикатора «Не синхронізовано: N»)
export const getUnsyncedCount = async (userId) => {
    const db = await getDb();

    const row =
        userId == null
            ? await db.getFirstAsync('SELECT COUNT(*) AS count FROM offenses WHERE synced = 0')
            : await db.getFirstAsync(
                'SELECT COUNT(*) AS count FROM offenses WHERE synced = 0 AND userId = ?',
                [userId]
            );

    return row?.count ?? 0;
};

// Позначає запис як відправлений.
// Необов'язково: передай відповідь сервера ({ id, url }), щоб запам'ятати serverId і посилання на фото
export const markSynced = async (id, serverOffense = null) => {
    const db = await getDb();

    await db.runAsync(
        `UPDATE offenses
         SET synced = 1,
             serverId = COALESCE(?, serverId),
             url = COALESCE(?, url)
         WHERE id = ?`,
        [serverOffense?.id ?? null, serverOffense?.url ?? null, id]
    );
};

// ---------------------------------------------------------------------------
// Читання (працює й без інтернету, показує записи пристрою та кеш сервера)
// ---------------------------------------------------------------------------

// Дні місяця, в які є локальні записи: ["2026-10-05", "2026-10-29"]
// monthStr у форматі YYYY-MM. День рахується за часовим поясом пристрою
export const getDaysByMonth = async (monthStr) => {
    const db = await getDb();
    const [start, end] = monthRange(monthStr);

    const rows = await db.getAllAsync(
        'SELECT date FROM offenses WHERE date >= ? AND date < ?',
        [start, end]
    );

    const days = new Set(rows.map((row) => localDay(row.date)));
    return [...days].sort();
};

// Усі записи місяця (monthStr = YYYY-MM), нові першими
export const getOffensesByMonth = async (monthStr) => {
    const db = await getDb();
    const [start, end] = monthRange(monthStr);

    const rows = await db.getAllAsync(
        'SELECT * FROM offenses WHERE date >= ? AND date < ? ORDER BY date DESC',
        [start, end]
    );

    return rows.map(toOffense);
};

// Записи за день (dateStr у форматі YYYY-MM-DD), нові першими
export const getOffensesByDate = async (dateStr) => {
    const db = await getDb();
    const [start, end] = dayRange(dateStr);

    const rows = await db.getAllAsync(
        'SELECT * FROM offenses WHERE date >= ? AND date < ? ORDER BY date DESC',
        [start, end]
    );

    return rows.map(toOffense);
};

// Один запис за локальним id
export const getOffenseById = async (id) => {
    const db = await getDb();
    const row = await db.getFirstAsync('SELECT * FROM offenses WHERE id = ?', [id]);
    return row ? toOffense(row) : null;
};

// Точки для маркерів на мапі: [{ latitude, longitude, count }]
// Координати округлені до 4 знаків, так само як на сервері
export const getLocations = async () => {
    const db = await getDb();

    return db.getAllAsync(
        `SELECT ROUND(latitude, 4)  AS latitude,
                ROUND(longitude, 4) AS longitude,
                COUNT(*)            AS count
         FROM offenses
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         GROUP BY ROUND(latitude, 4), ROUND(longitude, 4)`
    );
};

// Записи в точці (збіг по координатах, округлених до 4 знаків)
export const getOffensesByLocation = async (lat, lng) => {
    const db = await getDb();

    const rows = await db.getAllAsync(
        `SELECT * FROM offenses
         WHERE ROUND(latitude, 4)  = ROUND(?, 4)
           AND ROUND(longitude, 4) = ROUND(?, 4)
         ORDER BY date DESC`,
        [lat, lng]
    );

    return rows.map(toOffense);
};