import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { cseRoutinePdf, onePagePdf } from "../../api/test/cse-routine-pdf";
import { eeeRoutinePdf } from "../../api/test/eee-routine-pdf";
import { sweRoutineXlsx } from "../../api/test/swe-routine-xlsx";
import {
  clickUntilUrl,
  failOnConsoleErrors,
  logInAs,
  openMenu,
  SEED_ADMIN,
} from "./helpers";

failOnConsoleErrors();

// The seed has CSE routine v4.1 live, with sections 67_B (lab groups B1 and B2) and
// 65_A. Admin tests upload their own versions and may make them live, so students'
// tests only rely on 67_B, which every uploaded version keeps as it is.
const SEED_ROUTINE = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "../../api/seeds/routine-cse-4.1.json"),
    "utf8",
  ),
) as {
  version: string;
  classes: { day: string; start: string; section: string }[];
};

/** A version number no other test (or the other browser project) uses. */
const uniqueVersion = () =>
  `${100 + Math.floor(Math.random() * 900)}.${Math.floor(Math.random() * 1000)}.${Date.now() % 1000}`;

test("a student finds their section, makes it theirs and downloads it", async ({
  page,
}) => {
  // Nothing saved yet, Today offers the two ways in.
  await page.goto("/routine");
  await expect(
    page.getByRole("heading", { name: "Your class routine." }),
  ).toBeVisible();
  await clickUntilUrl(page, "Find your section", /\/routine\/cse$/);

  // "67b1" finds lab group B1 of 67_B; Enter opens it.
  const search = page.getByRole("combobox", { name: /Your section/ });
  await expect(async () => {
    // Typed before hydration, the text stays without suggestions: type it again.
    await search.fill("");
    await search.fill("67b1");
    await expect(page.getByRole("option", { name: /67_B1/ })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/routine\/cse\/67_B\?group=B1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("67_B1");
  await expect(
    page.getByText("CSE batch 67, section B · lab group B1"),
  ).toBeVisible();

  // Lab group B1's lab is there, B2's isn't.
  const week = page.getByRole("region", { name: /week/ });
  if (await page.getByRole("table", { name: "The week" }).isVisible()) {
    await expect(week.getByText("CSE322 · B1")).toBeVisible();
    await expect(week.getByText("CSE322 · B2")).toHaveCount(0);
  } else {
    await page.getByRole("tab", { name: "Mon" }).click();
    await expect(week.getByText("Lab · 67_B1")).toBeVisible();
    await expect(week.getByText("Lab · 67_B2")).toHaveCount(0);
  }

  // A class opens in full: the teacher, how to reach them, the course's week.
  await week.getByRole("button", { name: /Computer Networks Lab/ }).click();
  const details = page.getByRole("dialog");
  await expect(details).toContainText("Monday, 2:30 – 5:30 pm");
  await expect(details).toContainText("Dr. Sample Teacher");
  await expect(details.getByText("Sits in KT-712")).toBeVisible();
  await expect(
    details.getByRole("link", { name: "sta@example.com" }),
  ).toHaveAttribute("href", "mailto:sta@example.com");
  await page.keyboard.press("Escape");

  // The PDF is this lab group's week.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^67_B1_routine_v.+\.pdf$/);

  // Made "my section", /routine offers it first.
  await expect(async () => {
    await page.getByRole("button", { name: "Make it my section" }).click();
    await expect(
      page.getByRole("button", { name: "My section", pressed: true }),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass();
  // The routine's home then opens with that section's day.
  await page.goto("/routine");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today");
  await expect(page.getByText("My section:")).toContainText("CSE 67_B1");
  await expect(
    page.getByRole("region", { name: "Today", exact: true }),
  ).toBeVisible();
  // Today is today (or the next class day): the week is on the section's page.
  await expect(page.getByRole("tablist", { name: "Day" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Week, courses and PDF" }),
  ).toHaveAttribute("href", "/routine/cse/67_B?group=B1");
  await clickUntilUrl(page, "CSE 67_B1", /\/routine\/cse\/67_B\?group=B1$/);
});

test("anyone finds a teacher's week, and a teacher makes it theirs", async ({
  page,
}) => {
  // In the seed STA is "Dr. Sample Teacher" (MRR and IK are "Sample" too), teaching
  // 67_B, which tests keep.
  // Teachers, from the routine's menu: the department's teachers, filtered as
  // you type.
  await page.goto("/routine/cse");
  // In the header on wide screens, the bottom bar on phones.
  await expect(async () => {
    await page.getByRole("link", { name: "Teachers", exact: true }).click();
    await expect(page).toHaveURL(/\/routine\/cse\/teachers$/, {
      timeout: 2_000,
    });
  }).toPass();
  const search = page.getByRole("searchbox", { name: /initials or name/ });
  await expect(async () => {
    await search.fill("");
    await search.fill("sample teacher");
    await expect(page.getByText(/^1 of \d+ teachers$/)).toBeVisible({
      timeout: 1_000,
    });
  }).toPass();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/routine\/cse\/teachers\/STA$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Dr. Sample Teacher",
  );
  await expect(page.getByText(/^STA · CSE teacher/)).toBeVisible();

  // A class says who attends, and leads to their section's week.
  const week = page.getByRole("region", { name: /week/ });
  if (!(await page.getByRole("table", { name: "The week" }).isVisible())) {
    await page.getByRole("tab", { name: "Mon" }).click();
  }
  await week
    .getByRole("button", { name: /Computer Networks Lab/ })
    .first()
    .click();
  const details = page.getByRole("dialog");
  await expect(
    details.getByRole("link", { name: /^67_B[12]$/ }),
  ).toHaveAttribute("href", /\/routine\/cse\/67_B\?group=B[12]$/);
  await page.keyboard.press("Escape");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^STA_routine_v.+\.pdf$/);

  // Made "my routine", /routine opens with the teacher's day.
  await expect(async () => {
    await page.getByRole("button", { name: "Make it my routine" }).click();
    await expect(
      page.getByRole("button", { name: "My routine", pressed: true }),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await page.goto("/routine");
  await expect(page.getByText("My routine:")).toContainText(
    "CSE Dr. Sample Teacher",
  );

  // A section's page links its teachers to their weeks; initials in any case work.
  await page.goto("/routine/cse/67_B");
  await expect(async () => {
    await page
      .getByRole("region", { name: "Courses" })
      .getByRole("link", { name: "Dr. Sample Teacher" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/routine\/cse\/teachers\/STA$/, {
      timeout: 2_000,
    });
  }).toPass();
  // Searched before the page is interactive, initials still open the week.
  await page.goto("/routine/cse/teachers?q=sta");
  await expect(page).toHaveURL(/\/routine\/cse\/teachers\/STA$/);
  await page.goto("/routine/cse/teachers/sta");
  await expect(page).toHaveURL(/\/routine\/cse\/teachers\/STA$/);
  const missing = await page.goto("/routine/cse/teachers/ZZZ");
  expect(missing?.status()).toBe(404);
  await expect(page.getByText("ZZZ isn’t in the routine")).toBeVisible();
});

test("section addresses are canonical, and near misses find the section", async ({
  page,
}) => {
  await page.goto("/routine/cse/67_b?group=B9");
  await expect(page).toHaveURL(/\/routine\/cse\/67_B$/);
  // Written another way, as students type it.
  await page.goto("/routine/cse/67-b1");
  await expect(page).toHaveURL(/\/routine\/cse\/67_B\?group=B1$/);

  // A section that isn't there offers the search and look-alikes.
  const missing = await page.goto("/routine/cse/67_Z");
  expect(missing?.status()).toBe(404);
  await expect(page.getByText("67_Z isn’t in the routine")).toBeVisible();
  await page.getByRole("link", { name: "67_B1" }).click();
  await expect(page).toHaveURL(/\/routine\/cse\/67_B\?group=B1$/);
});

test("an admin uploads CSE's routine PDF, reviews it and makes it live", async ({
  page,
}) => {
  // It compares the draft with the live version, which another run of this test
  // would change at the same time: once, on desktop.
  test.skip(
    test.info().project.name === "mobile",
    "Makes a version live: runs in one project",
  );
  const version = uniqueVersion();
  await logInAs(page, SEED_ADMIN, "/admin/routine/versions");
  await expect(
    page.getByRole("heading", { name: "Routine versions" }),
  ).toBeVisible();

  const dialog = page.getByRole("dialog", { name: "Upload a routine" });
  const openUpload = async () => {
    await expect(async () => {
      await page.getByRole("button", { name: "Upload routine" }).click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass();
  };
  const choose = (name: string, buffer: Uint8Array) =>
    dialog.getByLabel("Routine file").setInputFiles({
      name,
      mimeType: "application/pdf",
      buffer: Buffer.from(buffer),
    });

  // A PDF that isn't a department's routine is turned away, saying so.
  await openUpload();
  await choose(
    "bba-routine.pdf",
    await onePagePdf("Class Routine for BBA Program"),
  );
  await dialog.getByRole("button", { name: "Upload" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "isn’t a routine PDF OurDIU can read",
  );

  // CSE's PDF becomes a draft: one 65_A class moved from Thursday to Tuesday.
  const fixed = structuredClone(SEED_ROUTINE);
  fixed.version = version;
  const moved = fixed.classes.find(
    (c) => c.section === "65_A" && c.day === "THU",
  )!;
  moved.day = "TUE";
  await choose(
    `cse-class-routine-v${version}.pdf`,
    await cseRoutinePdf(fixed as Parameters<typeof cseRoutinePdf>[0]),
  );
  await dialog.getByRole("button", { name: "Upload" }).click();
  await expect(page).toHaveURL(/\/admin\/routine\/versions\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `CSE v${version}`,
  );
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Moved" })).toBeVisible();

  await page.getByRole("button", { name: `Make v${version} live` }).click();
  await page.getByRole("button", { name: "Make live" }).click();
  await expect(page.getByText(`v${version} is live`)).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  // Its number can be changed, live or not.
  const renumbered = uniqueVersion();
  await page.getByRole("button", { name: "Change number" }).click();
  const numberDialog = page.getByRole("dialog");
  await numberDialog.getByLabel("Version").fill(renumbered);
  await numberDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `CSE v${renumbered}`,
  );

  // It's in the list as the live version, which can be deleted too (not here:
  // students' tests need a CSE routine).
  await page.goto("/admin/routine/versions");
  const row = page.getByRole("row", { name: new RegExp(`CSE v${renumbered}`) });
  await expect(row.getByText("Live", { exact: true })).toBeVisible();
  await openMenu(
    row.getByRole("button", { name: `Actions for v${renumbered}` }),
  );
  await expect(page.getByRole("menuitem", { name: "Make live" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("menuitem", { name: "Delete version" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // The version it replaced can be deleted, file and all.
  const old = page.getByRole("row", { name: /CSE v4\.1/ });
  await expect(old.getByText("Previous", { exact: true })).toBeVisible();
  await openMenu(old.getByRole("button", { name: "Actions for v4.1" }));
  await page.getByRole("menuitem", { name: "Delete version" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("v4.1 deleted")).toBeVisible();
  await expect(old).toHaveCount(0);
});

test("an admin uploads EEE's routine PDF, and EEE students find their section", async ({
  page,
}) => {
  test.skip(
    test.info().project.name === "mobile",
    "Makes a version live: runs in one project",
  );
  const version = uniqueVersion();
  await logInAs(page, SEED_ADMIN, "/admin/routine/versions");
  const dialog = page.getByRole("dialog", { name: "Upload a routine" });
  await expect(async () => {
    await page.getByRole("button", { name: "Upload routine" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByLabel("Routine file").setInputFiles({
    name: `eee-class-routine-v${version}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(await eeeRoutinePdf(version)),
  });
  await dialog.getByRole("button", { name: "Upload" }).click();

  // Read into a draft, with the cells it read with a guess to check.
  await expect(page).toHaveURL(/\/admin\/routine\/versions\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `EEE v${version}`,
  );
  await expect(page.getByText("2 places in DIU’s file to check")).toBeVisible();
  await expect(page.getByText(/says 1-3 A but 0541-131 B/)).toBeVisible();
  await expect(page.getByRole("link", { name: "DIU’s file" })).toBeVisible();
  await page.getByRole("button", { name: `Make v${version} live` }).click();
  await page.getByRole("button", { name: "Make live" }).click();
  await expect(page.getByText(`v${version} is live`)).toBeVisible();

  // The PDF has no course titles: one is added. A teacher gets the room they sit in.
  await page.goto("/admin/routine/courses?department=EEE&missing=true");
  // Typed where it is: Enter saves and goes on to the next course.
  const title = page.getByLabel("Title of 0713-121");
  await expect(async () => {
    await title.fill("Electrical Circuits I");
    await title.press("Enter");
    await expect(
      page.getByText(/^1 of \d+ EEE courses have a title$/),
    ).toBeVisible({
      timeout: 2_000,
    });
  }).toPass();
  // Without a title any more, it's left the list.
  await expect(page.getByLabel("Title of 0713-121")).toHaveCount(0);

  await page.goto("/admin/routine/teachers?department=EEE");
  await openMenu(
    page
      .getByRole("row", { name: /\bMW\b/ })
      .getByRole("button", { name: "Actions for MW" }),
  );
  await page.getByRole("menuitem", { name: "Edit details" }).click();
  const teacherDialog = page.getByRole("dialog");
  // From the PDF's list of teachers.
  await expect(teacherDialog.getByLabel("Name")).toHaveValue("Test Wahid");
  await expect(teacherDialog.getByLabel("Email")).toHaveValue("mw@example.com");
  await teacherDialog.getByLabel("Room where they sit").fill("KT-712");
  await teacherDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("MW saved")).toBeVisible();

  // Students switch to EEE and find 1-2 B1 as they write it.
  await page.goto("/routine/cse");
  await expect(async () => {
    await page
      .getByRole("navigation", { name: "Departments" })
      .getByRole("link", { name: /EEE/ })
      .click();
    await expect(page).toHaveURL(/\/routine\/eee$/, { timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole("heading", { name: "Students" })).toBeVisible();
  const search = page.getByRole("combobox", { name: /Your section/ });
  await expect(async () => {
    await search.fill("");
    await search.fill("12b1");
    await expect(page.getByRole("option", { name: /1-2 B1/ })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/routine\/eee\/1-2_B\?group=B1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("1-2 B1");
  await expect(
    page.getByText(/EEE level 1, term 2, section B · lab group B1/),
  ).toBeVisible();
  // The title added, and the teacher with the PDF's details and the room added.
  await expect(
    page
      .getByRole("region", { name: "Courses" })
      .getByText("Electrical Circuits I"),
  ).toBeVisible();
  const teachers = page.getByRole("region", { name: "Teachers" });
  await expect(teachers.getByText(/Test Wahid/)).toBeVisible();
  await expect(teachers.getByText("Sits in KT-712")).toBeVisible();
  await expect(
    teachers.getByRole("link", { name: "mw@example.com" }),
  ).toHaveAttribute("href", "mailto:mw@example.com");

  // Titles go in bulk: select, then remove.
  await page.goto("/admin/routine/courses?department=EEE");
  await expect(async () => {
    // Clicked while the page hydrates, the box can stay empty: check it again.
    await page.getByRole("checkbox", { name: "Select 0713-121" }).check();
    await expect(page.getByText("1 selected")).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await page.getByRole("button", { name: "Remove titles" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("Title removed")).toBeVisible();
  await expect(page.getByLabel("Title of 0713-121")).toHaveValue("");

  // Deleting the live version takes EEE's routine away until another is live.
  await page.goto("/admin/routine/versions");
  const eee = page.getByRole("row", { name: new RegExp(`EEE v${version}`) });
  await openMenu(eee.getByRole("button", { name: `Actions for v${version}` }));
  await page.getByRole("menuitem", { name: "Delete version" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "students will see no EEE routine",
  );
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(`v${version} deleted`)).toBeVisible();
  await page.goto("/routine/eee");
  await expect(
    page.getByText("DIU’s EEE routine is coming soon", { exact: false }),
  ).toBeVisible();
});

test("an admin uploads SWE's routine sheet, and SWE students find their section", async ({
  page,
}) => {
  test.skip(
    test.info().project.name === "mobile",
    "Makes a version live: runs in one project",
  );
  const version = uniqueVersion();
  await logInAs(page, SEED_ADMIN, "/admin/routine/versions");
  const dialog = page.getByRole("dialog", { name: "Upload a routine" });
  await expect(async () => {
    await page.getByRole("button", { name: "Upload routine" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  // An Excel sheet; its version number is in the file's name only.
  await dialog.getByLabel("Routine file").setInputFiles({
    name: `swe-routine-fall-2026-studentversion${version}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await sweRoutineXlsx()),
  });
  await dialog.getByRole("button", { name: "Upload" }).click();

  await expect(page).toHaveURL(/\/admin\/routine\/versions\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `SWE v${version}`,
  );
  await expect(page.getByText("2 places in DIU’s file to check")).toBeVisible();
  await page.getByRole("button", { name: `Make v${version} live` }).click();
  await page.getByRole("button", { name: "Make live" }).click();
  await expect(page.getByText(`v${version} is live`)).toBeVisible();

  // Students switch to SWE and find 44_G1 as they write it.
  await page.goto("/routine/cse");
  await expect(async () => {
    await page
      .getByRole("navigation", { name: "Departments" })
      .getByRole("link", { name: "SWE" })
      .click();
    await expect(page).toHaveURL(/\/routine\/swe$/, { timeout: 2_000 });
  }).toPass();
  const search = page.getByRole("combobox", { name: /Your section/ });
  await expect(async () => {
    await search.fill("");
    await search.fill("44g1");
    await expect(page.getByRole("option", { name: /44_G1/ })).toBeVisible({
      timeout: 1_000,
    });
  }).toPass();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/routine\/swe\/44_G\?group=G1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("44_G1");
});
