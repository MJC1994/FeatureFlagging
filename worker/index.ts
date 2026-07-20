import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import {
  ALLOWED_EMAIL_DOMAIN,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  authErrorRedirect,
  buildGoogleAuthUrl,
  clearCookieOptions,
  createSessionToken,
  exchangeGoogleCode,
  fetchGoogleUser,
  googleConfigured,
  isAllowedEmail,
  readSessionToken,
  redirectUriFor,
  sessionCookieOptions,
} from './auth';
import {
  brandToSlug,
  loadBrandPayload,
  parseBrandParam,
  parseEnvironmentParam,
} from './brands';
import {
  auditInsert,
  emptyFlagStates,
  getUserByEmail,
  getUserById,
  insertFlagStateRows,
  loadState,
  snapshotBrandStatements,
} from './db';
import {
  canChangeStatus,
  canCreateFlag,
  canDeleteFlag,
  canEditEnvironment,
  canEditFlagMeta,
  canManageUsers,
  canRevert,
} from './permissions';
import { ensureSeeded } from './seed';
import { BRANDS, ENVIRONMENTS } from './types';
import type {
  Brand,
  Environment,
  FeatureFlag,
  PendingChange,
  Role,
  User,
} from './types';

type Env = {
  Bindings: {
    DB: D1Database;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    SESSION_SECRET?: string;
    BOOTSTRAP_OWNER_EMAIL?: string;
  };
  Variables: {
    actor: User;
  };
};

const app = new Hono<Env>();

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

function requireGoogleEnv(env: Env['Bindings']): asserts env is Env['Bindings'] & {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
} {
  if (!googleConfigured(env)) {
    throw new HTTPException(503, {
      message:
        'Google auth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and SESSION_SECRET in .dev.vars (local) or as Worker secrets.',
    });
  }
}

async function requireActor(c: Context<Env>): Promise<User> {
  requireGoogleEnv(c.env);

  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    throw new HTTPException(401, { message: 'Not signed in' });
  }

  const session = await readSessionToken(c.env.SESSION_SECRET, token);
  if (!session) {
    throw new HTTPException(401, { message: 'Session expired' });
  }

  const user = await getUserById(c.env.DB, session.userId);
  if (!user) {
    throw new HTTPException(401, { message: 'Unknown user' });
  }
  if (!isAllowedEmail(user.email)) {
    throw new HTTPException(403, { message: 'Email domain not allowed' });
  }

  c.set('actor', user);
  return user;
}

function jsonError(message: string, status: 400 | 403 | 404 = 400): never {
  throw new HTTPException(status, { message });
}

// —— Auth ——

app.get('/api/auth/config', (c) => {
  return c.json({
    googleEnabled: googleConfigured(c.env),
    allowedDomain: ALLOWED_EMAIL_DOMAIN,
  });
});

app.get('/api/auth/me', async (c) => {
  await ensureSeeded(c.env.DB, c.env.BOOTSTRAP_OWNER_EMAIL);
  if (!googleConfigured(c.env)) {
    return c.json({ user: null }, 401);
  }
  try {
    const user = await requireActor(c);
    return c.json({ user });
  } catch (err) {
    if (err instanceof HTTPException && err.status === 401) {
      return c.json({ user: null }, 401);
    }
    throw err;
  }
});

app.get('/api/auth/login', async (c) => {
  requireGoogleEnv(c.env);
  await ensureSeeded(c.env.DB, c.env.BOOTSTRAP_OWNER_EMAIL);

  const url = new URL(c.req.url);
  const state = crypto.randomUUID();
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    ...sessionCookieOptions(url),
    maxAge: 600,
  });

  const authUrl = buildGoogleAuthUrl({
    clientId: c.env.GOOGLE_CLIENT_ID,
    redirectUri: redirectUriFor(url),
    state,
  });
  return c.redirect(authUrl, 302);
});

