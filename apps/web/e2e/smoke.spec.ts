import { expect, test, type Page } from "@playwright/test";
import {
  clickUntilUrl,
  closeQuestionFilters,
  failOnConsoleErrors,
  logInAs,
  NEW_READER,
  NEW_USER,
  logOut,
  openCombobox,
  openQuestionFilters,
  uploadPaperWithNewCourse,
} from "./helpers";

// These tests rely on the local seed data: `pnpm db:migrate && pnpm db:seed`.
// Question 1 (Data Structures) has 2 published, 1 pending and 1 rejected submission.

failOnConsoleErrors();

test("Android visitors are invited to test the app", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("complementary", { name: "Android app" });
  // The mobile project is a Pixel; desktop visitors never see the banner.
  if (test.info().project.name !== "mobile") {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(banner).toHaveCount(0);
    return;
  }

  await banner.getByRole("link", { name: "Become a tester" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("link", { name: "Join the group" }),
  ).toHaveAttribute("href", "https://groups.google.com/g/ourdiu");
  await expect(
    page.getByRole("link", { name: "Open the testing page" }),
  ).toHaveAttribute(
    "href",
    "https://play.google.com/apps/testing/com.ourdiu.app",
  );
  await expect(
    page.getByRole("link", { name: "Get it on Google Play" }),
  ).toHaveAttribute(
    "href",
    "https://play.google.com/store/apps/details?id=com.ourdiu.app",
  );

  // Question Bank pages, where readers land from search, have a slim strip.
  await page.goto("/questions/browse");
  await expect(
    banner.getByRole("link", { name: "become a tester" }),
  ).toBeVisible();

  // Dismissed, it stays away.
  await page.goto("/");
  await expect(async () => {
    await banner.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).toHaveCount(0, { timeout: 1_000 });
  }).toPass();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(banner).toHaveCount(0);
});

test("the hub leads to the question bank and its questions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "What do you need today?",
  );
  await expect(async () => {
    await page
      .getByRole("main")
      .getByRole("link", { name: /Question Bank/ })
      .click();
    await expect(page).toHaveURL(/\/questions$/, { timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find your paper",
  );

  await clickUntilUrl(page, "Browse all questions", /\/questions\/browse$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Browse questions",
  );
});

test("a slow navigation shows the top loader until the page is ready", async ({
  page,
}) => {
  await page.goto("/questions/browse");
  // Hydrated once its scripts have loaded; a click before that would load the next
  // page in full, which the loader doesn't show for.
  await page.waitForLoadState("networkidle");
  // Client navigations load their data from `*.data`; hold it back for a moment.
  await page.route("**/*.data*", async (route) => {
    // Long enough to see the bar even on a busy test machine.
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });
  const loader = page.getByRole("progressbar", { name: "Loading page" });
  await expect(loader).toHaveCount(0);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Question Bank" })
    .click();
  await expect(loader).toBeVisible();
  await expect(page).toHaveURL(/\/questions$/);
  await expect(loader).toHaveCount(0);
});

test("the footer leads to the about page and its promise", async ({ page }) => {
  await page.goto("/");
  await clickUntilUrl(page, "About", /\/about$/);
  await expect(page).toHaveTitle("About — OurDIU");
  await expect(
    page.getByRole("heading", { name: "The promise" }),
  ).toBeVisible();
  await expect(page.getByText("Free forever", { exact: true })).toBeVisible();

  const linkedin = page
    .getByRole("main")
    .getByRole("link", { name: "LinkedIn" });
  await expect(linkedin).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/sourov-biswas/",
  );
  await expect(linkedin).toHaveAttribute("target", "_blank");
});

