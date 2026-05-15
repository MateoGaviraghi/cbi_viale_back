import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS = [
  'manageAppointments',
  'manageSubmissions',
  'manageConsents',
  'exportData',
  'editServices',
  'manageAvailability',
  'manageUsers',
  'viewAuditLog',
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const PERMISSIONS_KEY = 'permissions'

/**
 * @Permissions('manageAppointments') — restringe por permiso granular.
 * ADMIN siempre pasa. EMPLOYEE pasa si User.permissions[perm] === true.
 */
export const Permissions = (...perms: Permission[]) => SetMetadata(PERMISSIONS_KEY, perms)
