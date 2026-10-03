import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
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
    page.getByRole("heading", { name: "Find your class routine." }),
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
  await page.goto("/routine");
  await page.getByRole("link", { name: /My section\s*67_B1/ }).click();
  await expect(page).toHaveURL(/\/routine\/cse\/67_B\?group=B1$/);
});

test("section addresses are canonical", async ({ page }) => {
  await page.goto("/routine/cse/67_b?group=B9");
  await expect(page).toHaveURL(/\/routine\/cse\/67_B$/);
  const missing = await page.goto("/routine/cse/99_Z");
  expect(missing?.status()).toBe(404);
});

test("an admin uploads a routine file, reviews it and makes it live", async ({
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

  const dialog = page.getByRole("dialog", { name: "Upload routine file" });
  const openUpload = async () => {
    await expect(async () => {
      await page.getByRole("button", { name: "Upload routine file" }).click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass();
  };
  const choose = (file: unknown) =>
    dialog.getByLabel("Routine file (.json)").setInputFiles({
      name: `cse-routine-${version}.json`,
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(file, null, 2)),
    });

  // A file with a 12-hour time is turned away, pointing at the class.
  await openUpload();
  const broken = structuredClone(SEED_ROUTINE);
  broken.version = version;
  broken.classes[0]!.start = "1:00";
  await choose(broken);
  await dialog.getByRole("button", { name: "Upload" }).click();
  await expect(dialog.getByRole("alert")).toContainText("classes[0].start");
  await expect(dialog.getByRole("alert")).toContainText("24-hour");

  // The fixed file becomes a draft: one 65_A class moved from Thursday to Tuesday.
  const fixed = structuredClone(SEED_ROUTINE);
  fixed.version = version;
  const moved = fixed.classes.find(
    (c) => c.section === "65_A" && c.day === "THU",
  )!;
  moved.day = "TUE";
  await choose(fixed);
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

  // It's in the list as the live version, and a draft's menu offers deleting.
  await page.goto("/admin/routine/versions");
  const row = page.getByRole("row", { name: new RegExp(`CSE v${version}`) });
  await expect(row.getByText("Live", { exact: true })).toBeVisible();
  await openMenu(row.getByRole("button", { name: `Actions for v${version}` }));
  await expect(page.getByRole("menuitem", { name: "Make live" })).toHaveCount(
    0,
  );
});