test("the footer leads to the contact and legal pages", async ({ page }) => {
  await page.goto("/");
  await clickUntilUrl(page, "Contact", /\/contact$/);
  await expect(page).toHaveTitle("Contact — OurDIU");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("link", { name: "sourov2305101004@diu.edu.bd" }),
  ).toHaveAttribute("href", "mailto:sourov2305101004@diu.edu.bd");
  // Each topic starts an email with its own subject.
  await expect(
    main.getByRole("link", { name: "Report a bug" }),
  ).toHaveAttribute(
    "href",
    /^mailto:sourov2305101004@diu\.edu\.bd\?subject=Bug%20report&body=/,
  );

  const legal = page.getByRole("navigation", { name: "Legal", exact: true });
  for (const [label, path, title] of [
    ["Privacy", "/privacy", "Privacy policy"],
    ["Terms", "/terms", "Terms of use"],
    ["Copyright", "/copyright", "Copyright and removal"],
    ["Cookies", "/cookies", "Cookie notice"],
  ] as const) {
    await expect(async () => {
      await legal.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 2_000 });
    }).toPass();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    // The tabs between the legal pages mark the current one.
    await expect(
      page
        .getByRole("navigation", { name: "Legal pages" })
        .getByRole("link", { name: label }),
    ).toHaveAttribute("aria-current", "page");
  }
  // The cookie notice lists the cookies the site sets (a table, or cards on phones).
  await expect(
    page.getByText("qb_views_q", { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
});

test("the account deletion page explains how to ask", async ({ page }) => {
  // Google Play links here, and so does the app's Account screen.
  await page.goto("/privacy");
  await expect(async () => {
    await page
      .getByRole("main")
      .getByRole("link", { name: "how deleting works" })
      .click();
    await expect(page).toHaveURL(/\/delete-account$/, { timeout: 2_000 });
  }).toPass();
  await expect(page).toHaveTitle("Delete your account — OurDIU");
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Email a deletion request" }),
  ).toHaveAttribute(
    "href",
    /^mailto:sourov2305101004@diu\.edu\.bd\?subject=Delete%20my%20account/,
  );
});

