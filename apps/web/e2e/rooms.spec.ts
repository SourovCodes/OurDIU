import type { Page } from "@playwright/test";
import { E2E_ORIGIN } from "./env";
import {
  APP_SHEET_COOKIE,
  expect,
  failOnConsoleErrors,
  logInAs,
  NEW_READER,
  NEW_USER,
  SEED_ADMIN,
  test,
} from "./helpers";

// Course rooms (docs/PLAN.md, decision 66). The e2e server has no Realtime SFU
// app, so voice says it isn't set up; the voice call's signalling is tested in the
// API (apps/api/test/rooms.test.ts). Course 2 is Algorithms in the seed data; both
// projects use its room at once, so tests look for their own messages only.

failOnConsoleErrors();

const COURSE = "/questions/courses/2";
const room = (page: Page) => page.getByRole("region", { name: "Course room" });

test("visitors are asked to sign in with a DIU email", async ({ page }) => {
  await page.goto(COURSE);
  await expect(
    room(page).getByText("Sign in with your DIU email to talk with classmates"),
  ).toBeVisible();
  await expect(
    room(page).getByRole("link", { name: "Sign in" }),
  ).toHaveAttribute("href", `/login?redirectTo=${encodeURIComponent(COURSE)}`);
});

test("rooms are for DIU email accounts", async ({ page }) => {
  await logInAs(page, NEW_READER, COURSE);
  await expect(
    room(page).getByText("Course rooms are for DIU email accounts"),
  ).toBeVisible();
  await expect(room(page).getByRole("button")).toHaveCount(0);
});

test("classmates chat in the course room, and it isn't kept", async ({
  page,
  browser,
}) => {
  const hello = `Anyone solved Q3? ${Math.random().toString(36).slice(2, 8)}`;
  await logInAs(page, NEW_USER, COURSE);
  // No SFU here: the card offers the chat.
  await expect(
    room(page).getByText("Voice calls aren't set up yet"),
  ).toBeVisible();

  // Another student, in another browser (past the Android app sheet, like `page`).
  const otherContext = await browser.newContext();
  await otherContext.addCookies([
    { name: APP_SHEET_COOKIE, value: "1", url: E2E_ORIGIN },
  ]);
  const other = await otherContext.newPage();
  const hydrated = () =>
    other.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await logInAs(other, NEW_USER, COURSE);
  await hydrated();
  await room(other).getByRole("button", { name: "Chat" }).click();
  const otherPanel = other.getByRole("region", { name: "Algorithms room" });
  await expect(otherPanel.getByText("Messages aren't saved")).toBeVisible();

  await room(page).getByRole("button", { name: "Chat" }).click();
  const panel = page.getByRole("region", { name: "Algorithms room" });
  await panel.getByRole("textbox", { name: "Message" }).fill(hello);
  await panel.getByRole("button", { name: "Send" }).click();
  await expect(panel.getByText(hello)).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "Message" })).toHaveValue("");

  // The other student sees it, with who sent it, and can report it.
  const line = otherPanel.getByRole("listitem").filter({ hasText: hello });
  await expect(line).toBeVisible();
  await line.getByRole("button", { name: /More for .*message/ }).click();
  await other.getByRole("menuitem", { name: "Report message" }).click();
  const dialog = other.getByRole("dialog");
  await expect(dialog.getByText(hello)).toBeVisible();
  await dialog.getByRole("radio", { name: "Spam" }).check();
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(
    other.getByText("Thanks. An admin will look at it."),
  ).toBeVisible();

  // Closing the panel keeps the chat while you're on the course's pages…
  await otherPanel.getByRole("button", { name: "Close the room" }).click();
  await expect(otherPanel).toBeHidden();
  await room(other).getByRole("button", { name: "Chat" }).click();
  await expect(otherPanel.getByText(hello)).toBeVisible();

  // …but nothing is stored: a fresh page starts with an empty chat.
  await other.reload();
  await hydrated();
  await room(other).getByRole("button", { name: "Chat" }).click();
  await expect(otherPanel.getByText("Say hello.")).toBeVisible();
  await expect(otherPanel.getByText(hello)).toHaveCount(0);
  await otherContext.close();
});

test("a paper page opens its course's room", async ({ page }) => {
  // Question 1 is a Data Structures paper (course 1).
  await logInAs(page, NEW_USER, "/questions/1");
  await page.getByRole("button", { name: /^Data Structures room/ }).click();
  const panel = page.getByRole("region", { name: "Data Structures room" });
  await expect(panel.getByText("Messages aren't saved")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("admins see this cycle's usage, reports and bans", async ({ page }) => {
  await logInAs(page, SEED_ADMIN, "/admin/questions/rooms");
  await expect(
    page.getByRole("heading", { name: /^This cycle/ }),
  ).toBeVisible();
  await expect(page.getByText("Voice (estimated)")).toBeVisible();
  // The e2e server has no SFU app.
  await expect(page.getByText("Voice isn't set up")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause rooms" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Open reports" }),
  ).toBeVisible();
});
