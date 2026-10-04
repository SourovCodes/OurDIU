import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { cseRoutinePdf, onePagePdf } from "../../api/test/cse-routine-pdf";
import { eeeRoutinePdf } from "../../api/test/eee-routine-pdf";
import { failOnConsoleErrors, logInAs, openMenu, SEED_ADMIN } from "./helpers";

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
  await page.goto("/routine");
  await expect(
    page.getByRole("heading", { name: "Your class routine." }),
  ).toBeVisible();

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
    page.getByText(/lab group B1 · 5 courses · 9 classes a week/),
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
  const today = page.getByRole("region", { name: "Today" });
  await expect(today).toContainText("My section · CSE 67_B1");
  await today.getByRole("link", { name: "See the week" }).click();
  await expect(page).toHaveURL(/\/routine\/cse\/67_B\?group=B1$/);
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
    dialog.getByLabel("Routine PDF").setInputFiles({
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

  // It's in the list as the live version, which can't be deleted.
  await page.goto("/admin/routine/versions");
  const row = page.getByRole("row", { name: new RegExp(`CSE v${version}`) });
  await expect(row.getByText("Live", { exact: true })).toBeVisible();
  await openMenu(row.getByRole("button", { name: `Actions for v${version}` }));
  await expect(page.getByRole("menuitem", { name: "Make live" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("menuitem", { name: "Delete version" }),
  ).toHaveCount(0);
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
  await dialog.getByLabel("Routine PDF").setInputFiles({
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
  await expect(page.getByText("2 places in DIU’s PDF to check")).toBeVisible();
  await expect(page.getByText(/says 1-3 A but 0541-131 B/)).toBeVisible();
  await expect(page.getByRole("link", { name: "DIU’s PDF" })).toBeVisible();
  await page.getByRole("button", { name: `Make v${version} live` }).click();
  await page.getByRole("button", { name: "Make live" }).click();
  await expect(page.getByText(`v${version} is live`)).toBeVisible();

  // The PDF has no course titles: one is added. A teacher gets the room they sit in.
  await page.goto("/admin/routine/courses?department=EEE");
  await openMenu(
    page
      .getByRole("row", { name: /0713-121/ })
      .getByRole("button", { name: "Actions for 0713-121" }),
  );
  await page.getByRole("menuitem", { name: /^(Edit|Add) title$/ }).click();
  const titleDialog = page.getByRole("dialog");
  await titleDialog.getByLabel("Course title").fill("Electrical Circuits I");
  await titleDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("0713-121 is titled")).toBeVisible();
  await expect(
    page
      .getByRole("row", { name: /0713-121/ })
      .getByText("Electrical Circuits I"),
  ).toBeVisible();

  await page.goto("/admin/routine/teachers?department=EEE");
  await openMenu(
    page
      .getByRole("row", { name: /\bMW\b/ })
      .getByRole("button", { name: "Actions for MW" }),
  );
  await page.getByRole("menuitem", { name: /^(Edit|Add) details$/ }).click();
  const teacherDialog = page.getByRole("dialog");
  // From the PDF's list of teachers.
  await expect(teacherDialog.getByLabel("Name")).toHaveValue("Test Wahid");
  await expect(teacherDialog.getByLabel("Email")).toHaveValue("mw@example.com");
  await teacherDialog.getByLabel("Room where they sit").fill("KT-712");
  await teacherDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("MW saved")).toBeVisible();

  // Students switch to EEE and find 1-2 B1 as they write it.
  await page.goto("/routine");
  await page
    .getByRole("navigation", { name: "Departments" })
    .getByRole("link", { name: /EEE/ })
    .click();
  await expect(page).toHaveURL(/\/routine\/eee$/);
  await expect(
    page.getByRole("heading", { name: "Every EEE section" }),
  ).toBeVisible();
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
});
