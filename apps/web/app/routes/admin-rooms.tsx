import type { AdminRoomReport, AdminRooms } from "@ourdiu/shared";
import { ROOM_REPORT_REASON_LABELS } from "@ourdiu/shared/rooms";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  EllipsisVertical,
  Flag,
  Pause,
  Play,
} from "lucide-react";
import { useFormAction } from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import { UserAvatar } from "~/components/admin/user-avatar";
import { EmptyState } from "~/components/empty-state";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminGetJson, adminRequest } from "~/lib/admin.server";
import { formatDate } from "~/lib/dates";
import type { Route } from "./+types/admin-rooms";

export const handle = { breadcrumb: "Course rooms" };

export const meta: Route.MetaFunction = () => [
  { title: "Course rooms — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  return adminGetJson<AdminRooms>(request, "/rooms");
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const userId = encodeURIComponent(String(form.get("userId") ?? ""));
  switch (intent) {
    case "pause":
      return adminRequest(request, intent, "PUT", "/rooms/settings", {
        paused: form.get("paused") === "true",
      });
    case "ban":
      return adminRequest(request, intent, "PUT", `/rooms/bans/${userId}`, {
        reportId: Number(form.get("reportId")) || undefined,
      });
    case "unban":
      return adminRequest(request, intent, "DELETE", `/rooms/bans/${userId}`);
    default:
      return adminRequest(
        request,
        intent,
        "PATCH",
        `/rooms/reports/${encodeURIComponent(String(form.get("reportId")))}`,
        { status: form.get("status") },
      );
  }
}

export { AdminRouteError as ErrorBoundary };

const GB = 1e9;
const gb = (bytes: number) =>
  bytes >= 10 * GB
    ? Math.round(bytes / GB)
    : Math.round((bytes / GB) * 10) / 10;

export default function AdminRoomsPage({ loaderData }: Route.ComponentProps) {
  const { usage, reports, bans } = loaderData;
  // Owned by the page: an acted-on report leaves the list, row and all.
  const { run, busy } = useFormAction();
  const share = usage.voiceBytesCap
    ? Math.min(1, usage.voiceBytes / usage.voiceBytesCap)
    : 1;

  return (
    <>
      <AdminPageHeader
        title="Course rooms"
        description="Live voice and chat on every course. Chat isn't stored; rooms pause themselves when this cycle's estimate reaches the free allowance."
      />
      <div className="space-y-8">
        {!usage.enabled && (
          <Alert variant="warning">
            <AlertTitle>Rooms are off</AlertTitle>
            <AlertDescription>
              ROOMS isn't "on" in the Worker's config (wrangler.jsonc).
            </AlertDescription>
          </Alert>
        )}
        {!usage.voiceAvailable && (
          <Alert variant="info">
            <AlertTitle>Voice isn't set up</AlertTitle>
            <AlertDescription>
              Rooms have chat only until the Realtime SFU app's REALTIME_APP_ID
              (wrangler.jsonc) and REALTIME_APP_TOKEN (a secret) are set.
            </AlertDescription>
          </Alert>
        )}

        <section aria-labelledby="usage" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="usage" className="font-semibold">
              This cycle ({formatDate(usage.cycle)} to{" "}
              {formatDate(usage.resetsOn)})
            </h2>
            <Button
              variant={usage.paused ? "default" : "outline"}
              disabled={busy}
              onClick={() =>
                run(
                  { intent: "pause", paused: String(!usage.paused) },
                  usage.paused ? "Rooms resumed" : "Rooms paused",
                )
              }
            >
              {usage.paused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {usage.paused ? "Resume rooms" : "Pause rooms"}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2 rounded-3xl bg-surface-low p-5">
              <p className="text-sm text-muted-foreground">Voice (estimated)</p>
              <p className="font-expressive text-3xl">
                {gb(usage.voiceBytes)} GB{" "}
                <span className="font-sans text-base text-muted-foreground">
                  of {gb(usage.voiceBytesCap)} GB
                </span>
              </p>
              <div className="h-2 rounded-full bg-surface-highest" aria-hidden>
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${share * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-2 rounded-3xl bg-surface-low p-5">
              <p className="text-sm text-muted-foreground">Time in calls</p>
              <p className="font-expressive text-3xl">
                {Math.round(usage.voiceSeconds / 3600).toLocaleString()} h
              </p>
            </div>
            <div className="space-y-2 rounded-3xl bg-surface-low p-5">
              <p className="text-sm text-muted-foreground">Messages received</p>
              <p className="font-expressive text-3xl">
                {usage.messages.toLocaleString()}{" "}
                <span className="font-sans text-base text-muted-foreground">
                  of {usage.messagesCap.toLocaleString()}
                </span>
              </p>
            </div>
          </div>
          {usage.paused && (
            <p className="text-sm text-muted-foreground">
              Paused: rooms can't be joined, calls end within a minute.
            </p>
          )}
        </section>

        <section aria-labelledby="reports" className="space-y-3">
          <h2 id="reports" className="font-semibold">
            Open reports
          </h2>
          {reports.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="No open reports"
              description="When someone reports a person in a room, it shows up here."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl bg-surface-low">
              <Table>
                <TableHeader className="bg-surface-high">
                  <TableRow>
                    <TableHead>Reported</TableHead>
                    <TableHead className="hidden @3xl/main:table-cell">
                      Room
                    </TableHead>
                    <TableHead className="hidden @5xl/main:table-cell">
                      Reporter
                    </TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="w-full max-w-0">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={report.reported.name}
                            image={report.reported.image}
                            className="size-6"
                          />
                          <span className="truncate font-medium">
                            {report.reported.name}
                          </span>
                          {report.banned && (
                            <span className="shrink-0 text-xs text-destructive">
                              Banned
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {ROOM_REPORT_REASON_LABELS[report.reason]}
                          {report.message && `: “${report.message}”`}
                        </p>
                      </TableCell>
                      <TableCell className="hidden max-w-56 truncate @3xl/main:table-cell">
                        {report.course.name}
                      </TableCell>
                      <TableCell className="hidden @5xl/main:table-cell">
                        <span className="block max-w-40 truncate">
                          {report.reporter.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(report.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ReportActions report={report} run={run} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section aria-labelledby="bans" className="space-y-3">
          <h2 id="bans" className="font-semibold">
            Banned from rooms
          </h2>
          {bans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is banned.</p>
          ) : (
            <ul className="divide-y divide-surface-high overflow-hidden rounded-2xl bg-surface-low">
              {bans.map((ban) => (
                <li
                  key={ban.user.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <UserAvatar
                    name={ban.user.name}
                    image={ban.user.image}
                    className="size-8"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{ban.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ban.user.email} · since {formatDate(ban.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(
                        { intent: "unban", userId: ban.user.id },
                        `${ban.user.name} can join rooms again`,
                      )
                    }
                  >
                    Unban
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function ReportActions({
  report,
  run,
}: {
  report: AdminRoomReport;
  run: ReturnType<typeof useFormAction>["run"];
}) {
  const id = String(report.id);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground data-[state=open]:state-layer"
          aria-label={`Actions for report ${report.id}`}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {!report.banned && (
          <>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                run(
                  { intent: "ban", userId: report.reported.id, reportId: id },
                  `${report.reported.name} is banned from rooms`,
                )
              }
            >
              <Ban />
              Ban from rooms
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onSelect={() =>
            run(
              { intent: "report", reportId: id, status: "resolved" },
              "Report resolved",
            )
          }
        >
          <CircleCheck />
          Resolve
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            run(
              { intent: "report", reportId: id, status: "dismissed" },
              "Report dismissed",
            )
          }
        >
          <CircleDashed />
          Dismiss
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
