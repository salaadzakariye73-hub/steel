import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('kaah_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<{ user: User }>('/auth/me');
        if (active) {
          setUser({
            ...res.user,
            id: res.user.id || res.user._id || '',
          });
        }
      } catch {
        localStorage.removeItem('kaah_token');
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    verify();
    return () => {
      active = false;
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem('kaah_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('kaah_token');
    setToken(null);
    setUser(null);
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
