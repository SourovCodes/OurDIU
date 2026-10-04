import { z } from "zod";
import {
  MAX_ROUTINE_CLASSES,
  ROUTINE_COURSE_CODE_PATTERN,
  ROUTINE_DAYS,
  ROUTINE_DEPARTMENT_SLUGS,
  ROUTINE_DEPARTMENTS,
  ROUTINE_FILE_FORMAT,
  ROUTINE_LAB_GROUP_PATTERN,
  ROUTINE_SECTION_PATTERN,
  ROUTINE_TEACHER_PATTERN,
  ROUTINE_VERSION_STATUSES,
  ROUTINE_WARNING_KINDS,
  routineMinutes,
} from "../constants";
import { nullableRef, paginatedSchema, paginationQuerySchema } from "./common";

// ── The routine file ─────────────────────────────────────────────────────────
// DIU publishes each department's routine as a PDF; an admin uploads it and OurDIU's
// reader for that department's layout turns it into this, checked before it's kept.
// A rule broken here means the PDF wasn't read right (its layout changed).

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  error: 'Use 24-hour time with two digits, e.g. "08:30" or "13:00"',
});

export const routineDaySchema = z
  .enum(ROUTINE_DAYS, { error: `Use one of ${ROUTINE_DAYS.join(", ")}` })
  .meta({ id: "RoutineDay" });
export type RoutineDay = z.infer<typeof routineDaySchema>;

export const routineDepartmentSchema = z
  .enum(ROUTINE_DEPARTMENTS, {
    error: `Only ${ROUTINE_DEPARTMENTS.join(", ")} has a routine for now`,
  })
  .meta({ id: "RoutineDepartment" });
export type RoutineDepartment = z.infer<typeof routineDepartmentSchema>;

const courseCodeSchema = z.string().regex(ROUTINE_COURSE_CODE_PATTERN, {
  error:
    'Use the course code as printed, in capitals: "CSE321", or EEE\'s "0713-121"',
});
const teacherInitialsSchema = z.string().regex(ROUTINE_TEACHER_PATTERN, {
  error: 'Use the teacher\'s initials as printed: "STA"',
});
const nameSchema = z.string().trim().min(1).max(120);

/** A routine's version as DIU numbers it: "4.1". */
const versionNumberSchema = z.string().regex(/^\d{1,3}(\.\d{1,3}){0,2}$/, {
  error: 'Use numbers and dots, like "4.1"',
});

/** A time slot of the routine: "13:00" to "14:30". */
export const routineSlotSchema = z
  .strictObject({ start: timeSchema, end: timeSchema })
  .meta({ id: "RoutineSlot" });

/** "lab" for a computer or other lab room. */
const roomTypeSchema = z.enum(["lab"]).meta({ id: "RoutineRoomType" });

export const routineFileClassSchema = z
  .strictObject({
    day: routineDaySchema,
    start: timeSchema,
    end: timeSchema,
    course: courseCodeSchema,
    section: z.string().regex(ROUTINE_SECTION_PATTERN, {
      error:
        'Use the section as printed: "67_B", "RE_A(3C)" for a retake, or EEE\'s "1-2 B"',
    }),
    /** The lab group that attends ("B1" for 67_B1 or 1-2 B1); absent when the whole section does. */
    labGroup: z
      .string()
      .regex(ROUTINE_LAB_GROUP_PATTERN, {
        error: 'Use the group as printed after the batch: "B1" for 67_B1',
      })
      .nullish(),
    room: z.string().trim().min(1).max(40),
    // Inline, not the named enum: an optional, nullable reference trips up the
    // Dart generator.
    roomType: z.enum(["lab"], { error: 'Use "lab" or leave it out' }).nullish(),
    teacher: teacherInitialsSchema.nullish(),
  })
  .meta({ id: "RoutineFileClass" });
export type RoutineFileClass = z.infer<typeof routineFileClassSchema>;

