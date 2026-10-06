import { departmentOfStudentId } from "@ourdiu/shared/constants";
import {
  COVER_PAGE_FIELDS,
  COVER_PAGE_TEMPLATE_FIELDS,
  COVER_PAGE_TEMPLATE_NAMES,
  COVER_PAGE_TEMPLATES,
  dhakaDate,
  MAX_COVER_PAGE_MEMBERS,
  semesterOn,
  type CoverPageField,
  type CoverPageMember,
  type CoverPageTemplate,
  type CoverPageValues,
} from "@ourdiu/shared/cover-pages";
import { ChevronDown, Download, Plus, X } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { CoverPagePreview } from "~/components/cover-page-preview";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { isTeacherPick, savedRoutine } from "~/lib/routine";
import { myRoutine } from "~/lib/routine.server";
import { pageMeta } from "~/lib/seo";
import { getUser } from "~/lib/session.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/cover-page";

// The cover page maker (docs/PLAN.md, decisions 39 and 40): DIU-format covers,
// filled in from the account and the saved class routine, previewed as typed and
// made into a PDF by the API. Nothing is kept on the server; "Remember my
// details" keeps the student's own on this device.

export const meta: Route.MetaFunction = () =>
  pageMeta({
    title: "DIU Cover Page Maker – Assignment and Lab Report | OurDIU",
    description:
      "Make a DIU-format cover page for an assignment, a lab report or a group assignment: your name, ID, course and teacher filled in from your class routine, as a PDF to print.",
  });

/** A course in the saved section's week, with who takes it. */
type RoutineCourse = {
  code: string;
  title: string;
  teacherName: string;
  teacherDesignation: string;
  teacherDepartment: string;
};

export async function loader({ request }: Route.LoaderArgs) {
  const cookie = request.headers.get("cookie");
  const saved = savedRoutine(cookie);
  const [user, mine] = await Promise.all([
    getUser(request),
    // A teacher's week has no section to fill in.
    saved && !isTeacherPick(saved)
      ? myRoutine(request, saved, [saved.department])
      : null,
  ]);

  const routineDepartment = mine?.department.toUpperCase() ?? null;
  const courses = new Map<string, RoutineCourse>();
  for (const c of mine?.classes ?? []) {
    if (courses.has(c.course.code)) continue;
    courses.set(c.course.code, {
      code: c.course.code,
      title: c.course.title ?? "",
      teacherName: c.teacher?.name ?? "",
      teacherDesignation: c.teacher?.designation ?? "",
      teacherDepartment: routineDepartment
        ? `Department of ${routineDepartment}`
        : "",
    });
  }

  const studentId = user?.studentId ?? "";
  const department =
    departmentOfStudentId(studentId) ?? routineDepartment ?? null;
  const now = new Date();
  const defaults: CoverPageValues = {
    studentName: user?.name ?? "",
    studentId,
    section: mine?.section ?? "",
    semester: semesterOn(now),
    studentDepartment: department ? `Department of ${department}` : "",
    date: dhakaDate(now),
  };
  return {
    signedIn: !!user,
    section: mine?.section ?? null,
    courses: [...courses.values()].sort((a, b) => a.code.localeCompare(b.code)),
    defaults,
  };
}

/** What "Remember my details" keeps on the device: the student's own, never the work's. */
const REMEMBERED: CoverPageField[] = [
  "studentName",
  "studentId",
  "section",
  "studentDepartment",
];
const STORAGE_KEY = "ourdiu_cover_page";

type Remembered = Partial<Record<CoverPageField, string>> & {
  members?: CoverPageMember[];
};

/** The stored details, as stored: a string, so the store's snapshot is stable. */
function rememberedRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseRemembered(raw: string | null): Remembered | null {
  try {
    return raw ? (JSON.parse(raw) as Remembered) : null;
  } catch {
    return null;
  }
}

// Storage is only read, never watched: it changes when this page downloads.
const subscribe = () => () => {};

function writeRemembered(values: Remembered | null) {
  try {
    if (values) localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private windows and blocked storage: the details just aren't kept.
  }
}

