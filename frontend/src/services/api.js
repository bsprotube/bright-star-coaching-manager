import axios from 'axios';
import { getItem, deleteItem } from '../utils/storage';

// ===============================
// Backend API base URL
// ===============================
// Set EXPO_PUBLIC_API_URL (in frontend/.env locally, or as a build environment
// variable on the host) to point the app at a backend, e.g.
//   EXPO_PUBLIC_API_URL=https://your-backend.example.com/api
//
// Expo inlines EXPO_PUBLIC_* variables at build time, so the value is baked into
// whatever bundle gets shipped. The localhost fallback below therefore only
// applies to development builds: in a production build a missing variable throws
// instead, because shipping a bundle that points at "localhost" would give every
// user an app that silently fails to reach any server.
const DEV_FALLBACK_URL = 'http://localhost:5000/api';
const configuredUrl = process.env.EXPO_PUBLIC_API_URL;

if (!configuredUrl && !__DEV__) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Set it before building for production — ' +
      'otherwise the app would ship pointing at localhost.'
  );
}

export const BASE_URL = configuredUrl || DEV_FALLBACK_URL;
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