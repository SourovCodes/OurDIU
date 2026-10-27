import type { Page } from "@playwright/test";
import { E2E_ORIGIN } from "./env";
import {
  APP_SHEET_COOKIE,
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
  expect,
  test,
} from "./helpers";

// These tests rely on the seed data, which their server gets fresh on every run.
// Question 1 (Data Structures) has 2 published, 1 pending and 1 rejected submission.

failOnConsoleErrors();

test("the footer leads to the app on Google Play", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Get the app" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("link", { name: "Get it on Google Play" }),
  ).toHaveAttribute(
    "href",
    "https://play.google.com/store/apps/details?id=com.ourdiu.app",
  );
  // Search engines learn it's an app.
  const ld = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(ld.some((text) => text.includes('"MobileApplication"'))).toBe(true);
});

test("Android visitors are asked once to use the app", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Only Android browsers are asked");
  await page.context().clearCookies({ name: APP_SHEET_COOKIE });
  await page.goto("/questions/1");
  const sheet = page.getByTestId("open-in-app-sheet");
  await expect(
    sheet.getByRole("link", { name: "Open in the app" }),
  ).toHaveAttribute(
    "href",
    /^intent:\/\/ourdiu\.com\/questions\/1#Intent;.*package=com\.ourdiu\.app;/,
  );
  await sheet.getByRole("button", { name: "Continue in browser" }).click();
  await expect(sheet).toHaveCount(0);

  // Answered: not on the next page, nor after a reload.
  await page.goto("/routine");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(sheet).toHaveCount(0);
});

