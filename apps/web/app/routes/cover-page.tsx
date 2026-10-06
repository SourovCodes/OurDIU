import type { RoutineClass, RoutineSection } from "@ourdiu/shared";
import { departmentOfStudentId } from "@ourdiu/shared/constants";
import {
  COVER_PAGE_FIELDS,
  COVER_PAGE_TEMPLATE_FIELDS,
  COVER_PAGE_TEMPLATE_NAMES,
  COVER_PAGE_TEMPLATES,
  coverPagePath,
  dhakaDate,
  isGroupTemplate,
  MAX_COVER_PAGE_MEMBERS,
  semesterOn,
  type CoverPageField,
  type CoverPageMember,
  type CoverPageTemplate,
  type CoverPageValues,
} from "@ourdiu/shared/cover-pages";
import {
  ChevronDown,
  Download,
  EllipsisVertical,
  ExternalLink,
  FileText,
  Plus,
  X,
} from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  data,
  Link,
  redirect,
  useParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { toast } from "~/lib/toast";
import { CoverPagePreview } from "~/components/cover-page-preview";
import { SuggestInput, type Suggestion } from "~/components/suggest-input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { isTeacherPick, savedRoutine } from "~/lib/routine";
import { myRoutine, routineLists } from "~/lib/routine.server";
import { breadcrumbJsonLd, originOf, pageMeta } from "~/lib/seo";
import {
  DriveAccessError,
  driveToken,
  loadGoogleIdentity,
  saveAsGoogleDoc,
} from "~/lib/google-docs";
import { googleDocsClientId } from "~/lib/google-docs.server";
import { getUser } from "~/lib/session.server";
import type { RouteHandle } from "~/root";
import { loadTaxonomy } from "~/lib/taxonomy.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/cover-page";

// The cover page maker (docs/PLAN.md, decisions 39 and 40): DIU-format covers,
// filled in from the account and the saved class routine, previewed as typed and
// made into a PDF by the API. Nothing is kept on the server; "Remember my
// details" keeps the student's own on this device.

/**
 * Each template's page, in the words students search for (Google's suggestions,
 * docs/PLAN.md, decision 39): "diu assignment cover page", "diu lab report cover
 * page", "front page", "maker", "pdf".
 */
const PAGES: Record<
  CoverPageTemplate,
  { title: string; heading: string; description: string; intro: string }
> = {
  assignment: {
    title:
      "DIU Cover Page Maker: Assignment Cover Page (Free PDF and Word) | OurDIU",
    heading: "DIU Cover Page Maker",
    description:
      "Make a Daffodil International University (DIU) assignment cover page in DIU's format, free: DIU's logo, course code and title, topic, and Submitted to and Submitted by filled in from your class routine. Download it as a PDF to print, or as a Word file to edit. Lab report, group assignment, final lab report and presentation cover pages too.",
    intro:
      "Assignment cover pages (front pages) in DIU’s format, with DIU’s logo, filled in for you, as a PDF to print or a Word file to edit.",
  },
  "lab-report": {
    title: "DIU Lab Report Cover Page Maker (Free PDF and Word) | OurDIU",
    heading: "DIU Lab Report Cover Page",
    description:
      "Make a DIU lab report cover page in Daffodil International University's format, free: experiment no. and name, course code and title, your teacher and your details, as a PDF or Word file. For CSE, SWE, EEE and every department.",
    intro:
      "Lab report cover pages (front pages) in DIU’s format: the experiment, the course, your teacher and you, as a PDF or a Word file.",
  },
  "group-assignment": {
    title: "DIU Group Assignment Cover Page Maker (Free PDF and Word) | OurDIU",
    heading: "DIU Group Assignment Cover Page",
    description:
      "Make a DIU group assignment cover page in Daffodil International University's format, free: every member's name and ID, the course, the topic and your teacher, as a PDF or Word file.",
    intro:
      "Group assignment cover pages in DIU’s format, with every member’s name and ID, as a PDF or a Word file.",
  },
  "final-lab-report": {
    title: "DIU Final Lab Report Cover Page Maker (Free PDF and Word) | OurDIU",
    heading: "DIU Final Lab Report Cover Page",
    description:
      "Make a DIU final lab report cover page in Daffodil International University's format, free: the course, your teacher and your details, as a PDF or Word file.",
    intro:
      "Final lab report cover pages in DIU’s format, for the lab’s report at the end of the semester, as a PDF or a Word file.",
  },
  presentation: {
    title: "DIU Presentation Cover Page Maker (Free PDF and Word) | OurDIU",
    heading: "DIU Presentation Cover Page",
    description:
      "Make a DIU presentation cover page in Daffodil International University's format, free: the topic, the course, your teacher and your details, as a PDF or Word file.",
    intro:
      "Presentation cover pages in DIU’s format, as a PDF or a Word file to put first in your slides.",
  },
};