const LABELS: Record<CoverPageField, string> = {
  courseCode: "Course code",
  courseTitle: "Course title",
  topic: "Topic",
  experimentNo: "Experiment no.",
  experimentName: "Experiment name",
  teacherName: "Teacher",
  teacherDesignation: "Designation",
  teacherDepartment: "Department",
  studentName: "Name",
  studentId: "Student ID",
  section: "Section",
  semester: "Semester",
  studentDepartment: "Department",
  date: "Date of submission",
};

const PLACEHOLDERS: Partial<Record<CoverPageField, string>> = {
  courseCode: "e.g. CSE311",
  courseTitle: "e.g. Operating Systems",
  topic: "What the assignment is about",
  experimentNo: "e.g. 2",
  experimentName: "e.g. Round-robin scheduling",
  teacherDesignation: "e.g. Assistant Professor",
  teacherDepartment: "e.g. Department of CSE",
  studentId: "e.g. 241-15-047",
  section: "e.g. 65_A",
  studentDepartment: "e.g. Department of CSE",
};

/** A labelled text box for one field. */
function Field({
  field,
  value,
  onChange,
  highlight,
}: {
  field: CoverPageField;
  value: string;
  onChange: (value: string) => void;
  highlight?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{LABELS[field]}</Label>
      <Input
        id={id}
        name={field}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDERS[field]}
        maxLength={COVER_PAGE_FIELDS[field]}
        autoComplete="off"
        className={cn("bg-background", highlight && "border-primary")}
      />
    </div>
  );
}

/**
 * A group of fields in a tonal card. On phones a filled-in group folds to one
 * line with what it says; wide screens show everything.
 */
