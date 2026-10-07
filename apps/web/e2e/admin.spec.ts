import {
  failOnConsoleErrors,
  logInAs,
  NEW_USER,
  logOut,
  openMenu,
  SEED_ADMIN,
  uploadPaperWithNewCourse,
  expect,
  test,
} from "./helpers";

failOnConsoleErrors();

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("members can't open the admin panel", async ({ page }) => {
  await logInAs(page, NEW_USER, "/account");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Admin panel" })).toHaveCount(
    0,
  );
});

test("an admin approves a proposed course and publishes the paper", async ({
  page,
}) => {
  // A contributor uploads a paper with a new course.
  const courseName = `E2E Proposed ${unique()}`;
  await logInAs(page, NEW_USER, "/questions/contribute");
  await uploadPaperWithNewCourse(page, courseName);
  await logOut(page);

  // The admin finds it in the review queue from the account menu.
  await logInAs(page, SEED_ADMIN, "/");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Admin panel" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");

  // The admin panel has its own shell, without the site header.
  await expect(page.getByRole("link", { name: "Share a paper" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Review submissions" }).click();
  await expect(page).toHaveURL(/\/admin\/questions\/submissions$/);
  // A click that lands before hydration is dropped, so retry until it navigates.
  await expect(async () => {
    await page.getByRole("link", { name: new RegExp(courseName) }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      courseName,
      { timeout: 2_000 },
    );
  }).toPass();
  await expect(
    page.getByText("This paper proposes new catalog entries"),
  ).toBeVisible();
  await expect(page.getByTestId("pdf-viewer")).toHaveAttribute(
    "data",
    /^\/api\/v1\/admin\/submissions\/[^/]+\/file/,
  );

  // It can't be published until the new course is approved.
  const publish = page.getByRole("button", { name: "Publish" });
  await expect(publish).toBeDisabled();

  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Review entries" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(dialog.getByRole("combobox", { name: "Course" })).toContainText(
    `${courseName} (new)`,
  );
  await dialog.getByRole("button", { name: "Approve and save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("New entries approved")).toBeVisible();
  await expect(
    page.getByText("This paper proposes new catalog entries"),
  ).toHaveCount(0);

  await publish.click();
  await expect(page.getByText("Paper published")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to review" }),
  ).toBeVisible();
  // Publishing starts the watermarked public copy.
  await expect(page.getByText("Public download")).toBeVisible();
  await expect(
    page.getByText(/Watermarking…|Watermarked|watermark failed/),
  ).toBeVisible();

  // Now it's public, filed under the new course.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Open the public page" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(courseName);
  await expect(page.getByTestId("pdf-viewer")).toBeVisible();
});

test("an admin watermarks published papers that have no public copy", async ({
  page,
}) => {
  await logInAs(page, SEED_ADMIN, "/admin/questions/submissions");
  // A click that lands before hydration is dropped, so retry until the dialog opens.
  const dialog = page.getByRole("alertdialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Watermark missing PDFs" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(dialog).toContainText("Watermark published papers?");
  await dialog.getByRole("button", { name: "Watermark" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Watermarking started")).toBeVisible();
});

test("an admin redoes every published paper's watermark", async ({ page }) => {
  await logInAs(page, SEED_ADMIN, "/admin/questions/submissions");
  // A click that lands before hydration is dropped, so retry until the dialog opens.
  const dialog = page.getByRole("alertdialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Redo all watermarks" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(dialog).toContainText("Watermark every published paper again?");
  await dialog.getByRole("button", { name: "Redo all" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Watermarking started")).toBeVisible();
});

test("an admin adds, renames and deletes a semester", async ({
  page,
}, testInfo) => {
  // Semester names are a term and a two-digit year, so each project gets its own.
  const [name, renamedName] =
    testInfo.project.name === "mobile"
      ? ["Short 17", "Short 18"]
      : ["Short 15", "Short 16"];
  await logInAs(page, SEED_ADMIN, "/admin/questions/catalog?tab=semesters");

  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Add semester" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Semester added")).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toBeVisible();

  // Names must be unique.
  await page.getByRole("button", { name: "Add semester" }).click();
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(dialog.getByRole("alert")).toContainText("already exists");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await row.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await dialog.getByLabel("Name").fill(renamedName.toLowerCase());
  await dialog.getByRole("button", { name: "Save" }).click();
  // Stored in the standard spelling.
  const renamed = page.getByRole("row", { name: new RegExp(renamedName) });
  await expect(renamed).toBeVisible();

  await renamed
    .getByRole("button", { name: `Actions for ${renamedName}` })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText(`Deleted “${renamedName}”`)).toBeVisible();
  await expect(renamed).toHaveCount(0);

  // Semesters in use can't be deleted.
  await page.getByRole("button", { name: "Actions for Spring 24" }).click();
  await expect(
    page.getByRole("menuitem", { name: /can’t delete/ }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("an admin merges duplicate courses, and the old course page redirects", async ({
  page,
}) => {
  await logInAs(page, SEED_ADMIN, "/admin/questions/catalog?tab=courses");
  // Two spellings of one course in CSE (seeded as department 1).
  const name = `E2E Merge ${unique()}`;
  const created: Record<string, number> = {};
  for (const spelling of [`${name} Lab`, `${name} Labs`]) {
    const res = await page.request.post("/api/v1/admin/courses", {
      data: { name: spelling, departmentId: 1 },
    });
    expect(res.status()).toBe(201);
    created[spelling] = ((await res.json()) as { id: number }).id;
  }
  await page.reload();

  // They show up among the likely duplicates.
  await page.getByRole("searchbox", { name: "Search courses" }).fill(name);
  await page.getByRole("button", { name: "Likely duplicates" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(
    2,
  );

  await page
    .getByRole("checkbox", { name: `Select ${name} Lab`, exact: true })
    .click();
  await page.getByRole("checkbox", { name: `Select ${name} Labs` }).click();
  await page.getByRole("button", { name: "Merge 2" }).click();

  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("radio", { name: new RegExp(`${name} Lab\\b(?!s)`) })
    .check();
  await expect(
    dialog.getByText("No exams are filed under the others."),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: `Merge into “${name} Lab”` })
    .click();
  await expect(page.getByText(`Merged into “${name} Lab”`)).toBeVisible();
  // No longer a duplicate: it leaves that view, and is the only one left.
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Likely duplicates" }).click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(
    1,
  );

  // The removed course's page leads to the one kept.
  await page.goto(`/questions/courses/${created[`${name} Labs`]}`);
  await expect(page).toHaveURL(`/questions/courses/${created[`${name} Lab`]}`);
});

test("an admin compares the AI's reading and prefills the form with it", async ({
  page,
}) => {
  // Seeded: the AI reads a different semester and a section for #15.
  await logInAs(page, SEED_ADMIN, "/admin/questions/submissions/15");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Operating Systems",
  );
  await expect(page.getByText("A question paper")).toBeVisible();
  await expect(page.getByText("A single paper")).toBeVisible();
  await expect(page.getByText("AI: Summer 25")).toBeVisible();

  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Apply AI values" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(
    dialog.getByRole("combobox", { name: "Semester" }),
  ).toContainText("Summer 25");
  await expect(dialog.getByLabel("Section (optional)")).toHaveValue("B");
  // Nothing is saved until the admin confirms.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // The list flags papers the AI disagrees with, and multi-paper files.
  await page.goto("/admin/questions/submissions?ai=flagged");
  await expect(
    page.getByRole("row", { name: /Multiple papers/ }),
  ).toBeVisible();
  await page.goto("/admin/questions/submissions/13");
  await expect(
    page.getByText("The AI found several question papers in this file"),
  ).toBeVisible();
});

test("an admin can scroll the course list in the classification dialog", async ({
  page,
}) => {
  await logInAs(page, SEED_ADMIN, "/admin/questions/submissions/15");
  const dialog = page.getByRole("dialog");
  await expect(async () => {
    await page.getByRole("button", { name: "Apply AI values" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await dialog.getByRole("combobox", { name: "Course" }).click();

  // The seed has few courses: a short list makes it overflow, as production's do.
  const list = page.locator("[cmdk-list]");
  await list.evaluate((el) => {
    el.style.setProperty("height", "80px", "important");
    el.style.setProperty("max-height", "80px", "important");
  });
  await list.hover();
  await page.mouse.wheel(0, 200);
  // The dialog's scroll lock must not swallow the wheel over the list.
  await expect
    .poll(() => list.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
});

test("an admin rejects a paper with a reason the uploader sees", async ({
  page,
  browser,
}) => {
  const courseName = `E2E Rejected ${unique()}`;
  await logInAs(page, NEW_USER, "/questions/contribute");
  await uploadPaperWithNewCourse(page, courseName);

  // The admin, in a separate browser session.
  const admin = await browser.newPage();
  await logInAs(admin, SEED_ADMIN, "/admin/questions/submissions");
  await expect(async () => {
    await admin.getByRole("link", { name: new RegExp(courseName) }).click();
    await expect(admin.getByRole("heading", { level: 1 })).toHaveText(
      courseName,
      { timeout: 2_000 },
    );
  }).toPass();

  const dialog = admin.getByRole("dialog");
  await expect(async () => {
    await admin.getByRole("button", { name: "Reject" }).click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  // A common reason fills in the text, which stays editable.
  await dialog.getByRole("button", { name: "Multiple papers" }).click();
  const reason = dialog.getByLabel("Reason", { exact: true });
  await expect(reason).toHaveValue(/multiple question papers/);
  await reason.fill("Two papers in one file. Please split them.");
  await dialog.getByRole("button", { name: "Reject" }).click();
  await expect(admin.getByText("Paper rejected")).toBeVisible();
  await expect(dialog).toBeHidden();
  // In the notice, and in the conversation with the uploader.
  await expect(
    admin
      .getByRole("main")
      .getByText("Two papers in one file. Please split them."),
  ).toHaveCount(2);
  await admin.close();

  // The uploader reads the reason on their submission.
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "Two papers in one file. Please split them.",
  );
});

test("an admin changes a user's username", async ({ page, browser }) => {
  // A member, in their own browser session.
  const memberPage = await browser.newPage();
  const member = await logInAs(memberPage, NEW_USER, "/account");
  await memberPage.close();

  await logInAs(
    page,
    SEED_ADMIN,
    `/admin/users?q=${encodeURIComponent(member.email)}`,
  );
  const row = page.getByRole("row").filter({ hasText: member.email });
  const dialog = page.getByRole("dialog");
  await openMenu(row.getByRole("button", { name: /^Actions for/ }));
  await page.getByRole("menuitem", { name: "Edit username" }).click();
  await expect(dialog).toBeVisible();

  const username = `renamed.${unique()}`;
  await dialog.getByLabel("Username").fill(username.toUpperCase());
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Username changed")).toBeVisible();
  await expect(row).toContainText(`@${username}`);
});

test("an admin asks for changes and the uploader fixes and resubmits the paper", async ({
  page,
  browser,
}) => {
  // A contributor uploads a paper (a new course, so the AI check can't publish it).
  const courseName = `E2E Changes ${unique()}`;
  await logInAs(page, NEW_USER, "/questions/contribute");
  await uploadPaperWithNewCourse(page, courseName);
  const paperUrl = page.url().replace(/\?.*$/, "");
  const id = paperUrl.split("/").at(-1)!;

  // The admin, in another browser, asks for a clearer scan.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await logInAs(admin, SEED_ADMIN, `/admin/questions/submissions/${id}`);
  const ask = admin.getByRole("dialog");
  await expect(async () => {
    await admin.getByRole("button", { name: "Request changes" }).click();
    await expect(ask).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await ask.getByRole("button", { name: "Blurry scan" }).click();
  await ask.getByRole("button", { name: "Send to uploader" }).click();
  await expect(ask).toBeHidden();
  await expect(admin.getByText("Changes requested")).toBeVisible();
  await expect(
    admin.getByText("Waiting for the uploader’s changes"),
  ).toBeVisible();

  // The uploader is told, in the header and on their list.
  await page.goto("/questions/my-submissions");
  await expect(
    page.getByRole("button", { name: "Account menu, 1 paper needs you" }),
  ).toBeVisible();
  await expect(
    page.getByText("A reviewer asked you to change a paper"),
  ).toBeVisible();
  await expect(page.getByText("1 new message")).toBeVisible();

  // They open it, see the request, and ask a question.
  await page.goto(paperUrl);
  await expect(page.getByText("The reviewer asked for changes")).toBeVisible();
  const conversation = page.getByRole("region", { name: "Messages" });
  await expect(
    conversation.getByText("Reviewer asked for changes"),
  ).toBeVisible();
  await conversation
    .getByRole("textbox", { name: "Message" })
    .fill("Which pages are blurry?");
  await conversation.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Message sent")).toBeVisible();
  await expect(conversation.getByText("Which pages are blurry?")).toBeVisible();

  // They replace the file and resubmit it with a note.
  const replace = page.getByRole("dialog");
  await page.getByRole("button", { name: "Replace file" }).click();
  await replace.getByLabel("PDF file").setInputFiles({
    name: "clearer.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n%e2e clearer scan\n"),
  });
  await replace.getByRole("button", { name: "Replace" }).click();
  await expect(replace).toBeHidden();
  await expect(page.getByText("File replaced")).toBeVisible();
  await expect(conversation.getByText("You replaced the file")).toBeVisible();

  const resubmit = page.getByRole("dialog");
  await page.getByRole("button", { name: "Resubmit" }).click();
  await resubmit
    .getByLabel(/What did you change/)
    .fill("Uploaded a clearer scan.");
  await resubmit.getByRole("button", { name: "Resubmit" }).click();
  await expect(resubmit).toBeHidden();
  await expect(page.getByText("Sent back for review")).toBeVisible();
  await expect(page.getByText("Pending review").first()).toBeVisible();

  // Back in the admin's queue, with the uploader's replies.
  await admin.goto("/admin/questions/submissions");
  const row = admin.getByRole("row", { name: new RegExp(courseName) });
  await expect(row.getByText(/new replies/)).toBeVisible();
  await admin.goto(`/admin/questions/submissions/${id}`);
  await expect(admin.getByText("Which pages are blurry?")).toBeVisible();
  await expect(admin.getByText("Uploaded a clearer scan.")).toBeVisible();
  await adminContext.close();
});
