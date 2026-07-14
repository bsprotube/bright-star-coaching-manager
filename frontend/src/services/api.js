import axios from 'axios';
import { getItem, deleteItem } from '../utils/storage';

// ===============================
// Live Render Backend API
// ===============================
// NOTE: Render's free tier spins down after inactivity, so the first request can
// take 30-50s and may exceed the timeout below.
// To develop against the local backend instead, swap in:
//   export const BASE_URL = 'http://localhost:5000/api';
// (the local server uses the LOCAL MongoDB, which holds different data)
export const BASE_URL = 'https://bright-star-coaching-manager.onrender.com/api';
export const API_URL = BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // Render's free tier "spins down" after inactivity, and the
  // first request after that can take 30-50+ seconds just to wake the server
  // back up. 30s was still short enough that the wake-up request got cut off
  // (the dashboard's dues call was timing out), so allow a full 60s.
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