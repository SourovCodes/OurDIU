import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_ORIGIN } from "./env";
import { claimSession, type SessionKind } from "./sessions";

// Shared by the e2e specs. They rely on the seed data, which their server gets fresh on every run.

// Fail any test that logs a console error, such as React's duplicate key or hydration
// warnings, which otherwise go unnoticed while every assertion still passes.
const consoleErrors = new WeakMap<Page, string[]>();

/** Fails any test in the calling spec that logs a console error. */
export function failOnConsoleErrors() {
  test.beforeEach(({ page }) => {
    const errors: string[] = [];
    consoleErrors.set(page, errors);
    page.on("console", (message) => {
      // Failed requests (such as expected 404s) aren't app bugs, and neither is a
      // route discovery request that a full page navigation cancelled.
      if (
        message.type() === "error" &&
        !message.text().startsWith("Failed to load resource") &&
        !message.text().startsWith("Failed to fetch manifest patches")
      ) {
        errors.push(message.text());
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));
  });

  test.afterEach(({ page }) => {
    expect(consoleErrors.get(page) ?? [], "console errors").toEqual([]);
  });
}

/**
 * Opens a searchable select. Right after a full page load the click can land on the
 * server-rendered button before React has hydrated, so retry until it opens.
 */
export async function openCombobox(page: Page, name: string) {
  const combobox = page.getByRole("combobox", { name });
  await expect(async () => {
    await combobox.click();
    await expect(combobox).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass();
}

/**
 * Opens a dropdown menu from its trigger, retrying a click that landed before
 * hydration. Each try waits briefly for the menu, so a missed click is retried
 * instead of hanging on a menu item that never appears.
 */
export async function openMenu(trigger: Locator) {
  await expect(async () => {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") {
      await trigger.click();
    }
    await expect(trigger).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass();
}

/**
 * Opens the questions page's filters: inline on wide screens, behind a "Filters"
 * button in a sheet on phones.
 */
export async function openQuestionFilters(page: Page) {
  const button = page.getByRole("button", { name: /^Filters/ });
  if (!(await button.isVisible())) return;
  const sheet = page.getByRole("dialog", { name: "Filter exams" });
  await expect(async () => {
    await button.click();
    await expect(sheet).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

/** Closes the filter sheet on phones with its "Show N exams" button. */
export async function closeQuestionFilters(page: Page) {
  const sheet = page.getByRole("dialog", { name: "Filter exams" });
  if (await sheet.isVisible()) {
    await sheet.getByRole("button", { name: /^Show \d+ exam/ }).click();
    await expect(sheet).toBeHidden();
  }
}

/**
 * Clicks a link until the URL changes. A click that lands while the page is still
 * hydrating can be dropped, so retry instead of asserting once.
 */
export async function clickUntilUrl(page: Page, name: string, url: RegExp) {
  await expect(async () => {
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(url, { timeout: 2_000 });
  }).toPass();
}

/** Fills in and submits the contribute form: CSE, a new course, Fall 24, Final. */
export async function uploadPaperWithNewCourse(page: Page, courseName: string) {
  await openCombobox(page, "Department");
  await page.getByPlaceholder("Search or add department…").fill("CSE");
  await page.getByRole("option", { name: /Computer Science/ }).click();

  await openCombobox(page, "Course");
  // Typed key by key: the "Add" option must appear while typing, not only on paste.
  await page
    .getByPlaceholder("Search or add course…")
    .pressSequentially(courseName);
  await page
    .getByRole("option", { name: `Add “${courseName}” as a new course` })
    .click();
  await expect(page.getByRole("combobox", { name: "Course" })).toContainText(
    `${courseName} (new)`,
  );

  await openCombobox(page, "Semester");
  await page.getByRole("option", { name: "Fall 24" }).click();
  await page.getByRole("radio", { name: "Final", exact: true }).check();

  await page.getByLabel("PDF file").setInputFiles({
    name: "paper.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n%e2e upload\n"),
  });
  await page.getByRole("button", { name: "Share paper" }).click();
  // Lands on the paper's status page.
  await expect(page).toHaveURL(/\/questions\/my-submissions\/\d+/);
  await expect(
    page.getByText("Thanks! Your paper was uploaded."),
  ).toBeVisible();
}

export async function logOut(page: Page) {
  // Right after a navigation the click can land before the menu has hydrated.
  const logOutItem = page.getByRole("menuitem", { name: "Log out" });
  await expect(async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(logOutItem).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await logOutItem.click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
}

/**
 * Who `logInAs` signs in: a fresh member (on a DIU address), a fresh reader (on
 * another address, so they can't contribute), or the seed admin (`apps/api/seeds/dev.sql`).
 */
export const NEW_USER = "user";
export const NEW_READER = "reader";
export const SEED_ADMIN = "admin";

/**
 * Signs in without Google: gives the browser a session from the pool that global
 * setup wrote (see `sessions.ts`), then opens `redirectTo`.
 */
export async function logInAs(
  page: Page,
  kind: SessionKind,
  redirectTo: string,
) {
  const session = claimSession(kind);
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: session.cookie,
      url: E2E_ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(redirectTo);
  return { id: session.userId, email: session.email };
}
