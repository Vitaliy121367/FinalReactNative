
import client from './client';

const API_URL = '/auth';

// POST /auth/login
export const loginRequest = (email, password) =>
    client
        .post(`${API_URL}/login`, { email, password })
        .then(response => response.data);

// POST /auth/register
export const registerRequest = ({
                                    firstName,
                                    lastName,
                                    email,
                                    password,
                                }) =>
    client
        .post(`${API_URL}/register`, {
            firstName,
            lastName,
            email,
            password,
        })
        .then(response => response.data);

// GET /auth/me
export const fetchMe = (token) =>
    client
        .get(`${API_URL}/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        .then(response => response.data);

// GET /auth/users/:id
export const fetchUserById = (id) =>
    client
        .get(`${API_URL}/users/${id}`)
        .then(response => response.data.user);