const isTemplate = (t: string | undefined): t is CoverPageTemplate =>
  (COVER_PAGE_TEMPLATES as readonly string[]).includes(t ?? "");

const templateOf = (param: string | undefined): CoverPageTemplate =>
  isTemplate(param) ? param : "assignment";

export const handle: RouteHandle = {
  ogImage: "/cover-page/og.png",
  // The templates are pages for search, but one maker: moving keeps what's typed.
  samePage: true,
};

export const meta: Route.MetaFunction = ({ params, matches }) => {
  const template = templateOf(params.template);
  const page = PAGES[template];
  const origin = originOf(matches);
  const url = origin + coverPagePath(template);
  return [
    ...pageMeta({ title: page.title, description: page.description }),
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: page.heading,
        url,
        description: page.description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "BDT" },
        inLanguage: "en",
        audience: {
          "@type": "EducationalAudience",
          educationalRole: "student",
        },
        provider: { "@type": "Organization", name: "OurDIU", url: origin },
      },
    },
    breadcrumbJsonLd(origin, [
      { name: "OurDIU", path: "/" },
      { name: "Cover Page", path: "/cover-page" },
      ...(template === "assignment"
        ? []
        : [
            {
              name: COVER_PAGE_TEMPLATE_NAMES[template],
              path: coverPagePath(template),
            },
          ]),
    ]),
  ];
};

// Moving between templates keeps what's typed: the page's data doesn't change.
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  const here = (url: URL) => url.pathname.startsWith("/cover-page");
  if (!formMethod && here(currentUrl) && here(nextUrl)) return false;
  return defaultShouldRevalidate;
}

/** A course in the saved section's week, with who takes it. */
type RoutineCourse = {
  code: string;
  title: string;
  teacherName: string;
  teacherDesignation: string;
  teacherDepartment: string;
};

/**
 * How each routine's own courses are coded (SWE's are "SE…"). Its routine also
 * lists courses other departments teach (ENG101, MAT101, ACT327), whose teachers
 * aren't in the department: their department is left for the student to type.
 */
const OWN_COURSE_PREFIXES: Record<string, string[]> = {
  CSE: ["CSE"],
  EEE: ["EEE"],
  SWE: ["SWE", "SE"],
};

const ownCourse = (code: string, department: string) =>
  (OWN_COURSE_PREFIXES[department] ?? [department]).some((prefix) =>
    new RegExp(`^${prefix}\\s?\\d`, "i").test(code),
  );

/** "Department of Computer Science and Engineering", by short name ("CSE"). */
type DepartmentNames = Record<string, string>;

const departmentLabel = (short: string, names: DepartmentNames) =>
  `Department of ${names[short.toUpperCase()] ?? short}`;

