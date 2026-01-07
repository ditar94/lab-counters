import type { ApiError } from '@lab-counters/shared';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Store dev auth info for API requests
let devCognitoId: string | null = null;

export function setDevCognitoId(cognitoId: string | null) {
  devCognitoId = cognitoId;
}

// Legacy support
export function setDevUserType(type: string | null) {
  devCognitoId = type ? `dev-${type}` : null;
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

    // Add dev cognito ID header in development
    if (import.meta.env.DEV && devCognitoId) {
      (headers as Record<string, string>)['X-Dev-Cognito-Id'] = devCognitoId;
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

  async put<T>(path: string, body: unknown, token?: string): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      token,
    });
  }

  async delete(path: string, token?: string): Promise<void> {
    return this.request(path, { method: 'DELETE', token });
  }

  async download(path: string, token?: string, filename?: string): Promise<void> {
    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add dev cognito ID header in development
    if (import.meta.env.DEV && devCognitoId) {
      headers['X-Dev-Cognito-Id'] = devCognitoId;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        code: 'DOWNLOAD_ERROR',
        message: 'Failed to download file',
      }));
      throw new ApiRequestError(response.status, error);
    }

    // Get filename from Content-Disposition header if not provided
    const contentDisposition = response.headers.get('Content-Disposition');
    let downloadFilename = filename;
    if (!downloadFilename && contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        downloadFilename = match[1];
      }
    }
    downloadFilename = downloadFilename || 'export.csv';

    // Trigger browser download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
