import { z } from "zod";
import { USER_ROLES } from "../constants";
import { paginatedSchema, paginationQuerySchema } from "./common";

// Contracts for the platform-wide admin pages (/api/v1/admin/*). Unlike public
// responses, these include users' email addresses.

export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

/** A user as admins see them, with their email address. */
export const adminUserRefSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
});
export type AdminUserRef = z.infer<typeof adminUserRefSchema>;

export const adminUserSchema = adminUserRefSchema.extend({
  role: userRoleSchema,
  createdAt: z.iso.datetime(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const listAdminUsersQuerySchema = paginationQuerySchema.extend({
  /** Matches name, username or email, ignoring case. */
  q: z.string().trim().max(100).optional(),
  role: userRoleSchema.optional(),
});
export type ListAdminUsersQuery = z.infer<typeof listAdminUsersQuerySchema>;

export const adminUserListSchema = paginatedSchema(adminUserSchema);
export type AdminUserList = z.infer<typeof adminUserListSchema>;

export const updateUserRoleInputSchema = z.object({ role: userRoleSchema });
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleInputSchema>;

// ── Departments (shared by every product) ────────────────────────────────────

export const departmentShortNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2,10}$/, "Use 2–10 letters, e.g. CSE")
  .transform((value) => value.toUpperCase());

export const departmentInputSchema = z.object({
  shortName: departmentShortNameSchema,
  name: z.string().trim().min(2).max(120),
});
export type DepartmentInput = z.infer<typeof departmentInputSchema>;

export const adminDepartmentSchema = z.object({
  id: z.number().int(),
  shortName: z.string(),
  name: z.string(),
});
export type AdminDepartment = z.infer<typeof adminDepartmentSchema>;

export const adminDepartmentListSchema = z.object({
  items: z.array(adminDepartmentSchema),
});
export type AdminDepartmentList = z.infer<typeof adminDepartmentListSchema>;
