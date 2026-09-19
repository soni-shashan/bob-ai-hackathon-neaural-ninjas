import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUserProfile } from '../services/api';

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
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'gridguard_token';
const USER_KEY = 'gridguard_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);

      if (savedToken && savedUser) {
        // Basic JWT expiry check
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);

        if (payload.exp && payload.exp > now) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } else {
          logout();
        }
      }
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

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

  // Live profile refresh from backend
  const refreshUserProfile = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) return;

    try {
      const freshUser = await getCurrentUserProfile();
      if (freshUser) {
        const updatedUserData: AuthUser = {
          id: freshUser.id,
          name: freshUser.name,
          email: freshUser.email,
          role: freshUser.role,
          department: freshUser.department,
          permissions: freshUser.permissions,
        };

        setUser(updatedUserData);
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUserData));
      }
    } catch (err: any) {
      // If user account is deactivated (403) or token invalid (401), force logout
      if (
        err?.message?.includes('403') ||
        err?.message?.includes('401') ||
        err?.message?.toLowerCase().includes('deactivated')
      ) {
        logout();
      }
    }
  }, [logout]);

  // Periodic polling (every 5 seconds) & focus listener for real-time live permission updates
  useEffect(() => {
    if (!token) return;

    // Initial check right after mount/login
    refreshUserProfile();

    const interval = setInterval(() => {
      refreshUserProfile();
    }, 5000);

    const handleFocus = () => {
      refreshUserProfile();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, refreshUserProfile]);

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
        refreshUserProfile,
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
