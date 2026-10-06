import type {
  ReviewAuthorRole,
  ReviewMessage,
  ReviewMessageKind,
} from "@ourdiu/shared";
import { MAX_REVIEW_MESSAGE_LENGTH } from "@ourdiu/shared/constants";
import {
  CircleCheck,
  CircleX,
  FilePen,
  FileUp,
  Pencil,
  RotateCcw,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useId, useRef } from "react";
import { useFetcher } from "react-router";
import { toast } from "~/lib/toast";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { RelativeTime } from "~/components/relative-time";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import type { ActionResult } from "~/lib/action-result";
import { cn } from "~/lib/utils";

/** How each step of the review reads, from the person who took it. */
const STEPS: Record<
  Exclude<ReviewMessageKind, "comment">,
  { icon: LucideIcon; text: string; tone: string }
> = {
  changes_requested: {
    icon: FilePen,
    text: "asked for changes",
    tone: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  },
  rejected: {
    icon: CircleX,
    text: "rejected the paper",
    tone: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  },
  published: {
    icon: CircleCheck,
    text: "published the paper",
    tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
  returned_to_review: {
    icon: RotateCcw,
    text: "moved the paper back to review",
    tone: "bg-surface-high text-foreground",
  },
  details_edited: {
    icon: Pencil,
    text: "edited the details",
    tone: "bg-surface-high text-foreground",
  },
  file_replaced: {
    icon: FileUp,
    text: "replaced the file",
    tone: "bg-surface-high text-foreground",
  },
  resubmitted: {
    icon: Send,
    text: "resubmitted the paper for review",
    tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
};

function authorName(message: ReviewMessage, viewer: ReviewAuthorRole) {
  const { role, name } = message.author;
  if (role === viewer && viewer === "uploader") return "You";
  if (role === "admin") return name ?? "Reviewer";
  return name ?? "The uploader";
}

function Entry({
  message,
  viewer,
}: {
  message: ReviewMessage;
  viewer: ReviewAuthorRole;
}) {
  const mine = message.author.role === viewer;
  const name = authorName(message, viewer);
  const time = (
    <span className="text-xs text-muted-foreground">
      <RelativeTime iso={message.createdAt} />
    </span>
  );

  if (message.kind !== "comment") {
    const step = STEPS[message.kind];
    const Icon = step.icon;
    return (
      <li className="grid gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full",
              step.tone,
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </span>
          <span>
            <span className="font-medium">{name}</span> {step.text}
          </span>
          {time}
        </div>
        {message.body && (
          <p className="ml-8 rounded-2xl bg-surface-high px-4 py-2.5 text-sm whitespace-pre-line">
            {message.body}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
      <ContributorAvatar
        name={name}
        image={message.author.image}
        size="sm"
        className="mt-5"
      />
      <div
        className={cn("grid max-w-[85%] gap-1", mine && "justify-items-end")}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{name}</span>
          {time}
        </div>
        <p
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line",
            mine
              ? "rounded-tr-sm bg-primary-container text-primary-container-foreground"
              : "rounded-tl-sm bg-surface-high",
          )}
        >
          {message.body}
        </p>
      </div>
    </li>
  );
}

/** Writes a message; posts `intent=message` with `body` to the page's action. */
function ReplyForm({ placeholder }: { placeholder: string }) {
  const id = useId();
  const fetcher = useFetcher<ActionResult>();
  const form = useRef<HTMLFormElement>(null);
  const busy = fetcher.state !== "idle";
  const { data, state } = fetcher;
  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (state !== "idle" || !data || handled.current === data) return;
    handled.current = data;
    if (data.ok) {
      form.current?.reset();
      toast.success("Message sent");
    } else {
      toast.error(data.error);
    }
  }, [data, state]);

  return (
    <fetcher.Form ref={form} method="post" className="grid gap-2">
      <input type="hidden" name="intent" value="message" />
      <Label htmlFor={id} className="sr-only">
        Message
      </Label>
      <Textarea
        id={id}
        name="body"
        rows={3}
        required
        maxLength={MAX_REVIEW_MESSAGE_LENGTH}
        placeholder={placeholder}
      />
      <Button
        type="submit"
        size="sm"
        className="justify-self-end"
        disabled={busy}
      >
        <Send />
        {busy ? "Sending…" : "Send"}
      </Button>
    </fetcher.Form>
  );
}

/**
 * A submission's review conversation between its uploader and the reviewers: their
 * messages, and each step of the review with its note. `unread` entries at the end
 * are marked new.
 */
export function ReviewThread({
  messages,
  viewer,
  unread = 0,
  canReply,
  placeholder,
  emptyText,
}: {
  messages: ReviewMessage[];
  viewer: ReviewAuthorRole;
  unread?: number;
  canReply: boolean;
  placeholder: string;
  emptyText: string;
}) {
  const firstNew = unread > 0 ? messages.length - unread : -1;
  return (
    <div className="grid gap-5">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="grid gap-4" aria-label="Review conversation">
          {messages.map((message, index) => (
            <Fragment key={message.id}>
              {index === firstNew && (
                <li
                  className="flex items-center gap-3 text-xs font-semibold text-primary"
                  aria-label="New messages"
                >
                  <span className="h-px flex-1 bg-primary/40" />
                  New
                  <span className="h-px flex-1 bg-primary/40" />
                </li>
              )}
              <Entry message={message} viewer={viewer} />
            </Fragment>
          ))}
        </ol>
      )}
      {canReply && <ReplyForm placeholder={placeholder} />}
    </div>
  );
}
