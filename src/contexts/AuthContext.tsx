import { useState, useCallback, useMemo, type ReactNode } from 'react';
import type { AxiosInstance } from 'axios';
import { AuthContext, type AuthContextValue, type AuthState } from './auth';
import { createHttpClient } from '../api/http';

const STORAGE_KEY = 'vitalis_auth';

function loadStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(loadStoredAuth);

  const http = useMemo<AxiosInstance | null>(() => {
    if (!auth) return null;
    return createHttpClient(auth.username, auth.password);
  }, [auth]);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    const client = createHttpClient(username, password);
    await client.get('/clients', { params: { size: 1 } });
    const newAuth: AuthState = { username, password };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAuth));
    setAuth(newAuth);
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ auth, http, isAuthenticated: auth !== null, login, logout }),
    [auth, http, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