app.get('/api/auth/callback', async (c) => {
  requireGoogleEnv(c.env);
  await ensureSeeded(c.env.DB, c.env.BOOTSTRAP_OWNER_EMAIL);

  const url = new URL(c.req.url);
  const origin = url.origin;
  const code = c.req.query('code');
  const state = c.req.query('state');
  const oauthError = c.req.query('error');
  const expectedState = getCookie(c, OAUTH_STATE_COOKIE);

  deleteCookie(c, OAUTH_STATE_COOKIE, clearCookieOptions(url));

  if (oauthError) {
    return c.redirect(authErrorRedirect(origin, 'google_denied'), 302);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return c.redirect(authErrorRedirect(origin, 'invalid_state'), 302);
  }

  try {
    const tokens = await exchangeGoogleCode({
      code,
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri: redirectUriFor(url),
    });
    const profile = await fetchGoogleUser(tokens.access_token);
    const email = profile.email?.trim().toLowerCase() ?? '';

    if (!profile.email_verified) {
      return c.redirect(authErrorRedirect(origin, 'email_unverified'), 302);
    }
    if (!isAllowedEmail(email)) {
      return c.redirect(authErrorRedirect(origin, 'domain_not_allowed'), 302);
    }

    const user = await getUserByEmail(c.env.DB, email);
    if (!user) {
      return c.redirect(authErrorRedirect(origin, 'not_invited'), 302);
    }

    const token = await createSessionToken(c.env.SESSION_SECRET, user.id);
    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(url));
    return c.redirect(`${origin}/`, 302);
  } catch (err) {
    console.error(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'oauth_failed',
      }),
    );
    return c.redirect(authErrorRedirect(origin, 'oauth_failed'), 302);
  }
});

app.post('/api/auth/logout', (c) => {
  const url = new URL(c.req.url);
  deleteCookie(c, SESSION_COOKIE, clearCookieOptions(url));
  return c.json({ ok: true });
});

// —— Public brand runtime API (config + features + warnings) ——

app.use('/api/v1/*', cors());

app.get('/api/v1/brands', async (c) => {
  await ensureSeeded(c.env.DB, c.env.BOOTSTRAP_OWNER_EMAIL);
  return c.json({
    brands: BRANDS.map((brand) => ({
      id: brandToSlug(brand),
      name: brand,
    })),
    environments: ENVIRONMENTS.map((environment) => ({
      id: environment.toLowerCase(),
      name: environment,
    })),
  });
});

app.get('/api/v1/:environment/:brand', async (c) => {
  await ensureSeeded(c.env.DB, c.env.BOOTSTRAP_OWNER_EMAIL);

  const environment = parseEnvironmentParam(c.req.param('environment'));
  const brand = parseBrandParam(c.req.param('brand'));

  if (!environment) {
    return c.json(
      { error: 'Invalid environment. Use stage or production.' },
      400,
    );
  }
  if (!brand) {
    return c.json(
      {
        error: `Unknown brand. Use one of: ${BRANDS.map(brandToSlug).join(', ')}`,
      },
      404,
    );
  }

  const payload = await loadBrandPayload(c.env.DB, brand, environment);
  if (!payload) {
    return c.json({ error: 'Brand configuration not found' }, 404);
  }

  return c.json(payload);
});

app.get('/api/state', async (c) => {
  await ensureSeeded(c.env.DB, c.env.BOOTSTRAP_OWNER_EMAIL);
  await requireActor(c);
  const state = await loadState(c.env.DB);
  return c.json(state);
});

