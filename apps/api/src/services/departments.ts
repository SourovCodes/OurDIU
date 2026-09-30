import type {
  AdminDepartment,
  AdminDepartmentList,
  DepartmentInput,
} from "@ourdiu/shared";
import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { departments } from "../db/schema";
import { isConstraintError } from "../lib/db-errors";
import { AppError } from "../lib/errors";

const columns = {
  id: departments.id,
  shortName: departments.shortName,
  name: departments.name,
};

/** A department by its short name (any case), or a 404. */
export async function findDepartment(db: Database, shortName: string) {
  const [row] = await db
    .select()
    .from(departments)
    .where(eq(departments.shortName, shortName.toUpperCase()));
  if (!row) {
    throw new AppError(
      404,
      "NOT_FOUND",
      `There is no department ${shortName.toUpperCase()}`,
    );
  }
  return row;
}

export async function listAdminDepartments(
  db: Database,
): Promise<AdminDepartmentList> {
  const items = await db
    .select(columns)
    .from(departments)
    .orderBy(asc(departments.shortName));
  return { items };
}

const taken = (shortName: string) =>
  new AppError(409, "CONFLICT", `There already is a department ${shortName}`);

export async function createDepartment(
  db: Database,
  input: DepartmentInput,
): Promise<AdminDepartment> {
  try {
    const [row] = await db.insert(departments).values(input).returning(columns);
    return row!;
  } catch (err) {
    if (isConstraintError(err, "UNIQUE")) throw taken(input.shortName);
    throw err;
  }
}

export async function updateDepartment(
  db: Database,
  id: number,
  input: DepartmentInput,
): Promise<AdminDepartment> {
  let row: AdminDepartment | undefined;
  try {
    [row] = await db
      .update(departments)
      .set(input)
      .where(eq(departments.id, id))
      .returning(columns);
  } catch (err) {
    if (isConstraintError(err, "UNIQUE")) throw taken(input.shortName);
    throw err;
  }
  if (!row) throw new AppError(404, "NOT_FOUND", "Department not found");
  return row;
}

export async function deleteDepartment(db: Database, id: number) {
  const deleted = await db
    .delete(departments)
    .where(eq(departments.id, id))
    .returning({ id: departments.id });
  if (deleted.length === 0) {
    throw new AppError(404, "NOT_FOUND", "Department not found");
  }
}
