import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: {
    loginId: string;
    password: string;
    fullName: string;
    email?: string;
    role?: Role;
  }) => Promise<void>;
  logout: () => void;
  switchDemoRole: (role: Role) => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('stockpilot_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await api.me();
        setUser(currentUser);
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('stockpilot_token');
        localStorage.removeItem('stockpilot_user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (identifier: string, password: string) => {
    const res = await api.login(identifier, password);
    localStorage.setItem('stockpilot_token', res.token);
    localStorage.setItem('stockpilot_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: {
    loginId: string;
    password: string;
    fullName: string;
    email?: string;
    role?: Role;
  }) => {
    const res = await api.register(data);
    localStorage.setItem('stockpilot_token', res.token);
    localStorage.setItem('stockpilot_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('stockpilot_token');
    localStorage.removeItem('stockpilot_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const switchDemoRole = async (role: Role) => {
    const roleEmailMap: Record<Role, string> = {
      ADMIN: 'admin@stockpilot.io',
      WAREHOUSE_MANAGER: 'manager@stockpilot.io',
      INVENTORY_SPECIALIST: 'inventory@stockpilot.io',
      PICKER_PACKER: 'picker@stockpilot.io',
      RECEIVING_CLERK: 'receiving@stockpilot.io',
    };
    await login(roleEmailMap[role], 'StockPilot2026!');
  };

  const hasRole = (...roles: Role[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        switchDemoRole,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
