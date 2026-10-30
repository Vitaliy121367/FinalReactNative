import axios from 'axios';
const API_URL = 'http://192.168.0.106:3000/auth';

const handleError = (error) => {
    if (error.response) {
        throw new Error(error.response.data?.error || 'Помилка сервера');
    }
    throw new Error("Немає з'єднання з сервером. Перевірте інтернет");
};

//POST /auth/login
export const loginRequest = (email, password) =>
    axios.post(`${API_URL}/login`, { email, password }, { timeout: 10000 })
        .then((response) => response.data)
        .catch(handleError);

//POST /auth/register
export const registerRequest = ({ firstName, lastName, email, password }) =>
    axios.post(`${API_URL}/register`, { firstName, lastName, email, password }, { timeout: 10000 })
        .then((response) => response.data)
        .catch(handleError);

//GET /auth/me
export const fetchMe = (token) =>
    axios.get(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
    })
        .then((response) => response.data)
        .catch(handleError);