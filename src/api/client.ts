import type {
  AppState,
  Brand,
  Environment,
  FlagStatus,
  PendingChange,
  Role,
  User,
} from '../types';
import type { BrandConfig } from '../configTypes';

/** Server-persisted slice of app state (pending stays client-side). */
export type ServerState = Omit<AppState, 'currentUserId' | 'pendingChanges'>;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data.error ?? data.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  authConfig: () =>
    request<{ googleEnabled: boolean; allowedDomain: string }>(
      '/api/auth/config',
    ),

  me: async (): Promise<User | null> => {
    try {
      const data = await request<{ user: User }>('/api/auth/me');
      return data.user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  getState: () => request<ServerState>('/api/state'),

  createFlag: (name: string, description: string, tags: string[]) =>
    request<ServerState>('/api/flags', {
      method: 'POST',
      body: JSON.stringify({ name, description, tags }),
    }),

  updateFlag: (
    id: string,
    patch: { name?: string; description?: string; tags?: string[] },
  ) =>
    request<ServerState>(`/api/flags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  setFlagStatus: (id: string, status: FlagStatus) =>
    request<ServerState>(`/api/flags/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteFlag: (id: string) =>
    request<ServerState>(`/api/flags/${id}`, {
      method: 'DELETE',
    }),

  publishChanges: (changes: PendingChange[]) =>
    request<ServerState>('/api/flags/publish', {
      method: 'POST',
      body: JSON.stringify({ changes }),
    }),

  updateBrandConfig: (
    brand: Brand,
    environment: Environment,
    config: BrandConfig,
    warnings: string[],
  ) =>
    request<ServerState>(
      `/api/configs/${encodeURIComponent(brand)}/${environment}`,
      {
        method: 'PUT',
        body: JSON.stringify({ config, warnings }),
      },
    ),

  addUser: (email: string, role: Role) =>
    request<ServerState>('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  changeUserRole: (targetId: string, role: Role) =>
    request<ServerState>(`/api/users/${targetId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeUser: (targetId: string) =>
    request<ServerState>(`/api/users/${targetId}`, {
      method: 'DELETE',
    }),

  revertBrand: (snapshotId: string) =>
    request<ServerState>(`/api/history/${snapshotId}/revert`, {
      method: 'POST',
    }),
};
