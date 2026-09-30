import { useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatCount } from "~/lib/format";

export type UrlTab = {
  value: string;
  label: string;
  /** Search string the tab navigates to, e.g. "?status=published". */
  search: string;
  count?: number;
};

/**
 * Tabs that filter a list through the URL. Narrow screens get a select instead, like
 * shadcn's dashboard block. Put the list itself (and toolbar) in `children`.
 */
export function UrlTabs({
  label,
  tabs,
  value,
  children,
  toolbar,
}: {
  label: string;
  tabs: UrlTab[];
  value: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const go = (next: string) => {
    const tab = tabs.find((t) => t.value === next);
    if (tab) navigate({ search: tab.search }, { preventScrollReset: true });
  };

  return (
    <Tabs value={value} onValueChange={go} className="gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={value} onValueChange={go}>
          <SelectTrigger
            size="sm"
            className="flex w-fit @3xl/main:hidden"
            aria-label={label}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                {tab.label}
                {tab.count !== undefined && ` (${formatCount(tab.count)})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TabsList
          aria-label={label}
          className="hidden **:data-[slot=badge]:h-5 **:data-[slot=badge]:min-w-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1.5 @3xl/main:flex"
        >
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.count ? (
                <Badge variant="secondary">{formatCount(tab.count)}</Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {toolbar && (
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        )}
      </div>
      {children}
    </Tabs>
  );
}