test("the hub leads to the question bank and its questions", async ({
  page,
}) => {
  // The hub (HUB_LIVE, since the Class Routine launched): both products live.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "What do you need today?",
  );
  await expect(
    page.getByRole("main").getByRole("link", { name: /Class Routine/ }),
  ).not.toContainText("Coming soon");
  await expect(async () => {
    await page
      .getByRole("main")
      .getByRole("link", { name: /^Question Bank/ })
      .click();
    await expect(page).toHaveURL(/\/questions$/, { timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find your paper.",
  );

  // A department leads to its courses.
  await expect(async () => {
    await page
      .getByRole("navigation", { name: "Departments" })
      .getByRole("link", { name: /^CSE/ })
      .click();
    await expect(page).toHaveURL(/\/questions\/departments\/1$/, {
      timeout: 2_000,
    });
  }).toPass();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Computer Science and Engineering",
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

test("the question bank home explains the move from diuqbank.com", async ({
  page,
}) => {
  await page.goto("/questions");
  await clickUntilUrl(page, "diuqbank.com", /\/diuqbank$/);
  await expect(page).toHaveTitle(
    "DIU QBank (diuqbank.com) is now the DIU Question Bank on OurDIU",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "DIU QBank is now the DIU Question Bank on OurDIU",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Do I need a new account?" }),
  ).toBeVisible();
  // It belongs to the question bank's space.
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Question Bank" }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Open the DIU Question Bank" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/questions$/);
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
  // Bugs, ideas and questions can also go to the Telegram group.
  await expect(
    main.getByRole("link", { name: "Join the group" }),
  ).toHaveAttribute("href", "https://t.me/ourdiu_community");
  await expect(
    page
      .getByRole("navigation", { name: "About", exact: true })
      .getByRole("link", { name: "Telegram community" }),
  ).toHaveAttribute("href", "https://t.me/ourdiu_community");
  await expect(
    page
      .getByRole("navigation", { name: "About", exact: true })
      .getByRole("link", { name: "Facebook page" }),
  ).toHaveAttribute("href", "https://www.facebook.com/ourdiu");

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

  // Home is the hub (HUB_LIVE).
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
  // Searched by the site's one rule, short names too ("dm": Discrete Mathematics),
  // which come first. Only first: other tests' courses have random names that can
  // contain "dm".
  await page.getByPlaceholder("Search courses…").fill("dm");
  const options = page.getByRole("option");
  await expect(options.nth(0)).toHaveText("Discrete Mathematics (CSE)");
  await expect(options.nth(1)).toHaveText("Discrete Mathematics (EEE)");
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

/** A paper in the list (or, on phones, the switcher), by its uploader or details. */
const paperLink = (page: Page, text: string) =>
  page
    .getByRole("list", { name: "Papers" })
    .getByRole("link", { name: new RegExp(text) })
    .filter({ visible: true })
    .first();

/** The uploader's link in the viewer's bar. */
// On phones the paper's bar links to its uploader; on wider screens the paper
// itself says who shared it, and the list of copies names them.
const uploaderLink = (page: Page, name: string, isMobile: boolean) =>
  isMobile
    ? page
        .getByRole("region", { name: "Question paper" })
        .getByRole("link", { name: new RegExp(`^${name}`) })
    : page.getByRole("complementary").getByText(name).first();

// Papers are told apart by section and batch, otherwise by uploader.
const SEED_01 = "Section A · Batch 61";
const SEED_02 = "Tanvir Hasan";

test("opening a filter while another has a search typed keeps it open", async ({
  page,
}) => {
  // On phones the open list covers the other filters, so this can't happen there.
  test.skip(test.info().project.name === "mobile", "filters side by side only");
  await page.goto("/questions/browse");
  await openCombobox(page, "Course");
  await page.getByPlaceholder("Search courses…").fill("data");

  // Straight to another filter, without picking a course.
  await page.getByRole("combobox", { name: "Semester" }).click();
  // Once the course list has gone, the semester list is still open and focused
  // (cmdk used to pull focus back to the closing list, which closed both).
  await expect(page.getByPlaceholder("Search courses…")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Semester" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByPlaceholder("Search semesters…")).toBeFocused();

  // And back, the other way round: the course search starts empty again.
  await page.getByPlaceholder("Search semesters…").fill("fall");
  await page.getByRole("combobox", { name: "Course" }).click();
  await expect(page.getByPlaceholder("Search semesters…")).toHaveCount(0);
  await expect(page.getByPlaceholder("Search courses…")).toBeFocused();
  await expect(page.getByPlaceholder("Search courses…")).toHaveValue("");
});

test("question page embeds the PDF, shows its uploader and switches submissions", async ({
  page,
  isMobile,
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
  // Browsers with a PDF viewer embed the paper. The others (phones, and the
  // headless test browser) get links to open or download it, and Android ones are
  // also asked to read it in the app.
  const hasViewer = await page.evaluate(() => navigator.pdfViewerEnabled);
  const viewer = page.getByTestId("pdf-viewer");
  const openPdf = page.getByRole("link", { name: "Open the PDF" });
  const shows = (submission: number) => {
    const file = new RegExp(`^/api/v1/submissions/${submission}/file`);
    return hasViewer
      ? expect(viewer).toHaveAttribute("data", file)
      : expect(openPdf).toHaveAttribute("href", file);
  };
  await shows(1);
  await expect(page.getByRole("link", { name: "Open in the app" })).toHaveCount(
    isMobile && !hasViewer ? 1 : 0,
  );
  if (isMobile && !hasViewer) {
    await expect(
      page.getByRole("link", { name: "Open in the app" }),
    ).toHaveAttribute(
      "href",
      /^intent:\/\/ourdiu\.com\/questions\/1\?submission=1#Intent;/,
    );
  }
  // The file can be downloaded from the viewer's place too (inside the embed, for
  // browsers that can't show it after all).
  await expect(
    page
      .getByTestId(
        isMobile && !hasViewer ? "pdf-open-in-app" : "pdf-viewer-fallback",
      )
      .locator("a[download]"),
  ).toHaveAttribute("href", "/api/v1/submissions/1/file");
  await expect(uploaderLink(page, "Ayesha Rahman", isMobile)).toBeVisible();
  // The optional section and batch tell papers apart.

  await paperLink(page, SEED_02).click();
  await expect(page).toHaveURL(/submission=2$/);
  await expect(paperLink(page, SEED_02)).toHaveAttribute(
    "aria-current",
    "true",
  );
  await shows(2);
  await expect(uploaderLink(page, "Tanvir Hasan", isMobile)).toBeVisible();

  // Switching back and forth keeps exactly one toolbar and viewer on the page.
  await paperLink(page, SEED_01).click();
  await shows(1);
  await paperLink(page, SEED_02).click();
  await shows(2);
  await expect(page.getByRole("link", { name: /^Log in to like/ })).toHaveCount(
    1,
  );
  await expect(page.getByRole("link", { name: "Report" })).toHaveCount(1);
  await expect(hasViewer ? viewer : openPdf).toHaveCount(1);

  // Unpublished copies aren't listed (just counted) and can't be opened.
  await expect(
    page.getByText("1 more copy is waiting for review."),
  ).toBeVisible();
  await expect(page.getByText("Rejected", { exact: true })).toHaveCount(0);
  const pendingFile = await page.request.get("/api/v1/submissions/13/file");
  expect(pendingFile.status()).toBe(404);
});

test("the paper can be read full screen", async ({ page, isMobile }) => {
  test.skip(isMobile, "Phones open the file instead");
  // The test browser has no PDF viewer; say it has, so the paper is embedded.
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", {
      get: () => true,
    }),
  );
  await page.goto("/questions/1");
  await page.getByRole("button", { name: "Full screen" }).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.tagName))
    .toBe("OBJECT");
  await page.keyboard.press("Escape");
});

test("theater mode spreads the paper and lists across the window and is remembered", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Theater mode is for wide screens");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto("/questions/1");
  const paper = page
    .getByRole("region", { name: "Question paper" })
    .getByTestId("pdf-viewer-fallback");
  const lists = page.getByRole("complementary");
  const box = async () => {
    const [p, l] = [await paper.boundingBox(), await lists.boundingBox()];
    return {
      left: Math.round(p?.x ?? 0),
      right: Math.round((l?.x ?? 0) + (l?.width ?? 0)),
      lists: Math.round(l?.width ?? 0),
    };
  };
  const theater = page.getByRole("button", { name: "Theater mode" });
  await expect(theater).toHaveAttribute("aria-pressed", "false");
  const normal = await box();
  const windowWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  // Near the window's edges (its padding, the paper's card inset, and the
  // scrollbar's gutter), with the lists as wide as before.
  const spread = async () => {
    const { left, right, lists } = await box();
    return left < 50 && right > windowWidth - 40 && lists === normal.lists;
  };
  expect(normal.left).toBeGreaterThan(100);

  await theater.click();
  await expect(theater).toHaveAttribute("aria-pressed", "true");
  await expect.poll(spread).toBe(true);

  // The server renders it in theater mode next time.
  await page.reload();
  await expect(theater).toHaveAttribute("aria-pressed", "true");
  await expect.poll(spread).toBe(true);
  await theater.click();
  await expect(theater).toHaveAttribute("aria-pressed", "false");
  await expect.poll(box).toEqual(normal);
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
  const others = page.getByRole("heading", {
    name: "Other Data Structures exams",
  });
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
  await page
    .getByRole("main")
    .getByRole("link", { name: /^Search \d+ courses/ })
    .click();
  await expect(search).toBeVisible();

  // A course's initials find it.
  await search.getByRole("combobox").fill("pafsa");
  await expect(
    search.getByRole("option", {
      name: /Principles of Accounting and Financial Statement Analysis/,
    }),
  ).toBeVisible();

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
  // "Browse" lists the departments, the one with the most papers first; on
  // phones it's in the menu.
  await page.goto("/questions");
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(async () => {
    if (test.info().project.name === "mobile") {
      // The menu's code loads on the first tap, so it may take a moment to open.
      if (!(await menu.isVisible())) {
        await page.getByRole("button", { name: "Open menu" }).click();
      }
      await menu
        .getByRole("link", { name: "Browse" })
        .click({ timeout: 3_000 });
    } else {
      await page
        .getByRole("banner")
        .getByRole("link", { name: "Browse" })
        .click();
    }
    await expect(page).toHaveURL(/\/questions\/departments$/, {
      timeout: 2_000,
    });
  }).toPass();
  await page
    .getByRole("main")
    .getByRole("link", { name: /^CSE Computer Science and Engineering/ })
    .click();
  await expect(page).toHaveURL(/\/questions\/departments\/1$/);
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Log in to share a paper",
  );
  // It stays in the Question Bank, the space it goes back to.
  await expect(
    page.getByRole("banner").getByText("Question Bank", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();

  // Submitted like the button's form, without following the redirect: the browser
  // would go on to the real Google (a redirect can't be stubbed with page.route).
  const res = await page.request.post(
    "/login?redirectTo=%2Fquestions%2Fcontribute",
    {
      form: { redirectTo: "/questions/contribute" },
      headers: { origin: E2E_ORIGIN },
      maxRedirects: 0,
    },
  );
  expect(res.status()).toBe(302);
  const google = new URL(res.headers()["location"]!);
  expect(google.origin).toBe("https://accounts.google.com");
  expect(google.searchParams.get("redirect_uri")).toBe(
    `${E2E_ORIGIN}/api/auth/callback/google`,
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
  await expect(page.getByText("Sharing needs a DIU email")).toBeVisible();
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
  isMobile,
}) => {
  await page.goto("/questions/contributors");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Contributors",
  );
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
  // Contributor pages are addressed by username, and show the student ID.
  await expect(page).toHaveURL(/\/contributors\/nusrat\.jahan$/);
  await expect(page.getByRole("main")).toContainText("ID 241-15-047");
  // Only published papers are public; pending uploads stay private.
  await expect(page.getByText("Pending review")).toHaveCount(0);

  // Published submissions open the question with that paper selected.
  await page.getByRole("link", { name: /Algorithms/ }).click();
  await expect(page).toHaveURL(/\/questions\/3\?submission=4$/);
  // Credited in its row of the list (and on the paper's bar on phones).
  await expect(uploaderLink(page, "Nusrat Jahan", isMobile)).toBeVisible();

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
  // The review timeline: uploaded, then the AI check, then a decision.
  await expect(page.getByRole("region", { name: "Review" })).toContainText(
    "Uploaded",
  );

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
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The page has both vote areas, one hidden by CSS: the bar under the paper on
  // phones, the column beside it from `lg`. Look only in this project's one, so
  // the test doesn't depend on the stylesheet having applied.
  const votes =
    testInfo.project.name === "mobile"
      ? page.getByRole("region", { name: "Question paper" })
      : page.getByRole("complementary").filter({
          has: page.getByRole("region", { name: "Feedback" }),
        });
  const like = votes.getByRole("button", { name: /^Like/ });
  const dislike = votes.getByRole("button", { name: /^Dislike/ });
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
    await votes.getByRole("button", { name: "Report" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByLabel("Unreadable or broken file").check();
  await dialog.getByLabel(/^Details/).fill("E2E: the second page is blurry");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thanks for the report")).toBeVisible();
  await expect(votes.getByRole("button", { name: "Reported" })).toBeDisabled();
});

test("visitors are asked to log in before voting", async ({ page }) => {
  await page.goto("/questions/1");
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
  await page.getByLabel("Username").fill(username);

  // The optional student ID.
  await page.getByLabel("Student ID").fill("241-15");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/^Like 241-15-047/)).toBeVisible();
  await page.getByLabel("Student ID").fill("241-15-047");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Student ID")).toHaveValue("241-15-047");
  // Shown on the contributor page unless hidden.
  const show = page.getByRole("checkbox", {
    name: "Show it on my contributor page",
  });
  await expect(show).toBeChecked();
  await show.click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile updated")).toBeVisible();
  await page.reload();
  await expect(show).not.toBeChecked();

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
  // On phones the other spaces are in the menu.
  const phone = test.info().project.name === "mobile";
  await expect(async () => {
    if (phone) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .getByRole("dialog", { name: "Menu" })
        .getByRole("link", { name: /Class Routine/ })
        .click({ timeout: 2_000 });
    } else {
      await page.getByRole("button", { name: "Switch product" }).click();
      await page
        .getByRole("menuitem", { name: /Class Routine/ })
        .click({ timeout: 2_000 });
    }
    await expect(page).toHaveURL(/\/routine$/, { timeout: 2_000 });
  }).toPass();
  // The seed has a live routine (without one, the page says it's coming soon).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your class routine.",
  );
  // The routine's space has no question bank menu.
  await expect(page.getByRole("link", { name: "Share a paper" })).toHaveCount(
    0,
  );
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

test("buttons and menu items show the hand cursor", async ({ page }) => {
  await page.goto("/questions/browse");
  const arrows = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [role=tab], [role=combobox]",
      ),
    ]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => getComputedStyle(el).cursor !== "pointer")
      .map((el) => el.getAttribute("aria-label") ?? el.innerText),
  );
  expect(arrows).toEqual([]);

  // A click that lands before hydration is dropped, so retry until the list opens.
  const option = page.getByRole("option").first();
  await expect(async () => {
    await page.getByRole("combobox", { name: "Sort exams" }).click();
    await expect(option).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(option).toHaveCSS("cursor", "pointer");

  // The searchable pickers (cmdk) mark enabled items data-disabled="false".
  await page.goto("/questions/browse");
  await openQuestionFilters(page);
  await openCombobox(page, "Course");
  await expect(page.getByRole("option", { name: "Algorithms" })).toHaveCSS(
    "cursor",
    "pointer",
  );
});

