import { z } from "zod";

// Lookup tables used to classify questions. They only carry a name
// (departments also have a short name, e.g. "CSE").

const idSchema = z.number().int().positive();

export const departmentSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    shortName: z.string(),
  })
  .meta({ id: "Department" });
export type Department = z.infer<typeof departmentSchema>;

export const courseSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    departmentId: idSchema,
  })
  .meta({ id: "Course" });
export type Course = z.infer<typeof courseSchema>;

export const semesterSchema = z
  .object({ id: idSchema, name: z.string() })
  .meta({ id: "Semester" });
export type Semester = z.infer<typeof semesterSchema>;

export const examTypeSchema = z
  .object({ id: idSchema, name: z.string() })
  .meta({ id: "ExamType" });
export type ExamType = z.infer<typeof examTypeSchema>;

function listSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item) });
}

/** A department as listed publicly, with how many papers can be read. */
export const departmentListItemSchema = departmentSchema
  .extend({
    publishedCount: z.number().int(),
  })
  .meta({ id: "DepartmentListItem" });
export type DepartmentListItem = z.infer<typeof departmentListItemSchema>;

/** A course as listed publicly, with how many papers can be read. */
export const courseListItemSchema = courseSchema
  .extend({
    publishedCount: z.number().int(),
  })
  .meta({ id: "CourseListItem" });
export type CourseListItem = z.infer<typeof courseListItemSchema>;

export const departmentListSchema = listSchema(departmentListItemSchema).meta({
  id: "DepartmentList",
});
export const courseListSchema = listSchema(courseListItemSchema).meta({
  id: "CourseList",
});
export const semesterListSchema = listSchema(semesterSchema).meta({
  id: "SemesterList",
});
export const examTypeListSchema = listSchema(examTypeSchema).meta({
  id: "ExamTypeList",
});
export type DepartmentList = z.infer<typeof departmentListSchema>;
export type CourseList = z.infer<typeof courseListSchema>;
export type SemesterList = z.infer<typeof semesterListSchema>;
export type ExamTypeList = z.infer<typeof examTypeListSchema>;

/** All four lookup lists in one response, for filters and forms. */
export const taxonomySchema = z
  .object({
    departments: z.array(departmentListItemSchema),
    courses: z.array(courseListItemSchema),
    semesters: z.array(semesterSchema),
    examTypes: z.array(examTypeSchema),
  })
  .meta({ id: "Taxonomy" });
export type Taxonomy = z.infer<typeof taxonomySchema>;

/** Query-string id: coerced from text, must be a positive integer. */
export const idQuerySchema = z.coerce.number().int().positive();

export const listCoursesQuerySchema = z.object({
  departmentId: idQuerySchema.optional(),
});
