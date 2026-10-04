import type {
  AdminRoutineVersionDetail,
  RoutineChange,
  RoutineChangedClass,
  RoutineSection,
} from "@ourdiu/shared";
import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  routineClockTime,
} from "@ourdiu/shared/constants";
import {
  Download,
  ExternalLink,
  FileJson,
  FileText,
  FileWarning,
  Radio,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { ConfirmAction, useFormAction } from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import {
  ChangeStat,
  DELETE_DESCRIPTION,
  RoutineStatusBadge,
  versionFileHref,
  versionPdfHref,
} from "~/components/admin/routine";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { WeekGrid } from "~/components/routine";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminGetJson } from "~/lib/admin.server";
import { formatDate } from "~/lib/dates";
import { formatNumber } from "~/lib/format";
import { routineHref, weekDays } from "~/lib/routine";
import { routineAdminAction } from "~/lib/routine-admin.server";
import type { Route } from "./+types/admin-routine-version";

export const handle = {
  breadcrumb: (data: unknown) =>
    data
      ? `v${(data as { v: AdminRoutineVersionDetail }).v.version}`
      : "Version",
};

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: `${loaderData ? `v${loaderData.v.version}` : "Version"} — Routine — Admin — OurDIU`,
  },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const id = encodeURIComponent(params.id);
  const v = await adminGetJson<AdminRoutineVersionDetail>(
    request,
    `/routine/versions/${id}`,
  );
  // One section as students would see it: ?preview=, else the first that changed.
  const asked = new URL(request.url).searchParams.get("preview");
  const section =
    (asked && v.sections.includes(asked) ? asked : null) ??
    v.changes.items[0]?.section ??
    v.sections[0];
  const preview = section
    ? await adminGetJson<RoutineSection>(
        request,
        `/routine/versions/${id}/sections/${encodeURIComponent(section)}`,
      )
    : null;
  return { v, preview };
}

export const action = ({ request }: Route.ActionArgs) =>
  routineAdminAction(request);

export { AdminRouteError as ErrorBoundary };

const KIND_LABELS: Record<RoutineChange["kind"], string> = {
  moved: "Moved",
  room: "Room",
  teacher: "Teacher",
  added: "Added",
  removed: "Removed",
};

function describe(c: RoutineChangedClass | null) {
  if (!c) return <span className="text-muted-foreground">—</span>;
  const day = ROUTINE_DAY_NAMES[ROUTINE_DAYS.indexOf(c.day)]!.slice(0, 3);
  return (
    <span className="tabular-nums">
      {c.course}
      {c.labGroup ? ` (${c.labGroup})` : ""} · {day} {routineClockTime(c.start)}{" "}
      · {c.room}
      {c.teacher ? ` · ${c.teacher}` : ""}
    </span>
  );
}

