import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, LoginRequest, RegisterRequest, UserRole } from '../types/auth';
import { TenantResponse } from '../types/tenant';
import { authApi } from '../api/auth';
import { tenantApi } from '../api/tenant';
import { storage } from '../utils/storage';
import { decodeJwt, isTokenExpired } from '../utils/jwt';

interface AuthContextType {
  user: AuthUser | null;
  tenant: TenantResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginRequest, remember?: boolean) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [user, setUser] = useState<AuthUser | null>(() => storage.getUser<AuthUser>());
  const [tenant, setTenant] = useState<TenantResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    storage.clear();
    setToken(null);
    setUser(null);
    setTenant(null);
  }, []);

  const refreshTenant = useCallback(async () => {
    try {
      const tenantData = await tenantApi.getCurrentTenant();
      setTenant(tenantData);
    } catch (err) {
      console.warn('Failed to load current tenant info:', err);
    }
  }, []);

  // Initialize session from storage / JWT on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = storage.getToken();

      if (!storedToken || isTokenExpired(storedToken)) {
        logout();
        setIsLoading(false);
        return;
      }

      setToken(storedToken);

      // Verify or decode user
      const cachedUser = storage.getUser<AuthUser>();
      if (cachedUser) {
        setUser(cachedUser);
      } else {
        const decoded = decodeJwt(storedToken);
        if (decoded) {
          const derivedUser: AuthUser = {
            id: decoded.sub,
            tenantId: decoded.tenant_id || '',
            name: 'User',
            email: '',
            role: (decoded.role as UserRole) || 'EMPLOYEE',
            departmentId: decoded.department_id || null,
          };
          setUser(derivedUser);
          storage.setUser(derivedUser);
        }
      }

      // Fetch tenant details
      try {
        const tenantData = await tenantApi.getCurrentTenant();
        setTenant(tenantData);
      } catch {
        // Tenant endpoint may fail if not authorized or network issue
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen to unauthorized events from Axios interceptor
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('eka:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('eka:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  const login = async (payload: LoginRequest, remember = true) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(payload);
      const accessToken = response.accessToken;

      // Extract department and other claims from token if available
      const decoded = decodeJwt(accessToken);

      const authUser: AuthUser = {
        id: response.userId,
        tenantId: response.tenantId,
        name: response.name,
        email: response.email,
        role: (response.role as UserRole) || (decoded?.role as UserRole) || 'EMPLOYEE',
        departmentId: decoded?.department_id || null,
      };

      storage.setToken(accessToken, remember);
      storage.setUser(authUser, remember);

      setToken(accessToken);
      setUser(authUser);

      // Fetch tenant
      try {
        const tenantData = await tenantApi.getCurrentTenant();
        setTenant(tenantData);
      } catch (err) {
        console.warn('Failed to load tenant info on login:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterRequest) => {
    setIsLoading(true);
    try {
      // Backend registers tenant & creates first user as ADMIN
      await authApi.register(payload);
      // Auto login with the registered credentials
      await login(
        {
          tenantSlug: payload.tenantSlug,
          email: payload.email,
          password: payload.password,
        },
        true
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        refreshTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
