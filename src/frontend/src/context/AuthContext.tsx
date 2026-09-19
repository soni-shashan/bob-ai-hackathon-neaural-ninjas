import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  permissions?: Record<string, string>;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  login: (
    newToken: string,
    userId: number,
    userName: string,
    userEmail: string,
    role: string,
    department?: string,
    permissions?: Record<string, string>
  ) => void;
  logout: () => void;
  isLoading: boolean;
  isMainAdmin: () => boolean;
  hasPermission: (section: string, level?: 'r' | 'rw') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'gridguard_token';
const USER_KEY = 'gridguard_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);

      if (savedToken && savedUser) {
        // Basic JWT expiry check (decode payload without verification)
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);

        if (payload.exp && payload.exp > now) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } else {
          // Token expired — clear storage
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(
    (
      newToken: string,
      userId: number,
      userName: string,
      userEmail: string,
      role: string,
      department?: string,
      permissions?: Record<string, string>
    ) => {
      const userData: AuthUser = {
        id: userId,
        name: userName,
        email: userEmail,
        role: role || 'MAIN_ADMIN',
        department,
        permissions,
      };
      setToken(newToken);
      setUser(userData);
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const isMainAdmin = useCallback((): boolean => {
    if (!user) return true;
    return user.role === 'MAIN_ADMIN' || user.email === 'neaural.ninjas@electricity.com' || !user.role;
  }, [user]);

  const hasPermission = useCallback(
    (section: string, level: 'r' | 'rw' = 'r'): boolean => {
      if (!user) return true;
      if (isMainAdmin()) return true;
      if (!user.permissions) return true;
      const perm = user.permissions[section] || 'rw';
      if (perm === 'none') return false;
      if (level === 'rw' && perm !== 'rw') return false;
      return true;
    },
    [user, isMainAdmin]
  );

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        user,
        token,
        login,
        logout,
        isLoading,
        isMainAdmin,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

