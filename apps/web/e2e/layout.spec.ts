import { expect, test, type Page } from "@playwright/test";
import { failOnConsoleErrors, logInAs, SEED_ADMIN } from "./helpers";

// No page is wider than a small phone's screen: nothing makes the page scroll
// sideways, signed out or in (signed in, pages show names, IDs and admin tables
// that a visitor never sees). The seed data is in apps/api/seeds/dev.sql.

failOnConsoleErrors();

// The narrowest phones still in use; wider screens only have more room.
test.use({ viewport: { width: 320, height: 720 } });
// Its own width, so once is enough.
test.beforeEach(() => {
  test.skip(test.info().project.name !== "mobile", "phones only");
});

const PUBLIC_PAGES = [
  "/",
  "/questions",
  "/questions/browse",
  "/questions/search?q=algorithms",
  "/questions/departments",
  "/questions/departments/1",
  "/questions/courses/1",
  "/questions/1",
  "/questions/contributors",
  "/questions/contributors/ayesha",
  "/diuqbank",
  "/admission",
  "/routine",
  "/routine/cse",
  "/routine/cse/teachers",
  "/routine/cse/teachers/sta",
  "/routine/cse/67_B",
  "/cover-page",
  "/cover-page/lab-report",
  "/cover-page/group-assignment",
  "/cover-page/final-lab-report",
  "/cover-page/presentation",
  "/cover-page/project-report",
  "/cover-page/lab-report-index",
  "/cover-page/internship-report",
  "/cover-page/final-year-project",
  "/market",
  "/app",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/copyright",
  "/cookies",
  "/delete-account",
  "/login",
  "/no-such-page",
];

const SIGNED_IN_PAGES = [
  "/",
  "/account",
  "/questions/1",
  "/questions/saved",
  "/questions/contribute",
  "/questions/my-submissions",
  "/routine/cse/67_B",
  "/cover-page",
  "/cover-page/group-assignment",
  "/cover-page/final-year-project",
  "/admin",
  "/admin/questions/submissions",
  "/admin/questions/submissions/1",
  "/admin/questions/reports",
  "/admin/questions/catalog",
  "/admin/routine/versions",
  "/admin/routine/versions/1",
  "/admin/routine/courses",
  "/admin/routine/teachers",
  "/admin/users",
];

/** Fails with the elements that stick out past the right edge of the screen. */
async function expectNoSidewaysScroll(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const width = root.clientWidth;
    if (root.scrollWidth <= width) return null;
    // The innermost elements that stick out: the ones to fix.
    const out = [...document.body.querySelectorAll<HTMLElement>("*")].filter(
      (e) => e.getBoundingClientRect().right > width + 1,
    );
    const leaves = out.filter(
      (e) => ![...e.children].some((c) => out.includes(c as HTMLElement)),
    );
    return {
      scrollWidth: root.scrollWidth,
      width,
      elements: leaves.slice(0, 5).map((e) => {
        const name = e.getAttribute("class")?.slice(0, 80) ?? "";
        return `<${e.tagName.toLowerCase()} class="${name}"> ${e.textContent?.trim().slice(0, 40) ?? ""}`;
      }),
    };
  });
  expect.soft(overflow, `${path} scrolls sideways`).toBeNull();

  // The header's name stays clear of its buttons (overlap isn't overflow).
  const clash = await page.evaluate(() => {
    const row = document.querySelector("header .container");
    const name = row?.querySelector("a .font-expressive");
    const buttons = row?.querySelector(":scope > .ml-auto");
    if (!name || !buttons) return null;
    const gap =
      buttons.getBoundingClientRect().left - name.getBoundingClientRect().right;
    return gap < 0 ? `"${name.textContent}" runs ${-gap}px under them` : null;
  });
  expect.soft(clash, `${path}: the header's name meets its buttons`).toBeNull();
}

test("public pages fit a small phone", async ({ page }) => {
  test.setTimeout(120_000);
  for (const path of PUBLIC_PAGES) await expectNoSidewaysScroll(page, path);
});

test("signed-in and admin pages fit a small phone", async ({ page }) => {
  test.setTimeout(120_000);
  await logInAs(page, SEED_ADMIN, "/");
  for (const path of SIGNED_IN_PAGES) await expectNoSidewaysScroll(page, path);
});

test("the cover page fits a small phone with long details filled in", async ({
  page,
}) => {
  // Remembered details fold "Submitted by" to a line that doesn't wrap: a long
  // name and ID once made the form wider than the screen.
  await page.addInitScript(() => {
    localStorage.setItem(
      "ourdiu_cover_page",
      JSON.stringify({
        studentName: "Mohammad Abdullah Al Mamun Chowdhury",
        studentId: "232-15-004",
        section: "67_B",
        studentDepartment: "Computer Science and Engineering",
      }),
    );
  });
  await expectNoSidewaysScroll(page, "/cover-page");
  await expect(
    page.getByRole("button", { name: /Submitted by · Mohammad/ }),
  ).toBeVisible();
});
