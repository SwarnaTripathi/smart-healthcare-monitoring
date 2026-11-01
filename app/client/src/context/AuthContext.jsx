import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { connectSocket, disconnectSocket } from '../utils/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (token && savedUser) {
        try {
          setUser(JSON.parse(savedUser));
          // L-3: Revalidate session against server
          const { data } = await api.get('/auth/me');
          if (data?.user) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          // Re-connect socket with the valid token on page reload
          connectSocket();
        } catch {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          disconnectSocket();
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    // Connect and authenticate socket immediately after login
    connectSocket();
    return data;
  };

  const register = async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    // Connect socket after registration too
    connectSocket();
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      disconnectSocket();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