/** A section of the version as students will see it, to check before going live. */
function Preview({
  v,
  preview,
}: {
  v: AdminRoutineVersionDetail;
  preview: RoutineSection;
}) {
  const navigate = useNavigate();
  return (
    <section aria-labelledby="preview" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="preview" className="font-expressive text-xl">
            Preview a section
          </h2>
          <p className="text-sm text-muted-foreground">
            The week as students will see it in v{v.version}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={preview.section}
            onValueChange={(section) =>
              navigate(`?preview=${encodeURIComponent(section)}`, {
                preventScrollReset: true,
                replace: true,
              })
            }
          >
            <SelectTrigger className="w-44" aria-label="Section to preview">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {v.sections.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {v.status === "live" && (
            <Button variant="ghost" size="sm" asChild>
              <Link
                to={routineHref({
                  department: "cse",
                  section: preview.section,
                  group: null,
                })}
                target="_blank"
              >
                Student page
                <ExternalLink aria-hidden />
              </Link>
            </Button>
          )}
        </div>
      </div>
      <WeekGrid
        classes={preview.classes}
        slots={preview.slots}
        days={weekDays(preview.classes)}
        today={null}
        now={null}
      />
    </section>
  );
}

export default function AdminRoutineVersion({
  loaderData,
}: Route.ComponentProps) {
  const { v, preview } = loaderData;
  const { changes } = v;
  // Owned by the page: the buttons go once the version is live (or deleted).
  const { run } = useFormAction();
  const name = `v${v.version}`;
  const unread = v.warnings.filter((w) => w.kind === "unreadable");
  const others = v.warnings.filter((w) => w.kind !== "unreadable");
  const changed =
    changes.moved +
    changes.room +
    changes.teacher +
    changes.added +
    changes.removed;

  return (
    <>
      <AdminPageHeader
        title={`${v.department} ${name}`}
        description={
          v.comparedWith
            ? `Compared with v${v.comparedWith}, ${v.status === "live" ? "the version it replaced" : "the live version"}.`
            : "The first version: nothing to compare with."
        }
        actions={
          <>
            {v.hasPdf ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">
                    <Download aria-hidden />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={versionPdfHref(v)} download>
                      <FileText />
                      DIU’s PDF
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={versionFileHref(v)} download>
                      <FileJson />
                      File read from it (JSON)
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" asChild>
                <a href={versionFileHref(v)} download>
                  <Download aria-hidden />
                  Uploaded file
                </a>
              </Button>
            )}
            {v.status !== "live" && (
              <ConfirmAction
                trigger={
                  <Button variant="outline">
                    <Trash2 aria-hidden />
                    Delete version
                  </Button>
                }
                title={`Delete ${name}?`}
                description={DELETE_DESCRIPTION}
                confirmLabel="Delete"
                destructive
                successMessage={`${name} deleted`}
                fields={{ intent: "delete", id: String(v.id), from: "review" }}
                run={run}
              />
            )}
            {v.status !== "live" && (
              <ConfirmAction
                trigger={
                  <Button>
                    <Radio aria-hidden />
                    Make {name} live
                  </Button>
                }
                title={`Make ${name} live?`}
                description={`Students will see ${name} straight away on the website and in the app.${v.comparedWith ? ` v${v.comparedWith} becomes a previous version; you can make it live again later.` : ""}`}
                confirmLabel="Make live"
                successMessage={`${name} is live`}
                fields={{ intent: "live", id: String(v.id) }}
                run={run}
              />
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <RoutineStatusBadge status={v.status} />
          <span>
            {formatNumber(v.sectionCount)} sections ·{" "}
            {formatNumber(v.classCount)} classes · uploaded{" "}
            {formatDate(v.createdAt)}
            {v.uploadedBy ? ` by ${v.uploadedBy.name}` : ""}
            {v.publishedOn
              ? ` · published by DIU ${formatDate(v.publishedOn)}`
              : ""}
          </span>
        </div>
      </AdminPageHeader>

      {v.comparedWith && (
        <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4">
          <ChangeStat value={changes.moved} label="classes moved" />
          <ChangeStat value={changes.room} label="room changes" />
          <ChangeStat value={changes.teacher} label="teacher changes" />
          <ChangeStat
            value={changes.added + changes.removed}
            label={`classes added or removed`}
          />
        </div>
      )}

      {(changes.sectionsAdded.length > 0 ||
        changes.sectionsRemoved.length > 0) && (
        <Alert variant="info">
          <AlertTitle>Sections</AlertTitle>
          <AlertDescription>
            {changes.sectionsAdded.length > 0 && (
              <p>New: {changes.sectionsAdded.join(", ")}</p>
            )}
            {changes.sectionsRemoved.length > 0 && (
              <p>Gone: {changes.sectionsRemoved.join(", ")}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {unread.length > 0 && (
        <Alert variant="destructive">
          <FileWarning aria-hidden />
          <AlertTitle>
            {unread.length} place{unread.length === 1 ? "" : "s"} in DIU’s PDF
            to check
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 grid max-h-80 list-disc gap-1 overflow-y-auto pl-4">
              {unread.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
            <p className="mt-2">
              Cells that couldn’t be read are left out, so students won’t see
              those classes; others were read with a guess. Compare them with
              the PDF. To correct them, download the file read from it, fix it,
              delete this draft and upload the file.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {others.length > 0 && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertTitle>
            {others.length} warning{others.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 grid max-h-80 list-disc gap-1 overflow-y-auto pl-4">
              {others.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
            <p className="mt-2">
              {v.hasPdf
                ? "These may be in DIU’s routine itself, or misread from the PDF. If they’re misread, fix the file read from it and upload it as a new draft."
                : "These may be in DIU’s routine itself, or slips in the file. Fix the file and upload it as a new draft if they’re slips."}
            </p>
          </AlertDescription>
        </Alert>
      )}

      {preview && <Preview v={v} preview={preview} />}

      {v.comparedWith && (
        <section className="space-y-3">
          <h2 className="font-expressive text-xl">
            {changed === 0
              ? `No class changed from v${v.comparedWith}`
              : `What changed from v${v.comparedWith}`}
          </h2>
          {changes.items.length > 0 && (
            <div className="overflow-hidden rounded-2xl bg-surface-low">
              <Table>
                <TableHeader className="bg-surface-high">
                  <TableRow>
                    <TableHead>Section</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>v{v.comparedWith}</TableHead>
                    <TableHead>{name}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.items.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-semibold">
                        <Link
                          to={`?preview=${encodeURIComponent(c.section)}#preview`}
                          preventScrollReset
                          className="underline-offset-4 hover:underline"
                          title={`Preview ${c.section}`}
                        >
                          {c.section}
                        </Link>
                      </TableCell>
                      <TableCell>{KIND_LABELS[c.kind]}</TableCell>
                      <TableCell>{describe(c.before)}</TableCell>
                      <TableCell>{describe(c.after)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {changes.items.length < changed && (
            <p className="text-sm text-muted-foreground">
              The first {changes.items.length} of {formatNumber(changed)}{" "}
              changes.
            </p>
          )}
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        <Link to="/admin/routine/versions" className="text-primary underline">
          All versions
        </Link>
      </p>
    </>
  );
}
