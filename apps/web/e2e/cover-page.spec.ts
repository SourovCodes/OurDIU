import { expect, test, type Page } from "@playwright/test";
import { E2E_ORIGIN } from "./env";
import { failOnConsoleErrors, logInAs, NEW_USER } from "./helpers";

// The Cover Page maker (docs/PLAN.md, decisions 39 and 40). The seed
// has CSE routine v4.1 live with section 67_B, where STA ("Dr. Sample Teacher",
// an Associate Professor) takes CSE321 (Computer Networks).

failOnConsoleErrors();

const preview = (page: Page) =>
  page.getByRole("img", { name: "Preview of the cover page" });

/** Clicks Download PDF (the phone's or the wide screen's) and returns the PDF. */
async function download(page: Page) {
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/v1/cover-page/"),
  );
  await page.getByRole("button", { name: "Download PDF" }).first().click();
  return response;
}

test("the cover page maker works signed out, as a product of its own", async ({
  page,
}) => {
  await page.goto("/cover-page");
  await expect(page.getByRole("heading", { name: "Cover page" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Log in" }).first(),
  ).toBeVisible();

  // The preview follows what's typed and the template picked.
  // Retried: a click before hydration does nothing.
  const lab = page.getByRole("radio", { name: "Lab report" });
  await expect(async () => {
    await lab.click();
    await expect(lab).toHaveAttribute("aria-checked", "true", {
      timeout: 1_000,
    });
  }).toPass();
  await expect(preview(page)).toContainText("LAB REPORT");
  await page.getByLabel("Experiment name").fill("Round-robin scheduling");
  await page.getByLabel("Course code").fill("CSE323");
  await page.getByLabel("Name", { exact: true }).fill("Cover Tester");
  await expect(preview(page)).toContainText("Round-robin scheduling");

  // With nothing saved, a section typed in brings up its courses.
  await page.getByLabel("Your section").fill("67_B");
  const cse321 = page.getByRole("button", { name: "CSE321" });
  await expect(cse321).toBeVisible();
  await cse321.click();
  await expect(page.getByLabel("Teacher")).toHaveValue("Dr. Sample Teacher");

  // Departments are suggested as they're typed.
  const department = page.getByLabel("Department").last();
  await department.fill("electrical");
  await page
    .getByRole("option", { name: /Electrical and Electronic Engineering/ })
    .click();
  await expect(department).toHaveValue(
    "Department of Electrical and Electronic Engineering",
  );

  const res = await download(page);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect(res.headers()["content-disposition"]).toContain(
    "CSE321-lab-report-cover.pdf",
  );

  // "Remember my details" keeps the student's own on this device, not the work's.
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Cover Tester",
  );
  await expect(page.getByLabel("Course code")).toHaveValue("");
  // The remembered section's courses come back too.
  await expect(page.getByLabel("Your section")).toHaveValue("67_B");
  await expect(page.getByRole("button", { name: "CSE321" })).toBeVisible();
});

test("it fills in the student, the course and the teacher", async ({
  page,
}) => {
  await logInAs(page, NEW_USER, "/");
  const set = await page.request.put("/api/v1/me/student-id", {
    data: { studentId: "241-15-047" },
    headers: { origin: E2E_ORIGIN },
  });
  expect(set.ok()).toBe(true);
  // Section 67_B saved in the Class Routine.
  await page
    .context()
    .addCookies([
      { name: "ourdiu_routine", value: "cse%2F67_B%2F", url: E2E_ORIGIN },
    ]);

  await page.goto("/cover-page");
  await expect(page.getByLabel("Student ID")).toHaveValue("241-15-047");
  await expect(page.getByLabel("Your section")).toHaveValue("67_B");
  // The department comes from the ID: 15 is CSE.
  await expect(page.getByLabel("Department").last()).toHaveValue(
    "Department of Computer Science and Engineering",
  );

  // Picking a course from the routine brings its title and teacher.
  const cse321 = page.getByRole("button", { name: "CSE321" });
  await expect(async () => {
    await cse321.click();
    await expect(cse321).toHaveAttribute("aria-pressed", "true", {
      timeout: 1_000,
    });
  }).toPass();
  await expect(page.getByLabel("Course title")).toHaveValue(
    "Computer Networks",
  );
  await expect(page.getByLabel("Teacher")).toHaveValue("Dr. Sample Teacher");
  await expect(page.getByLabel("Designation")).toHaveValue(
    "Associate Professor",
  );
  // CSE321 is CSE's own course: its teacher is in the department.
  await expect(page.getByLabel("Department").first()).toHaveValue(
    "Department of Computer Science and Engineering",
  );
  await page.getByLabel("Topic").fill("Subnetting");

  // Enter in a field doesn't make the PDF: only Download does.
  let made = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/cover-page/")) made++;
  });
  await page.getByLabel("Topic").press("Enter");
  await expect(preview(page)).toContainText("Subnetting");
  expect(made).toBe(0);
  await expect(preview(page)).toContainText("Dr. Sample Teacher");
  await expect(preview(page)).toContainText("Subnetting");

  const res = await download(page);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain(
    "CSE321-assignment-cover.pdf",
  );

  // A course another department teaches (accounting, in CSE's routine): the
  // teacher's department is left to type.
  await page.getByRole("button", { name: "ACT327" }).click();
  await expect(page.getByLabel("Teacher")).toHaveValue("Sample Islam Khan");
  await expect(page.getByLabel("Department").first()).toHaveValue("");
});

test("the hub offers the Cover Page", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: /Cover Page/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/cover-page$/);
});
