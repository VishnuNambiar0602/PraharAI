import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loginUser, registerUser, getProfile } from './api';

interface User {
  userId: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  dateOfBirth?: string;
  age?: number;
  income?: number;
  state?: string;
  employment?: string;
  education?: string;
  gender?: string;
  onboardingComplete?: boolean;
  completeness?: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; age?: number; income?: number; state?: string; gender?: string }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await loginUser(email, password);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);

    // Fetch full profile
    try {
      const profile = await getProfile(data.user.userId);
      const fullUser = { ...data.user, ...profile };
      localStorage.setItem('user', JSON.stringify(fullUser));
      setUser(fullUser);
    } catch { /* profile fetch is optional */ }
  };

  const register = async (regData: { email: string; password: string; name: string; age?: number; income?: number; state?: string; gender?: string }) => {
    const data = await registerUser(regData);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const profile = await getProfile(user.userId);
      const updated = { ...user, ...profile };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch { /* silent */ }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
