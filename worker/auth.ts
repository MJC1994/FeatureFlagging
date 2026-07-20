/** Allowed Google Workspace / email domain for Flagdeck access. */
export const ALLOWED_EMAIL_DOMAIN = 'ontrackretail.co.uk';

export const SESSION_COOKIE = 'flagdeck_session';
export const OAUTH_STATE_COOKIE = 'flagdeck_oauth_state';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export function isAllowedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export type AuthEnv = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${bytesToBase64Url(sig)}`;
}

async function verify(secret: string, token: string): Promise<string | null> {
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(sig),
    new TextEncoder().encode(payload),
  );
  return valid ? payload : null;
}

export type SessionPayload = {
  userId: string;
  exp: number;
};

export async function createSessionToken(
  secret: string,
  userId: string,
): Promise<string> {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return sign(secret, bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload))));
}

export async function readSessionToken(
  secret: string,
  token: string,
): Promise<SessionPayload | null> {
  const payload = await verify(secret, token);
  if (!payload) return null;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payload));
    const data = JSON.parse(json) as SessionPayload;
    if (!data.userId || typeof data.exp !== 'number') return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(url: URL): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
  maxAge: number;
} {
  return {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearCookieOptions(url: URL): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
  maxAge: number;
} {
  return {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
    maxAge: 0,
  };
}

export function googleConfigured(env: Partial<AuthEnv>): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET,
  );
}

export function buildGoogleAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: opts.state,
    hd: ALLOWED_EMAIL_DOMAIN,
    prompt: 'select_account',
    access_type: 'online',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ access_token: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }
  return (await res.json()) as { access_token: string };
}

export async function fetchGoogleUser(accessToken: string): Promise<{
  email: string;
  email_verified: boolean;
  name?: string;
}> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google userinfo failed: ${text}`);
  }
  return (await res.json()) as {
    email: string;
    email_verified: boolean;
    name?: string;
  };
}

export function redirectUriFor(requestUrl: URL): string {
  return `${requestUrl.origin}/api/auth/callback`;
}

export function authErrorRedirect(origin: string, code: string): string {
  return `${origin}/?auth_error=${encodeURIComponent(code)}`;
}
