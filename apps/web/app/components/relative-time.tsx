import { formatDate, formatRelative } from "~/lib/dates";

/**
 * "5 minutes ago", with the date on hover. The server and the browser may disagree by
 * a few seconds, so hydration differences are expected here.
 */
export function RelativeTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatDate(iso)} suppressHydrationWarning>
      {formatRelative(iso)}
    </time>
  );
}
