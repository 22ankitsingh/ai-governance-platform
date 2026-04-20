import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, officerAPI } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify token on mount
    if (token && user) {
      const role = user.role;
      const verifyFn = role === 'officer' ? officerAPI.me() : authAPI.me();
      verifyFn
        .then(res => {
          const userData = { ...res.data, role: res.data.role || role };
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password, role = 'citizen') => {
    let res;
    if (role === 'officer') {
      res = await officerAPI.login({ email, password });
    } else {
      res = await authAPI.login({ email, password });
    }
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const register = async (data, role = 'citizen') => {
    let res;
    if (role === 'officer') {
      res = await officerAPI.register(data);
    } else {
      res = await authAPI.register(data);
    }
    const { access_token, user: userData } = res.data;
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const isAdmin = user?.role === 'admin';
  const isCitizen = user?.role === 'citizen';
  const isOfficer = user?.role === 'officer';
  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider value={{
      user, token, loading, login, register, logout,
      isAdmin, isCitizen, isOfficer, isAuthenticated,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
