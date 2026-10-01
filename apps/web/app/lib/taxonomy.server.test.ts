import type { Taxonomy } from "@ourdiu/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiGetJson } from "./api.server";
import { invalidateTaxonomy, loadTaxonomy } from "./taxonomy.server";

// The real module calls into the Worker's API (cloudflare:workers), not available here.
vi.mock("./api.server", () => ({ apiGetJson: vi.fn() }));

const taxonomy = (name: string): Taxonomy => ({
  departments: [{ id: 1, name, shortName: "CSE", publishedCount: 3 }],
  courses: [],
  semesters: [],
  examTypes: [],
});
const request = new Request("https://example.com/questions");
const fetchTaxonomy = vi.mocked(apiGetJson);

describe("loadTaxonomy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invalidateTaxonomy();
    fetchTaxonomy.mockReset();
    fetchTaxonomy
      .mockResolvedValueOnce(taxonomy("first"))
      .mockResolvedValueOnce(taxonomy("second"));
  });
  afterEach(() => vi.useRealTimers());

  it("fetches all lists with one API call and reuses them for a minute", async () => {
    expect(await loadTaxonomy(request)).toEqual(taxonomy("first"));
    expect(fetchTaxonomy).toHaveBeenCalledWith(request, "/api/v1/taxonomy");

    vi.advanceTimersByTime(59_000);
    expect(await loadTaxonomy(request)).toEqual(taxonomy("first"));
    expect(fetchTaxonomy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    expect(await loadTaxonomy(request)).toEqual(taxonomy("second"));
    expect(fetchTaxonomy).toHaveBeenCalledTimes(2);
  });

  it("skips the cache when asked for fresh lists or after an invalidation", async () => {
    await loadTaxonomy(request);
    expect(await loadTaxonomy(request, { fresh: true })).toEqual(
      taxonomy("second"),
    );

    fetchTaxonomy.mockResolvedValueOnce(taxonomy("third"));
    invalidateTaxonomy();
    expect(await loadTaxonomy(request)).toEqual(taxonomy("third"));
  });

  it("doesn't keep a failed load", async () => {
    fetchTaxonomy.mockReset();
    fetchTaxonomy
      .mockRejectedValueOnce(new Error("API down"))
      .mockResolvedValueOnce(taxonomy("after"));
    await expect(loadTaxonomy(request)).rejects.toThrow("API down");
    expect(await loadTaxonomy(request)).toEqual(taxonomy("after"));
  });
});
