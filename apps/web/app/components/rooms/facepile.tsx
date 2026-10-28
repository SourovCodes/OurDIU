import type { RoomVoiceMember } from "@ourdiu/shared/rooms";
import { ContributorAvatar } from "~/components/contributor-avatar";
import { cn } from "~/lib/utils";

/** Up to `max` people in the call, talkers with a ring in the space's colour. */
export function Facepile({
  voice,
  speaking,
  max = 5,
  ringClass = "ring-primary-container",
}: {
  voice: RoomVoiceMember[];
  speaking: ReadonlySet<string>;
  max?: number;
  /** The surface the pile sits on, so the gap around each face matches it. */
  ringClass?: string;
}) {
  if (voice.length === 0) return null;
  const shown = voice.slice(0, max);
  return (
    <div className="flex shrink-0 items-center" aria-hidden>
      {shown.map((member, i) => (
        <span
          key={member.id}
          className={cn(
            "rounded-full ring-3 transition-shadow",
            ringClass,
            i > 0 && "-ml-2.5",
            speaking.has(member.id) &&
              "outline-3 outline-offset-3 outline-primary",
          )}
        >
          <ContributorAvatar
            name={member.name}
            image={member.image}
            size="md"
          />
        </span>
      ))}
      {voice.length > max && (
        <span
          className={cn(
            "-ml-2.5 flex size-10 items-center justify-center rounded-full bg-surface-highest text-xs font-semibold ring-3",
            ringClass,
          )}
        >
          +{voice.length - max}
        </span>
      )}
    </div>
  );
}
