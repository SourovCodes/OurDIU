import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  adminDepartmentListSchema,
  adminDepartmentSchema,
  adminUserListSchema,
  adminUserSchema,
  departmentInputSchema,
  idQuerySchema,
  listAdminUsersQuerySchema,
  updateUserRoleInputSchema,
} from "@ourdiu/shared";
import { validationHook } from "../lib/errors";
import { errorResponse, jsonResponse } from "../lib/openapi";
import { requireAdmin } from "../middleware/require-admin";
import {
  createDepartment,
  deleteDepartment,
  listAdminDepartments,
  updateDepartment,
} from "../services/departments";
import { listAdminUsers, updateUserRole } from "../services/users";
import type { AppEnv } from "../types";

// Platform-wide admin routes: users and departments. Products will add their own
// admin routes next to these.

export const middleware = requireAdmin;
export const denied = {
  401: errorResponse("Not signed in"),
  403: errorResponse("Not an admin"),
};

export function jsonBody<T extends z.ZodType>(schema: T) {
  return {
    body: { required: true, content: { "application/json": { schema } } },
  };
}

// ── Users ────────────────────────────────────────────────────────────────────

const userTags = ["Admin: users"];

const listUsersRoute = createRoute({
  method: "get",
  path: "/users",
  tags: userTags,
  summary: "List users, newest first",
  middleware,
  request: { query: listAdminUsersQuerySchema },
  responses: {
    200: jsonResponse(adminUserListSchema, "Users"),
    ...denied,
    422: errorResponse("Invalid query"),
  },
});

const updateUserRoleRoute = createRoute({
  method: "patch",
  path: "/users/{id}",
  tags: userTags,
  summary: "Grant or remove admin rights",
  middleware,
  request: {
    params: z.object({ id: z.string().min(1) }),
    ...jsonBody(updateUserRoleInputSchema),
  },
  responses: {
    200: jsonResponse(adminUserSchema, "Updated user"),
    ...denied,
    404: errorResponse("User not found"),
    409: errorResponse("Admins can't change their own role"),
    422: errorResponse("Invalid role"),
  },
});

// ── Departments ──────────────────────────────────────────────────────────────

const departmentTags = ["Admin: departments"];
const idParams = z.object({ id: idQuerySchema });

const listDepartmentsRoute = createRoute({
  method: "get",
  path: "/departments",
  tags: departmentTags,
  summary: "List departments",
  middleware,
  responses: {
    200: jsonResponse(adminDepartmentListSchema, "Departments"),
    ...denied,
  },
});

const createDepartmentRoute = createRoute({
  method: "post",
  path: "/departments",
  tags: departmentTags,
  summary: "Add a department",
  middleware,
  request: jsonBody(departmentInputSchema),
  responses: {
    201: jsonResponse(adminDepartmentSchema, "Added"),
    ...denied,
    409: errorResponse("The short name is taken"),
    422: errorResponse("Invalid department"),
  },
});

const updateDepartmentRoute = createRoute({
  method: "put",
  path: "/departments/{id}",
  tags: departmentTags,
  summary: "Rename a department",
  middleware,
  request: { params: idParams, ...jsonBody(departmentInputSchema) },
  responses: {
    200: jsonResponse(adminDepartmentSchema, "Updated"),
    ...denied,
    404: errorResponse("Department not found"),
    409: errorResponse("The short name is taken"),
    422: errorResponse("Invalid department"),
  },
});

const deleteDepartmentRoute = createRoute({
  method: "delete",
  path: "/departments/{id}",
  tags: departmentTags,
  summary: "Delete a department",
  middleware,
  request: { params: idParams },
  responses: {
    204: { description: "Deleted" },
    ...denied,
    404: errorResponse("Department not found"),
  },
});

export const adminRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
})
  .openapi(listUsersRoute, async (c) =>
    c.json(await listAdminUsers(c.var.db, c.req.valid("query")), 200),
  )
  .openapi(updateUserRoleRoute, async (c) =>
    c.json(
      await updateUserRole(
        c.var.db,
        c.var.session!.user.id,
        c.req.valid("param").id,
        c.req.valid("json").role,
      ),
      200,
    ),
  )
  .openapi(listDepartmentsRoute, async (c) =>
    c.json(await listAdminDepartments(c.var.db), 200),
  )
  .openapi(createDepartmentRoute, async (c) => {
    return c.json(await createDepartment(c.var.db, c.req.valid("json")), 201);
  })
  .openapi(updateDepartmentRoute, async (c) => {
    return c.json(
      await updateDepartment(
        c.var.db,
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(deleteDepartmentRoute, async (c) => {
    await deleteDepartment(c.var.db, c.req.valid("param").id);
    return c.body(null, 204);
  });
