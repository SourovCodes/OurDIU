import { cleanup, render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, expect, it } from "vitest";
import type { SessionUser } from "~/lib/types";
import { SiteHeader } from "./site-header";

afterEach(cleanup);

function renderHeader(
  user: SessionUser | null,
  path = "/questions",
  needsAttention = 0,
) {
  const Stub = createRoutesStub([
    {
      path: "*",
      Component: () => (
        <SiteHeader user={user} needsAttention={needsAttention} />
      ),
    },
  ]);
  render(<Stub initialEntries={[path]} />);
}

it("shows the question bank's own menu in its space", async () => {
  renderHeader(null, "/questions/42");
  expect(
    await screen.findByRole("link", { name: "Question Bank" }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Browse" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Share a paper/ })).toBeTruthy();
});

it("shows OurDIU, without a product's menu, on platform pages", async () => {
  renderHeader(null, "/");
  expect(await screen.findByRole("link", { name: "OurDIU" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Browse" })).toBeNull();
  expect(screen.queryByRole("link", { name: /Share a paper/ })).toBeNull();
});

it("switches between products", async () => {
  renderHeader(null, "/questions");
  const switcher = await screen.findByRole("button", {
    name: "Switch product",
  });
  switcher.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
  );
  const current = await screen.findByRole("menuitem", {
    name: /Question Bank/,
  });
  expect(current.getAttribute("aria-current")).toBe("page");
  expect(
    screen.getByRole("menuitem", { name: /Class Routine/ }).textContent,
  ).toContain("Soon");
});

it("offers log in to visitors", async () => {
  renderHeader(null);
  expect(await screen.findByRole("link", { name: "Log in" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Account menu" })).toBeNull();
});

it("switches between the light and dark theme", async () => {
  renderHeader(null);
  const toggle = await screen.findByRole("button", {
    name: "Switch to dark theme",
  });
  toggle.click();
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(document.cookie).toContain("ourdiu_theme=dark");

  (
    await screen.findByRole("button", { name: "Switch to light theme" })
  ).click();
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(document.cookie).toContain("ourdiu_theme=light");
});

it("shows the account menu instead when signed in", async () => {
  renderHeader({
    id: "u1",
    name: "Ayesha Rahman",
    email: "ayesha@example.com",
  });
  const menu = await screen.findByRole("button", { name: "Account menu" });
  expect(menu.textContent).toBe("AR");
  expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  expect(screen.getByRole("link", { name: /Share a paper/ })).toBeTruthy();
});

it("flags the papers that need the user on the account menu", async () => {
  renderHeader(
    { id: "u1", name: "Ayesha Rahman", email: "ayesha@example.com" },
    "/questions",
    2,
  );
  expect(
    await screen.findByRole("button", {
      name: "Account menu, 2 papers need you",
    }),
  ).toBeTruthy();
});

it("links admins to the admin panel from the account menu", async () => {
  renderHeader({
    id: "u2",
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
  });
  const menu = await screen.findByRole("button", { name: "Account menu" });
  // Radix opens menus on pointerdown, not click.
  menu.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
  );
  expect(
    await screen.findByRole("menuitem", { name: "Admin panel" }),
  ).toBeTruthy();
});

it("puts the visitor's own pages, the other spaces and the theme in the phone menu", async () => {
  renderHeader(
    { id: "u1", name: "Ayesha Rahman", email: "ayesha@example.com" },
    "/questions/browse",
  );
  (await screen.findByRole("button", { name: "Open menu" })).click();
  const menu = await screen.findByRole("dialog", { name: "Menu" });
  const link = (name: string | RegExp) =>
    within(menu).getByRole("link", { name });
  expect(link("All papers").getAttribute("aria-current")).toBe("page");
  expect(link("Saved").getAttribute("href")).toBe("/questions/saved");
  expect(link("My submissions").getAttribute("href")).toBe(
    "/questions/my-submissions",
  );
  expect(link("Account settings").getAttribute("href")).toBe("/account");
  expect(link(/Class Routine/).textContent).toContain("Soon");
  expect(within(menu).getByRole("button", { name: "Log out" })).toBeTruthy();

  within(menu).getByRole("button", { name: "Dark" }).click();
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  within(menu).getByRole("button", { name: "Light" }).click();
  expect(document.documentElement.classList.contains("dark")).toBe(false);
});

it("asks visitors to log in from the phone menu", async () => {
  renderHeader(null, "/questions");
  (await screen.findByRole("button", { name: "Open menu" })).click();
  const menu = await screen.findByRole("dialog", { name: "Menu" });
  expect(
    within(menu).getByRole("link", { name: "Log in with Google" }),
  ).toBeTruthy();
  expect(
    within(menu).queryByRole("link", { name: "My submissions" }),
  ).toBeNull();
});

it("searches courses in the question bank only", async () => {
  renderHeader(null, "/questions/1");
  expect(
    (await screen.findAllByRole("link", { name: /Search courses/ })).length,
  ).toBeGreaterThan(0);

  cleanup();
  renderHeader(null, "/routine");
  await screen.findByRole("link", { name: "Class Routine" });
  expect(screen.queryByRole("link", { name: /Search courses/ })).toBeNull();
});
