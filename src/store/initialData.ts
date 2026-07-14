import { v4 as uuid } from 'uuid';
import { BRANDS } from '../types';
import type {
  AppState,
  Brand,
  BrandConfigs,
  Environment,
  FeatureFlag,
  FlagStates,
  User,
} from '../types';
import {
  EXAMPLE_PAYLOAD,
  cloneConfig,
  emptyBrandConfig,
  featureKeyToDescription,
  featureKeyToTags,
} from '../configDefaults';

export function emptyStates(): FlagStates {
  const states = {} as FlagStates;
  for (const brand of BRANDS) {
    states[brand] = { Stage: false, Production: false };
  }
  return states;
}

function makeFlag(
  name: string,
  description: string,
  tags: string[],
  overrides?: Partial<Record<Brand, Partial<Record<Environment, boolean>>>>,
): FeatureFlag {
  const now = new Date().toISOString();
  const states = emptyStates();
  if (overrides) {
    for (const brand of Object.keys(overrides) as Brand[]) {
      for (const env of Object.keys(overrides[brand]!) as Environment[]) {
        states[brand][env] = overrides[brand]![env]!;
      }
    }
  }
  return {
    id: uuid(),
    name,
    description,
    tags,
    status: 'Active',
    states,
    createdAt: now,
    updatedAt: now,
  };
}

function seedConfigs(): BrandConfigs {
  const configs = {} as BrandConfigs;
  for (const brand of BRANDS) {
    configs[brand] = {
      Stage: {
        config: emptyBrandConfig(),
        warnings: [],
      },
      Production: {
        config: emptyBrandConfig(),
        warnings: [],
      },
    };
  }

  // Seed Southeastern Stage from the real API example
  configs.Southeastern.Stage = {
    config: cloneConfig(EXAMPLE_PAYLOAD.config),
    warnings: [...EXAMPLE_PAYLOAD.warnings],
  };

  return configs;
}

function seedFlagsFromApiFeatures(): FeatureFlag[] {
  return Object.entries(EXAMPLE_PAYLOAD.features)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, enabled]) =>
      makeFlag(name, featureKeyToDescription(name), featureKeyToTags(name), {
        Southeastern: { Stage: enabled, Production: false },
      }),
    );
}

export function createInitialState(): AppState {
  const owner: User = {
    id: uuid(),
    email: 'owner@example.com',
    role: 'Owner',
  };
  const admin: User = {
    id: uuid(),
    email: 'admin@example.com',
    role: 'Admin',
  };
  const developer: User = {
    id: uuid(),
    email: 'dev@example.com',
    role: 'Developer',
  };

  const flags = seedFlagsFromApiFeatures();

  return {
    currentUserId: owner.id,
    users: [owner, admin, developer],
    flags,
    configs: seedConfigs(),
    auditLog: [
      {
        id: uuid(),
        timestamp: new Date().toISOString(),
        userId: owner.id,
        userEmail: owner.email,
        action: 'flag_create',
        summary: `Seeded ${flags.length} features from Southeastern Stage API example`,
        brand: 'Southeastern',
        environment: 'Stage',
        after: `${flags.length} flags`,
      },
    ],
    history: [],
    pendingChanges: [],
  };
}

export const STORAGE_KEY = 'flagdeck-state-v2';
