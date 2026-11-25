export const STAFF_ROLES = ["admin", "editor", "viewer"] as const;
export const ALL_USER_ROLES = ["user", "viewer", "editor", "admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type UserRole = (typeof ALL_USER_ROLES)[number];

export type AdminPermission =
  | "analytics:read"
  | "users:read"
  | "users:create"
  | "users:block"
  | "users:billing"
  | "users:delete"
  | "notifications:read"
  | "notifications:write"
  | "notifications:purge"
  | "staff:read"
  | "staff:manage";

const ALL_ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  "analytics:read",
  "users:read",
  "users:create",
  "users:block",
  "users:billing",
  "users:delete",
  "notifications:read",
  "notifications:write",
  "notifications:purge",
  "staff:read",
  "staff:manage",
];

/**
 * Industry-standard capability matrix:
 * - admin: Full control (users, billing, deletion, bulk purge, staff management)
 * - editor: Day-to-day moderation & content ops (add/block users, notifications, read-only staff list)
 * - viewer: Read-only analyst (analytics, accounts, notifications; no staff directory or mutations)
 * - user: Regular teacher/end-user (no admin dashboard access)
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly AdminPermission[]> = {
  admin: ALL_ADMIN_PERMISSIONS,
  editor: [
    "analytics:read",
    "users:read",
    "users:create",
    "users:block",
    "notifications:read",
    "notifications:write",
    "staff:read",
  ],
  viewer: [
    "analytics:read",
    "users:read",
    "notifications:read",
  ],
  user: [],
};

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return Boolean(role && (STAFF_ROLES as readonly string[]).includes(role));
}

export function isValidUserRole(role: string | null | undefined): role is UserRole {
  return Boolean(role && (ALL_USER_ROLES as readonly string[]).includes(role));
}

export function hasPermission(
  role: string | null | undefined,
  permission: AdminPermission
): boolean {
  if (!isValidUserRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