test("hover and menu highlights tint the surface in both themes", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Phones have no hover");
  const TINT = /^linear-gradient\(rgba\(\d+, \d+, \d+, 0\.08\)/;
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/questions/browse");
    // A card: its own surface stays, the state layer is laid over it.
    const card = page.locator('[data-slot="card"]').first();
    await card.hover();
    await expect(card).toHaveCSS("background-image", TINT);

    // The product switcher's items, which used to match the menu's colour.
    const item = page.getByRole("menuitem", { name: /Class Routine/ });
    await expect(async () => {
      await page.getByRole("button", { name: "Switch product" }).click();
      await expect(item).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await item.hover();
    await expect(item).toHaveCSS("background-image", TINT);
    await page.keyboard.press("Escape");
  }
});

test("the footer leads to the admission guide, in the question bank's space", async ({
  page,
}) => {
  await page.goto("/");
  await clickUntilUrl(page, "Admission guide", /\/admission$/);
  await expect(page).toHaveTitle(
    "DIU Admission Test Guide: Eligibility, Test Schedule and Documents",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Getting into DIU: the admission test and how to apply",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Engineering 2:30 to 3:30 pm/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Can I apply before my HSC result is published?",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Apply online" }),
  ).toHaveAttribute("href", "https://admission.daffodilvarsity.edu.bd");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Question Bank" }),
  ).toBeVisible();
});

