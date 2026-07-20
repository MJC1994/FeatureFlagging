import type { Environment, Role } from './types';

export function canManageUsers(role: Role): boolean {
  return role === 'Owner';
}

export function canDeleteFlag(role: Role): boolean {
  return role === 'Owner';
}

export function canCreateFlag(role: Role): boolean {
  return role === 'Developer' || role === 'Admin' || role === 'Owner';
}

export function canEditFlagMeta(role: Role): boolean {
  return role === 'Developer' || role === 'Admin' || role === 'Owner';
}

export function canEditStage(role: Role): boolean {
  return role === 'Developer' || role === 'Admin' || role === 'Owner';
}

export function canEditProduction(role: Role): boolean {
  return role === 'Admin' || role === 'Owner';
}

export function canRevert(role: Role): boolean {
  return role === 'Owner';
}

export function canChangeStatus(role: Role): boolean {
  return role === 'Developer' || role === 'Admin' || role === 'Owner';
}

export function canEditEnvironment(role: Role, environment: Environment): boolean {
  return environment === 'Stage'
    ? canEditStage(role)
    : canEditProduction(role);
}
