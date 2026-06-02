import { createContext } from 'react';
import type { AxiosInstance } from 'axios';

export interface AuthState {
  username: string;
  password: string;
}

export interface AuthContextValue {
  auth: AuthState | null;
  http: AxiosInstance | null;
  isAuthenticated: boolean;
  validating: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
