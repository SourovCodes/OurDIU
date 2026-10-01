import { describe, expect, it } from "vitest";
import { listQuestionsQuerySchema } from "./question";

describe("listQuestionsQuerySchema", () => {
  it("coerces filter ids from the query string and applies pagination defaults", () => {
    expect(
      listQuestionsQuerySchema.parse({ departmentId: "1", courseId: "2" }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      sort: "newest",
      departmentId: 1,
      courseId: 2,
    });
  });

  it("rejects unknown sorts", () => {
    expect(listQuestionsQuerySchema.safeParse({ sort: "random" }).success).toBe(
      false,
    );
  });

  it.each([{ courseId: "abc" }, { semesterId: "0" }, { examTypeId: "-1" }])(
    "rejects invalid ids %o",
    (query) => {
      expect(listQuestionsQuerySchema.safeParse(query).success).toBe(false);
    },
  );

  it("caps page size", () => {
    expect(
      listQuestionsQuerySchema.safeParse({ pageSize: "500" }).success,
    ).toBe(false);
  });
});
