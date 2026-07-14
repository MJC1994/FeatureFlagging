import type { Role } from './types';

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

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  flag_create: 'Flag created',
  flag_edit: 'Flag edited',
  flag_delete: 'Flag deleted',
  flag_status: 'Status changed',
  flag_toggle: 'Flag toggled',
  config_update: 'Config updated',
  config_revert: 'Config reverted',
  user_add: 'User added',
  user_role_change: 'Role changed',
  user_remove: 'User removed',
};
