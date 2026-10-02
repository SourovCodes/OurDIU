import type {
  Course,
  Department,
  ExamType,
  Semester,
  SubmissionClassification,
} from "@ourdiu/shared";
import {
  parseSemesterName,
  SEMESTER_FORMAT_MESSAGE,
} from "@ourdiu/shared/constants";
import { useEffect, useId, useState } from "react";
import { ExamShape, EXAM_TONE, examKind } from "~/components/exam-badge";
import { SearchableSelect } from "~/components/searchable-select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  findCourseByName,
  findDepartmentByName,
  findSemesterByName,
} from "~/lib/choices";
import { courseOptions, type SelectOption } from "~/lib/filters";
import { cn } from "~/lib/utils";

/** An existing value (by id) or a new name typed by the user. */
export type Choice =
  { kind: "existing"; id: string } | { kind: "new"; name: string } | null;

const withArticle = (noun: string) =>
  `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

type ChoiceFieldProps = {
  label: string;
  noun: string;
  options: SelectOption[];
  value: Choice;
  onChange: (value: Choice) => void;
  /** Form field for an existing value's id. */
  idField: string;
  /** Form field for a new name. Omit to only allow existing values. */
  nameField?: string;
  error?: string;
  hint?: string;
  children?: React.ReactNode;
};

function ChoiceField({
  label,
  noun,
  options,
  value,
  onChange,
  idField,
  nameField,
  error,
  hint,
  children,
}: ChoiceFieldProps) {
  return (
    <div className="grid content-start gap-1.5">
      <SearchableSelect
        label={label}
        placeholder={`Select ${withArticle(noun)}`}
        searchPlaceholder={
          nameField ? `Search or add ${noun}…` : `Search ${noun}s…`
        }
        emptyText={
          nameField ? `Type a name to add a new ${noun}.` : `No ${noun} found.`
        }
        options={options}
        value={value?.kind === "existing" ? value.id : null}
        displayLabel={value?.kind === "new" ? `${value.name} (new)` : undefined}
        clearable={false}
        invalid={Boolean(error)}
        onChange={(id) => onChange(id ? { kind: "existing", id } : null)}
        onCreate={
          nameField ? (name) => onChange({ kind: "new", name }) : undefined
        }
        createLabel={(name) => `Add “${name}” as a new ${noun}`}
      />
      {/* Only the chosen shape is submitted: an id, or a new name. */}
      {value?.kind === "existing" && (
        <input type="hidden" name={idField} value={value.id} />
      )}
      {value?.kind === "new" && nameField && (
        <input type="hidden" name={nameField} value={value.name} />
      )}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {children}
    </div>
  );
}

/** Starting values for the fields, e.g. a submission's current classification. */
export type ClassificationDefaults = {
  department: Choice;
  shortName: string;
  course: Choice;
  semester: Choice;
  examType: Choice;
};

const EMPTY: ClassificationDefaults = {
  department: null,
  shortName: "",
  course: null,
  semester: null,
  examType: null,
};

/** Defaults that reproduce a classification: ids where they exist, else new names. */
export function defaultsFrom(
  classification: SubmissionClassification,
): ClassificationDefaults {
  const choice = (value: { id: number | null; name: string }): Choice =>
    value.id === null
      ? { kind: "new", name: value.name }
      : { kind: "existing", id: String(value.id) };
  const { department, course, semester, examType } = classification;
  return {
    department: choice(department),
    shortName: department.id === null ? (department.shortName ?? "") : "",
    course: choice(course),
    semester: choice(semester),
    examType: choice(examType),
  };
}

type ClassificationFieldsProps = {
  departments: Department[];
  courses: Course[];
  semesters: Semester[];
  examTypes: ExamType[];
  fieldErrors: Record<string, string>;
  defaults?: ClassificationDefaults;
  /** Whether a new department may leave out its short name. Defaults to true. */
  shortNameOptional?: boolean;
  /** Exam types as chips in their colours and shapes (the contribute form). */
  examTypeChips?: boolean;
  /** Told the chosen existing course, semester and exam type as they change. */
  onClassify?: (chosen: {
    courseId: string | null;
    semesterId: string | null;
    examTypeId: string | null;
  }) => void;
};

/**
 * Department, course, semester and exam type pickers, each an existing value or a new
 * name (exam types are existing only). Renders the four fields as siblings, for a grid.
 */
export function ClassificationFields({
  departments,
  courses,
  semesters,
  examTypes,
  fieldErrors,
  defaults = EMPTY,
  shortNameOptional = true,
  examTypeChips = false,
  onClassify,
}: ClassificationFieldsProps) {
  const [department, setDepartment] = useState<Choice>(defaults.department);
  const [shortName, setShortName] = useState(defaults.shortName);
  const [course, setCourse] = useState<Choice>(defaults.course);
  const [semester, setSemester] = useState<Choice>(defaults.semester);
  const [examType, setExamType] = useState<Choice>(defaults.examType);
  const shortNameId = useId();

  const errorFor = (...fields: string[]) =>
    fields.map((field) => fieldErrors[field]).find(Boolean);
  const findCourse = (id: string) => courses.find((c) => String(c.id) === id);

  // A typed name that matches an existing value selects that value instead.
  const existing = (match: { id: number } | undefined, fallback: Choice) =>
    match ? ({ kind: "existing", id: String(match.id) } as const) : fallback;

  const changeDepartment = (next: Choice) => {
    const choice =
      next?.kind === "new"
        ? existing(findDepartmentByName(departments, next.name), next)
        : next;
    setDepartment(choice);
    if (choice?.kind !== "new") setShortName("");
    // An existing course only fits its own department.
    if (course?.kind === "existing") {
      const current = findCourse(course.id);
      if (
        choice?.kind !== "existing" ||
        String(current?.departmentId) !== choice.id
      ) {
        setCourse(null);
      }
    }
  };

  const changeCourse = (next: Choice) => {
    const choice =
      next?.kind === "new" && department?.kind === "existing"
        ? existing(
            findCourseByName(courses, Number(department.id), next.name),
            next,
          )
        : next;
    setCourse(choice);
    // Picking an existing course first fills in its department.
    if (choice?.kind === "existing" && department === null) {
      const picked = findCourse(choice.id);
      if (picked) {
        setDepartment({ kind: "existing", id: String(picked.departmentId) });
      }
    }
  };

  // New semesters get the standard spelling ("fall 2025" → "Fall 25") right away.
  const changeSemester = (next: Choice) => {
    if (next?.kind !== "new") return setSemester(next);
    const typed = { ...next, name: parseSemesterName(next.name) ?? next.name };
    setSemester(existing(findSemesterByName(semesters, typed.name), typed));
  };
  const idOf = (choice: Choice) =>
    choice?.kind === "existing" ? choice.id : null;
  const courseId = idOf(course);
  const semesterId = idOf(semester);
  const examTypeId = idOf(examType);
  useEffect(() => {
    onClassify?.({ courseId, semesterId, examTypeId });
  }, [onClassify, courseId, semesterId, examTypeId]);

  const semesterFormatError =
    semester?.kind === "new" && parseSemesterName(semester.name) === null
      ? SEMESTER_FORMAT_MESSAGE
      : undefined;

  // A new department can't contain existing courses.
  const courseChoices =
    department?.kind === "new"
      ? []
      : courseOptions(
          courses,
          departments,
          department?.kind === "existing" ? department.id : null,
        );

  return (
    <>
      <ChoiceField
        label="Department"
        noun="department"
        options={departments.map((d) => ({
          value: String(d.id),
          label: `${d.name} (${d.shortName})`,
        }))}
        value={department}
        onChange={changeDepartment}
        idField="departmentId"
        nameField="customDepartmentName"
        error={errorFor("departmentId", "customDepartmentName")}
      >
        {department?.kind === "new" && (
          <div className="grid gap-1.5 pt-2">
            <Label htmlFor={shortNameId}>
              Short name
              {shortNameOptional && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  (optional)
                </span>
              )}
            </Label>
            <Input
              id={shortNameId}
              // Omitted from the form when empty.
              name={shortName.trim() ? "customDepartmentShortName" : undefined}
              value={shortName}
              onChange={(event) => setShortName(event.target.value)}
              placeholder="e.g. ME"
              maxLength={20}
              aria-invalid={
                fieldErrors.customDepartmentShortName ? true : undefined
              }
            />
            {fieldErrors.customDepartmentShortName && (
              <p className="text-sm text-destructive">
                {fieldErrors.customDepartmentShortName}
              </p>
            )}
          </div>
        )}
      </ChoiceField>

      <ChoiceField
        label="Course"
        noun="course"
        options={courseChoices}
        value={course}
        onChange={changeCourse}
        idField="courseId"
        nameField="customCourseName"
        error={errorFor("courseId", "customCourseName")}
        hint={
          department?.kind === "new"
            ? "Type the course name to add it to the new department."
            : undefined
        }
      />

      <ChoiceField
        label="Semester"
        noun="semester"
        options={semesters.map((s) => ({
          value: String(s.id),
          label: s.name,
        }))}
        value={semester}
        onChange={changeSemester}
        idField="semesterId"
        nameField="customSemesterName"
        error={
          semesterFormatError ?? errorFor("semesterId", "customSemesterName")
        }
        hint="A term and a year, e.g. Fall 25"
      />

      {examTypeChips ? (
        <fieldset className="grid gap-2 sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Exam type</legend>
          <div className="flex flex-wrap gap-2">
            {examTypes.map((type) => {
              const kind = examKind(type.name);
              const on =
                examType?.kind === "existing" &&
                examType.id === String(type.id);
              return (
                <label
                  key={type.id}
                  className={cn(
                    "relative flex h-11 cursor-pointer items-center gap-2 rounded-xl border pr-4 pl-2.5 text-sm font-semibold transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                    on
                      ? cn("border-transparent", EXAM_TONE[kind])
                      : "border-input hover:state-layer",
                  )}
                >
                  <input
                    type="radio"
                    name="examTypeId"
                    value={type.id}
                    checked={on}
                    onChange={() =>
                      setExamType({ kind: "existing", id: String(type.id) })
                    }
                    // Covers the chip, unseen: the label is what shows.
                    className="absolute inset-0 cursor-pointer appearance-none rounded-xl opacity-0"
                  />
                  <ExamShape kind={kind} className="size-6" />
                  {type.name}
                </label>
              );
            })}
          </div>
          {errorFor("examTypeId") && (
            <p className="text-sm text-destructive">{errorFor("examTypeId")}</p>
          )}
        </fieldset>
      ) : (
        <ChoiceField
          label="Exam type"
          noun="exam type"
          options={examTypes.map((e) => ({
            value: String(e.id),
            label: e.name,
          }))}
          value={examType}
          onChange={setExamType}
          idField="examTypeId"
          error={errorFor("examTypeId")}
        />
      )}
    </>
  );
}
