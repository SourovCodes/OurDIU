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
import { Form, Link } from "react-router";
import {
  ActionDialog,
  ConfirmAction,
  useFormAction,
} from "~/components/actions";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import {
  catalogApiQuery,
  catalogSearch,
  catalogViewOf,
  departmentTabs,
  InlineEdit,
  SelectionBar,
  type CatalogView,
} from "~/components/admin/routine";
import { EmptyState } from "~/components/empty-state";
import { FormField } from "~/components/form";
import { TablePagination } from "~/components/table-pagination";
import { Button, buttonVariants } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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

const PAGE_SIZE = 25;

export async function loader({ request }: Route.LoaderArgs) {
  const view = catalogViewOf(request);
  const list = await adminGetJson<AdminRoutineTeacherList>(
    request,
    `/routine/teachers?${catalogApiQuery(view, PAGE_SIZE)}`,
  );
  return { view, list };
}

export const action = ({ request }: Route.ActionArgs) =>
  routineCatalogAction(request);

export { AdminRouteError as ErrorBoundary };

/** A teacher's details: name, designation, room, email, phone. New with initials too. */
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
            label="Designation"
            name="designation"
            defaultValue={teacher?.designation ?? ""}
            placeholder="e.g. Assistant Professor"
            maxLength={80}
            error={fieldErrors.designation}
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
            Edit details
          </DropdownMenuItem>
          {(teacher.name ||
            teacher.designation ||
            teacher.room ||
            teacher.email ||
            teacher.phone) && (
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
        description="Their name, designation, room, email and phone are removed; students see only the initials."
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
  view,
  list,
}: {
  view: CatalogView;
  list: AdminRoutineTeacherList;
}) {
  // Owned by the list: teachers added by hand go when their details are removed.
  const { run } = useFormAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);
  const { department } = view;
  const { items } = list;
  // Selected rows on this page; ones gone after a removal drop out on their own.
  const picked = selected.filter((i) => items.some((t) => t.initials === i));
  const allPicked = items.length > 0 && picked.length === items.length;
  const toggle = (initials: string, on: boolean) =>
    setSelected((all) =>
      on ? [...all, initials] : all.filter((other) => other !== initials),
    );
  const filtered = view.q !== "" || view.missing;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Form role="search" className="relative sm:w-72">
          {department !== "CSE" && (
            <input type="hidden" name="department" value={department} />
          )}
          {view.missing && <input type="hidden" name="missing" value="true" />}
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            key={view.q}
            type="search"
            name="q"
            defaultValue={view.q}
            placeholder="Search initials, names, rooms…"
            aria-label="Search teachers"
            className="h-8 pl-8"
          />
        </Form>
        <Link
          to={catalogSearch({ ...view, missing: !view.missing, page: 1 })}
          aria-pressed={view.missing}
          preventScrollReset
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "self-start",
            view.missing &&
              "border-transparent bg-primary-container text-primary-container-foreground",
          )}
        >
          Without a name
        </Link>
        <TeacherDialog
          department={department}
          trigger={
            <Button size="sm" className="self-start sm:ml-auto">
              <Plus />
              Add teacher
            </Button>
          }
        />
      </div>

      {picked.length > 0 && (
        <SelectionBar count={picked.length} onClear={() => setSelected([])}>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRemoving(true)}
          >
            <Trash2 />
            Remove details
          </Button>
        </SelectionBar>
      )}
      <ConfirmAction
        open={removing}
        onOpenChange={setRemoving}
        title={`Remove ${picked.length === 1 ? "1 teacher’s" : `${picked.length} teachers’`} details?`}
        description={`Their names, designations, rooms, emails and phones are removed; students see only the initials: ${picked.join(", ")}.`}
        confirmLabel="Remove"
        destructive
        successMessage={
          picked.length === 1
            ? "Details removed"
            : `${picked.length} teachers’ details removed`
        }
        fields={{
          intent: "forget-teachers",
          department,
          list: picked.join("\n"),
        }}
        run={(fields, message, to) => {
          run(fields, message, to);
          setSelected([]);
        }}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Contact}
          title={
            filtered ? "No matching teachers" : `No ${department} teachers yet`
          }
          description={
            filtered
              ? undefined
              : `Teachers appear here once a ${department} routine PDF is uploaded, or add one.`
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface-low">
          <Table>
            <TableHeader className="bg-surface-high">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allPicked
                        ? true
                        : picked.length > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(on) =>
                      setSelected(
                        on === true ? items.map((t) => t.initials) : [],
                      )
                    }
                    aria-label="Select every teacher on this page"
                  />
                </TableHead>
                <TableHead className="w-20">Initials</TableHead>
                <TableHead>Name</TableHead>
                <TableHead
                  className="hidden @xl/main:table-cell"
                  title={
                    list.version
                      ? `Their courses in v${list.version}`
                      : undefined
                  }
                >
                  Teaches
                </TableHead>
                <TableHead className="hidden @3xl/main:table-cell">
                  Sits in
                </TableHead>
                <TableHead className="hidden @5xl/main:table-cell">
                  Contact
                </TableHead>
                <TableHead
                  className="hidden text-right @5xl/main:table-cell"
                  title={
                    list.version
                      ? `Classes a week in v${list.version}`
                      : undefined
                  }
                >
                  Classes
                </TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow
                  key={t.initials}
                  data-state={
                    picked.includes(t.initials) ? "selected" : undefined
                  }
                >
                  <TableCell>
                    <Checkbox
                      checked={picked.includes(t.initials)}
                      onCheckedChange={(on) => toggle(t.initials, on === true)}
                      aria-label={`Select ${t.initials}`}
                    />
                  </TableCell>
                  <TableCell className="font-semibold">{t.initials}</TableCell>
                  <TableCell className="w-full min-w-36 py-1">
                    <InlineEdit
                      label={`Name of ${t.initials}`}
                      defaultValue={t.name ?? ""}
                      placeholder="Add a name"
                      name="name"
                      maxLength={120}
                      // The other details go along, so saving a name keeps them.
                      fields={{
                        intent: "teacher",
                        department,
                        initials: t.initials,
                        designation: t.designation ?? "",
                        room: t.room ?? "",
                        email: t.email ?? "",
                        phone: t.phone ?? "",
                      }}
                    />
                  </TableCell>
                  <TableCell className="hidden max-w-56 text-sm leading-snug whitespace-normal text-muted-foreground @xl/main:table-cell">
                    {t.courses.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground @3xl/main:table-cell">
                    {t.room ?? "—"}
                  </TableCell>
                  <TableCell className="hidden @5xl/main:table-cell">
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
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums @5xl/main:table-cell">
                    {t.classes || "—"}
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
      <TablePagination
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        noun="teacher"
        hrefFor={(page) => catalogSearch({ ...view, page }) || "?"}
      />
      <p className="px-1 text-sm text-muted-foreground">
        {list.named} of {list.all} {department} teachers have a name
      </p>
    </div>
  );
}

export default function AdminRoutineTeachers({
  loaderData,
}: Route.ComponentProps) {
  const { view, list } = loaderData;
  return (
    <>
      <AdminPageHeader
        title="Teachers"
        description="DIU’s routine PDFs give teachers’ initials (EEE’s also lists names, phones and emails). Type a name and press Enter to save it and go on to the next; a teacher’s designation (for cover pages), the room where they sit, their email and phone are under Edit details in each row’s menu. Students see them right away."
      />
      <UrlTabs
        label="Departments"
        tabs={departmentTabs}
        value={view.department}
      >
        <Teachers key={view.department} view={view} list={list} />
      </UrlTabs>
    </>
  );
}
