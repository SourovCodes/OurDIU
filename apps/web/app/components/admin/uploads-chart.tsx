import type { AdminStats } from "@ourdiu/shared";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { formatDay } from "~/lib/dates";
import { plural } from "~/lib/submissions";

type Day = AdminStats["dailySubmissions"][number];

const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "14", label: "Last 14 days" },
  { value: "7", label: "Last 7 days" },
];

const chartConfig = {
  count: { label: "Uploads", color: "var(--primary)" },
} satisfies ChartConfig;

/** New submissions per day as one series of bars, with a range toggle. */
export function UploadsChart({ days }: { days: Day[] }) {
  const [range, setRange] = useState("30");
  const shown = days.slice(-Number(range));
  const total = shown.reduce((sum, day) => sum + day.count, 0);
  const label = RANGES.find((r) => r.value === range)!.label;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Uploads</CardTitle>
        <CardDescription>
          {plural(total, "new submission")} · {label.toLowerCase()}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(value) => value && setRange(value)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[640px]/card:flex"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.value} value={r.value}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger
              size="sm"
              className="flex w-36 @[640px]/card:hidden"
              aria-label="Range"
            >
              <SelectValue>
                {RANGES.find((r) => r.value === range)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {RANGES.map((r) => (
                <SelectItem
                  key={r.value}
                  value={r.value}
                  className="rounded-lg"
                >
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="relative px-2 pt-2 sm:px-6">
        {total === 0 && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
            No uploads in this range
          </p>
        )}
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[240px] w-full"
          aria-label={`${plural(total, "upload")}, ${label.toLowerCase()}`}
        >
          <BarChart data={shown} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatDay}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatDay(String(value))}
                  indicator="dot"
                />
              }
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[8, 8, 8, 8]}
              maxBarSize={24}
            />
          </BarChart>
        </ChartContainer>
        <table className="sr-only">
          <caption>Uploads per day</caption>
          <tbody>
            {shown.map((day) => (
              <tr key={day.date}>
                <td>{formatDay(day.date)}</td>
                <td>{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
