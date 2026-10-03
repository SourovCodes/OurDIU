import type { RoutineClass } from "@ourdiu/shared";
import { routineGroupLabel, routineTimeRange } from "@ourdiu/shared/constants";
import { describe, expect, it } from "vitest";
import {
  classesFor,
  classState,
  dhakaNow,
  exactSection,
  matchSections,
  routineHref,
  savedRoutine,
  sectionChoices,
  weekDays,
} from "./routine";

const cls = (over: Partial<RoutineClass>): RoutineClass => ({
  day: "SUN",
  start: "10:00",
  end: "11:30",
  course: { code: "CSE315", title: "Software Engineering" },
  labGroup: null,
  room: "KT-213",
  roomType: null,
  teacher: { initials: "AS", name: null },
  ...over,
});

const choices = sectionChoices([
  { section: "65_A", labGroups: [], classCount: 6 },
  { section: "67_B", labGroups: ["B1", "B2"], classCount: 10 },
  { section: "RE_A(3C)", labGroups: [], classCount: 2 },
]);

describe("section search", () => {
  it("finds sections and lab groups regardless of case, spaces and underscores", () => {
    expect(matchSections(choices, "67b").map((c) => c.label)).toEqual([
      "67_B",
      "67_B1",
      "67_B2",
    ]);
    expect(matchSections(choices, "67 b2").map((c) => c.label)).toEqual([
      "67_B2",
    ]);
    expect(matchSections(choices, "re")[0]!.section).toBe("RE_A(3C)");
    expect(matchSections(choices, "  ")).toEqual([]);
  });

  it("opens exactly what was typed", () => {
    expect(exactSection(choices, "67_b1")).toMatchObject({
      section: "67_B",
      group: "B1",
    });
    expect(exactSection(choices, "67")).toBeNull();
  });
});

describe("saved section", () => {
  it("reads the cookie among others", () => {
    expect(savedRoutine("a=1; ourdiu_routine=cse%2F67_B%2FB1; b=2")).toEqual({
      department: "cse",
      section: "67_B",
      group: "B1",
    });
    expect(savedRoutine("ourdiu_routine=cse%2F65_A%2F")).toEqual({
      department: "cse",
      section: "65_A",
      group: null,
    });
  });

  it("ignores unknown departments and junk", () => {
    expect(savedRoutine("ourdiu_routine=bba%2F1_A%2F")).toBeNull();
    expect(savedRoutine("ourdiu_routine=")).toBeNull();
    expect(savedRoutine(null)).toBeNull();
  });
});

describe("a section's week", () => {
  const week = [
    cls({}),
    cls({
      day: "MON",
      labGroup: "B1",
      course: { code: "CSE322", title: null },
    }),
    cls({
      day: "MON",
      labGroup: "B2",
      course: { code: "CSE322", title: null },
    }),
  ];

  it("keeps a lab group's own labs and the whole section's classes", () => {
    expect(classesFor(week, "B1").map((c) => c.labGroup)).toEqual([null, "B1"]);
    expect(classesFor(week, null)).toHaveLength(3);
  });

  it("shows Friday only when there are classes on it", () => {
    expect(weekDays(week)).toEqual(["SAT", "SUN", "MON", "TUE", "WED", "THU"]);
    expect(weekDays([cls({ day: "FRI" })])).toContain("FRI");
  });

  it("tells a class that's on from one that's over or to come", () => {
    const now = { day: "SUN" as const, minutes: 10 * 60 + 40 };
    expect(classState(cls({}), now)).toBe("now");
    expect(classState(cls({ start: "11:30", end: "13:00" }), now)).toBe(
      "later",
    );
    expect(classState(cls({ start: "08:30", end: "10:00" }), now)).toBe("over");
    expect(classState(cls({ day: "MON" }), now)).toBeNull();
  });
});

describe("routine helpers", () => {
  it("knows the day and time in Dhaka (UTC+6)", () => {
    // Saturday 23:30 UTC is Sunday 05:30 in Dhaka.
    expect(dhakaNow(new Date("2026-10-03T23:30:00Z"))).toEqual({
      day: "SUN",
      minutes: 5 * 60 + 30,
    });
  });

  it("names lab groups and times as students write them", () => {
    expect(routineGroupLabel("67_B", "B1")).toBe("67_B1");
    expect(routineGroupLabel("RE_A(3C)", "G1")).toBe("RE_A(3C) (G1)");
    expect(routineTimeRange("10:00", "11:30")).toBe("10:00 – 11:30 am");
    expect(routineTimeRange("11:30", "13:00")).toBe("11:30 am – 1:00 pm");
  });

  it("links to a section and lab group", () => {
    expect(
      routineHref({ department: "cse", section: "RE_A(3C)", group: null }),
    ).toBe("/routine/cse/RE_A(3C)");
    expect(
      routineHref({ department: "cse", section: "67_B", group: "B1" }),
    ).toBe("/routine/cse/67_B?group=B1");
  });
});
