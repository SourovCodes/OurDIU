import { afterEach, describe, expect, it } from "vitest";
import { setTheater, THEATER_SCRIPT } from "./theater";

const runScript = () => new Function(THEATER_SCRIPT)();
const marked = () => "theater" in document.documentElement.dataset;

afterEach(() => {
  setTheater(false);
  document.cookie = "a=; Max-Age=0";
});

describe("THEATER_SCRIPT", () => {
  it("marks the page when the cookie is set, among others", () => {
    document.cookie = "a=b";
    setTheater(true);
    delete document.documentElement.dataset.theater;
    runScript();
    expect(marked()).toBe(true);
  });

  it("leaves it alone without the cookie", () => {
    setTheater(true);
    setTheater(false);
    runScript();
    expect(marked()).toBe(false);
  });
});
