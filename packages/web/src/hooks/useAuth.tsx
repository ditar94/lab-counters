import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { UserWithOrg } from '@lab-counters/shared';
import { api, setDevUserType } from '../api/client';

const isDev = import.meta.env.DEV;

interface AuthContextType {
  user: UserWithOrg | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  devLogin: (userType: 'admin' | 'supervisor' | 'tech') => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  isDev: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Store dev token in memory
let devToken: string | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithOrg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (isDev && devToken) {
      return devToken;
    }

    // Production: use Cognito
    try {
      const { fetchAuthSession } = await import('aws-amplify/auth');
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() || null;
    } catch {
      return null;
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }

      const userData = await api.get<UserWithOrg>('/api/auth/me', token);
      setUser(userData);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setUser(null);
    }
  }, [getToken]);

  useEffect(() => {
    async function checkAuth() {
      // Check for stored dev session
      if (isDev) {
        const storedToken = sessionStorage.getItem('devToken');
        const storedUserType = sessionStorage.getItem('devUserType');
        if (storedToken) {
          devToken = storedToken;
          if (storedUserType) {
            setDevUserType(storedUserType);
          }
          await fetchUser();
          setLoading(false);
          return;
        }
      }

      // Production: check Cognito
      try {
        const { getCurrentUser } = await import('aws-amplify/auth');
        await getCurrentUser();
        await fetchUser();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const { signIn } = await import('aws-amplify/auth');
      await signIn({ username: email, password });
      await fetchUser();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  };

  const devLogin = async (userType: 'admin' | 'supervisor' | 'tech') => {
    if (!isDev) {
      throw new Error('Dev login only available in development mode');
    }

    setError(null);
    try {
      devToken = 'dev-token';
      sessionStorage.setItem('devToken', devToken);
      sessionStorage.setItem('devUserType', userType);
      setDevUserType(userType);

      const userData = await api.get<UserWithOrg>('/api/auth/me', devToken);
      setUser(userData);
    } catch (err) {
      devToken = null;
      sessionStorage.removeItem('devToken');
      sessionStorage.removeItem('devUserType');
      setDevUserType(null);
      const message = err instanceof Error ? err.message : 'Dev login failed';
      setError(message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (isDev && devToken) {
        devToken = null;
        sessionStorage.removeItem('devToken');
        sessionStorage.removeItem('devUserType');
        setDevUserType(null);
        setUser(null);
        return;
      }

      const { signOut } = await import('aws-amplify/auth');
      await signOut();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, devLogin, logout, getToken, isDev }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
