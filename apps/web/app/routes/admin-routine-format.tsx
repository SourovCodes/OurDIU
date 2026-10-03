import { Check, Copy, Download } from "lucide-react";
import { useRef, useState } from "react";
import { AdminPageHeader } from "~/components/admin/admin-header";
import { AdminRouteError } from "~/components/admin/route-error";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  ROUTINE_EXAMPLE,
  ROUTINE_FIELD_RULES,
  routineAiInstructions,
} from "~/lib/routine-format";
import { routineFileJsonSchema } from "~/lib/routine-format.server";
import type { Route } from "./+types/admin-routine-format";

export const handle = { breadcrumb: "Routine file format" };

export const meta: Route.MetaFunction = () => [
  { title: "Routine file format — Admin — OurDIU" },
  { name: "robots", content: "noindex" },
];

// The admin layout checks the visitor is an admin.
export function loader() {
  return { instructions: routineAiInstructions(routineFileJsonSchema()) };
}

export { AdminRouteError as ErrorBoundary };

function CopyInstructions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const fallback = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            fallback.current?.select();
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copied" : "Copy AI instructions"}
      </Button>
      <textarea
        ref={fallback}
        readOnly
        value={text}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      />
    </>
  );
}

export default function AdminRoutineFormat({
  loaderData,
}: Route.ComponentProps) {
  return (
    <>
      <AdminPageHeader
        title="Routine file format"
        description="One JSON file per routine version, made from DIU’s routine PDF by hand or with an AI chat. Copy the AI instructions, paste them into a chat with the PDF, check the answer and upload it."
        actions={<CopyInstructions text={loaderData.instructions} />}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/admin/routine/format/example.json" download>
              <Download aria-hidden />
              Example file (67_B)
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/admin/routine/format/schema.json" download>
              <Download aria-hidden />
              JSON schema
            </a>
          </Button>
        </div>
      </AdminPageHeader>
      <div className="grid items-start gap-5 @5xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <pre
          tabIndex={0}
          aria-label="Example routine file"
          className="max-h-[40rem] overflow-auto rounded-2xl bg-surface-high p-5 font-mono text-[0.8125rem] leading-relaxed"
        >
          {JSON.stringify(
            {
              ...ROUTINE_EXAMPLE,
              classes: ROUTINE_EXAMPLE.classes.slice(3, 7),
            },
            null,
            2,
          )}
        </pre>
        <div className="overflow-hidden rounded-2xl bg-surface-low">
          <Table>
            <TableHeader className="bg-surface-high">
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROUTINE_FIELD_RULES.map((r) => (
                <TableRow key={r.field}>
                  <TableCell className="align-top">
                    <code className="text-[0.8125rem] font-semibold whitespace-nowrap">
                      {r.field}
                    </code>
                  </TableCell>
                  <TableCell className="whitespace-normal">{r.rule}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        An upload is checked against these rules; a file that breaks one is
        turned away with where the problem is. Clashes (a room, a teacher or a
        section in two places at once) and courses without a title don’t stop an
        upload: they show as warnings on the draft.
      </p>
    </>
  );
}
