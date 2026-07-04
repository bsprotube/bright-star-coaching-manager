import axios from 'axios';
import { getItem, deleteItem } from '../utils/storage';

// CHANGE THIS TO YOUR LOCAL BACKEND SERVER IP ADDRESS FOR TESTING ON PHYSICAL DEVICES
// E.g., 'http://192.168.1.100:5000/api'
export const BASE_URL = 'http://localhost:5000/api'; 
export const API_URL = BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
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
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to catch token expirations (401)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid/expired. Clean store.
      try {
        await deleteItem('user_token');
        await deleteItem('user_data');
      } catch (e) {
        console.error('Error clearing secure store', e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
