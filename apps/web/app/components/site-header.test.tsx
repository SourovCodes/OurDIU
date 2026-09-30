import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, expect, it } from "vitest";
import type { SessionUser } from "~/lib/types";
import { SiteHeader } from "./site-header";

afterEach(cleanup);

function renderHeader(user: SessionUser | null) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <SiteHeader user={user} /> },
  ]);
  render(<Stub initialEntries={["/"]} />);
}

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
  expect(screen.getByRole("link", { name: "Routine" })).toBeTruthy();
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