/** A section's courses, once each, with who takes them, by code. */
function routineCourses(
  classes: Pick<RoutineClass, "course" | "teacher">[],
  department: string,
  names: DepartmentNames,
): RoutineCourse[] {
  const courses = new Map<string, RoutineCourse>();
  for (const c of classes) {
    if (courses.has(c.course.code)) continue;
    courses.set(c.course.code, {
      code: c.course.code,
      title: c.course.title ?? "",
      teacherName: c.teacher?.name ?? "",
      teacherDesignation: c.teacher?.designation ?? "",
      teacherDepartment: ownCourse(c.course.code, department)
        ? departmentLabel(department, names)
        : "",
    });
  }
  return [...courses.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** A section in a live routine, to pick as "Your section". */
type SectionChoice = { slug: string; department: string; section: string };

export async function loader({ request, params }: Route.LoaderArgs) {
  // The assignment's page is the maker's home; other names aren't pages.
  if (params.template === "assignment") throw redirect("/cover-page", 301);
  if (params.template !== undefined && !isTemplate(params.template)) {
    throw data("Not found", { status: 404 });
  }
  const cookie = request.headers.get("cookie");
  const saved = savedRoutine(cookie);
  const [user, mine, taxonomy, routines] = await Promise.all([
    getUser(request),
    // A teacher's week has no section to fill in.
    saved && !isTeacherPick(saved)
      ? myRoutine(request, saved, [saved.department])
      : null,
    loadTaxonomy(request),
    // Without the routines the sections just aren't suggested.
    routineLists(request).catch(() => null),
  ]);

  const names: DepartmentNames = Object.fromEntries(
    taxonomy.departments.map((d) => [d.shortName.toUpperCase(), d.name]),
  );
  const routineDepartment = mine?.department.toUpperCase() ?? null;
  const studentId = user?.studentId ?? "";
  const department = departmentOfStudentId(studentId) ?? routineDepartment;
  const now = new Date();
  const defaults: CoverPageValues = {
    studentName: user?.name ?? "",
    studentId,
    section: mine?.section ?? "",
    semester: semesterOn(now),
    studentDepartment: department ? departmentLabel(department, names) : "",
    date: dhakaDate(now),
  };
  return {
    signedIn: !!user,
    // "Open in Google Docs", when it's on (decision 43).
    googleClientId: googleDocsClientId(),
    section: mine?.section ?? null,
    courses:
      mine && routineDepartment
        ? routineCourses(mine.classes, routineDepartment, names)
        : [],
    names,
    departments: taxonomy.departments
      .map((d) => ({ name: d.name, shortName: d.shortName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    sections: (routines?.lists ?? []).flatMap(
      ({ department: slug, list }): SectionChoice[] =>
        (list?.sections ?? []).map((s) => ({
          slug,
          department: slug.toUpperCase(),
          section: s.section,
        })),
    ),
    defaults,
  };
}

/** A section's week in the live routine, from the API. */
async function fetchWeek(choice: SectionChoice): Promise<RoutineSection> {
  const res = await fetch(
    `/api/v1/routine/${choice.slug}/sections/${encodeURIComponent(choice.section)}`,
  );
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as RoutineSection;
}

/** What "Remember my details" keeps on the device: the student's own, never the work's. */
const REMEMBERED: CoverPageField[] = [
  "studentName",
  "studentId",
  "section",
  "studentDepartment",
];
const STORAGE_KEY = "ourdiu_cover_page";

/** Only the student's own details: never their group's, who are other students. */
type Remembered = Partial<Record<CoverPageField, string>>;

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
  teacherDepartment: "e.g. Department of Software Engineering",
  studentId: "e.g. 241-15-047",
  section: "e.g. 67_B",
  studentDepartment: "e.g. Department of Software Engineering",
};

/** A labelled text box for one field. */
function Field({
  field,
  value,
  onChange,
  highlight,
  label,
  suggestions,
  onPick,
}: {
  field: CoverPageField;
  value: string;
  onChange: (value: string) => void;
  highlight?: boolean;
  label?: string;
  /** Suggested as the student types; anything typed is still taken. */
  suggestions?: Suggestion[];
  onPick?: (suggestion: Suggestion) => void;
}) {
  const id = useId();
  if (suggestions) {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{label ?? LABELS[field]}</Label>
        <SuggestInput
          id={id}
          name={field}
          value={value}
          onChange={onChange}
          onPick={onPick}
          suggestions={suggestions}
          placeholder={PLACEHOLDERS[field]}
          maxLength={COVER_PAGE_FIELDS[field]}
          className={cn("bg-background", highlight && "border-primary")}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label ?? LABELS[field]}</Label>
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
  courses: savedCourses,
  names,
  departments,
  sections,
  defaults,
  googleClientId,
  raw,
}: Route.ComponentProps["loaderData"] & { raw: string | null }) {
  // What this device remembers wins over the account's: the student may write
  // their name differently on covers.
  const kept = parseRemembered(raw);
  const template = templateOf(useParams().template);
  const page = PAGES[template];
  const [values, setValues] = useState<CoverPageValues>(() => {
    const start = { ...defaults };
    for (const f of REMEMBERED) if (kept?.[f]) start[f] = kept[f];
    return start;
  });
  const [members, setMembers] = useState<CoverPageMember[]>(() => [
    {
      name: kept?.studentName || defaults.studentName || "",
      id: kept?.studentId || defaults.studentId || "",
    },
  ]);
  const [course, setCourse] = useState<string | null>(null);
  // The courses to pick from: the saved routine's section's, or the one picked here.
  const [courses, setCourses] = useState(savedCourses);
  const [coursesOf, setCoursesOf] = useState(section);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<"pdf" | "docx" | "docs" | null>(null);

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

  const departmentSuggestions = useMemo(
    () =>
      departments.map((d) => ({
        value: `Department of ${d.name}`,
        label: d.name,
        hint: d.shortName,
      })),
    [departments],
  );
  const sectionSuggestions = useMemo(
    () =>
      sections.map((s) => ({
        value: s.section,
        hint: s.department,
      })),
    [sections],
  );

  /** Shows a section's courses, from its week in the routine. */
  function showWeek(week: RoutineSection, choice: SectionChoice) {
    setCourses(routineCourses(week.classes, choice.department, names));
    setCoursesOf(week.section);
    setCourse(null);
    setValues((v) =>
      v.studentDepartment
        ? v
        : {
            ...v,
            studentDepartment: departmentLabel(choice.department, names),
          },
    );
  }

  async function loadSection(choice: SectionChoice) {
    try {
      showWeek(await fetchWeek(choice), choice);
    } catch {
      toast.error("Couldn’t load that section’s courses. Please try again.");
    }
  }

  /** The routine's section a typed or picked name is, if exactly one. */
  const findSection = (name: string, department?: string) => {
    const matches = sections.filter(
      (s) =>
        s.section.toLowerCase() === name.trim().toLowerCase() &&
        (!department || s.department === department),
    );
    return matches.length === 1 ? matches[0]! : null;
  };

  // A section remembered on this device, without a saved routine: its courses
  // come up too, once its week arrives.
  const rememberedSection = useEffectEvent(() =>
    savedCourses.length ? null : findSection(values.section ?? ""),
  );
  const shownWeek = useEffectEvent(showWeek);
  useEffect(() => {
    const choice = rememberedSection();
    if (!choice) return;
    let current = true;
    fetchWeek(choice)
      .then((week) => current && shownWeek(week, choice))
      .catch(() => {
        // The student can still pick the section again.
      });
    return () => {
      current = false;
    };
  }, []);

  const fields = COVER_PAGE_TEMPLATE_FIELDS[template];
  const shown: CoverPageValues = {
    ...Object.fromEntries(fields.map((f) => [f, value(f)])),
    ...(isGroupTemplate(template) ? { members } : {}),
  };

  /** The cover page from the API, as a PDF or a Word file, with its name. */
  async function make(format: "pdf" | "docx") {
    const res = await fetch(`/api/v1/cover-page/${template}/${format}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(shown),
    });
    if (!res.ok) throw new Error(String(res.status));
    const name =
      /filename="([^"]+)"/.exec(
        res.headers.get("content-disposition") ?? "",
      )?.[1] ?? `cover-page.${format}`;
    return { blob: await res.blob(), name };
  }

  const keepDetails = () =>
    writeRemembered(
      remember
        ? Object.fromEntries(REMEMBERED.map((f) => [f, value(f)]))
        : null,
    );

  async function download(format: "pdf" | "docx") {
    setBusy(format);
    try {
      const { blob, name } = await make(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      keepDetails();
    } catch {
      toast.error(
        `Couldn’t make the ${format === "pdf" ? "PDF" : "Word file"}. Please try again.`,
      );
    } finally {
      setBusy(null);
    }
  }

  // Google's script loads ahead, so a click can open its popup straight away.
  const google = useRef<Awaited<ReturnType<typeof loadGoogleIdentity>> | null>(
    null,
  );
  useEffect(() => {
    if (!googleClientId) return;
    loadGoogleIdentity()
      .then((oauth2) => {
        google.current = oauth2;
      })
      .catch(() => {
        // The button says so when it's clicked.
      });
  }, [googleClientId]);

  /** Saves the Word file to the student's Google Drive as a Google Doc. */
  async function openInGoogleDocs() {
    if (!googleClientId || !google.current) {
      toast.error("Google Docs isn’t ready yet. Please try again.");
      return;
    }
    // Asked first, inside the click, or the browser blocks Google's popup.
    const access = driveToken(google.current, googleClientId);
    setBusy("docs");
    try {
      const token = await access;
      const { blob, name } = await make("docx");
      const link = await saveAsGoogleDoc(
        token,
        blob,
        name.replace(/\.docx$/, "").replaceAll("-", " "),
      );
      keepDetails();
      toast.success("Saved to your Google Drive", {
        action: {
          label: "Open in Google Docs",
          onClick: () => window.open(link, "_blank", "noopener"),
        },
        duration: 15_000,
      });
    } catch (error) {
      // Without Drive access there's still the Word file, which Docs opens too.
      const word = {
        label: "Download Word",
        onClick: () => void download("docx"),
      };
      if (error instanceof DriveAccessError && error.reason === "blocked") {
        toast.error(
          "Your browser blocked Google’s window. Allow pop-ups for ourdiu.com and try again.",
        );
      } else if (error instanceof DriveAccessError) {
        toast(
          "Google Docs needs your permission to save the cover page to your Drive.",
          {
            description:
              "It only gets the files OurDIU makes, not the rest of your Drive. Or download the Word file instead.",
            action: word,
            duration: 10_000,
          },
        );
      } else {
        toast.error("Couldn’t save it to Google Docs. Please try again.", {
          action: word,
        });
      }
    } finally {
      setBusy(null);
    }
  }

  const courseFields: CoverPageField[] =
    template === "lab-report"
      ? ["experimentNo", "experimentName"]
      : template === "final-lab-report"
        ? []
        : ["topic"];
  const filled = (...f: CoverPageField[]) => f.every((x) => value(x).trim());

  return (
    <div className="space-y-6 pt-2 pb-28 sm:pt-6 lg:pb-10">
      <header className="space-y-2">
        <h1 className="font-expressive text-4xl sm:text-5xl">{page.heading}</h1>
        <p className="max-w-2xl text-muted-foreground">
          {page.intro}{" "}
          {signedIn ? (
            "Your details come from your account."
          ) : (
            <>
              <Link
                to={`/login?redirectTo=${encodeURIComponent(coverPagePath(template))}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Log in
              </Link>{" "}
              to have your name and ID filled in.
            </>
          )}
        </p>
      </header>

      {/* Each template is a page of its own (for search); moving keeps what's typed. */}
      <nav aria-label="Cover page templates" className="flex flex-wrap gap-2">
        {COVER_PAGE_TEMPLATES.map((t) => (
          <Link
            key={t}
            to={coverPagePath(t)}
            replace
            preventScrollReset
            aria-current={t === template ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium hover:state-layer",
              t === template &&
                "border-primary bg-primary-container text-primary-container-foreground",
            )}
          >
            {COVER_PAGE_TEMPLATE_NAMES[t]}
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <form
          className="space-y-4"
          // Only the Download buttons make the PDF, not Enter (or a phone's Go)
          // in a field.
          onSubmit={(e) => e.preventDefault()}
          aria-label="Cover page details"
        >
          <section className="space-y-4 rounded-3xl bg-surface p-5">
            <h2 className="font-expressive text-lg">Course</h2>
            <Field
              field="section"
              label="Your section"
              value={value("section")}
              onChange={(name) => {
                set("section")(name);
                // Typed in full: its courses come up as if picked.
                const choice = findSection(name);
                if (choice && choice.section !== coursesOf) {
                  void loadSection(choice);
                }
              }}
              suggestions={sectionSuggestions}
              onPick={(s) => {
                const choice = findSection(s.value, s.hint);
                if (choice) void loadSection(choice);
              }}
            />
            {courses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Pick from {coursesOf}’s courses
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
                ? `Who takes ${course}${coursesOf ? ` for ${coursesOf}` : ""}, from the routine`
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
              suggestions={departmentSuggestions}
            />
          </Group>

          <Group
            title="Submitted by"
            hint={signedIn ? "From your account" : undefined}
            summary={
              isGroupTemplate(template)
                ? `${members.filter((m) => m.name).length} members`
                : [value("studentName"), value("studentId")]
                    .filter(Boolean)
                    .join(", ")
            }
            startOpen={
              isGroupTemplate(template) ||
              !filled("studentName", "studentId", "studentDepartment")
            }
          >
            {isGroupTemplate(template) ? (
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
            <Field
              field="semester"
              value={value("semester")}
              onChange={set("semester")}
            />
            <Field
              field="studentDepartment"
              value={value("studentDepartment")}
              onChange={set("studentDepartment")}
              suggestions={departmentSuggestions}
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
          <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t bg-background/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur lg:hidden">
            <Button
              type="button"
              size="lg"
              className="flex-1 rounded-full"
              disabled={!!busy}
              onClick={() => void download("pdf")}
            >
              <Download aria-hidden />
              {busy === "pdf" ? "Making the PDF…" : "Download PDF"}
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon-lg"
                  variant="outline"
                  className="rounded-full"
                  disabled={!!busy}
                  aria-label="Other formats"
                >
                  <EllipsisVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-56">
                <DropdownMenuItem onSelect={() => void download("docx")}>
                  <FileText />
                  Word file (.docx)
                </DropdownMenuItem>
                {googleClientId && (
                  <DropdownMenuItem onSelect={() => void openInGoogleDocs()}>
                    <ExternalLink />
                    Open in Google Docs
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </form>

        <aside aria-label="Preview" className="space-y-4 lg:sticky lg:top-24">
          <h2 className="font-expressive text-lg lg:sr-only">Preview</h2>
          <CoverPagePreview
            template={template}
            values={shown}
            className="w-full rounded-md shadow-md ring-1 ring-black/5"
          />
          <div className="hidden gap-2 lg:grid">
            <Button
              type="button"
              size="lg"
              className="w-full rounded-full"
              disabled={!!busy}
              onClick={() => void download("pdf")}
            >
              <Download aria-hidden />
              {busy === "pdf" ? "Making the PDF…" : "Download PDF"}
            </Button>
            <div className={cn("grid gap-2", googleClientId && "grid-cols-2")}>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={!!busy}
                onClick={() => void download("docx")}
              >
                <FileText aria-hidden />
                {busy === "docx" ? "Making it…" : "Word (.docx)"}
              </Button>
              {googleClientId && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={!!busy}
                  onClick={() => void openInGoogleDocs()}
                >
                  <ExternalLink aria-hidden />
                  {busy === "docs" ? "Saving…" : "Google Docs"}
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>

      <AboutCoverPages />
    </div>
  );
}

/**
 * A few lines on what's made and how, under the maker: what search engines read
 * of the page, and the questions students ask. Kept short (decision 36).
 */
function AboutCoverPages() {
  return (
    <section
      aria-labelledby="about-cover-pages"
      className="max-w-3xl space-y-4 pt-6 text-sm text-muted-foreground"
    >
      <h2
        id="about-cover-pages"
        className="font-expressive text-xl text-foreground"
      >
        About DIU cover pages
      </h2>
      <p>
        A cover page (or front page) goes first on every assignment, lab report
        and presentation handed in at Daffodil International University (DIU).
        DIU’s format has the university’s logo, what the work is (course code
        and title, topic or experiment), who it’s submitted to (the teacher,
        with their designation and department), who submits it (name, student
        ID, section, semester and department) and the date of submission.
      </p>
      <p>
        Here it’s filled in for you. Your name and student ID come from your
        account; type your section (like 67_B) and pick a course, and its title
        and your teacher come from DIU’s class routine (CSE, SWE and EEE so
        far). Everything can be changed. The preview is the page as it prints:
        download it as a PDF to print, or as a Word file to edit in Word or
        Google Docs. It’s free, and works for every department without logging
        in. What you type isn’t kept on the site.
      </p>
      <p>
        Cover pages for an{" "}
        {COVER_PAGE_TEMPLATES.map((t, i) => (
          <span key={t}>
            {i > 0 &&
              (i === COVER_PAGE_TEMPLATES.length - 1 ? " and a " : ", a ")}
            <Link
              to={coverPagePath(t)}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {COVER_PAGE_TEMPLATE_NAMES[t].toLowerCase()}
            </Link>
          </span>
        ))}
        .
      </p>
    </section>
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
