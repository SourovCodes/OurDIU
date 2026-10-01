import { ContributorAvatar } from "~/components/contributor-avatar";

/** A user's photo or initials, sized by `className` (default 32px). */
export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  return (
    <ContributorAvatar
      name={name}
      image={image}
      size="sm"
      className={className}
    />
  );
}
