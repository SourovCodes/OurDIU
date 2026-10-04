import type {
  AdminRoutineTeacher,
  AdminRoutineTeacherList,
  RoutineDepartment,
} from "@ourdiu/shared";
import {
  Contact,
  EllipsisVertical,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  ActionDialog,
  ConfirmAction,
  useFormAction,
} from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import {
  departmentTabs,
  routineDepartmentOf,
} from "~/components/admin/routine";
import { EmptyState } from "~/components/empty-state";
import { FormField } from "~/components/form";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { UrlTabs } from "~/components/url-tabs";
import { adminGetJson } from "~/lib/admin.server";
import { routineCatalogAction } from "~/lib/routine-admin.server";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/admin-routine-teachers";

export const handle = { breadcrumb: "Teachers" };

export const meta: Route.MetaFunction = () => [
  { title: "Teachers — Routine — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const department = routineDepartmentOf(request);
  const { items } = await adminGetJson<AdminRoutineTeacherList>(
    request,
    `/routine/teachers?department=${department}`,
  );
  return { department, items };
}

export const action = ({ request }: Route.ActionArgs) =>
  routineCatalogAction(request);

export { AdminRouteError as ErrorBoundary };

/** A teacher's details: name, room, email, phone. New with initials too. */
function TeacherDialog({
  department,
  teacher,
  open,
  onOpenChange,
  trigger,
}: {
  department: RoutineDepartment;
  teacher?: AdminRoutineTeacher;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement;
}) {
  const [initials, setInitials] = useState(teacher?.initials ?? "");
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={
        teacher
          ? `${teacher.initials}${teacher.name ? ` · ${teacher.name}` : ""}`
          : `Add a ${department} teacher`
      }
      description="Students see these with the teacher’s classes, right away. Leave out what you don’t know."
      submitLabel="Save"
      pendingLabel="Saving…"
      successMessage={`${teacher?.initials ?? initials} saved`}
      fields={{
        intent: "teacher",
        department,
        ...(teacher ? { initials: teacher.initials } : {}),
      }}
    >
      {(fieldErrors) => (
        <>
          {!teacher && (
            <FormField
              label="Initials, as in the routine"
              name="initials"
              value={initials}
              onChange={(event) => setInitials(event.target.value)}
              placeholder="e.g. STA"
              required
              maxLength={15}
              autoFocus
              error={fieldErrors.initials}
            />
          )}
          <FormField
            label="Name"
            name="name"
            defaultValue={teacher?.name ?? ""}
            placeholder="Full name, e.g. Dr. Ayesha Rahman"
            required
            minLength={2}
            maxLength={120}
            autoFocus={!!teacher}
            error={fieldErrors.name}
          />
          <FormField
            label="Room where they sit"
            name="room"
            defaultValue={teacher?.room ?? ""}
            placeholder="e.g. KT-712"
            maxLength={60}
            error={fieldErrors.room}
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            defaultValue={teacher?.email ?? ""}
            placeholder="e.g. name@diu.edu.bd"
            maxLength={200}
            error={fieldErrors.email}
          />
          <FormField
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={teacher?.phone ?? ""}
            placeholder="e.g. 01712345678"
            maxLength={40}
            error={fieldErrors.phone}
          />
        </>
      )}
    </ActionDialog>
  );
}

