import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  xl: "size-20 text-2xl",
};

/** Up to two initials: "Ayesha Rahman" → "AR". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words[0]![0]! + words.at(-1)![0]!
      : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** A user's photo, or their initials when they have none (or it fails to load). */
export function UserAvatar({
  name,
  image,
  size = "sm",
  className,
}: {
  name: string;
  image?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], className)} aria-hidden>
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback className="font-medium">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