app.post('/api/flags', async (c) => {
  const actor = await requireActor(c);
  if (!canCreateFlag(actor.role)) {
    jsonError('Forbidden', 403);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    tags?: string[];
  }>();
  const name = body.name?.trim() ?? '';
  if (!name) jsonError('Name is required');

  const now = new Date().toISOString();
  const flagId = crypto.randomUUID();
  const description = body.description?.trim() ?? '';
  const tags = (body.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const states = emptyFlagStates();

  const stmts = [
    c.env.DB.prepare(
      `INSERT INTO flags (id, name, description, tags_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Active', ?, ?)`,
    ).bind(flagId, name, description, JSON.stringify(tags), now, now),
    ...insertFlagStateRows(c.env.DB, flagId, states),
  ];

  // Need current flags for snapshots after insert — build in-memory
  const before = await loadState(c.env.DB);
  const newFlag: FeatureFlag = {
    id: flagId,
    name,
    description,
    tags,
    status: 'Active',
    states,
    createdAt: now,
    updatedAt: now,
  };
  const nextFlags = [...before.flags, newFlag];

  for (const brand of BRANDS) {
    stmts.push(
      snapshotBrandStatements(
        c.env.DB,
        nextFlags,
        brand,
        actor,
        `Created flag "${name}"`,
      ),
    );
  }
  stmts.push(
    auditInsert(c.env.DB, actor, 'flag_create', `Created flag "${name}"`, {
      flagId,
      flagName: name,
      after: JSON.stringify({ name, description, tags }),
    }),
  );

  await c.env.DB.batch(stmts);
  return c.json(await loadState(c.env.DB), 201);
});

app.patch('/api/flags/:id', async (c) => {
  const actor = await requireActor(c);
  if (!canEditFlagMeta(actor.role)) jsonError('Forbidden', 403);

  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    description?: string;
    tags?: string[];
  }>();

  const existing = await c.env.DB.prepare(
    'SELECT id, name, description, tags_json FROM flags WHERE id = ?',
  )
    .bind(id)
    .first<{
      id: string;
      name: string;
      description: string;
      tags_json: string;
    }>();
  if (!existing) jsonError('Flag not found', 404);

  const name = body.name?.trim() ?? existing.name;
  const description =
    body.description !== undefined
      ? body.description.trim()
      : existing.description;
  const tags =
    body.tags !== undefined
      ? body.tags.map((t) => t.trim()).filter(Boolean)
      : (JSON.parse(existing.tags_json) as string[]);
  const now = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE flags SET name = ?, description = ?, tags_json = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(name, description, JSON.stringify(tags), now, id),
    auditInsert(c.env.DB, actor, 'flag_edit', `Edited flag "${existing.name}"`, {
      flagId: id,
      flagName: existing.name,
      before: JSON.stringify({
        name: existing.name,
        description: existing.description,
        tags: JSON.parse(existing.tags_json),
      }),
      after: JSON.stringify({ name, description, tags }),
    }),
  ]);

  return c.json(await loadState(c.env.DB));
});

app.patch('/api/flags/:id/status', async (c) => {
  const actor = await requireActor(c);
  if (!canChangeStatus(actor.role)) jsonError('Forbidden', 403);

  const id = c.req.param('id');
  const body = await c.req.json<{ status?: 'Active' | 'Deprecated' }>();
  if (body.status !== 'Active' && body.status !== 'Deprecated') {
    jsonError('Invalid status');
  }

  const existing = await c.env.DB.prepare(
    'SELECT id, name, status FROM flags WHERE id = ?',
  )
    .bind(id)
    .first<{ id: string; name: string; status: string }>();
  if (!existing) jsonError('Flag not found', 404);
  if (existing.status === body.status) {
    return c.json(await loadState(c.env.DB));
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE flags SET status = ?, updated_at = ? WHERE id = ?',
    ).bind(body.status, new Date().toISOString(), id),
    auditInsert(
      c.env.DB,
      actor,
      'flag_status',
      `Changed status of "${existing.name}" to ${body.status}`,
      {
        flagId: id,
        flagName: existing.name,
        before: existing.status,
        after: body.status,
      },
    ),
  ]);

  return c.json(await loadState(c.env.DB));
});

app.delete('/api/flags/:id', async (c) => {
  const actor = await requireActor(c);
  if (!canDeleteFlag(actor.role)) jsonError('Forbidden', 403);

  const id = c.req.param('id');
  const state = await loadState(c.env.DB);
  const existing = state.flags.find((f) => f.id === id);
  if (!existing) jsonError('Flag not found', 404);

  const nextFlags = state.flags.filter((f) => f.id !== id);
  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare('DELETE FROM flags WHERE id = ?').bind(id),
  ];
  for (const brand of BRANDS) {
    stmts.push(
      snapshotBrandStatements(
        c.env.DB,
        nextFlags,
        brand,
        actor,
        `Deleted flag "${existing.name}"`,
      ),
    );
  }
  stmts.push(
    auditInsert(c.env.DB, actor, 'flag_delete', `Deleted flag "${existing.name}"`, {
      flagId: id,
      flagName: existing.name,
      before: JSON.stringify(existing),
    }),
  );

  await c.env.DB.batch(stmts);
  return c.json(await loadState(c.env.DB));
});

