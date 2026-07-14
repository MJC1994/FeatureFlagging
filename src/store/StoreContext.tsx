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
import { BRANDS } from '../types';
import type {
  AppState,
  AuditEntry,
  AuditActionType,
  Brand,
  BrandSnapshot,
  Environment,
  FeatureFlag,
  FlagStatus,
  PendingChange,
  Role,
  User,
} from '../types';
import type { BrandConfig } from '../configTypes';
import { createInitialState, emptyStates, STORAGE_KEY } from './initialData';
import { cloneConfig, emptyBrandConfig } from '../configDefaults';

function pendingKey(
  flagId: string,
  brand: Brand,
  environment: Environment,
): string {
  return `${flagId}::${brand}::${environment}`;
}

type StoreContextValue = {
  state: AppState;
  currentUser: User;
  // Flags
  createFlag: (name: string, description: string, tags: string[]) => void;
  updateFlag: (
    id: string,
    patch: { name?: string; description?: string; tags?: string[] },
  ) => void;
  setFlagStatus: (id: string, status: FlagStatus) => void;
  deleteFlag: (id: string) => void;
  /** Stage an on/off change into the publish draft (does not apply yet). */
  stageToggle: (
    flagId: string,
    brand: Brand,
    environment: Environment,
    value: boolean,
  ) => void;
  publishChanges: () => void;
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
  // Config
  updateBrandConfig: (
    brand: Brand,
    environment: Environment,
    config: BrandConfig,
    warnings: string[],
  ) => void;
  // Users
  addUser: (email: string, role: Role) => void;
  changeUserRole: (userId: string, role: Role) => void;
  removeUser: (userId: string) => void;
  setCurrentUser: (userId: string) => void;
  // History
  revertBrand: (snapshotId: string) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      const base = createInitialState();
      return {
        ...base,
        ...parsed,
        users: parsed.users ?? base.users,
        flags: parsed.flags ?? base.flags,
        configs: parsed.configs ?? base.configs,
        auditLog: parsed.auditLog ?? base.auditLog,
        history: parsed.history ?? base.history,
        currentUserId: parsed.currentUserId ?? base.currentUserId,
        pendingChanges: parsed.pendingChanges ?? [],
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return createInitialState();
}

function snapshotBrand(
  state: AppState,
  brand: Brand,
  user: User,
  label: string,
): BrandSnapshot {
  const states: BrandSnapshot['states'] = {};
  for (const flag of state.flags) {
    states[flag.id] = {
      Stage: flag.states[brand].Stage,
      Production: flag.states[brand].Production,
    };
  }
  return {
    id: uuid(),
    brand,
    timestamp: new Date().toISOString(),
    userId: user.id,
    userEmail: user.email,
    label,
    states,
  };
}

function audit(
  user: User,
  action: AuditActionType,
  summary: string,
  extras: Partial<AuditEntry> = {},
): AuditEntry {
  return {
    id: uuid(),
    timestamp: new Date().toISOString(),
    userId: user.id,
    userEmail: user.email,
    action,
    summary,
    ...extras,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const currentUser = useMemo(() => {
    return (
      state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
    );
  }, [state.users, state.currentUserId]);

  const createFlag = useCallback(
    (name: string, description: string, tags: string[]) => {
      const now = new Date().toISOString();
      const flag: FeatureFlag = {
        id: uuid(),
        name: name.trim(),
        description: description.trim(),
        tags: tags.map((t) => t.trim()).filter(Boolean),
        status: 'Active',
        states: emptyStates(),
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => {
        const user =
          prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
        const next = { ...prev, flags: [...prev.flags, flag] };
        const snaps = BRANDS.map((brand) =>
          snapshotBrand(next, brand, user, `Created flag "${flag.name}"`),
        );
        return {
          ...next,
          history: [...snaps, ...prev.history],
          auditLog: [
            audit(user, 'flag_create', `Created flag "${flag.name}"`, {
              flagId: flag.id,
              flagName: flag.name,
              after: JSON.stringify({
                name: flag.name,
                description: flag.description,
                tags: flag.tags,
              }),
            }),
            ...prev.auditLog,
          ],
        };
      });
    },
    [],
  );

  const updateFlag = useCallback(
    (
      id: string,
      patch: { name?: string; description?: string; tags?: string[] },
    ) => {
      setState((prev) => {
        const user =
          prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
        const existing = prev.flags.find((f) => f.id === id);
        if (!existing) return prev;
        const updated: FeatureFlag = {
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          flags: prev.flags.map((f) => (f.id === id ? updated : f)),
          pendingChanges: prev.pendingChanges.map((c) =>
            c.flagId === id && patch.name
              ? { ...c, flagName: patch.name }
              : c,
          ),
          auditLog: [
            audit(user, 'flag_edit', `Edited flag "${existing.name}"`, {
              flagId: id,
              flagName: existing.name,
              before: JSON.stringify({
                name: existing.name,
                description: existing.description,
                tags: existing.tags,
              }),
              after: JSON.stringify({
                name: updated.name,
                description: updated.description,
                tags: updated.tags,
              }),
            }),
            ...prev.auditLog,
          ],
        };
      });
    },
    [],
  );

  const setFlagStatus = useCallback((id: string, status: FlagStatus) => {
    setState((prev) => {
      const user =
        prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
      const existing = prev.flags.find((f) => f.id === id);
      if (!existing || existing.status === status) return prev;
      return {
        ...prev,
        flags: prev.flags.map((f) =>
          f.id === id
            ? { ...f, status, updatedAt: new Date().toISOString() }
            : f,
        ),
        auditLog: [
          audit(
            user,
            'flag_status',
            `Changed status of "${existing.name}" to ${status}`,
            {
              flagId: id,
              flagName: existing.name,
              before: existing.status,
              after: status,
            },
          ),
          ...prev.auditLog,
        ],
      };
    });
  }, []);

  const deleteFlag = useCallback((id: string) => {
    setState((prev) => {
      const user =
        prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
      const existing = prev.flags.find((f) => f.id === id);
      if (!existing) return prev;
      const nextFlags = prev.flags.filter((f) => f.id !== id);
      const next = {
        ...prev,
        flags: nextFlags,
        pendingChanges: prev.pendingChanges.filter((c) => c.flagId !== id),
      };
      const snaps = BRANDS.map((brand) =>
        snapshotBrand(next, brand, user, `Deleted flag "${existing.name}"`),
      );
      return {
        ...next,
        history: [...snaps, ...prev.history],
        auditLog: [
          audit(user, 'flag_delete', `Deleted flag "${existing.name}"`, {
            flagId: id,
            flagName: existing.name,
            before: JSON.stringify(existing),
          }),
          ...prev.auditLog,
        ],
      };
    });
  }, []);

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

        // Toggling back to published value clears the draft entry
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

  const publishChanges = useCallback(() => {
    setState((prev) => {
      if (prev.pendingChanges.length === 0) return prev;
      const user =
        prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
      const now = new Date().toISOString();

      let nextFlags = prev.flags.map((flag) => {
        const relevant = prev.pendingChanges.filter((c) => c.flagId === flag.id);
        if (relevant.length === 0) return flag;
        let states = flag.states;
        for (const change of relevant) {
          states = {
            ...states,
            [change.brand]: {
              ...states[change.brand],
              [change.environment]: change.after,
            },
          };
        }
        return { ...flag, states, updatedAt: now };
      });

      const next: AppState = {
        ...prev,
        flags: nextFlags,
        pendingChanges: [],
      };

      const affectedBrands = [
        ...new Set(prev.pendingChanges.map((c) => c.brand)),
      ];
      const snaps = affectedBrands.map((brand) =>
        snapshotBrand(
          next,
          brand,
          user,
          `Published ${prev.pendingChanges.filter((c) => c.brand === brand).length} change(s)`,
        ),
      );

      const audits = prev.pendingChanges.map((change) =>
        audit(
          user,
          'flag_toggle',
          `Published "${change.flagName}" ${change.after ? 'ON' : 'OFF'}`,
          {
            flagId: change.flagId,
            flagName: change.flagName,
            brand: change.brand,
            environment: change.environment,
            before: change.before ? 'ON' : 'OFF',
            after: change.after ? 'ON' : 'OFF',
          },
        ),
      );

      return {
        ...next,
        history: [...snaps, ...prev.history],
        auditLog: [...audits, ...prev.auditLog],
      };
    });
  }, []);

  const discardChanges = useCallback(() => {
    setState((prev) =>
      prev.pendingChanges.length === 0
        ? prev
        : { ...prev, pendingChanges: [] },
    );
  }, []);

  const updateBrandConfig = useCallback(
    (
      brand: Brand,
      environment: Environment,
      config: BrandConfig,
      warnings: string[],
    ) => {
      setState((prev) => {
        const user =
          prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
        const existing = prev.configs[brand]?.[environment] ?? {
          config: emptyBrandConfig(),
          warnings: [],
        };
        const nextConfig = cloneConfig(config);
        const nextWarnings = [...warnings];
        return {
          ...prev,
          configs: {
            ...prev.configs,
            [brand]: {
              ...prev.configs[brand],
              [environment]: {
                config: nextConfig,
                warnings: nextWarnings,
              },
            },
          },
          auditLog: [
            audit(
              user,
              'config_update',
              `Updated ${brand} ${environment} config`,
              {
                brand,
                environment,
                before: JSON.stringify(existing),
                after: JSON.stringify({
                  config: nextConfig,
                  warnings: nextWarnings,
                }),
              },
            ),
            ...prev.auditLog,
          ],
        };
      });
    },
    [],
  );

  const addUser = useCallback((email: string, role: Role) => {
    setState((prev) => {
      const actor =
        prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
      const trimmed = email.trim().toLowerCase();
      if (prev.users.some((u) => u.email.toLowerCase() === trimmed)) return prev;
      const user: User = { id: uuid(), email: trimmed, role };
      return {
        ...prev,
        users: [...prev.users, user],
        auditLog: [
          audit(actor, 'user_add', `Added user ${trimmed} as ${role}`, {
            after: `${trimmed} (${role})`,
          }),
          ...prev.auditLog,
        ],
      };
    });
  }, []);

  const changeUserRole = useCallback((userId: string, role: Role) => {
    setState((prev) => {
      const actor =
        prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
      const target = prev.users.find((u) => u.id === userId);
      if (!target || target.role === role) return prev;
      return {
        ...prev,
        users: prev.users.map((u) => (u.id === userId ? { ...u, role } : u)),
        auditLog: [
          audit(
            actor,
            'user_role_change',
            `Changed ${target.email} from ${target.role} to ${role}`,
            {
              before: target.role,
              after: role,
            },
          ),
          ...prev.auditLog,
        ],
      };
    });
  }, []);

  const removeUser = useCallback((userId: string) => {
    setState((prev) => {
      const actor =
        prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
      const target = prev.users.find((u) => u.id === userId);
      if (!target || target.id === actor.id) return prev;
      return {
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
        auditLog: [
          audit(actor, 'user_remove', `Removed user ${target.email}`, {
            before: `${target.email} (${target.role})`,
          }),
          ...prev.auditLog,
        ],
      };
    });
  }, []);

  const setCurrentUser = useCallback((userId: string) => {
    setState((prev) =>
      prev.users.some((u) => u.id === userId)
        ? { ...prev, currentUserId: userId }
        : prev,
    );
  }, []);

  const revertBrand = useCallback((snapshotId: string) => {
    setState((prev) => {
      const user =
        prev.users.find((u) => u.id === prev.currentUserId) ?? prev.users[0];
      const snap = prev.history.find((h) => h.id === snapshotId);
      if (!snap) return prev;
      const brand = snap.brand;
      const nextFlags = prev.flags.map((flag) => {
        const restored = snap.states[flag.id];
        if (!restored) return flag;
        return {
          ...flag,
          states: {
            ...flag.states,
            [brand]: {
              Stage: restored.Stage,
              Production: restored.Production,
            },
          },
          updatedAt: new Date().toISOString(),
        };
      });
      const next = { ...prev, flags: nextFlags };
      const newSnap = snapshotBrand(
        next,
        brand,
        user,
        `Reverted to snapshot from ${new Date(snap.timestamp).toLocaleString()}`,
      );
      return {
        ...next,
        history: [newSnap, ...prev.history],
        auditLog: [
          audit(
            user,
            'config_revert',
            `Reverted ${brand} to configuration from ${new Date(snap.timestamp).toLocaleString()}`,
            {
              brand,
              before: snap.id,
              after: newSnap.id,
            },
          ),
          ...prev.auditLog,
        ],
      };
    });
  }, []);

  const value: StoreContextValue = {
    state,
    currentUser,
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
    setCurrentUser,
    revertBrand,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
