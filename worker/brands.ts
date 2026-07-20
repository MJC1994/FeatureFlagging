import { BRANDS } from './types';
import type { Brand, Environment } from './types';

export type BrandApiPayload = {
  config: unknown;
  features: Record<string, boolean>;
  warnings: string[];
};

export function brandToSlug(brand: Brand): string {
  return brand.toLowerCase().replace(/\s+/g, '-');
}

export function parseBrandParam(value: string): Brand | null {
  const raw = decodeURIComponent(value).trim();
  const direct = BRANDS.find((b) => b.toLowerCase() === raw.toLowerCase());
  if (direct) return direct;

  const slug = raw.toLowerCase().replace(/\s+/g, '-');
  const fromSlug = BRANDS.find((b) => brandToSlug(b) === slug);
  return fromSlug ?? null;
}

export function parseEnvironmentParam(value: string): Environment | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'stage') return 'Stage';
  if (normalized === 'production' || normalized === 'prod') return 'Production';
  return null;
}

export async function loadBrandPayload(
  db: D1Database,
  brand: Brand,
  environment: Environment,
): Promise<BrandApiPayload | null> {
  const configRow = await db
    .prepare(
      `SELECT config_json, warnings_json FROM brand_configs
       WHERE brand = ? AND environment = ?`,
    )
    .bind(brand, environment)
    .first<{ config_json: string; warnings_json: string }>();

  if (!configRow) return null;

  const flagRows = await db
    .prepare(
      `SELECT f.name AS name, fs.enabled AS enabled
       FROM flags f
       INNER JOIN flag_states fs ON fs.flag_id = f.id
       WHERE fs.brand = ? AND fs.environment = ?
       ORDER BY f.name`,
    )
    .bind(brand, environment)
    .all<{ name: string; enabled: number }>();

  const features: Record<string, boolean> = {};
  for (const row of flagRows.results ?? []) {
    features[row.name] = row.enabled === 1;
  }

  return {
    config: JSON.parse(configRow.config_json),
    features,
    warnings: JSON.parse(configRow.warnings_json) as string[],
  };
}