app.post('/api/flags/publish', async (c) => {
  const actor = await requireActor(c);
  const body = await c.req.json<{ changes?: PendingChange[] }>();
  const changes = body.changes ?? [];
  if (changes.length === 0) {
    return c.json(await loadState(c.env.DB));
  }

  for (const change of changes) {
    if (!canEditEnvironment(actor.role, change.environment)) {
      jsonError(
        `Forbidden to publish ${change.environment} changes`,
        403,
      );
    }
  }

  const state = await loadState(c.env.DB);
  const flagMap = new Map(state.flags.map((f) => [f.id, f]));
  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];

  for (const change of changes) {
    const flag = flagMap.get(change.flagId);
    if (!flag) continue;
    flag.states[change.brand][change.environment] = change.after;
    stmts.push(
      c.env.DB.prepare(
        `UPDATE flag_states SET enabled = ?
         WHERE flag_id = ? AND brand = ? AND environment = ?`,
      ).bind(change.after ? 1 : 0, change.flagId, change.brand, change.environment),
    );
    stmts.push(
      c.env.DB.prepare('UPDATE flags SET updated_at = ? WHERE id = ?').bind(
        now,
        change.flagId,
      ),
    );
    stmts.push(
      auditInsert(
        c.env.DB,
        actor,
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
  }

  const affectedBrands = [...new Set(changes.map((ch) => ch.brand))];
  for (const brand of affectedBrands) {
    const count = changes.filter((ch) => ch.brand === brand).length;
    stmts.push(
      snapshotBrandStatements(
        c.env.DB,
        state.flags,
        brand,
        actor,
        `Published ${count} change(s)`,
      ),
    );
  }

  // batch in chunks
  const CHUNK = 80;
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await c.env.DB.batch(stmts.slice(i, i + CHUNK));
  }

  return c.json(await loadState(c.env.DB));
});

