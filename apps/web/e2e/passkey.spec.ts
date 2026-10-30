import type { Page } from "@playwright/test";
import {
  expect,
  failOnConsoleErrors,
  logInAs,
  logOut,
  NEW_USER,
  test,
} from "./helpers";

failOnConsoleErrors();

/**
 * Gives the browser a passkey device that says yes on its own: Chromium's virtual
 * authenticator, with a fingerprint-style check and room for discoverable passkeys.
 */
async function addVirtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

test("a user adds a passkey, logs in with it and removes it", async ({
  page,
}) => {
  await addVirtualAuthenticator(page);
  const { email } = await logInAs(page, NEW_USER, "/account");

  const passkeys = page.getByRole("region", { name: "Passkeys" });
  await passkeys.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByText("Passkey added.")).toBeVisible();
  await expect(passkeys.getByText(/^Added /)).toHaveCount(1);

  await logOut(page);
  await page.goto("/login?redirectTo=%2Faccount");
  await page.getByRole("button", { name: "Log in with a passkey" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(email)).toBeVisible();

  await passkeys.getByRole("button", { name: "Remove Passkey" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("Passkey removed.")).toBeVisible();
  await expect(passkeys.getByText(/^Added /)).toHaveCount(0);
});

test("logging in with a passkey that isn't on an account says what to do", async ({
  page,
}) => {
  await addVirtualAuthenticator(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in with a passkey" }).click();
  // The virtual device has no passkey for the site, so the browser gives up.
  await expect(page.getByRole("alert")).toContainText(
    /cancelled|couldn’t use a passkey/,
  );
});
