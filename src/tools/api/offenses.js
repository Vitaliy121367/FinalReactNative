import client, { authHeader } from './client';

// Усі запити читання відкриті (токен не потрібен), створення потребує токена.
// Помилки приходять уже оброблені перехоплювачем у client.js:
//   error.message        — текст для користувача
//   error.isNetworkError — true, якщо немає зв'язку (тоді працюємо з локальною БД)

// GET /offenses/days?month=2026-10
// Дні місяця, в які є правопорушення: ["2026-10-05", "2026-10-29"]
export const fetchDays = (month) =>
    client
        .get('/offenses/days', { params: { month } })
        .then((response) => response.data.days);

// GET /offenses/locations
// Точки для маркерів на мапі: [{ latitude, longitude, count }]
export const fetchLocations = () =>
    client
        .get('/offenses/locations')
        .then((response) => response.data.locations);

// GET /offenses?date=2026-10-29
// Правопорушення за конкретну дату (формат YYYY-MM-DD)
export const fetchOffensesByDate = (date) =>
    client
        .get('/offenses', { params: { date } })
        .then((response) => response.data.offenses);

// GET /offenses/by-location?lat=..&lng=..
// Правопорушення в точці (збіг по координатах, округлених до 4 знаків)
export const fetchOffensesByLocation = (lat, lng) =>
    client
        .get('/offenses/by-location', { params: { lat, lng } })
        .then((response) => response.data.offenses);

// GET /offenses/:id
// Одне правопорушення для екрана деталей
export const fetchOffenseById = (id) =>
    client
        .get(`/offenses/${id}`)
        .then((response) => response.data.offense);

// POST /offenses  (потрібен токен)
// data: { description, date, latitude, longitude, imageBase64, clientId }
// Повертає { offense, alreadyExisted }:
//   alreadyExisted = true, якщо запис з таким clientId уже був на сервері
//   (повторна відправка під час синхронізації не створює дубліката)
export const createOffense = (data, token) =>
    client
        .post('/offenses', data, {
            headers: authHeader(token),
            // Фото в base64 вантажиться довше за звичайний запит
            timeout: 30000,
        })
        .then((response) => ({
            offense: response.data.offense,
            alreadyExisted: response.status === 200,
        }));