/** A routine version as read from DIU's PDF. */
export const routineFileSchema = z
  .strictObject({
    format: z.literal(ROUTINE_FILE_FORMAT, {
      error: `Set "format" to ${ROUTINE_FILE_FORMAT}`,
    }),
    department: routineDepartmentSchema,
    /** As printed on DIU's PDF: "4.1". */
    version: versionNumberSchema,
    /** When DIU published it. */
    publishedOn: z.iso
      .date({ error: 'Use a date like "2026-10-04"' })
      .nullish(),
    slots: z.array(routineSlotSchema).min(1).max(12),
    /** Teachers by initials, when the PDF lists them (EEE's does). */
    teachers: z
      .record(
        teacherInitialsSchema,
        z.strictObject({
          name: nameSchema,
          phone: z.string().max(40).nullish(),
          email: z.email().max(200).nullish(),
        }),
      )
      .optional(),
    classes: z.array(routineFileClassSchema).min(1).max(MAX_ROUTINE_CLASSES),
  })
  .superRefine((file, ctx) => {
    // Times that aren't "HH:MM" already have their own problem.
    const isTime = (t: unknown) =>
      typeof t === "string" && /^\d\d:\d\d$/.test(t);
    let previousEnd = -1;
    file.slots.forEach((slot, i) => {
      if (!isTime(slot.start) || !isTime(slot.end)) return;
      const start = routineMinutes(slot.start);
      const end = routineMinutes(slot.end);
      if (end <= start || start < previousEnd) {
        ctx.addIssue({
          code: "custom",
          path: ["slots", i],
          message: "Slots must be in order, each ending after it starts",
        });
      }
      previousEnd = end;
    });
    const starts = new Set(file.slots.map((s) => s.start));
    const ends = new Set(file.slots.map((s) => s.end));
    const startList = file.slots.map((s) => s.start).join(", ");
    const endList = file.slots.map((s) => s.end).join(", ");
    file.classes.forEach((c, i) => {
      if (!isTime(c.start) || !isTime(c.end)) return;
      if (!starts.has(c.start)) {
        ctx.addIssue({
          code: "custom",
          path: ["classes", i, "start"],
          message: `"${c.start}" isn't the start of a slot (${startList})`,
        });
      }
      if (!ends.has(c.end)) {
        ctx.addIssue({
          code: "custom",
          path: ["classes", i, "end"],
          message: `"${c.end}" isn't the end of a slot (${endList})`,
        });
      } else if (routineMinutes(c.end) <= routineMinutes(c.start)) {
        ctx.addIssue({
          code: "custom",
          path: ["classes", i, "end"],
          message: "A class must end after it starts",
        });
      }
    });
  })
  .meta({ id: "RoutineFile" });
export type RoutineFile = z.infer<typeof routineFileSchema>;

// ── Public reads (/api/v1/routine) ───────────────────────────────────────────

export const routineDepartmentParamSchema = z.object({
  department: z
    .enum(ROUTINE_DEPARTMENT_SLUGS)
    .meta({ id: "RoutineDepartmentSlug" }),
});

export const routineSectionParamsSchema = routineDepartmentParamSchema.extend({
  section: z.string().regex(ROUTINE_SECTION_PATTERN),
});

export const routinePdfQuerySchema = z.object({
  /** Only this lab group's labs; the whole section's otherwise. */
  group: z.string().regex(ROUTINE_LAB_GROUP_PATTERN).optional(),
});

/** The live version of a department's routine. */
export const routineVersionSchema = z
  .object({
    department: routineDepartmentSchema,
    version: z.string(),
    /** When DIU published it. */
    publishedOn: z.iso.date().nullable(),
    /** DIU's own PDF of it, if the file named it. */
    source: z.string().nullable(),
    /** When it was made live on OurDIU. */
    liveSince: z.iso.datetime(),
  })
  .meta({ id: "RoutineVersion" });
export type RoutineVersion = z.infer<typeof routineVersionSchema>;

export const routineSectionSummarySchema = z
  .object({
    section: z.string(),
    /** Its lab groups ("B1", "B2"), if it has any. */
    labGroups: z.array(z.string()),
    classCount: z.number().int(),
  })
  .meta({ id: "RoutineSectionSummary" });
export type RoutineSectionSummary = z.infer<typeof routineSectionSummarySchema>;

export const routineSectionListSchema = z
  .object({
    version: routineVersionSchema,
    sections: z.array(routineSectionSummarySchema),
  })
  .meta({ id: "RoutineSectionList" });
export type RoutineSectionList = z.infer<typeof routineSectionListSchema>;

export const routineCourseSchema = z
  .object({ code: z.string(), title: z.string().nullable() })
  .meta({ id: "RoutineCourse" });

