import type { ApiError } from '@lab-counters/shared';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Store dev user type for API requests
let devUserType: string | null = null;

export function setDevUserType(type: string | null) {
  devUserType = type;
}

class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit & { token?: string } = {}
  ): Promise<T> {
    const { token, ...fetchOptions } = options;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    // Add dev user type header in development
    if (import.meta.env.DEV && devUserType) {
      (headers as Record<string, string>)['X-Dev-User-Type'] = devUserType;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      }));
      throw new ApiRequestError(response.status, error);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(path: string, token?: string): Promise<T> {
    return this.request<T>(path, { method: 'GET', token });
  }

  async post<T>(path: string, body: unknown, token?: string): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    });
  }

  async patch<T>(path: string, body: unknown, token?: string): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    });
  }

  async delete(path: string, token?: string): Promise<void> {
    return this.request(path, { method: 'DELETE', token });
  }
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public error: ApiError
  ) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

export const api = new ApiClient();
