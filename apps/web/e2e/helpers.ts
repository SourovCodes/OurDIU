import { expect, test, type Page } from "@playwright/test";
import { claimSession, type SessionKind } from "./sessions";

// Shared by the e2e specs. They rely on the local seed data: `pnpm db:migrate && pnpm db:seed`.

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

/** Who `logInAs` signs in: a fresh member, or the admin created by `pnpm db:seed`. */
export const NEW_USER = "user";
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
      url: "http://localhost:5173",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(redirectTo);
  return { id: session.userId, email: session.email };
}
