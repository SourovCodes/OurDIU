import type { AdminDepartment, AdminDepartmentList } from "@ourdiu/shared";
import {
  Building2,
  EllipsisVertical,
  Pencil,
  Plus,
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
import { EmptyState } from "~/components/empty-state";
import { FormField } from "~/components/form";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { adminGetJson, adminRequest, formObject } from "~/lib/admin.server";
import type { Route } from "./+types/admin-departments";

export const handle = { breadcrumb: "Departments" };

export const meta: Route.MetaFunction = () => [
  { title: "Departments — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  return adminGetJson<AdminDepartmentList>(request, "/departments");
}

export async function action({ request }: Route.ActionArgs) {
  const { intent, id, ...fields } = formObject(await request.formData());
  switch (intent) {
    case "create":
      return adminRequest(request, intent, "POST", "/departments", fields);
    case "update":
      return adminRequest(request, intent, "PUT", `/departments/${id}`, fields);
    default:
      return adminRequest(request, "delete", "DELETE", `/departments/${id}`);
  }
}

export { AdminRouteError as ErrorBoundary };

/** The add and edit dialogs' fields. */
function DepartmentFields({
  department,
  fieldErrors,
}: {
  department?: AdminDepartment;
  fieldErrors: Record<string, string>;
}) {
  return (
    <>
      <FormField
        label="Short name"
        name="shortName"
        defaultValue={department?.shortName}
        placeholder="CSE"
        autoComplete="off"
        required
        maxLength={10}
        error={fieldErrors.shortName}
      />
      <FormField
        label="Name"
        name="name"
        defaultValue={department?.name}
        placeholder="Computer Science and Engineering"
        autoComplete="off"
        required
        maxLength={120}
        error={fieldErrors.name}
      />
    </>
  );
}

function RowActions({
  department,
  remove,
}: {
  department: AdminDepartment;
  remove: ReturnType<typeof useFormAction>["run"];
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:bg-muted"
            aria-label={`Actions for ${department.shortName}`}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ActionDialog
        open={editing}
        onOpenChange={setEditing}
        title={`Edit ${department.shortName}`}
        submitLabel="Save"
        pendingLabel="Saving…"
        successMessage="Department saved"
        fields={{ intent: "update", id: String(department.id) }}
      >
        {(fieldErrors) => (
          <DepartmentFields department={department} fieldErrors={fieldErrors} />
        )}
      </ActionDialog>
      <ConfirmAction
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${department.shortName}?`}
        description={department.name}
        confirmLabel="Delete"
        destructive
        successMessage={`${department.shortName} deleted`}
        fields={{ intent: "delete", id: String(department.id) }}
        run={remove}
      />
    </>
  );
}

export default function AdminDepartments({ loaderData }: Route.ComponentProps) {
  // Owned by the page: deleting removes the row the dialog lives in.
  const { run: remove } = useFormAction();
  const addButton = (
    <ActionDialog
      trigger={
        <Button size="sm">
          <Plus />
          Add department
        </Button>
      }
      title="Add a department"
      submitLabel="Add"
      pendingLabel="Adding…"
      successMessage="Department added"
      fields={{ intent: "create" }}
    >
      {(fieldErrors) => <DepartmentFields fieldErrors={fieldErrors} />}
    </ActionDialog>
  );

  return (
    <>
      <AdminPageHeader
        title="Departments"
        description="University departments, shared by every OurDIU product."
        actions={addButton}
      />
      {loaderData.items.length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-28">Short name</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loaderData.items.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">
                    {department.shortName}
                  </TableCell>
                  <TableCell className="max-w-0 truncate">
                    {department.name}
                  </TableCell>
                  <TableCell>
                    <RowActions department={department} remove={remove} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