export const routineTeacherSchema = z
  .object({
    initials: z.string(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    /** Where the teacher sits: "KT-712". */
    room: z.string().nullable(),
  })
  .meta({ id: "RoutineTeacher" });

export const routineClassSchema = z
  .object({
    day: routineDaySchema,
    /** 24-hour "HH:MM". */
    start: z.string(),
    end: z.string(),
    course: routineCourseSchema,
    /** The lab group that attends, or null when the whole section does. */
    labGroup: z.string().nullable(),
    room: z.string(),
    roomType: nullableRef(roomTypeSchema),
    teacher: nullableRef(routineTeacherSchema),
  })
  .meta({ id: "RoutineClass" });
export type RoutineClass = z.infer<typeof routineClassSchema>;

/** A section's week, in day and time order. */
export const routineSectionSchema = z
  .object({
    version: routineVersionSchema,
    section: z.string(),
    labGroups: z.array(z.string()),
    /** The routine's time slots, in order: the columns of a week. */
    slots: z.array(routineSlotSchema),
    classes: z.array(routineClassSchema),
  })
  .meta({ id: "RoutineSection" });
export type RoutineSection = z.infer<typeof routineSectionSchema>;

// ── Admin (/api/v1/admin/routine) ────────────────────────────────────────────

export const routineVersionStatusSchema = z
  .enum(ROUTINE_VERSION_STATUSES)
  .meta({ id: "RoutineVersionStatus" });
export type RoutineVersionStatus = z.infer<typeof routineVersionStatusSchema>;

export const routineWarningSchema = z
  .object({
    kind: z.enum(ROUTINE_WARNING_KINDS).meta({ id: "RoutineWarningKind" }),
    message: z.string(),
  })
  .meta({ id: "RoutineWarning" });
export type RoutineWarning = z.infer<typeof routineWarningSchema>;

export const adminRoutineVersionSchema = z
  .object({
    id: z.number().int(),
    department: routineDepartmentSchema,
    version: z.string(),
    publishedOn: z.iso.date().nullable(),
    source: z.string().nullable(),
    status: routineVersionStatusSchema,
    sectionCount: z.number().int(),
    classCount: z.number().int(),
    warningCount: z.number().int(),
    uploadedBy: nullableRef(
      z.object({ name: z.string() }).meta({ id: "AdminRoutineUploader" }),
    ),
    createdAt: z.iso.datetime(),
    /** When it was last made live. */
    liveAt: z.iso.datetime().nullable(),
    /** When another version replaced it, if it was live. */
    replacedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "AdminRoutineVersion" });
export type AdminRoutineVersion = z.infer<typeof adminRoutineVersionSchema>;

export const adminRoutineVersionListSchema = z
  .object({ items: z.array(adminRoutineVersionSchema) })
  .meta({ id: "AdminRoutineVersionList" });
export type AdminRoutineVersionList = z.infer<
  typeof adminRoutineVersionListSchema
>;

const changedClassSchema = z
  .object({
    day: routineDaySchema,
    start: z.string(),
    end: z.string(),
    course: z.string(),
    labGroup: z.string().nullable(),
    room: z.string(),
    teacher: z.string().nullable(),
  })
  .meta({ id: "RoutineChangedClass" });
export type RoutineChangedClass = z.infer<typeof changedClassSchema>;

export const ROUTINE_CHANGE_KINDS = [
  "moved",
  "room",
  "teacher",
  "added",
  "removed",
] as const;

export const routineChangeSchema = z
  .object({
    section: z.string(),
    /**
     * moved: another day or time (maybe a new room or teacher too); room / teacher:
     * same time, new room or teacher (or both, as "room"); added / removed: a class
     * with no counterpart.
     */
    kind: z.enum(ROUTINE_CHANGE_KINDS).meta({ id: "RoutineChangeKind" }),
    before: nullableRef(changedClassSchema),
    after: nullableRef(changedClassSchema),
  })
  .meta({ id: "RoutineChange" });
export type RoutineChange = z.infer<typeof routineChangeSchema>;

export const routineChangesSchema = z
  .object({
    moved: z.number().int(),
    room: z.number().int(),
    teacher: z.number().int(),
    added: z.number().int(),
    removed: z.number().int(),
    sectionsAdded: z.array(z.string()),
    sectionsRemoved: z.array(z.string()),
    /** The first changes, by section. */
    items: z.array(routineChangeSchema),
  })
  .meta({ id: "RoutineChanges" });

export const adminRoutineVersionDetailSchema = adminRoutineVersionSchema
  .extend({
    /** Its sections, for previewing one as students will see it. */
    sections: z.array(z.string()),
    /**
     * Its courses and teachers, and how many have a title or a name (kept per
     * department, so this changes as admins add them).
     */
    catalog: z
      .object({
        courses: z.number().int(),
        titled: z.number().int(),
        teachers: z.number().int(),
        named: z.number().int(),
      })
      .meta({ id: "RoutineVersionCatalog" }),
    warnings: z.array(routineWarningSchema),
    /** The version the changes are counted against: the live one, if another is. */
    comparedWith: z.string().nullable(),
    changes: routineChangesSchema,
  })
  .meta({ id: "AdminRoutineVersionDetail" });
export type AdminRoutineVersionDetail = z.infer<
  typeof adminRoutineVersionDetailSchema
>;

/** Why what was read from a PDF can't be used: each problem with where it is. */
export const routineFileProblemSchema = z.object({
  /** Where in the file, e.g. "classes[412].start"; empty for the whole file. */
  path: z.string(),
  message: z.string(),
});
export type RoutineFileProblem = z.infer<typeof routineFileProblemSchema>;

/** "classes[412].start" for Zod's ["classes", 412, "start"]. */
export function routineFilePath(path: readonly PropertyKey[]): string {
  return path
    .map((p, i) =>
      typeof p === "number" ? `[${p}]` : `${i === 0 ? "" : "."}${String(p)}`,
    )
    .join("");
}

// ── Course titles and teachers (/api/v1/admin/routine/courses, /teachers) ────
// Kept per department across versions; DIU's PDFs don't have titles (and CSE's no
// teachers' names), so admins add them.

/** A page of a department's courses or teachers, maybe searched or only those missing a title or name. */
export const adminRoutineCatalogQuerySchema = paginationQuerySchema.extend({
  department: routineDepartmentSchema,
  /** Part of a code, initials, title or name. */
  q: z.string().trim().max(100).optional(),
  /** Only those without a title (courses) or a name (teachers). */
  missing: z.enum(["true", "false"]).optional(),
});

export const adminRoutineCourseSchema = z
  .object({
    department: routineDepartmentSchema,
    code: z.string(),
    title: z.string().nullable(),
    /** Sections taking it in the current version (the live one, else the newest); 0 if it's not in it. */
    sections: z.number().int(),
  })
  .meta({ id: "AdminRoutineCourse" });
export type AdminRoutineCourse = z.infer<typeof adminRoutineCourseSchema>;

export const adminRoutineCourseListSchema = paginatedSchema(
  adminRoutineCourseSchema,
)
  .extend({
    /** All the department's courses, whatever the search, and how many have a title. */
    all: z.number().int(),
    titled: z.number().int(),
    /** The version counted in: the live one, else the newest; null before any. */
    version: z.string().nullable(),
  })
  .meta({ id: "AdminRoutineCourseList" });
export type AdminRoutineCourseList = z.infer<
  typeof adminRoutineCourseListSchema
>;

export const routineCourseParamsSchema = z.object({
  department: routineDepartmentSchema,
  code: courseCodeSchema,
});

/** Several courses' titles to take away at once. */
export const routineCoursesRemoveInputSchema = z
  .object({
    department: routineDepartmentSchema,
    codes: z.array(courseCodeSchema).min(1).max(500),
  })
  .meta({ id: "RoutineCoursesRemoveInput" });

/** Several teachers' details to forget at once. */
export const routineTeachersRemoveInputSchema = z
  .object({
    department: routineDepartmentSchema,
    initials: z.array(teacherInitialsSchema).min(1).max(500),
  })
  .meta({ id: "RoutineTeachersRemoveInput" });

/** How many a bulk removal removed. */
export const routineRemovedSchema = z
  .object({ removed: z.number().int() })
  .meta({ id: "RoutineRemoved" });

export const routineCourseInputSchema = z
  .object({ title: z.string().trim().min(2).max(200) })
  .meta({ id: "RoutineCourseInput" });
export type RoutineCourseInput = z.infer<typeof routineCourseInputSchema>;

export const adminRoutineTeacherSchema = z
  .object({
    department: routineDepartmentSchema,
    initials: z.string(),
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    room: z.string().nullable(),
    /** Classes a week in the current version (the live one, else the newest); 0 if not in it. */
    classes: z.number().int(),
    /** The courses they teach in the current version, by code. */
    courses: z.array(z.string()),
  })
  .meta({ id: "AdminRoutineTeacher" });
export type AdminRoutineTeacher = z.infer<typeof adminRoutineTeacherSchema>;

export const adminRoutineTeacherListSchema = paginatedSchema(
  adminRoutineTeacherSchema,
)
  .extend({
    /** All the department's teachers, whatever the search, and how many have a name. */
    all: z.number().int(),
    named: z.number().int(),
    /** The version counted in: the live one, else the newest; null before any. */
    version: z.string().nullable(),
  })
  .meta({ id: "AdminRoutineTeacherList" });
export type AdminRoutineTeacherList = z.infer<
  typeof adminRoutineTeacherListSchema
>;

export const routineTeacherParamsSchema = z.object({
  department: routineDepartmentSchema,
  initials: teacherInitialsSchema,
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const routineTeacherInputSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: optionalText(40).refine((v) => !v || /^\+?[\d\s-]{7,20}$/.test(v), {
      error: "Use digits, e.g. 01712345678",
    }),
    email: optionalText(200).refine(
      (v) => !v || z.email().safeParse(v).success,
      { error: "Use an email address, e.g. name@diu.edu.bd" },
    ),
    /** Where the teacher sits: "KT-712". */
    room: optionalText(60),
  })
  .meta({ id: "RoutineTeacherInput" });
export type RoutineTeacherInput = z.infer<typeof routineTeacherInputSchema>;

/** A version's number, set by an admin when DIU's PDF has none or another. */
export const routineVersionInputSchema = z
  .object({ version: versionNumberSchema })
  .meta({ id: "RoutineVersionInput" });
export type RoutineVersionInput = z.infer<typeof routineVersionInputSchema>;