function RowActions({
  teacher,
  run,
}: {
  teacher: AdminRoutineTeacher;
  run: ReturnType<typeof useFormAction>["run"];
}) {
  const [dialog, setDialog] = useState<"edit" | "forget" | null>(null);
  const onOpenChange = (open: boolean) => !open && setDialog(null);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:state-layer"
            aria-label={`Actions for ${teacher.initials}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil />
            {teacher.name ? "Edit details" : "Add details"}
          </DropdownMenuItem>
          {teacher.name && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDialog("forget")}
            >
              <Trash2 />
              Remove details
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <TeacherDialog
        department={teacher.department}
        teacher={teacher}
        open={dialog === "edit"}
        onOpenChange={onOpenChange}
      />
      <ConfirmAction
        open={dialog === "forget"}
        onOpenChange={onOpenChange}
        title={`Remove ${teacher.initials}’s details?`}
        description="Their name, room, email and phone are removed; students see only the initials."
        confirmLabel="Remove"
        destructive
        successMessage={`${teacher.initials}’s details removed`}
        fields={{
          intent: "forget-teacher",
          department: teacher.department,
          initials: teacher.initials,
        }}
        run={run}
      />
    </>
  );
}

function Teachers({
  department,
  items,
}: {
  department: RoutineDepartment;
  items: AdminRoutineTeacher[];
}) {
  // Owned by the list: a teacher added by hand goes when their details are removed.
  const { run } = useFormAction();
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const needle = query.trim().toLowerCase();
  const rows = items.filter(
    (t) =>
      (!needle ||
        [t.initials, t.name, t.room, t.email].some((v) =>
          v?.toLowerCase().includes(needle),
        )) &&
      (!missingOnly || !t.name),
  );
  const named = items.filter((t) => t.name).length;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search initials, names, rooms…"
            aria-label="Search teachers"
            className="h-8 pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={missingOnly}
          onClick={() => setMissingOnly((on) => !on)}
          className={cn(
            missingOnly &&
              "border-transparent bg-primary-container text-primary-container-foreground",
          )}
        >
          Without a name
        </Button>
        <TeacherDialog
          department={department}
          trigger={
            <Button size="sm" className="sm:ml-auto">
              <Plus />
              Add teacher
            </Button>
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Contact}
          title={
            items.length === 0
              ? `No ${department} teachers yet`
              : "No matching teachers"
          }
          description={
            items.length === 0
              ? `Teachers appear here once a ${department} routine PDF is uploaded, or add one.`
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface-low">
          <Table>
            <TableHeader className="bg-surface-high">
              <TableRow>
                <TableHead className="w-24">Initials</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden @xl/main:table-cell">
                  Sits in
                </TableHead>
                <TableHead className="hidden @3xl/main:table-cell">
                  Contact
                </TableHead>
                <TableHead className="hidden text-right @3xl/main:table-cell">
                  Classes a week
                </TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.initials}>
                  <TableCell className="font-semibold">{t.initials}</TableCell>
                  <TableCell className="max-w-72 truncate">
                    {t.name ?? (
                      <TeacherDialog
                        department={department}
                        teacher={t}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 h-7 text-muted-foreground"
                          >
                            <Pencil />
                            Add details
                          </Button>
                        }
                      />
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground @xl/main:table-cell">
                    {t.room ?? "—"}
                  </TableCell>
                  <TableCell className="hidden @3xl/main:table-cell">
                    <span className="grid gap-0.5 text-sm text-muted-foreground">
                      {t.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="size-3.5" aria-hidden />
                          {t.email}
                        </span>
                      )}
                      {t.phone && (
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <Phone className="size-3.5" aria-hidden />
                          {t.phone}
                        </span>
                      )}
                      {!t.email && !t.phone && "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums @3xl/main:table-cell">
                    {t.liveClasses || "—"}
                  </TableCell>
                  <TableCell>
                    <RowActions teacher={t} run={run} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="px-1 text-sm text-muted-foreground">
        {named} of {items.length} teachers have a name
      </p>
    </div>
  );
}

export default function AdminRoutineTeachers({
  loaderData,
}: Route.ComponentProps) {
  const { department, items } = loaderData;
  return (
    <>
      <AdminPageHeader
        title="Teachers"
        description="DIU’s routine PDFs give teachers’ initials (EEE’s also lists names, phones and emails). Names, the room where a teacher sits, emails and phones added here show with their classes for students right away."
      />
      <UrlTabs label="Departments" tabs={departmentTabs} value={department}>
        <Teachers key={department} department={department} items={items} />
      </UrlTabs>
    </>
  );
}
