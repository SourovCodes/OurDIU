import type {
  AdminRoutineCourse,
  AdminRoutineCourseList,
  AdminRoutineTeacher,
  AdminRoutineTeacherList,
  RoutineDepartment,
  RoutineTeacherInput,
} from "@ourdiu/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { routineCourses, routineTeachers } from "../../db/schema";

// A department's course titles and teachers, kept across versions for admins to fill
// in: DIU's PDFs have no titles, and CSE's no teachers' names. Listed are the codes
// and initials in any of the department's versions, and any added by hand.

/**
 * The version the lists count in: the department's live one, else its newest. Its
 * id as a subquery.
 */
const currentVersion = (department: RoutineDepartment) => sql`
  select id from routine_versions where department = ${department}
  order by status = 'live' desc, created_at desc, id desc limit 1`;

/** The current version's number, if there's one. */
async function currentVersionNumber(
  db: Database,
  department: RoutineDepartment,
) {
  const [row] = await db.all<{ version: string }>(
    sql`select version from routine_versions where id = (${currentVersion(department)})`,
  );
  return row?.version ?? null;
}

/**
 * Every course of a department: those in its versions and those with a title, with
 * how many sections take it in the current version.
 */
export async function listRoutineCourses(
  db: Database,
  department: RoutineDepartment,
  code?: string,
): Promise<AdminRoutineCourse[]> {
  const rows = await db.all<{
    code: string;
    title: string | null;
    sections: number;
  }>(sql`
    with codes as (
      select distinct c.course as code from routine_classes c
      join routine_versions v on v.id = c.version_id
      where v.department = ${department}
      union
      select code from routine_courses where department = ${department}
    ),
    live as (
      select c.course as code, count(distinct c.section) as sections
      from routine_classes c
      where c.version_id = (${currentVersion(department)})
      group by c.course
    )
    select codes.code as code, rc.title as title,
      coalesce(live.sections, 0) as sections
    from codes
    left join routine_courses rc
      on rc.department = ${department} and rc.code = codes.code
    left join live on live.code = codes.code
    ${code === undefined ? sql`` : sql`where codes.code = ${code}`}
    order by codes.code`);
  return rows.map((r) => ({ department, ...r }));
}

export async function setRoutineCourseTitle(
  db: Database,
  department: RoutineDepartment,
  code: string,
  title: string,
): Promise<AdminRoutineCourse> {
  await db
    .insert(routineCourses)
    .values({ department, code, title })
    .onConflictDoUpdate({
      target: [routineCourses.department, routineCourses.code],
      set: { title, updatedAt: new Date() },
    });
  const [course] = await listRoutineCourses(db, department, code);
  return course!;
}

/** Takes a course's title away: students see its code again. */
export async function deleteRoutineCourseTitle(
  db: Database,
  department: RoutineDepartment,
  code: string,
) {
  await db
    .delete(routineCourses)
    .where(
      and(
        eq(routineCourses.department, department),
        eq(routineCourses.code, code),
      ),
    );
}

/**
 * Every teacher of a department: those teaching in its versions and those added by
 * hand, with their classes a week in the live version.
 */
export async function listRoutineTeachers(
  db: Database,
  department: RoutineDepartment,
  initials?: string,
): Promise<AdminRoutineTeacher[]> {
  const rows = await db.all<
    Omit<AdminRoutineTeacher, "department" | "courses"> & {
      courses: string | null;
    }
  >(sql`
    with initials as (
      select distinct c.teacher as initials from routine_classes c
      join routine_versions v on v.id = c.version_id
      where v.department = ${department} and c.teacher is not null
      union
      select initials from routine_teachers where department = ${department}
    ),
    live as (
      select c.teacher as initials, count(*) as classes,
        group_concat(distinct c.course) as courses
      from routine_classes c
      where c.version_id = (${currentVersion(department)})
      group by c.teacher
    )
    select initials.initials as initials, t.name as name, t.designation as designation, t.phone as phone,
      t.email as email, t.room as room, coalesce(live.classes, 0) as classes,
      live.courses as courses
    from initials
    left join routine_teachers t
      on t.department = ${department} and t.initials = initials.initials
    left join live on live.initials = initials.initials
    ${initials === undefined ? sql`` : sql`where initials.initials = ${initials}`}
    order by initials.initials`);
  return rows.map((r) => ({
    department,
    ...r,
    courses: r.courses ? r.courses.split(",").sort() : [],
  }));
}

