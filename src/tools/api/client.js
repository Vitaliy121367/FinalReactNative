import axios from 'axios';

const API_URL = 'http://192.168.0.106:3000';

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

        const isNetworkError =
            !error.response &&
            (
                error.code === 'ERR_NETWORK' ||
                error.code === 'ECONNABORTED' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ECONNREFUSED' ||
                error.code === 'ENOTFOUND'
            );

        const sentToken = Boolean(
            error.config?.headers?.Authorization
        );

        if (
            status === 401 &&
            sentToken &&
            unauthorizedHandler
        ) {
            unauthorizedHandler();
        }

        let message;

        if (isNetworkError) {
            message = 'Нет подключения к серверу';
        } else {
            message =
                error.response?.data?.error ||
                error.message ||
                'Ошибка сервера';
        }

        const apiError = new Error(message);

        apiError.status = status;
        apiError.isNetworkError = isNetworkError;

        return Promise.reject(apiError);
    }
);

export default client;