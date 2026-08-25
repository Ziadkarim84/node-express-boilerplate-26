// Roles, scopes and permissions are owned by the central identity service.
// roleIdByKey mirrors shopup-lite — keep in sync with the identity role table.
export type RoleKey =
  | 'SYSADMIN'
  | 'ROLE_MANAGER'
  | 'SOFTWARE_ENGINEER'
  | 'QA_ENGINEER'
  | 'DATA_ANALYST'
  | 'PA_OFFLINE'
  | 'PA_ONLINE'
  | 'FIELD_AGENT'
  | 'CALL_AGENT'
  | 'INVENTORY_SUPERVISOR'
  | 'ELOAN_SUPERVISOR';

export const roleIdByKey: { [key in RoleKey]: number } = {
  SYSADMIN: 1,
  ROLE_MANAGER: 2,
  SOFTWARE_ENGINEER: 3,
  DATA_ANALYST: 4,
  PA_OFFLINE: 5,
  PA_ONLINE: 6,
  FIELD_AGENT: 7,
  CALL_AGENT: 8,
  INVENTORY_SUPERVISOR: 9,
  ELOAN_SUPERVISOR: 10,
  QA_ENGINEER: 11,
};

// The principal attached to req.user — same shape as the identity JWT claims.
// `permissions` exists on JWTs only; bearer permission checks hit the service.
export type SessionUser = {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  roleIds: number[];
  scopeIds: string[] | null;
  permissions?: string[];
};
