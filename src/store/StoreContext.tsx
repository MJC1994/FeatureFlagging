import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { v4 as uuid } from 'uuid';
import { api, ApiError, type ServerState } from '../api/client';
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

const PENDING_KEY = 'flagdeck-pending-v1';

function pendingKey(
  flagId: string,
  brand: Brand,
  environment: Environment,
): string {
  return `${flagId}::${brand}::${environment}`;
}

function loadPending(): PendingChange[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (raw) return JSON.parse(raw) as PendingChange[];
  } catch {
    /* ignore */
  }
  return [];
}

type StoreContextValue = {
  state: AppState;
  currentUser: User | null;
  authenticated: boolean;
  authReady: boolean;
  googleEnabled: boolean;
  allowedDomain: string;
  loading: boolean;
  error: string | null;
  authError: string | null;
  logout: () => Promise<void>;
  // Flags
  createFlag: (name: string, description: string, tags: string[]) => Promise<void>;
  updateFlag: (
    id: string,
    patch: { name?: string; description?: string; tags?: string[] },
  ) => Promise<void>;
  setFlagStatus: (id: string, status: FlagStatus) => Promise<void>;
  deleteFlag: (id: string) => Promise<void>;
  stageToggle: (
    flagId: string,
    brand: Brand,
    environment: Environment,
    value: boolean,
  ) => void;
  publishChanges: () => Promise<void>;
  discardChanges: () => void;
  getEffectiveValue: (
    flagId: string,
    brand: Brand,
    environment: Environment,
  ) => boolean;
  isPending: (
    flagId: string,
    brand: Brand,
    environment: Environment,
  ) => boolean;
  updateBrandConfig: (
    brand: Brand,
    environment: Environment,
    config: BrandConfig,
    warnings: string[],
  ) => Promise<void>;
  addUser: (email: string, role: Role) => Promise<void>;
  changeUserRole: (userId: string, role: Role) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  revertBrand: (snapshotId: string) => Promise<void>;
};

const StoreContext = createContext<StoreContextValue | null>(null);

const emptyState: AppState = {
  currentUserId: '',
  users: [],
  flags: [],
  configs: {} as AppState['configs'],
  auditLog: [],
  history: [],
  pendingChanges: [],
};

function readAuthErrorFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('auth_error');
    if (!code) return null;
    params.delete('auth_error');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
    return code;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    ...emptyState,
    pendingChanges: loadPending(),
  }));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState('ontrackretail.co.uk');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError] = useState<string | null>(() => readAuthErrorFromUrl());

  const applyServer = useCallback((server: ServerState, user: User) => {
    setState((prev) => {
      const flagIds = new Set(server.flags.map((f) => f.id));
      const pendingChanges = prev.pendingChanges.filter((c) =>
        flagIds.has(c.flagId),
      );
      return {
        ...server,
        currentUserId: user.id,
        pendingChanges,
      };
    });
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await api.authConfig();
        if (cancelled) return;
        setGoogleEnabled(config.googleEnabled);
        setAllowedDomain(config.allowedDomain);

        if (!config.googleEnabled) {
          setCurrentUser(null);
          setLoading(false);
          setAuthReady(true);
          return;
        }

        const user = await api.me();
        if (cancelled) return;

        if (!user) {
          setCurrentUser(null);
          setLoading(false);
          setAuthReady(true);
          return;
        }

        const server = await api.getState();
        if (cancelled) return;
        applyServer(server, user);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setCurrentUser(null);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyServer]);

  useEffect(() => {
    localStorage.setItem(PENDING_KEY, JSON.stringify(state.pendingChanges));
  }, [state.pendingChanges]);

  const withSession = useCallback(
    async (fn: () => Promise<ServerState>) => {
      if (!currentUser) throw new Error('Not signed in');
      try {
        const server = await fn();
        applyServer(server, currentUser);
        setError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setCurrentUser(null);
        }
        const message = err instanceof Error ? err.message : 'Request failed';
        setError(message);
        throw err;
      }
    },
    [applyServer, currentUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setCurrentUser(null);
      setState((prev) => ({
        ...emptyState,
        pendingChanges: prev.pendingChanges,
      }));
    }
  }, []);

  const createFlag = useCallback(
    async (name: string, description: string, tags: string[]) => {
      await withSession(() => api.createFlag(name, description, tags));
    },
    [withSession],
  );

  const updateFlag = useCallback(
    async (
      id: string,
      patch: { name?: string; description?: string; tags?: string[] },
    ) => {
      await withSession(() => api.updateFlag(id, patch));
      if (patch.name) {
        setState((prev) => ({
          ...prev,
          pendingChanges: prev.pendingChanges.map((c) =>
            c.flagId === id ? { ...c, flagName: patch.name! } : c,
          ),
        }));
      }
    },
    [withSession],
  );

  const setFlagStatus = useCallback(
    async (id: string, status: FlagStatus) => {
      await withSession(() => api.setFlagStatus(id, status));
    },
    [withSession],
  );

  const deleteFlag = useCallback(
    async (id: string) => {
      await withSession(() => api.deleteFlag(id));
      setState((prev) => ({
        ...prev,
        pendingChanges: prev.pendingChanges.filter((c) => c.flagId !== id),
      }));
    },
    [withSession],
  );

  const stageToggle = useCallback(
    (
      flagId: string,
      brand: Brand,
      environment: Environment,
      value: boolean,
    ) => {
      setState((prev) => {
        const existing = prev.flags.find((f) => f.id === flagId);
        if (!existing) return prev;
        const published = existing.states[brand][environment];
        const key = pendingKey(flagId, brand, environment);
        const without = prev.pendingChanges.filter(
          (c) => pendingKey(c.flagId, c.brand, c.environment) !== key,
        );

        if (value === published) {
          return { ...prev, pendingChanges: without };
        }

        const change: PendingChange = {
          id: uuid(),
          flagId,
          flagName: existing.name,
          brand,
          environment,
          before: published,
          after: value,
        };
        return { ...prev, pendingChanges: [...without, change] };
      });
    },
    [],
  );

  const getEffectiveValue = useCallback(
    (flagId: string, brand: Brand, environment: Environment): boolean => {
      const pending = state.pendingChanges.find(
        (c) =>
          c.flagId === flagId &&
          c.brand === brand &&
          c.environment === environment,
      );
      if (pending) return pending.after;
      const flag = state.flags.find((f) => f.id === flagId);
      return flag?.states[brand][environment] ?? false;
    },
    [state.flags, state.pendingChanges],
  );

  const isPending = useCallback(
    (flagId: string, brand: Brand, environment: Environment): boolean => {
      return state.pendingChanges.some(
        (c) =>
          c.flagId === flagId &&
          c.brand === brand &&
          c.environment === environment,
      );
    },
    [state.pendingChanges],
  );

  const publishChanges = useCallback(async () => {
    const changes = state.pendingChanges;
    if (changes.length === 0) return;
    await withSession(() => api.publishChanges(changes));
    setState((prev) => ({ ...prev, pendingChanges: [] }));
  }, [state.pendingChanges, withSession]);

  const discardChanges = useCallback(() => {
    setState((prev) =>
      prev.pendingChanges.length === 0
        ? prev
        : { ...prev, pendingChanges: [] },
    );
  }, []);

  const updateBrandConfig = useCallback(
    async (
      brand: Brand,
      environment: Environment,
      config: BrandConfig,
      warnings: string[],
    ) => {
      await withSession(() =>
        api.updateBrandConfig(brand, environment, config, warnings),
      );
    },
    [withSession],
  );

  const addUser = useCallback(
    async (email: string, role: Role) => {
      await withSession(() => api.addUser(email, role));
    },
    [withSession],
  );

  const changeUserRole = useCallback(
    async (userId: string, role: Role) => {
      await withSession(() => api.changeUserRole(userId, role));
    },
    [withSession],
  );

  const removeUser = useCallback(
    async (userId: string) => {
      await withSession(() => api.removeUser(userId));
    },
    [withSession],
  );

  const revertBrand = useCallback(
    async (snapshotId: string) => {
      await withSession(() => api.revertBrand(snapshotId));
    },
    [withSession],
  );

  const value: StoreContextValue = useMemo(
    () => ({
      state,
      currentUser,
      authenticated: Boolean(currentUser),
      authReady,
      googleEnabled,
      allowedDomain,
      loading,
      error,
      authError,
      logout,
      createFlag,
      updateFlag,
      setFlagStatus,
      deleteFlag,
      stageToggle,
      publishChanges,
      discardChanges,
      getEffectiveValue,
      isPending,
      updateBrandConfig,
      addUser,
      changeUserRole,
      removeUser,
      revertBrand,
    }),
    [
      state,
      currentUser,
      authReady,
      googleEnabled,
      allowedDomain,
      loading,
      error,
      authError,
      logout,
      createFlag,
      updateFlag,
      setFlagStatus,
      deleteFlag,
      stageToggle,
      publishChanges,
      discardChanges,
      getEffectiveValue,
      isPending,
      updateBrandConfig,
      addUser,
      changeUserRole,
      removeUser,
      revertBrand,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