/** Sets everything about a teacher; what's left out is cleared. */
export async function setRoutineTeacher(
  db: Database,
  department: RoutineDepartment,
  initials: string,
  input: RoutineTeacherInput,
): Promise<AdminRoutineTeacher> {
  const values = {
    name: input.name,
    designation: input.designation ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    room: input.room ?? null,
  };
  await db
    .insert(routineTeachers)
    .values({ department, initials, ...values })
    .onConflictDoUpdate({
      target: [routineTeachers.department, routineTeachers.initials],
      set: { ...values, updatedAt: new Date() },
    });
  const [teacher] = await listRoutineTeachers(db, department, initials);
  return teacher!;
}

/** Forgets a teacher's details: students see the initials only. */
export async function deleteRoutineTeacher(
  db: Database,
  department: RoutineDepartment,
  initials: string,
) {
  await db
    .delete(routineTeachers)
    .where(
      and(
        eq(routineTeachers.department, department),
        eq(routineTeachers.initials, initials),
      ),
    );
}

/** What the admin lists are asked for: a page, maybe searched or only missing ones. */
type ListQuery = {
  department: RoutineDepartment;
  page: number;
  pageSize: number;
  q?: string;
  missing?: "true" | "false";
};

function pageOf<T>(items: T[], { page, pageSize }: ListQuery) {
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: items.length,
  };
}

const matches = (q: string | undefined, ...texts: (string | null)[]) =>
  !q || texts.some((t) => t?.toLowerCase().includes(q.toLowerCase()));

/** A page of a department's courses, by code. */
export async function pageRoutineCourses(
  db: Database,
  query: ListQuery,
): Promise<AdminRoutineCourseList> {
  const all = await listRoutineCourses(db, query.department);
  const shown = all.filter(
    (c) =>
      matches(query.q, c.code, c.title) &&
      (query.missing !== "true" || !c.title),
  );
  return {
    ...pageOf(shown, query),
    all: all.length,
    titled: all.filter((c) => c.title).length,
    version: await currentVersionNumber(db, query.department),
  };
}

/** A page of a department's teachers, by initials. */
export async function pageRoutineTeachers(
  db: Database,
  query: ListQuery,
): Promise<AdminRoutineTeacherList> {
  const all = await listRoutineTeachers(db, query.department);
  const shown = all.filter(
    (t) =>
      matches(
        query.q,
        t.initials,
        t.name,
        t.designation,
        t.room,
        t.email,
        t.phone,
        ...t.courses,
      ) &&
      (query.missing !== "true" || !t.name),
  );
  return {
    ...pageOf(shown, query),
    all: all.length,
    named: all.filter((t) => t.name).length,
    version: await currentVersionNumber(db, query.department),
  };
}

/** D1 binds at most 100 values a query. */
const CHUNK = 90;

function chunks<T>(items: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    out.push(items.slice(i, i + CHUNK));
  }
  return out;
}

/** Takes several courses' titles away; returns how many had one. */
export async function removeRoutineCourseTitles(
  db: Database,
  department: RoutineDepartment,
  codes: string[],
) {
  let removed = 0;
  for (const part of chunks([...new Set(codes)])) {
    const rows = await db
      .delete(routineCourses)
      .where(
        and(
          eq(routineCourses.department, department),
          inArray(routineCourses.code, part),
        ),
      )
      .returning({ code: routineCourses.code });
    removed += rows.length;
  }
  return removed;
}

/** Forgets several teachers' details; returns how many had some. */
export async function removeRoutineTeachers(
  db: Database,
  department: RoutineDepartment,
  initials: string[],
) {
  let removed = 0;
  for (const part of chunks([...new Set(initials)])) {
    const rows = await db
      .delete(routineTeachers)
      .where(
        and(
          eq(routineTeachers.department, department),
          inArray(routineTeachers.initials, part),
        ),
      )
      .returning({ initials: routineTeachers.initials });
    removed += rows.length;
  }
  return removed;
}