test("an unknown URL renders a styled 404 page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found — OurDIU");
  await expect(page.getByText("Page not found")).toBeVisible();

  // The document must carry real CSS, or the page paints unstyled until hydration.
  // The dev server builds its stylesheet from the matched routes, so before the
  // catch-all route an unmatched path served an empty one.
  const html = await (await page.request.get("/no-such-page")).text();
  const hrefs = [
    ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g),
  ].map((match) => match[1]!);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const css = await (await page.request.get(href)).text();
    expect(css.length, href).toBeGreaterThan(0);
  }

  await clickUntilUrl(page, "Back to home", /\/$/);

  // Routes that exist but can't find their record still go through the error boundary.
  const missing = await page.goto("/questions/999999");
  expect(missing?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("course filter follows the selected department", async ({ page }) => {
  await page.goto("/questions/browse");
  await openQuestionFilters(page);

  // No department: every course, suffixed with its department's short name.
  await openCombobox(page, "Course");
  await expect(
    page.getByRole("option", { name: "Circuit Analysis (EEE)" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  // Closing a picker returns focus to it (unless another picker took it meanwhile).
  await expect(page.getByRole("combobox", { name: "Course" })).toBeFocused();

  // Pick a department by searching its short name.
  await openCombobox(page, "Department");
  await page.getByPlaceholder("Search departments…").fill("CSE");
  await page.getByRole("option", { name: /Computer Science/ }).click();
  await expect(page).toHaveURL(/departmentId=1/);

  // Now only that department's courses, without the suffix.
  await openCombobox(page, "Course");
  await expect(
    page.getByRole("option", { name: "Algorithms", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: /Circuit Analysis/ }),
  ).toHaveCount(0);
  await page
    .getByRole("option", { name: "Data Structures", exact: true })
    .click();
  await expect(page).toHaveURL(/courseId=1/);
  await closeQuestionFilters(page);

  await page
    .getByRole("link", { name: /Data Structures/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Data Structures",
  );

  // The next visit opens on the department picked last.
  await page.goto("/questions/browse");
  await expect(page).toHaveURL(/\/questions\/browse\?departmentId=1$/);
});

/** A paper in the list (or, on phones, the switcher) by its title. */
const paperLink = (page: Page, title: string) =>
  page
    .getByRole("link", { name: new RegExp(`^${title}`) })
    .filter({ visible: true })
    .first();

// Papers are titled by section and batch, otherwise by uploader.
const SEED_01 = "Section A · Batch 61";
const SEED_02 = "By Tanvir Hasan";

test("question page embeds the PDF, shows its uploader and switches submissions", async ({
  page,
}) => {
  await page.goto("/questions/1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Data Structures",
  );

  // The newest published paper (#1, by Ayesha) is selected by default.
  await expect(paperLink(page, SEED_01)).toHaveAttribute(
    "aria-current",
    "true",
  );
  const viewer = page.getByTestId("pdf-viewer");
  await expect(viewer).toHaveAttribute(
    "data",
    /^\/api\/v1\/submissions\/1\/file/,
  );
  // Browsers without an inline PDF viewer get links to the same file instead.
  await expect(
    page.getByTestId("pdf-viewer-fallback").locator("a[download]"),
  ).toHaveAttribute("href", "/api/v1/submissions/1/file");
  // The uploader card links to their profile.
  await expect(
    page.getByRole("link", { name: /^Ayesha Rahman/ }),
  ).toBeVisible();
  // The optional section and batch tell papers apart.

  await paperLink(page, SEED_02).click();
  await expect(page).toHaveURL(/submission=2$/);
  await expect(paperLink(page, SEED_02)).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(viewer).toHaveAttribute("data", /\/submissions\/2\/file/);
  await expect(page.getByRole("link", { name: /^Tanvir Hasan/ })).toBeVisible();

  // Switching back and forth keeps exactly one toolbar and viewer on the page.
  await paperLink(page, SEED_01).click();
  await expect(viewer).toHaveAttribute("data", /\/submissions\/1\/file/);
  await paperLink(page, SEED_02).click();
  await expect(viewer).toHaveAttribute("data", /\/submissions\/2\/file/);
  await expect(page.getByRole("link", { name: /^Log in to like/ })).toHaveCount(
    1,
  );
  await expect(page.getByRole("link", { name: "Report" })).toHaveCount(1);
  await expect(viewer).toHaveCount(1);

  // Unpublished submissions are listed but can't be opened.
  await expect(page.getByText("Pending review", { exact: true })).toBeVisible();
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  const pendingFile = await page.request.get("/api/v1/submissions/13/file");
  expect(pendingFile.status()).toBe(404);
});

test("question with only pending submissions explains the review", async ({
  page,
}) => {
  // Question 9 (Marketing Management) only has a pending submission.
  await page.goto("/questions/9");
  await expect(page.getByText("No published paper yet")).toBeVisible();
  await expect(
    page.getByText(/waiting for admin review/).first(),
  ).toBeVisible();
  await expect(page.getByTestId("pdf-viewer")).toHaveCount(0);
});

test("a question links to the same exam from other semesters", async ({
  page,
}) => {
  // Questions 1 and 11: the Data Structures midterm, 2nd and 1st semester.
  await page.goto("/questions/1");
  const others = page.getByRole("heading", { name: "Other semesters" });
  await others.scrollIntoViewIfNeeded();
  await clickUntilUrl(page, "Spring 24", /\/questions\/11$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Data Structures",
  );
  await expect(page.getByText("Spring 24").first()).toBeVisible();
});

test("course search leads to a course, its exams and a paper", async ({
  page,
}) => {
  await page.goto("/questions");
  // The pill opens the search once hydrated; before that it links to browsing.
  await page.waitForLoadState("networkidle");
  const search = page.getByRole("dialog", { name: "Search courses" });
  await page.getByRole("link", { name: /Search a course/ }).click();
  await expect(search).toBeVisible();

  // Every word must match, in any order.
  await search.getByRole("combobox").fill("struct data");
  await search.getByRole("option", { name: /Data Structures/ }).click();
  await expect(page).toHaveURL(/\/questions\/courses\/1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Data Structures",
  );

  // Only midterms, newest semester first.
  await page
    .getByRole("navigation", { name: "Exam type" })
    .getByRole("link", { name: /^Midterm/ })
    .click();
  await expect(page).toHaveURL(/examTypeId=\d+$/);
  const semesters = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(semesters.first()).toHaveText("Summer 24");
  await expect(
    page.getByRole("region", { name: "Summer 24" }).getByRole("link"),
  ).toHaveCount(1);

  await page
    .getByRole("region", { name: "Spring 24" })
    .getByRole("link", { name: /Midterm/ })
    .click();
  await expect(page).toHaveURL(/\/questions\/11$/);

  // The search remembers the course.
  await page.keyboard.press("/");
  await expect(
    search.getByRole("group", { name: "Recent" }).getByRole("option", {
      name: /Data Structures/,
    }),
  ).toBeVisible();
});

test("a department lists its courses A to Z, filtered as you type", async ({
  page,
}) => {
  await page.goto("/questions/departments/1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Computer Science and Engineering",
  );
  await expect(
    page.getByRole("heading", { name: "A", exact: true }),
  ).toBeVisible();

  const main = page.getByRole("main");
  await expect(async () => {
    await main.getByRole("searchbox", { name: "Filter courses" }).fill("data");
    await expect(main.getByRole("link", { name: "Algorithms" })).toHaveCount(
      0,
      { timeout: 1_000 },
    );
  }).toPass();
  await expect(
    main.getByRole("link", { name: "Database Systems" }),
  ).toBeVisible();

  await main.getByRole("link", { name: "Data Structures" }).click();
  await expect(page).toHaveURL(/\/questions\/courses\/1$/);
});

test("a course points to the same course filed under another department", async ({
  page,
}) => {
  await page.goto("/questions/courses/4");
  // On phones the Android strip appears once hydrated and moves the page down.
  await page.waitForLoadState("networkidle");
  const others = page.getByRole("complementary").filter({
    has: page.getByRole("heading", { name: "Same course, other names" }),
  });
  await others.getByRole("link", { name: /Discrete Mathematics/ }).click();
  await expect(page).toHaveURL(/\/questions\/courses\/9$/);
});

test("the phone menu has the visitor's own pages", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "The menu is for phones");
  await logInAs(page, NEW_USER, "/questions");
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(async () => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(menu).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(menu.getByRole("button", { name: "Log out" })).toBeVisible();
  await menu.getByRole("link", { name: "My submissions" }).click();
  await expect(page).toHaveURL(/\/questions\/my-submissions$/);
});

test("logging in sends visitors to Google", async ({ page }) => {
  await page.goto("/login?redirectTo=%2Fquestions%2Fcontribute");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Log in");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();

  // Submitted like the button's form, without following the redirect: the browser
  // would go on to the real Google (a redirect can't be stubbed with page.route).
  const res = await page.request.post(
    "/login?redirectTo=%2Fquestions%2Fcontribute",
    {
      form: { redirectTo: "/questions/contribute" },
      headers: { origin: "http://localhost:5173" },
      maxRedirects: 0,
    },
  );
  expect(res.status()).toBe(302);
  const google = new URL(res.headers()["location"]!);
  expect(google.origin).toBe("https://accounts.google.com");
  expect(google.searchParams.get("redirect_uri")).toBe(
    "http://localhost:5173/api/auth/callback/google",
  );
  expect(google.searchParams.get("state")).toBeTruthy();
  // The OAuth state cookie comes along, for the callback to check.
  expect(res.headers()["set-cookie"]).toContain("better-auth.state=");
});

test("a failed Google sign-in explains what happened", async ({ page }) => {
  await page.goto("/login?error=access_denied");
  await expect(page.getByText("Google sign-in was cancelled.")).toBeVisible();
});

test("an account without a DIU email is asked to switch before contributing", async ({
  page,
}) => {
  const { email } = await logInAs(page, NEW_READER, "/questions/contribute");
  await expect(page.getByText("Uploading needs a DIU email")).toBeVisible();
  await expect(page.getByRole("main")).toContainText(email);

  // A click during hydration can be lost; once it lands, the button is gone.
  const toLogin = /\/login\?redirectTo=%2Fquestions%2Fcontribute$/;
  await expect(async () => {
    if (!toLogin.test(page.url())) {
      await page
        .getByRole("button", { name: "Switch to your DIU account" })
        .click({ timeout: 1_000 });
    }
    await expect(page).toHaveURL(toLogin, { timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});

test("contributors index leads to a contributor's submissions", async ({
  page,
}) => {
  await page.goto("/questions/contributors");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Contributors",
  );
  // On phones the Android strip appears once hydrated and moves the page down.
  await page.waitForLoadState("networkidle");
  // Most published papers first.
  await expect(
    page
      .getByRole("list", { name: "Contributors" })
      .getByRole("listitem")
      .first(),
  ).toContainText("Ayesha Rahman");

  await page.getByRole("link", { name: /Nusrat Jahan/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Nusrat Jahan",
  );
  // Contributor pages are addressed by username.
  await expect(page).toHaveURL(/\/contributors\/nusrat\.jahan$/);
  // Only published papers are public; pending uploads stay private.
  await expect(page.getByText("Pending review")).toHaveCount(0);

  // Published submissions open the question with that paper selected.
  await page.getByRole("link", { name: /Algorithms/ }).click();
  await expect(page).toHaveURL(/\/questions\/3\?submission=4$/);
  await expect(page.getByRole("link", { name: /^Nusrat Jahan/ })).toBeVisible();

  // Links from before usernames (by user id) and other cases lead to the same page.
  for (const old of [
    "/questions/contributors/seed-user-3",
    "/questions/contributors/NUSRAT.JAHAN",
  ]) {
    await page.goto(`${old}?page=1`);
    await expect(page).toHaveURL(/\/contributors\/nusrat\.jahan\?page=1$/);
  }
});

test("a contributor can upload a paper with a new course", async ({ page }) => {
  await page.goto("/questions/contribute");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fquestions%2Fcontribute/);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await logInAs(page, NEW_USER, "/questions/contribute");

  const courseName = `E2E Course ${suffix}`;
  await uploadPaperWithNewCourse(page, courseName);

  // The status page says where the paper stands and what happened so far.
  await expect(page.getByRole("heading", { name: courseName })).toBeVisible();
  await expect(page.getByText("Pending review").first()).toBeVisible();
  await expect(page.getByText("Activity", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "My submissions" }).first().click();
  const card = page
    .getByRole("list", { name: "My submissions" })
    .getByRole("listitem")
    .filter({ hasText: courseName });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: courseName }).click();
  await expect(page).toHaveURL(/\/questions\/my-submissions\/\d+$/);
});

type ButtonLocator = ReturnType<Page["getByRole"]>;

/** The count in a vote button's accessible name, e.g. "Like (3)" → 3. */
async function voteCount(button: ButtonLocator) {
  const label = (await button.getAttribute("aria-label")) ?? "";
  return Number(/\((\d+)\)/.exec(label)?.[1]);
}

/**
 * Clicks a vote button and waits until the server has saved the vote. The counts update
 * optimistically, so without waiting a reload could cancel the request.
 */
async function castVote(page: Page, button: ButtonLocator, questionId: number) {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.startsWith(`/questions/${questionId}`),
  );
  await button.click();
  await saved;
}

test("a member can like, dislike and report a paper", async ({
  page,
}, testInfo) => {
  // The two projects share one database, so each votes on its own paper:
  // question 10 (#11) on desktop, question 8 (#9) on mobile.
  const questionId = testInfo.project.name === "mobile" ? 8 : 10;
  await logInAs(page, NEW_USER, `/questions/${questionId}`);
  await expect(page.getByText(/\d+ views?/).first()).toBeVisible();
  // On phones the Android strip appears once hydrated and moves the page down.
  await page.waitForLoadState("networkidle");

  const like = page.getByRole("button", { name: /^Like/ });
  const dislike = page.getByRole("button", { name: /^Dislike/ });
  await expect(like).toHaveAttribute("aria-pressed", "false");
  const likes = await voteCount(like);
  const dislikes = await voteCount(dislike);

  await castVote(page, like, questionId);
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAttribute("aria-label", `Like (${likes + 1})`);

  // Switching moves the vote; it is saved, so it survives a reload.
  await castVote(page, dislike, questionId);
  await expect(dislike).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(dislike).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAttribute("aria-label", `Like (${likes})`);
  await expect(dislike).toHaveAttribute(
    "aria-label",
    `Dislike (${dislikes + 1})`,
  );

  // Pressing the active vote again clears it.
  await castVote(page, dislike, questionId);
  await expect(dislike).toHaveAttribute("aria-pressed", "false");
  await expect(dislike).toHaveAttribute("aria-label", `Dislike (${dislikes})`);

  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Report" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByLabel("Unreadable or broken file").check();
  await dialog.getByLabel(/^Details/).fill("E2E: the second page is blurry");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thanks for the report")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reported" })).toBeDisabled();
});

test("visitors are asked to log in before voting", async ({ page }) => {
  await page.goto("/questions/1");
  // On phones the Android strip appears once hydrated and moves the page down.
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /^Log in to like/ }).click();
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fquestions%2F1/);
});

