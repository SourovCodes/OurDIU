import { expect, test } from "@playwright/test";
import { failOnConsoleErrors, logInAs, logOut, NEW_USER } from "./helpers";

failOnConsoleErrors();

test("the hub lists the products", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("OurDIU — Tools for DIU students");
  const products = page.getByRole("region", { name: "Products" });
  await expect(products.getByText("Class Routine")).toBeVisible();
  await expect(products.getByText("Question Bank")).toBeVisible();
  await expect(products.getByText("Marketplace")).toBeVisible();
  await expect(
    products.getByRole("link", { name: /Question Bank/ }),
  ).toHaveAttribute("href", "https://diuqbank.com");
});

test("the routine and marketplace say they're coming soon", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("region", { name: "Products" })
    .getByRole("link", { name: /Class Routine/ })
    .click();
  await expect(page).toHaveURL(/\/routine$/);
  await expect(page.getByText("Class Routine is coming soon")).toBeVisible();

  await page.goto("/market");
  await expect(page.getByText("Marketplace is coming soon")).toBeVisible();
});

test("unknown pages are a 404", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("the login page offers Google", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("a member changes their name and username", async ({ page }) => {
  const { id } = await logInAs(page, NEW_USER, "/account");
  const username = `e2e_${id.slice(-8)}`;
  await page.getByLabel("Name", { exact: true }).fill("Renamed Member");
  await page.getByLabel("Username").fill(username.toUpperCase());
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.getByLabel("Username")).toHaveValue(username);
  await logOut(page);
});
