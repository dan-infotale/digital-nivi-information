import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('authUser')); } catch { return null; }
  });

  const login = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('authUser', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('authUser');
    setUser(null);
  }, []);

  const loginWithPassword = useCallback(async (email, password, isAdmin = false) => {
    const endpoint = isAdmin ? '/auth/admin/login' : '/auth/login';
    const { data } = await api.post(endpoint, { email, password });
    login(data.token, data.user);
    return data.user;
  }, [login]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loginWithPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
