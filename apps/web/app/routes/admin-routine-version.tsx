import type {
  AdminRoutineVersionDetail,
  RoutineChange,
  RoutineChangedClass,
} from "@ourdiu/shared";
import {
  ROUTINE_DAY_NAMES,
  ROUTINE_DAYS,
  routineClockTime,
} from "@ourdiu/shared/constants";
import { Download, Radio, Trash2, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { ConfirmAction, useFormAction } from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import {
  ChangeStat,
  RoutineStatusBadge,
  versionFileHref,
} from "~/components/admin/routine";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
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
import { routineAdminAction } from "~/lib/routine-admin.server";
import type { Route } from "./+types/admin-routine-version";

export const handle = {
  breadcrumb: (data: unknown) =>
    data ? `v${(data as AdminRoutineVersionDetail).version}` : "Version",
};

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title: `${loaderData ? `v${loaderData.version}` : "Version"} — Routine — Admin — OurDIU`,
  },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  return adminGetJson<AdminRoutineVersionDetail>(
    request,
    `/routine/versions/${encodeURIComponent(params.id)}`,
  );
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

export default function AdminRoutineVersion({
  loaderData: v,
}: Route.ComponentProps) {
  const { changes } = v;
  // Owned by the page: the buttons go once the version is live (or deleted).
  const { run } = useFormAction();
  const name = `v${v.version}`;
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
            <Button variant="ghost" asChild>
              <a href={versionFileHref(v)} download>
                <Download aria-hidden />
                Uploaded file
              </a>
            </Button>
            {v.status === "draft" && (
              <ConfirmAction
                trigger={
                  <Button variant="outline">
                    <Trash2 aria-hidden />
                    Delete draft
                  </Button>
                }
                title={`Delete draft ${name}?`}
                description="The draft and its uploaded file are deleted. You can upload the file again."
                confirmLabel="Delete"
                destructive
                successMessage={`Draft ${name} deleted`}
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

      {v.warnings.length > 0 && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden />
          <AlertTitle>
            {v.warningCount} warning{v.warningCount === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 grid max-h-80 list-disc gap-1 overflow-y-auto pl-4">
              {v.warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
            <p className="mt-2">
              These may be in DIU’s routine itself, or slips in the file. Fix
              the file and upload it as a new draft if they’re slips.
            </p>
          </AlertDescription>
        </Alert>
      )}

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
                        {c.section}
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