test("a paper's text is on its page, and search finds its words", async ({
  page,
}) => {
  await page.goto("/questions/1");
  const text = page.getByTestId("paper-text");
  await text.getByText("Read the questions as text").click();
  await expect(
    text.getByText(/What is a stack\? Explain push and pop/),
  ).toBeVisible();

  // From the course search to the papers' text.
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("/");
  const search = page.getByRole("dialog", { name: "Search courses" });
  await search.getByRole("combobox").fill("linked list");
  await search
    .getByRole("option", { name: "Find “linked list” in papers’ text" })
    .click();
  await expect(page).toHaveURL(/\/questions\/search\?q=linked\+list$/);

  const results = page.getByRole("list", { name: "Matching papers" });
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await expect(results.locator("mark").first()).toHaveText("linked");
  await results.getByRole("link", { name: "Data Structures" }).click();
  await expect(page).toHaveURL(/\/questions\/1\?submission=1$/);

  // Other forms of a word match ("sorting" finds "Sort"), courses whose names match
  // come first, and a pending paper's text is never found.
  await page.goto("/questions/search?q=sorting+merge");
  await expect(
    page
      .getByRole("list", { name: "Matching papers" })
      .getByRole("link", { name: "Algorithms" }),
  ).toBeVisible();
  await page.goto("/questions/search?q=draft+pending");
  await expect(
    page.getByText("No paper mentions “draft pending”"),
  ).toBeVisible();
  await page.goto("/questions/search?q=algorithms");
  await expect(
    page.getByRole("region", { name: "Courses" }).getByRole("link", {
      name: /Algorithms/,
    }),
  ).toBeVisible();
});

test("the question bank home shows what was most viewed today", async ({
  page,
}) => {
  await page.goto("/questions");
  const section = page.getByRole("region", { name: "Most viewed today" });
  const tiles = section.getByRole("link").filter({ hasText: "views today" });
  await expect(tiles).toHaveCount(4);
  // Most views first: Algorithms (40), then Circuit Analysis (31).
  await expect(tiles.first()).toContainText("Algorithms");
  await expect(tiles.first()).toContainText("40 views today");
  await expect(tiles.nth(1)).toContainText("Circuit Analysis");

  // The home has a "See all" per section: this one's.
  await expect(async () => {
    await section.getByRole("link", { name: "See all" }).click();
    await expect(page).toHaveURL(/sort=trending$/, { timeout: 2_000 });
  }).toPass();
  await expect(page.getByRole("combobox", { name: "Sort exams" })).toHaveText(
    /Most viewed today/,
  );
  await expect(
    page.getByRole("list", { name: "Questions" }).getByRole("link").first(),
  ).toHaveText("Algorithms");
});