app.put('/api/configs/:brand/:environment', async (c) => {
  const actor = await requireActor(c);
  const brand = c.req.param('brand') as Brand;
  const environment = c.req.param('environment') as Environment;

  if (!BRANDS.includes(brand)) jsonError('Invalid brand');
  if (environment !== 'Stage' && environment !== 'Production') {
    jsonError('Invalid environment');
  }
  if (!canEditEnvironment(actor.role, environment)) {
    jsonError('Forbidden', 403);
  }

  const body = await c.req.json<{ config?: unknown; warnings?: string[] }>();
  if (!body.config) jsonError('config is required');
  const warnings = body.warnings ?? [];

  const existing = await c.env.DB.prepare(
    `SELECT config_json, warnings_json FROM brand_configs
     WHERE brand = ? AND environment = ?`,
  )
    .bind(brand, environment)
    .first<{ config_json: string; warnings_json: string }>();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO brand_configs (brand, environment, config_json, warnings_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(brand, environment) DO UPDATE SET
         config_json = excluded.config_json,
         warnings_json = excluded.warnings_json`,
    ).bind(brand, environment, JSON.stringify(body.config), JSON.stringify(warnings)),
    auditInsert(
      c.env.DB,
      actor,
      'config_update',
      `Updated ${brand} ${environment} config`,
      {
        brand,
        environment,
        before: existing
          ? JSON.stringify({
              config: JSON.parse(existing.config_json),
              warnings: JSON.parse(existing.warnings_json),
            })
          : undefined,
        after: JSON.stringify({ config: body.config, warnings }),
      },
    ),
  ]);

  return c.json(await loadState(c.env.DB));
});

app.post('/api/users', async (c) => {
  const actor = await requireActor(c);
  if (!canManageUsers(actor.role)) jsonError('Forbidden', 403);

  const body = await c.req.json<{ email?: string; role?: Role }>();
  const email = body.email?.trim().toLowerCase() ?? '';
  const role = body.role;
  if (!email) jsonError('Email is required');
  if (!isAllowedEmail(email)) {
    jsonError(`Email must be @${ALLOWED_EMAIL_DOMAIN}`);
  }
  if (role !== 'Developer' && role !== 'Admin' && role !== 'Owner') {
    jsonError('Invalid role');
  }

  const dup = await c.env.DB.prepare(
    'SELECT id FROM users WHERE lower(email) = ?',
  )
    .bind(email)
    .first();
  if (dup) jsonError('User already exists');

  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id, email, role) VALUES (?, ?, ?)').bind(
      id,
      email,
      role,
    ),
    auditInsert(c.env.DB, actor, 'user_add', `Added user ${email} as ${role}`, {
      after: `${email} (${role})`,
    }),
  ]);

  return c.json(await loadState(c.env.DB), 201);
});

app.patch('/api/users/:id', async (c) => {
  const actor = await requireActor(c);
  if (!canManageUsers(actor.role)) jsonError('Forbidden', 403);

  const userId = c.req.param('id');
  if (userId === actor.id) jsonError('Cannot change your own role');

  const body = await c.req.json<{ role?: Role }>();
  const role = body.role;
  if (role !== 'Developer' && role !== 'Admin' && role !== 'Owner') {
    jsonError('Invalid role');
  }

  const target = await getUserById(c.env.DB, userId);
  if (!target) jsonError('User not found', 404);
  if (target.role === role) return c.json(await loadState(c.env.DB));

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId),
    auditInsert(
      c.env.DB,
      actor,
      'user_role_change',
      `Changed ${target.email} from ${target.role} to ${role}`,
      { before: target.role, after: role },
    ),
  ]);

  return c.json(await loadState(c.env.DB));
});

app.delete('/api/users/:id', async (c) => {
  const actor = await requireActor(c);
  if (!canManageUsers(actor.role)) jsonError('Forbidden', 403);

  const userId = c.req.param('id');
  if (userId === actor.id) jsonError('Cannot remove yourself');

  const target = await getUserById(c.env.DB, userId);
  if (!target) jsonError('User not found', 404);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
    auditInsert(c.env.DB, actor, 'user_remove', `Removed user ${target.email}`, {
      before: `${target.email} (${target.role})`,
    }),
  ]);

  return c.json(await loadState(c.env.DB));
});

app.post('/api/history/:id/revert', async (c) => {
  const actor = await requireActor(c);
  if (!canRevert(actor.role)) jsonError('Forbidden', 403);

  const snapshotId = c.req.param('id');
  const state = await loadState(c.env.DB);
  const snap = state.history.find((h) => h.id === snapshotId);
  if (!snap) jsonError('Snapshot not found', 404);

  const brand = snap.brand;
  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];

  for (const flag of state.flags) {
    const restored = snap.states[flag.id];
    if (!restored) continue;
    flag.states[brand] = {
      Stage: restored.Stage,
      Production: restored.Production,
    };
    stmts.push(
      c.env.DB.prepare(
        `UPDATE flag_states SET enabled = ?
         WHERE flag_id = ? AND brand = ? AND environment = 'Stage'`,
      ).bind(restored.Stage ? 1 : 0, flag.id, brand),
    );
    stmts.push(
      c.env.DB.prepare(
        `UPDATE flag_states SET enabled = ?
         WHERE flag_id = ? AND brand = ? AND environment = 'Production'`,
      ).bind(restored.Production ? 1 : 0, flag.id, brand),
    );
    stmts.push(
      c.env.DB.prepare('UPDATE flags SET updated_at = ? WHERE id = ?').bind(
        now,
        flag.id,
      ),
    );
  }

  const newSnapId = crypto.randomUUID();
  const label = `Reverted to snapshot from ${new Date(snap.timestamp).toLocaleString()}`;
  const states: BrandSnapshotStates = {};
  for (const flag of state.flags) {
    states[flag.id] = {
      Stage: flag.states[brand].Stage,
      Production: flag.states[brand].Production,
    };
  }

  stmts.push(
    c.env.DB.prepare(
      `INSERT INTO history_snapshots (
        id, brand, timestamp, user_id, user_email, label, states_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      newSnapId,
      brand,
      now,
      actor.id,
      actor.email,
      label,
      JSON.stringify(states),
    ),
  );
  stmts.push(
    auditInsert(
      c.env.DB,
      actor,
      'config_revert',
      `Reverted ${brand} to configuration from ${new Date(snap.timestamp).toLocaleString()}`,
      { brand, before: snap.id, after: newSnapId },
    ),
  );

  const CHUNK = 80;
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await c.env.DB.batch(stmts.slice(i, i + CHUNK));
  }

  return c.json(await loadState(c.env.DB));
});

type BrandSnapshotStates = Record<
  string,
  Record<Environment, boolean>
>;

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env['Bindings']>;