/** A wide image drawn in the page, so the cropper has something to crop. */
async function widePhoto(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas context");
    context.fillStyle = "#0ea5e9";
    context.fillRect(0, 0, 900, 600);
    context.fillStyle = "#7c3aed";
    context.fillRect(450, 0, 450, 600);
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  });
  return {
    name: "wide photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

test("a user crops, sets and removes a profile photo", async ({ page }) => {
  await logInAs(page, NEW_USER, "/account");
  const headerImage = page
    .getByRole("button", { name: "Account menu" })
    .locator("img");
  await expect(headerImage).toHaveCount(0);

  const photo = await widePhoto(page);
  const choose = page.getByLabel(/^(Choose|Change) photo$/);
  const dialog = page.getByRole("dialog");
  const save = page.getByRole("button", { name: "Save photo" });

  // Opening the cropper needs hydration, so retry picking the file.
  await expect(async () => {
    await choose.setInputFiles(photo);
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();

  // Cancelling the crop leaves nothing to save.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(save).toHaveCount(0);

  await choose.setInputFiles(photo);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Use photo" }).click();
  await expect(dialog).toBeHidden();
  await save.click();
  await expect(page.getByText("Photo updated")).toBeVisible();
  await expect(headerImage).toHaveAttribute("src", /^\/api\/v1\/avatars\//);

  // What was uploaded is the square crop, not the wide original.
  const uploaded = await page.evaluate(async () => {
    const image = document.querySelector<HTMLImageElement>(
      'img[src^="/api/v1/avatars/"]',
    );
    if (!image) throw new Error("No avatar image");
    const blob = await fetch(image.src).then((res) => res.blob());
    const bitmap = await createImageBitmap(blob);
    return { type: blob.type, width: bitmap.width, height: bitmap.height };
  });
  expect(uploaded.type).toBe("image/webp");
  expect(uploaded.width).toBe(uploaded.height);

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Photo removed")).toBeVisible();
  await expect(headerImage).toHaveCount(0);
});

test("a user can log out", async ({ page }) => {
  await logInAs(page, NEW_USER, "/");
  await logOut(page);
});

test("a contributor can manage their submissions and profile", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { email } = await logInAs(page, NEW_USER, "/questions/contribute");

  const courseName = `E2E Withdrawn ${suffix}`;
  await uploadPaperWithNewCourse(page, courseName);

  // A pending paper's details can be fixed without uploading it again.
  await page.getByRole("button", { name: "Edit details" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit details" });
  await editDialog.getByLabel("Section (optional)").fill("B");
  await editDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Details saved")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Section B");

  // The account menu leads to the user's own submissions, including unpublished ones.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "My submissions" }).click();
  await expect(page).toHaveURL(/\/questions\/my-submissions$/);
  const row = page
    .getByRole("list", { name: "My submissions" })
    .getByRole("listitem")
    .filter({ hasText: courseName });
  await expect(row).toContainText("Pending review");

  // Uploaders can open their own pending PDF.
  const actions = row.getByRole("button", {
    name: `Actions for ${courseName}`,
  });
  await expect(async () => {
    await actions.click();
    await expect(
      page.getByRole("menuitem", { name: "Preview PDF" }),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass();
  const preview = page.getByRole("menuitem", { name: "Preview PDF" });
  const previewFile = await page.request.get(
    (await preview.getAttribute("href"))!,
  );
  expect(previewFile.status()).toBe(200);

  await page.getByRole("menuitem", { name: "Withdraw" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Withdraw" })
    .click();
  await expect(page.getByText("Submission withdrawn")).toBeVisible();
  await expect(page.getByText("No submissions yet")).toBeVisible();

  // Rename, from the account settings in the account menu.
  await expect(async () => {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page
      .getByRole("menuitem", { name: "Account settings" })
      .click({ timeout: 1_000 });
    await expect(page).toHaveURL(/\/account$/, { timeout: 2_000 });
  }).toPass();
  await page.getByLabel("Name", { exact: true }).fill("Renamed Contributor");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Renamed Contributor",
  );

  // A new username, typed in any case, is saved in lowercase.
  const username = `e2e.${suffix}`.slice(0, 50).toLowerCase();
  await page.getByLabel("Username").fill(username.toUpperCase());
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated")).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveValue(username);
  // An invalid one is explained.
  await page.getByLabel("Username").fill("no spaces allowed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/^Use 3–50 lowercase letters/)).toBeVisible();

  // The email comes from Google and can't be changed on the account page.
  await page.goto("/account");
  await expect(page.getByText(email)).toBeVisible();
});

test("the theme follows the OS until one is picked", async ({ page }) => {
  const html = page.locator("html");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(html).toHaveClass(/\bdark\b/);

  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).not.toHaveClass(/\bdark\b/);

  // A picked theme sticks across reloads and ignores the OS. On phones the
  // theme is picked in the menu.
  const phone = test.info().project.name === "mobile";
  const menu = page.getByRole("dialog", { name: "Menu" });
  const openMenu = async () => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(menu).toBeVisible({ timeout: 1_000 });
  };
  await expect(async () => {
    if (phone) {
      await openMenu();
      await menu.getByRole("button", { name: "Dark" }).click();
    } else {
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
    }
    await expect(html).toHaveClass(/\bdark\b/, { timeout: 1_000 });
  }).toPass();
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  if (phone) {
    await expect(openMenu).toPass();
    await expect(menu.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  } else {
    await expect(
      page.getByRole("button", { name: "Switch to light theme" }),
    ).toBeVisible();
  }
});

test("the switcher moves between products", async ({ page }) => {
  await page.goto("/questions/browse");
  await expect(async () => {
    await page.getByRole("button", { name: "Switch product" }).click();
    await page
      .getByRole("menuitem", { name: /Class Routine/ })
      .click({ timeout: 2_000 });
    await expect(page).toHaveURL(/\/routine$/, { timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Class Routine",
  );
  await expect(page.getByText("Class Routine is coming soon")).toBeVisible();
  // The routine's space has no question bank menu.
  await expect(page.getByRole("link", { name: "Contribute" })).toHaveCount(0);
});

test("the old question bank's addresses lead to their new pages", async ({
  request,
}) => {
  // Locally the site is http, so the host redirect is checked by unit tests
  // (redirect.test.ts); here, that the pages it sends people to exist.
  for (const path of [
    "/questions",
    "/questions/browse",
    "/questions/contributors",
    "/questions/contribute",
  ]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect([200, 302]).toContain(res.status());
  }
});
