import { expect, it } from "vitest";
import { loader } from "./market";

it("sends the dropped Marketplace's page to the hub", () => {
  const res = loader();
  expect(res.status).toBe(301);
  expect(res.headers.get("location")).toBe("/");
});
