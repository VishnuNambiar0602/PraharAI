import { useState, useEffect } from 'react';

interface User {
  userId: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Check for stored tokens on mount
    console.log('useAuth: Checking localStorage for tokens');
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');

    console.log('useAuth: Found tokens:', { 
      hasAccessToken: !!accessToken, 
      hasRefreshToken: !!refreshToken, 
      hasUser: !!userStr 
    });

    if (accessToken && userStr) {
      const user = JSON.parse(userStr);
      console.log('useAuth: Setting authenticated state for user:', user.email);
      setAuthState({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      console.log('useAuth: No valid tokens found, user not authenticated');
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (email: string, password: string) => {
    console.log('Login attempt:', email);
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    console.log('Login successful, storing tokens:', data);
    
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setAuthState({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
    
    console.log('Auth state updated, isAuthenticated: true');
  };

  const register = async (userData: any) => {
    console.log('Register attempt:', userData.email);
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    console.log('Registration successful, storing tokens:', data);
    
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setAuthState({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
    
    console.log('Auth state updated after registration, isAuthenticated: true');
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    setAuthState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return {
    ...authState,
    login,
    register,
    logout,
  };
};
