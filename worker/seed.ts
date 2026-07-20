import apiExample from './data/apiExample.json';
import { isAllowedEmail } from './auth';
import { BRANDS, ENVIRONMENTS } from './types';
import type { Role } from './types';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';
const ADMIN_ID = '00000000-0000-4000-8000-000000000002';
const DEV_ID = '00000000-0000-4000-8000-000000000003';

function emptyBrandConfig() {
  return {
    apiTimeoutInMilliseconds: 30000,
    apiJPJourneyPlanTimeoutInMilliseconds: 30000,
    documents: {
      accessibleDocumentLeafletPdfUrl: '',
      accessibleDocumentLeafletPdfEasyReadUrl: '',
      accessibleDocumentPolicyPdfUrl: '',
      accessibleDocumentPolicyPdfEasyReadUrl: '',
      accessibleDocumentRollingStockUrl: '',
      accessibleWordLargePrintAudioUrl: '',
      magazine: {
        description: '',
        imageUrl: '',
        srTitle: '',
        title: '',
        url: '',
      },
      prioritySeatMoreInfoUrl: '',
    },
    webchat: { url: '' },
    smartcard: { warningAtScanning: '' },
    bestFareFinder: {
      defaultNumberOfResults: 4,
      defaultNLC: '',
    },
  };
}

function featureKeyToDescription(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function featureKeyToTags(key: string): string[] {
  const k = key.toLowerCase();
  const tags: string[] = [];
  if (
    /paypal|applepay|googlepay|payment|braintree|pay360|cardpayment/.test(k)
  ) {
    tags.push('payments');
  }
  if (/refund/.test(k)) tags.push('refunds');
  if (/railcard|promo|discount|evoucher/.test(k)) tags.push('discounts');
  if (
    /assist|priority|sunflower|jamscheme|accessible|passengerassist/.test(k)
  ) {
    tags.push('accessibility');
  }
  if (
    /smartcard|keygo|sticket|eticket|itso|ticket|wallet|collection/.test(k)
  ) {
    tags.push('tickets');
  }
  if (/webchat|message|airship|notification/.test(k)) tags.push('messaging');
  if (/widget/.test(k)) tags.push('widgets');
  if (/localescape/.test(k)) tags.push('local-escapes');
  if (/reservation|seat|bike/.test(k)) tags.push('reservations');
  if (/delayrepay|charity|carbon/.test(k)) tags.push('delay-repay');
  if (/magazine|rating|reward|route/.test(k)) tags.push('engagement');
  if (/station|parking|calling|homework/.test(k)) tags.push('stations');
  if (tags.length === 0) tags.push('general');
  return tags;
}

export async function ensureSeeded(
  db: D1Database,
  bootstrapOwnerEmail?: string,
): Promise<void> {
  const existing = await db
    .prepare('SELECT COUNT(*) AS count FROM users')
    .first<{ count: number }>();
  if (existing && existing.count > 0) {
    await upsertBootstrapOwner(db, bootstrapOwnerEmail);
    return;
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];

  const seedUsers: { id: string; email: string; role: Role }[] = [
    { id: OWNER_ID, email: 'owner@ontrackretail.co.uk', role: 'Owner' },
    { id: ADMIN_ID, email: 'admin@ontrackretail.co.uk', role: 'Admin' },
    { id: DEV_ID, email: 'dev@ontrackretail.co.uk', role: 'Developer' },
  ];

  for (const user of seedUsers) {
    statements.push(
      db
        .prepare('INSERT INTO users (id, email, role) VALUES (?, ?, ?)')
        .bind(user.id, user.email, user.role),
    );
  }

  for (const brand of BRANDS) {
    for (const environment of ENVIRONMENTS) {
      const isSeededStage =
        brand === 'Southeastern' && environment === 'Stage';
      const config = isSeededStage
        ? apiExample.config
        : emptyBrandConfig();
      const warnings = isSeededStage ? apiExample.warnings : [];
      statements.push(
        db
          .prepare(
            `INSERT INTO brand_configs (brand, environment, config_json, warnings_json)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(
            brand,
            environment,
            JSON.stringify(config),
            JSON.stringify(warnings),
          ),
      );
    }
  }

  const features = Object.entries(apiExample.features).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [name, enabled] of features) {
    const flagId = crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `INSERT INTO flags (id, name, description, tags_json, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'Active', ?, ?)`,
        )
        .bind(
          flagId,
          name,
          featureKeyToDescription(name),
          JSON.stringify(featureKeyToTags(name)),
          now,
          now,
        ),
    );

    for (const brand of BRANDS) {
      for (const environment of ENVIRONMENTS) {
        const on =
          brand === 'Southeastern' &&
          environment === 'Stage' &&
          Boolean(enabled);
        statements.push(
          db
            .prepare(
              `INSERT INTO flag_states (flag_id, brand, environment, enabled)
               VALUES (?, ?, ?, ?)`,
            )
            .bind(flagId, brand, environment, on ? 1 : 0),
        );
      }
    }
  }

  statements.push(
    db
      .prepare(
        `INSERT INTO audit_log (
          id, timestamp, user_id, user_email, action, summary,
          brand, environment, after_val
        ) VALUES (?, ?, ?, ?, 'flag_create', ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        now,
        OWNER_ID,
        'owner@ontrackretail.co.uk',
        `Seeded ${features.length} features from Southeastern Stage API example`,
        'Southeastern',
        'Stage',
        `${features.length} flags`,
      ),
  );

  // D1 batch limit is 100 statements per batch
  const CHUNK = 80;
  for (let i = 0; i < statements.length; i += CHUNK) {
    await db.batch(statements.slice(i, i + CHUNK));
  }

  await upsertBootstrapOwner(db, bootstrapOwnerEmail);
}

async function upsertBootstrapOwner(
  db: D1Database,
  email: string | undefined,
): Promise<void> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !isAllowedEmail(normalized)) return;

  const existing = await db
    .prepare('SELECT id FROM users WHERE lower(email) = ?')
    .bind(normalized)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare("UPDATE users SET role = 'Owner' WHERE id = ?")
      .bind(existing.id)
      .run();
    return;
  }

  await db
    .prepare('INSERT INTO users (id, email, role) VALUES (?, ?, ?)')
    .bind(crypto.randomUUID(), normalized, 'Owner')
    .run();
}

export { OWNER_ID };
