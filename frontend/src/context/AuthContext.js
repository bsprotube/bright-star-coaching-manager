import React, { createContext, useState, useEffect } from 'react';
import { getItem, setItem, deleteItem } from '../utils/storage';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [user, setUser] = useState(null);

  // Check if user is already logged in on boot
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await getItem('user_token');
        const userDataStr = await getItem('user_data');
        
        if (token && userDataStr) {
          setUserToken(token);
          setUser(JSON.parse(userDataStr));
        }
      } catch (e) {
        console.error('Failed to restore token', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (phone, password) => {
    try {
      const response = await api.post('/auth/login', { phone, password });
      
      const { token, user: userData } = response.data;

      // Persist user session details
      await setItem('user_token', token);
      await setItem('user_data', JSON.stringify(userData));

      setUserToken(token);
      setUser(userData);
      return { success: true };
    } catch (error) {
      console.error('Login error', error);
      const msg = error.response?.data?.message || 'Login failed. Please check network/credentials.';
      return { success: false, error: msg };
    }
  };

  // Persists an updated user object (e.g. after changing phone/email in Account
  // Settings) so the new details survive a refresh instead of reverting to the
  // stale copy read at login.
  const updateUser = async (userData) => {
    await setItem('user_data', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      await deleteItem('user_token');
      await deleteItem('user_data');
      setUserToken(null);
      setUser(null);
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        userToken,
        user,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
