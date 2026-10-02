import { expect, it } from "vitest";
import { loader } from "./assetlinks";

it("lets the Play-signed app open the site's links", async () => {
  const res = loader();
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  expect(await res.json()).toEqual([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.ourdiu.app",
        sha256_cert_fingerprints: [
          expect.stringMatching(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/),
        ],
      },
    },
  ]);
});
