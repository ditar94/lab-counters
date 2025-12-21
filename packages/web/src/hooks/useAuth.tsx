import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { UserWithOrg } from '@lab-counters/shared';
import { api, setDevCognitoId } from '../api/client';

// Use dev auth picker only if explicitly enabled
const isDev = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH === 'true';

export interface DevUser {
  id: string;
  cognitoId: string;
  email: string;
  name: string;
  role: string;
  organization: { id: string; name: string; slug: string };
  site: { id: string; name: string };
}

export interface DevUsersResponse {
  organizations: Array<{
    org: { id: string; name: string; slug: string };
    users: DevUser[];
  }>;
}

interface AuthContextType {
  user: UserWithOrg | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<'SUCCESS' | 'NEW_PASSWORD_REQUIRED'>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  devLogin: (userType: 'superadmin' | 'admin' | 'supervisor' | 'tech') => Promise<void>;
  devLoginAs: (cognitoId: string) => Promise<void>;
  fetchDevUsers: () => Promise<DevUsersResponse | null>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  switchSite: (siteId: string) => Promise<void>;
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
        const storedCognitoId = sessionStorage.getItem('devCognitoId');
        if (storedToken && storedCognitoId) {
          devToken = storedToken;
          setDevCognitoId(storedCognitoId);
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

  const login = async (username: string, password: string): Promise<'SUCCESS' | 'NEW_PASSWORD_REQUIRED'> => {
    setError(null);
    try {
      const { signIn } = await import('aws-amplify/auth');
      const result = await signIn({ username, password });

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        return 'NEW_PASSWORD_REQUIRED';
      }

      await fetchUser();
      return 'SUCCESS';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  };

  const completeNewPassword = async (newPassword: string) => {
    setError(null);
    try {
      const { confirmSignIn } = await import('aws-amplify/auth');
      await confirmSignIn({ challengeResponse: newPassword });
      await fetchUser();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set new password';
      setError(message);
      throw err;
    }
  };

  const fetchDevUsers = async (): Promise<DevUsersResponse | null> => {
    if (!isDev) return null;
    try {
      return await api.get<DevUsersResponse>('/api/auth/dev-users');
    } catch (err) {
      console.error('Failed to fetch dev users:', err);
      return null;
    }
  };

  const devLoginAs = async (cognitoId: string) => {
    if (!isDev) {
      throw new Error('Dev login only available in development mode');
    }

    setError(null);
    try {
      devToken = 'dev-token';
      sessionStorage.setItem('devToken', devToken);
      sessionStorage.setItem('devCognitoId', cognitoId);
      setDevCognitoId(cognitoId);

      const userData = await api.get<UserWithOrg>('/api/auth/me', devToken);
      setUser(userData);
    } catch (err) {
      devToken = null;
      sessionStorage.removeItem('devToken');
      sessionStorage.removeItem('devCognitoId');
      setDevCognitoId(null);
      const message = err instanceof Error ? err.message : 'Dev login failed';
      setError(message);
      throw err;
    }
  };

  // Legacy support - login by role type
  const devLogin = async (userType: 'superadmin' | 'admin' | 'supervisor' | 'tech') => {
    const cognitoId = `dev-${userType}`;
    return devLoginAs(cognitoId);
  };

  const logout = async () => {
    try {
      if (isDev && devToken) {
        devToken = null;
        sessionStorage.removeItem('devToken');
        sessionStorage.removeItem('devCognitoId');
        setDevCognitoId(null);
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

  const switchSite = async (siteId: string) => {
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const userData = await api.post<UserWithOrg>('/api/auth/switch-site', { siteId }, token);
      setUser(userData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch site';
      setError(message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, completeNewPassword, devLogin, devLoginAs, fetchDevUsers, logout, getToken, switchSite, isDev }}
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