function Group({
  title,
  hint,
  summary,
  startOpen,
  children,
}: {
  title: string;
  hint?: string;
  /** What the folded line shows, e.g. the teacher's name. */
  summary?: string;
  startOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  const bodyId = useId();
  return (
    <section className="rounded-3xl bg-surface p-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-2 text-left lg:hidden"
      >
        <span className="min-w-0 flex-1 truncate font-expressive text-lg">
          {title}
          {!open && summary && (
            <span className="text-muted-foreground"> · {summary}</span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-5 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <div className="hidden items-baseline gap-2 lg:flex">
        <h2 className="font-expressive text-lg">{title}</h2>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </div>
      <div
        id={bodyId}
        className={cn("mt-4 gap-3 lg:grid", open ? "grid" : "hidden")}
      >
        {children}
      </div>
    </section>
  );
}

export default function CoverPage({ loaderData }: Route.ComponentProps) {
  // What this device remembers, after hydration (the server can't know it). The
  // form is keyed on it, so it starts again with those details filled in.
  const raw = useSyncExternalStore(subscribe, rememberedRaw, () => null);
  return <CoverPageMaker key={raw ?? ""} {...loaderData} raw={raw} />;
}

function CoverPageMaker({
  signedIn,
  section,
  courses,
  defaults,
  raw,
}: Route.ComponentProps["loaderData"] & { raw: string | null }) {
  // What this device remembers wins over the account's: the student may write
  // their name differently on covers.
  const kept = parseRemembered(raw);
  const [template, setTemplate] = useState<CoverPageTemplate>("assignment");
  const [values, setValues] = useState<CoverPageValues>(() => {
    const start = { ...defaults };
    for (const f of REMEMBERED) if (kept?.[f]) start[f] = kept[f];
    return start;
  });
  const [members, setMembers] = useState<CoverPageMember[]>(() =>
    kept?.members?.length
      ? kept.members
      : [{ name: defaults.studentName ?? "", id: defaults.studentId ?? "" }],
  );
  const [course, setCourse] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const set = (field: CoverPageField) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));
  const value = (field: CoverPageField) => values[field] ?? "";

  const pickCourse = (c: RoutineCourse | null) => {
    setCourse(c?.code ?? "");
    setValues((v) => ({
      ...v,
      courseCode: c?.code ?? "",
      courseTitle: c?.title ?? "",
      teacherName: c?.teacherName ?? "",
      teacherDesignation: c?.teacherDesignation ?? "",
      teacherDepartment: c?.teacherDepartment ?? "",
    }));
  };

  const fields = COVER_PAGE_TEMPLATE_FIELDS[template];
  const shown: CoverPageValues = {
    ...Object.fromEntries(fields.map((f) => [f, value(f)])),
    ...(template === "group" ? { members } : {}),
  };

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/cover-page/${template}/pdf`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(shown),
      });
      if (!res.ok) throw new Error(String(res.status));
      const name =
        /filename="([^"]+)"/.exec(
          res.headers.get("content-disposition") ?? "",
        )?.[1] ?? "cover-page.pdf";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      writeRemembered(
        remember
          ? {
              ...Object.fromEntries(REMEMBERED.map((f) => [f, value(f)])),
              members: members.filter((m) => m.name || m.id),
            }
          : null,
      );
    } catch {
      toast.error("Couldn’t make the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const courseFields: CoverPageField[] =
    template === "lab-report" ? ["experimentNo", "experimentName"] : ["topic"];
  const filled = (...f: CoverPageField[]) => f.every((x) => value(x).trim());

  return (
    <div className="space-y-6 pt-2 pb-28 sm:pt-6 lg:pb-10">
      <header className="space-y-2">
        <h1 className="font-expressive text-4xl sm:text-5xl">Cover page</h1>
        <p className="max-w-2xl text-muted-foreground">
          {signedIn ? (
            "Assignment and lab report covers in DIU’s format, filled in from your account and your class routine."
          ) : (
            <>
              Assignment and lab report covers in DIU’s format.{" "}
              <Link
                to="/login?redirectTo=%2Fcover-page"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Log in
              </Link>{" "}
              and save your section in the Class Routine to have them filled in.
            </>
          )}
        </p>
      </header>

      <ToggleGroup
        type="single"
        value={template}
        onValueChange={(t) => t && setTemplate(t as CoverPageTemplate)}
        aria-label="Template"
        className="flex flex-wrap gap-2"
      >
        {COVER_PAGE_TEMPLATES.map((t) => (
          <ToggleGroupItem
            key={t}
            value={t}
            className="rounded-full border px-4 data-[state=on]:border-primary data-[state=on]:bg-primary-container data-[state=on]:text-primary-container-foreground"
          >
            {COVER_PAGE_TEMPLATE_NAMES[t]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void download();
          }}
          aria-label="Cover page details"
        >
          <section className="space-y-4 rounded-3xl bg-surface p-5">
            <h2 className="font-expressive text-lg">Course</h2>
            {courses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Pick from your routine ({section})
                </p>
                <div className="flex flex-wrap gap-2">
                  {courses.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={course === c.code}
                      title={c.title || undefined}
                      onClick={() => pickCourse(c)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm font-medium hover:state-layer",
                        course === c.code
                          ? "border-primary bg-primary-container text-primary-container-foreground"
                          : "bg-background",
                      )}
                    >
                      {c.code}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={course === ""}
                    onClick={() => pickCourse(null)}
                    className={cn(
                      "rounded-xl border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground hover:state-layer",
                      course === "" && "border-primary text-foreground",
                    )}
                  >
                    Other course
                  </button>
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                field="courseCode"
                value={value("courseCode")}
                onChange={set("courseCode")}
              />
              <Field
                field="courseTitle"
                value={value("courseTitle")}
                onChange={set("courseTitle")}
              />
            </div>
            <div
              className={cn(
                "grid gap-3",
                courseFields.length > 1 && "sm:grid-cols-[8rem_1fr]",
              )}
            >
              {courseFields.map((f) => (
                <Field
                  key={f}
                  field={f}
                  value={value(f)}
                  onChange={set(f)}
                  highlight={!value(f)}
                />
              ))}
            </div>
          </section>

          <Group
            title="Submitted to"
            hint={
              course
                ? `Who takes ${course}${section ? ` for ${section}` : ""}, from the routine`
                : undefined
            }
            summary={value("teacherName")}
            startOpen={
              !filled("teacherName", "teacherDesignation", "teacherDepartment")
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                field="teacherName"
                value={value("teacherName")}
                onChange={set("teacherName")}
              />
              <Field
                field="teacherDesignation"
                value={value("teacherDesignation")}
                onChange={set("teacherDesignation")}
              />
            </div>
            <Field
              field="teacherDepartment"
              value={value("teacherDepartment")}
              onChange={set("teacherDepartment")}
            />
          </Group>

          <Group
            title="Submitted by"
            hint={signedIn ? "From your account" : undefined}
            summary={
              template === "group"
                ? `${members.filter((m) => m.name).length} members`
                : [value("studentName"), value("studentId")]
                    .filter(Boolean)
                    .join(", ")
            }
            startOpen={
              template === "group" ||
              !filled(
                "studentName",
                "studentId",
                "section",
                "studentDepartment",
              )
            }
          >
            {template === "group" ? (
              <Members members={members} onChange={setMembers} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  field="studentName"
                  value={value("studentName")}
                  onChange={set("studentName")}
                />
                <Field
                  field="studentId"
                  value={value("studentId")}
                  onChange={set("studentId")}
                />
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                field="section"
                value={value("section")}
                onChange={set("section")}
              />
              <Field
                field="semester"
                value={value("semester")}
                onChange={set("semester")}
              />
            </div>
            <Field
              field="studentDepartment"
              value={value("studentDepartment")}
              onChange={set("studentDepartment")}
            />
          </Group>

          <section className="flex flex-wrap items-end gap-4 rounded-3xl bg-surface p-5">
            <div className="min-w-48 flex-1">
              <Field
                field="date"
                value={value("date")}
                onChange={set("date")}
              />
            </div>
            <div className="flex min-h-11 flex-1 items-center gap-3">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(c) => setRemember(c === true)}
              />
              <Label htmlFor="remember" className="font-normal">
                Remember my details on this device
              </Label>
            </div>
          </section>

          {/* On phones the button stays at the bottom of the screen. */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur lg:hidden">
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={busy}
            >
              <Download aria-hidden />
              {busy ? "Making the PDF…" : "Download PDF"}
            </Button>
          </div>
        </form>

        <aside aria-label="Preview" className="space-y-4 lg:sticky lg:top-24">
          <h2 className="font-expressive text-lg lg:sr-only">Preview</h2>
          <CoverPagePreview
            template={template}
            values={shown}
            className="w-full rounded-md shadow-md ring-1 ring-black/5"
          />
          <Button
            type="button"
            size="lg"
            className="hidden w-full rounded-full lg:flex"
            disabled={busy}
            onClick={() => void download()}
          >
            <Download aria-hidden />
            {busy ? "Making the PDF…" : "Download PDF"}
          </Button>
        </aside>
      </div>
    </div>
  );
}

/** A group assignment's members: a name and an ID each, up to six. */
function Members({
  members,
  onChange,
}: {
  members: CoverPageMember[];
  onChange: (members: CoverPageMember[]) => void;
}) {
  const update = (i: number, patch: Partial<CoverPageMember>) =>
    onChange(members.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Members</p>
      {members.map((m, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            aria-label={`Member ${i + 1}'s name`}
            value={m.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Name"
            maxLength={80}
            className="min-w-0 flex-[2] bg-background"
          />
          <Input
            aria-label={`Member ${i + 1}'s ID`}
            value={m.id}
            onChange={(e) => update(i, { id: e.target.value })}
            placeholder="ID"
            maxLength={20}
            className="min-w-0 flex-1 bg-background"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove member ${i + 1}`}
            disabled={members.length === 1}
            onClick={() => onChange(members.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      {members.length < MAX_COVER_PAGE_MEMBERS && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...members, { name: "", id: "" }])}
        >
          <Plus aria-hidden />
          Add a member
        </Button>
      )}
    </div>
  );
}
