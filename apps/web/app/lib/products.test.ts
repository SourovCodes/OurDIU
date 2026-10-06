import { describe, expect, it } from "vitest";
import { productsWith } from "./products";

describe("products", () => {
  it("shows the Class Routine as live once a routine is", () => {
    const status = (live: boolean) =>
      Object.fromEntries(productsWith(live).map((p) => [p.id, p.status]));
    expect(status(false)).toEqual({
      questions: "live",
      routine: "soon",
      cover: "live",
      market: "soon",
    });
    expect(status(true)).toEqual({
      questions: "live",
      routine: "live",
      cover: "live",
      market: "soon",
    });
  });
});
