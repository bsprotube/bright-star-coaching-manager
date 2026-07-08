import axios from 'axios';
import { getItem, deleteItem } from '../utils/storage';

// ===============================
// Live Render Backend API
// ===============================
export const BASE_URL = 'https://bright-star-coaching-manager.onrender.com/api';
export const API_URL = BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // Increased from 10s to 30s — Render's free tier "spins down"
  // after inactivity, and the first request after that can take 30-50+
  // seconds to wake it back up. A short timeout was cutting off login
  // before the server even finished waking up.
});

// Request interceptor to automatically inject token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getItem('user_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching token from storage', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to catch expired tokens
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      try {
        await deleteItem('user_token');
        await deleteItem('user_data');
      } catch (e) {
        console.error('Error clearing storage', e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;