export const BRANDS = [
  'Southeastern',
  'Transpennine',
  'Southern',
  'Gatwick',
  'Great Northern',
  'Thameslink',
  'Ticketyboo',
] as const;

export type Brand = (typeof BRANDS)[number];

export const ENVIRONMENTS = ['Stage', 'Production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const ROLES = ['Developer', 'Admin', 'Owner'] as const;
export type Role = (typeof ROLES)[number];

export type FlagStatus = 'Active' | 'Deprecated';

export type AuditActionType =
  | 'flag_create'
  | 'flag_edit'
  | 'flag_delete'
  | 'flag_status'
  | 'flag_toggle'
  | 'config_update'
  | 'config_revert'
  | 'user_add'
  | 'user_role_change'
  | 'user_remove';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export type FlagStates = Record<Brand, Record<Environment, boolean>>;

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  tags: string[];
  status: FlagStatus;
  states: FlagStates;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: AuditActionType;
  summary: string;
  brand?: Brand;
  environment?: Environment;
  flagId?: string;
  flagName?: string;
  before?: string;
  after?: string;
}

export interface BrandSnapshot {
  id: string;
  brand: Brand;
  timestamp: string;
  userId: string;
  userEmail: string;
  label: string;
  states: Record<string, Record<Environment, boolean>>;
}

export interface PendingChange {
  id: string;
  flagId: string;
  flagName: string;
  brand: Brand;
  environment: Environment;
  before: boolean;
  after: boolean;
}

export interface BrandConfigPayload {
  config: unknown;
  warnings: string[];
}

export type BrandConfigs = Record<
  Brand,
  Record<Environment, BrandConfigPayload>
>;

export interface AppState {
  users: User[];
  flags: FeatureFlag[];
  configs: BrandConfigs;
  auditLog: AuditEntry[];
  history: BrandSnapshot[];
}
