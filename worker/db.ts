import { BRANDS, ENVIRONMENTS } from './types';
import type {
  AppState,
  AuditActionType,
  AuditEntry,
  Brand,
  BrandConfigs,
  BrandSnapshot,
  Environment,
  FeatureFlag,
  FlagStates,
  User,
} from './types';

function emptyStates(): FlagStates {
  const states = {} as FlagStates;
  for (const brand of BRANDS) {
    states[brand] = { Stage: false, Production: false };
  }
  return states;
}

export async function getUserById(
  db: D1Database,
  userId: string,
): Promise<User | null> {
  const row = await db
    .prepare('SELECT id, email, role FROM users WHERE id = ?')
    .bind(userId)
    .first<{ id: string; email: string; role: User['role'] }>();
  return row ?? null;
}

export async function getUserByEmail(
  db: D1Database,
  email: string,
): Promise<User | null> {
  const row = await db
    .prepare('SELECT id, email, role FROM users WHERE lower(email) = ?')
    .bind(email.trim().toLowerCase())
    .first<{ id: string; email: string; role: User['role'] }>();
  return row ?? null;
}

export async function loadState(db: D1Database): Promise<AppState> {
  const [usersRes, flagsRes, statesRes, configsRes, auditRes, historyRes] =
    await db.batch([
      db.prepare('SELECT id, email, role FROM users ORDER BY email'),
      db.prepare(
        `SELECT id, name, description, tags_json, status, created_at, updated_at
         FROM flags ORDER BY name`,
      ),
      db.prepare(
        'SELECT flag_id, brand, environment, enabled FROM flag_states',
      ),
      db.prepare(
        'SELECT brand, environment, config_json, warnings_json FROM brand_configs',
      ),
      db.prepare(
        `SELECT id, timestamp, user_id, user_email, action, summary,
                brand, environment, flag_id, flag_name, before_val, after_val
         FROM audit_log ORDER BY timestamp DESC LIMIT 500`,
      ),
      db.prepare(
        `SELECT id, brand, timestamp, user_id, user_email, label, states_json
         FROM history_snapshots ORDER BY timestamp DESC LIMIT 200`,
      ),
    ]);

  const users: User[] = (usersRes.results as User[]).map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
  }));

  const statesByFlag = new Map<string, FlagStates>();
  for (const row of statesRes.results as {
    flag_id: string;
    brand: Brand;
    environment: Environment;
    enabled: number;
  }[]) {
    let states = statesByFlag.get(row.flag_id);
    if (!states) {
      states = emptyStates();
      statesByFlag.set(row.flag_id, states);
    }
    states[row.brand][row.environment] = row.enabled === 1;
  }

  const flags: FeatureFlag[] = (
    flagsRes.results as {
      id: string;
      name: string;
      description: string;
      tags_json: string;
      status: FeatureFlag['status'];
      created_at: string;
      updated_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    tags: JSON.parse(row.tags_json) as string[],
    status: row.status,
    states: statesByFlag.get(row.id) ?? emptyStates(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const configs = {} as BrandConfigs;
  for (const brand of BRANDS) {
    configs[brand] = {
      Stage: { config: {}, warnings: [] },
      Production: { config: {}, warnings: [] },
    };
  }
  for (const row of configsRes.results as {
    brand: Brand;
    environment: Environment;
    config_json: string;
    warnings_json: string;
  }[]) {
    configs[row.brand][row.environment] = {
      config: JSON.parse(row.config_json),
      warnings: JSON.parse(row.warnings_json) as string[],
    };
  }

  const auditLog: AuditEntry[] = (
    auditRes.results as {
      id: string;
      timestamp: string;
      user_id: string;
      user_email: string;
      action: AuditActionType;
      summary: string;
      brand: Brand | null;
      environment: Environment | null;
      flag_id: string | null;
      flag_name: string | null;
      before_val: string | null;
      after_val: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    userId: row.user_id,
    userEmail: row.user_email,
    action: row.action,
    summary: row.summary,
    brand: row.brand ?? undefined,
    environment: row.environment ?? undefined,
    flagId: row.flag_id ?? undefined,
    flagName: row.flag_name ?? undefined,
    before: row.before_val ?? undefined,
    after: row.after_val ?? undefined,
  }));

  const history: BrandSnapshot[] = (
    historyRes.results as {
      id: string;
      brand: Brand;
      timestamp: string;
      user_id: string;
      user_email: string;
      label: string;
      states_json: string;
    }[]
  ).map((row) => ({
    id: row.id,
    brand: row.brand,
    timestamp: row.timestamp,
    userId: row.user_id,
    userEmail: row.user_email,
    label: row.label,
    states: JSON.parse(row.states_json) as BrandSnapshot['states'],
  }));

  return { users, flags, configs, auditLog, history };
}

export function auditInsert(
  db: D1Database,
  user: User,
  action: AuditActionType,
  summary: string,
  extras: Partial<{
    brand: Brand;
    environment: Environment;
    flagId: string;
    flagName: string;
    before: string;
    after: string;
  }> = {},
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO audit_log (
        id, timestamp, user_id, user_email, action, summary,
        brand, environment, flag_id, flag_name, before_val, after_val
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      user.id,
      user.email,
      action,
      summary,
      extras.brand ?? null,
      extras.environment ?? null,
      extras.flagId ?? null,
      extras.flagName ?? null,
      extras.before ?? null,
      extras.after ?? null,
    );
}

export function snapshotBrandStatements(
  db: D1Database,
  flags: FeatureFlag[],
  brand: Brand,
  user: User,
  label: string,
): D1PreparedStatement {
  const states: BrandSnapshot['states'] = {};
  for (const flag of flags) {
    states[flag.id] = {
      Stage: flag.states[brand].Stage,
      Production: flag.states[brand].Production,
    };
  }
  return db
    .prepare(
      `INSERT INTO history_snapshots (
        id, brand, timestamp, user_id, user_email, label, states_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      brand,
      new Date().toISOString(),
      user.id,
      user.email,
      label,
      JSON.stringify(states),
    );
}

export function insertFlagStateRows(
  db: D1Database,
  flagId: string,
  states: FlagStates,
): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [];
  for (const brand of BRANDS) {
    for (const environment of ENVIRONMENTS) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO flag_states (flag_id, brand, environment, enabled)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(flagId, brand, environment, states[brand][environment] ? 1 : 0),
      );
    }
  }
  return stmts;
}

export function emptyFlagStates(): FlagStates {
  return emptyStates();
}
