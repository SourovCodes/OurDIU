import type {
  AdminRoutineCourse,
  AdminRoutineTeacher,
  RoutineDepartment,
  RoutineTeacherInput,
} from "@ourdiu/shared";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { routineCourses, routineTeachers } from "../../db/schema";

// A department's course titles and teachers, kept across versions for admins to fill
// in: DIU's PDFs have no titles, and CSE's no teachers' names. Listed are the codes
// and initials in any of the department's versions, and any added by hand.

/**
 * Every course of a department: those in its versions and those with a title, with
 * how many sections take it in the live version.
 */
export async function listRoutineCourses(
  db: Database,
  department: RoutineDepartment,
  code?: string,
): Promise<AdminRoutineCourse[]> {
  const rows = await db.all<{
    code: string;
    title: string | null;
    liveSections: number;
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
      join routine_versions v on v.id = c.version_id
      where v.department = ${department} and v.status = 'live'
      group by c.course
    )
    select codes.code as code, rc.title as title,
      coalesce(live.sections, 0) as liveSections
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
  const rows = await db.all<Omit<AdminRoutineTeacher, "department">>(sql`
    with initials as (
      select distinct c.teacher as initials from routine_classes c
      join routine_versions v on v.id = c.version_id
      where v.department = ${department} and c.teacher is not null
      union
      select initials from routine_teachers where department = ${department}
    ),
    live as (
      select c.teacher as initials, count(*) as classes
      from routine_classes c
      join routine_versions v on v.id = c.version_id
      where v.department = ${department} and v.status = 'live'
      group by c.teacher
    )
    select initials.initials as initials, t.name as name, t.phone as phone,
      t.email as email, t.room as room, coalesce(live.classes, 0) as liveClasses
    from initials
    left join routine_teachers t
      on t.department = ${department} and t.initials = initials.initials
    left join live on live.initials = initials.initials
    ${initials === undefined ? sql`` : sql`where initials.initials = ${initials}`}
    order by initials.initials`);
  return rows.map((r) => ({ department, ...r }));
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
