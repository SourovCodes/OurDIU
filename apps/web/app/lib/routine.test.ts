import type { RoutineClass } from "@ourdiu/shared";
import { routineGroupLabel, routineTimeRange } from "@ourdiu/shared/constants";
import { describe, expect, it } from "vitest";
import {
  classesFor,
  classState,
  dhakaNow,
  dayWord,
  exactSection,
  isRegularSection,
  matchSections,
  nextClass,
  routineHref,
  sectionGroup,
  sectionGroups,
  savedRoutine,
  sectionChoices,
  weekDates,
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
  teacher: { initials: "AS", name: null, phone: null, email: null, room: null },
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

  it("finds EEE's sections however they're typed", () => {
    const eee = sectionChoices([
      { section: "1-2 B", labGroups: ["B1", "B2"], classCount: 12 },
    ]);
    expect(matchSections(eee, "12b1").map((c) => c.label)).toEqual(["1-2 B1"]);
    // As a page address has it.
    expect(exactSection(eee, "1-2_B")).toMatchObject({
      section: "1-2 B",
      group: null,
    });
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
    expect(routineGroupLabel("1-2 B", "B1")).toBe("1-2 B1");
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
    // EEE's sections have a space: an underscore in addresses.
    expect(
      routineHref({ department: "eee", section: "1-2 B", group: "B1" }),
    ).toBe("/routine/eee/1-2_B?group=B1");
  });

  it("groups sections by batch, or by level and term", () => {
    expect(
      sectionGroups(["65_A", "67_B", "67_A", "RE_A(3C)"]).map((g) => [
        g.title,
        g.name,
        g.sections,
      ]),
    ).toEqual([
      ["67", "batch 67", ["67_B", "67_A"]],
      ["65", "batch 65", ["65_A"]],
      ["Retakes", null, ["RE_A(3C)"]],
    ]);
    expect(
      sectionGroups(["2-2 C", "1-2 B", "1-2 A"]).map((g) => [g.title, g.name]),
    ).toEqual([
      ["1-2", "level 1, term 2"],
      ["2-2", "level 2, term 2"],
    ]);
    expect(sectionGroup("1-2 B")?.letter).toBe("B");
  });
});

describe("the next class", () => {
  const week = [
    cls({ day: "SUN", start: "10:00", end: "11:30" }),
    cls({ day: "SUN", start: "14:30", end: "16:00" }),
    cls({ day: "MON", start: "08:30", end: "11:30" }),
  ];
  const at = (day: "SUN" | "MON" | "TUE", hhmm: string) => ({
    day,
    minutes: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)),
  });

  it("is later today, tomorrow, or next week after the last one", () => {
    expect(nextClass(week, at("SUN", "10:40"))).toMatchObject({
      c: { start: "14:30" },
      daysAhead: 0,
    });
    expect(nextClass(week, at("SUN", "17:00"))).toMatchObject({
      c: { day: "MON" },
      daysAhead: 1,
    });
    expect(nextClass(week, at("TUE", "09:00"))).toMatchObject({
      c: { day: "SUN", start: "10:00" },
      daysAhead: 5,
    });
    expect(nextClass([], at("SUN", "09:00"))).toBeNull();
  });

  it("says when in words", () => {
    expect(dayWord("MON", 0)).toBe("Today");
    expect(dayWord("MON", 1)).toBe("Tomorrow");
    expect(dayWord("WED", 3)).toBe("Wednesday");
  });

  it("dates this university week in Dhaka", () => {
    // Sunday 4 October 2026 in Dhaka: Saturday the 3rd to Friday the 9th.
    expect(weekDates(new Date("2026-10-04T05:00:00Z"))).toEqual({
      SAT: 3,
      SUN: 4,
      MON: 5,
      TUE: 6,
      WED: 7,
      THU: 8,
      FRI: 9,
    });
  });

  it("tells a batch's section from a retake section", () => {
    expect(isRegularSection("67_B")).toBe(true);
    expect(isRegularSection("1-2 B")).toBe(true);
    expect(isRegularSection("RE_A(3C)")).toBe(false);
  });
});
