import axios from 'axios';

const API_URL = 'http://192.168.0.106:3000/auth';

const client = axios.create({
    baseURL: API_URL,
    timeout: 10000, // 10 секунд, щоб запит не висів без інтернету
    headers: { 'Content-Type': 'application/json' },
});

// Обробник «токен недійсний». AuthContext реєструє тут свій logout
let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
    unauthorizedHandler = handler;
};

// Повертає заголовок авторизації, якщо токен є
export const authHeader = (token) =>
    token ? { Authorization: `Bearer ${token}` } : {};

// Перетворюємо помилки axios у зрозумілі Error з додатковими полями:
//   error.message        — текст від сервера (поле "error") або загальний
//   error.status         — HTTP-статус (якщо сервер відповів)
//   error.isNetworkError — true, якщо немає зв'язку або вичерпано таймаут
client.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const isNetworkError = !error.response;

        // 401 вважаємо «токен прострочено» лише якщо запит ішов з токеном.
        // Інакше це просто невірний пароль при вході
        const sentToken = Boolean(error.config?.headers?.Authorization);
        if (status === 401 && sentToken && unauthorizedHandler) {
            unauthorizedHandler();
        }

        let message;
        if (isNetworkError) {
            message = "Немає з'єднання з сервером. Перевірте інтернет";
        } else {
            message = error.response.data?.error || 'Помилка сервера';
        }

        const apiError = new Error(message);
        apiError.status = status;
        apiError.isNetworkError = isNetworkError;

        return Promise.reject(apiError);
    }
);

export default client;