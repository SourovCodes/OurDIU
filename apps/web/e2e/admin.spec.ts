import { expect, test } from "@playwright/test";
import { failOnConsoleErrors, logInAs, NEW_USER, SEED_ADMIN } from "./helpers";

failOnConsoleErrors();

test("members can't open the admin panel", async ({ page }) => {
  await logInAs(page, NEW_USER, "/account");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("an admin adds, renames and deletes a department", async ({ page }) => {
  await logInAs(page, SEED_ADMIN, "/admin");
  // The panel opens on its users page, in its own shell.
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Users");

  // The sidebar is a slide-over on phones; go straight to the page.
  await page.goto("/admin/departments");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Departments",
  );
  await expect(
    page.getByRole("cell", { name: "CSE", exact: true }),
  ).toBeVisible();

  // 2–10 letters, unique per run and project.
  const shortName = `E${Array.from({ length: 7 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join("")}`;
  await page.getByRole("button", { name: "Add department" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Short name").fill(shortName);
  await dialog.getByLabel("Name", { exact: true }).fill(`E2E ${shortName}`);
  await dialog.getByRole("button", { name: "Add" }).click();
  const cell = page.getByRole("cell", { name: shortName, exact: true });
  await expect(cell).toBeVisible();

  await page.getByRole("button", { name: `Actions for ${shortName}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await dialog.getByLabel("Name", { exact: true }).fill(`Renamed ${shortName}`);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("cell", { name: `Renamed ${shortName}`, exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Actions for ${shortName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(cell).toHaveCount(0);
});
