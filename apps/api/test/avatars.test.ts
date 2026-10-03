import {
  MAX_AVATAR_BYTES,
  type Avatar,
  type ContributorDetail,
  type QuestionDetail,
} from "@ourdiu/shared";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { user } from "../src/db/schema";
import { removeAvatar, setAvatar } from "../src/services/avatars";
import {
  api,
  db,
  seedQuestion,
  seedSubmission,
  seedTaxonomy,
  signIn,
} from "./helpers";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

function upload(file: File, cookie?: string) {
  const body = new FormData();
  body.append("file", file);
  return api("/api/v1/me/avatar", {
    method: "PUT",
    headers: cookie ? { cookie } : {},
    body,
  });
}

const imageOf = async (id: string) =>
  (
    await db().query.user.findFirst({
      columns: { image: true },
      where: eq(user.id, id),
    })
  )?.image;

describe("profile images", () => {
  it("requires sign-in to upload", async () => {
    const res = await upload(new File([PNG], "me.png"));
    expect(res.status).toBe(401);
  });

  it("stores and serves an uploaded image, replacing the previous one", async () => {
    const me = await signIn();
    const res = await upload(
      new File([PNG], "me.png", { type: "image/png" }),
      me.cookie,
    );
    expect(res.status).toBe(200);
    const first = await res.json<Avatar>();
    expect(first.image).toMatch(/^\/api\/v1\/avatars\/[0-9a-f-]{36}$/);
    expect(await imageOf(me.id)).toBe(first.image);

    const served = await api(first.image);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toContain("immutable");
    await served.arrayBuffer();

    // The type is detected from the bytes, not from the client's claim.
    const second = await (
      await upload(new File([JPEG], "me.png", { type: "image/png" }), me.cookie)
    ).json<Avatar>();
    const replaced = await api(second.image);
    expect(replaced.headers.get("content-type")).toBe("image/jpeg");
    await replaced.arrayBuffer();

    expect(await imageOf(me.id)).toBe(second.image);
    expect((await api(first.image)).status).toBe(404);
  });

  it("rejects files that aren't JPEG, PNG or WebP, or are too large", async () => {
    const me = await signIn();
    const svg = await upload(
      new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "x.svg", {
        type: "image/svg+xml",
      }),
      me.cookie,
    );
    expect(svg.status).toBe(400);

    const big = new Uint8Array(MAX_AVATAR_BYTES + 1);
    big.set(PNG);
    expect((await upload(new File([big], "big.png"), me.cookie)).status).toBe(
      400,
    );
    expect(await imageOf(me.id)).toBeNull();
  });

  it("removes the image", async () => {
    const me = await signIn();
    const { image } = await (
      await upload(new File([PNG], "me.png"), me.cookie)
    ).json<Avatar>();

    const res = await api("/api/v1/me/avatar", {
      method: "DELETE",
      headers: { cookie: me.cookie },
    });
    expect(res.status).toBe(204);
    expect(await imageOf(me.id)).toBeNull();
    expect((await api(image)).status).toBe(404);
  });

  it("can't be set through Better Auth's update-user", async () => {
    const me = await signIn();
    const victim = await signIn();
    const { image } = await (
      await upload(new File([PNG], "them.png"), victim.cookie)
    ).json<Avatar>();

    const updateUser = (body: object) =>
      api("/api/auth/update-user", {
        method: "POST",
        headers: { cookie: me.cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    for (const value of [image, "https://example.com/x.png", null]) {
      expect((await updateUser({ image: value })).status).toBe(400);
    }
    expect(await imageOf(me.id)).toBeNull();
    // Replacing their own image then can't delete someone else's.
    await upload(new File([PNG], "me.png"), me.cookie);
    expect((await api(image)).status).toBe(200);

    // The name still changes there.
    expect((await updateUser({ name: "New Name" })).status).toBe(200);
  });

  it("stores images on the files domain when there is one", async () => {
    const FILES_URL = "https://files.example.com";
    const me = await signIn();
    // Set before there was a files domain.
    const old = await setAvatar(
      db(),
      env.BUCKET,
      "",
      me.id,
      new File([PNG], "me.png"),
    );
    const first = await setAvatar(
      db(),
      env.BUCKET,
      FILES_URL,
      me.id,
      new File([PNG], "me.png"),
    );
    const id = first.image.match(
      /^https:\/\/files\.example\.com\/avatars\/([0-9a-f-]{36})$/,
    )?.[1];
    expect(id).toBeDefined();
    expect(await env.BUCKET.head(old.image.replace("/api/v1/", ""))).toBeNull();
    const stored = await env.BUCKET.head(`avatars/${id}`);
    expect(stored?.httpMetadata?.contentType).toBe("image/png");
    expect(stored?.httpMetadata?.cacheControl).toContain("immutable");

    // The API's URL, which images set before keep, redirects there.
    const res = await createApp().request(
      `/api/v1/avatars/${id}`,
      {},
      { ...env, FILES_URL },
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(first.image);

    // Replacing or removing it deletes the stored object.
    const second = await setAvatar(
      db(),
      env.BUCKET,
      FILES_URL,
      me.id,
      new File([JPEG], "me.jpg"),
    );
    expect(await env.BUCKET.head(`avatars/${id}`)).toBeNull();
    await removeAvatar(db(), env.BUCKET, FILES_URL, me.id);
    expect(
      await env.BUCKET.head(second.image.replace(`${FILES_URL}/`, "")),
    ).toBeNull();
  });

  it("shows the image on the user's papers and contributor profile", async () => {
    const me = await signIn();
    const { image } = await (
      await upload(new File([PNG], "me.png"), me.cookie)
    ).json<Avatar>();
    const t = await seedTaxonomy();
    const question = await seedQuestion({
      departmentId: t.cse.id,
      courseId: t.algorithms.id,
      semesterId: t.sem1.id,
      examTypeId: t.midterm.id,
    });
    await seedSubmission(question.id, { uploaderId: me.id });

    const detail = await (
      await api(`/api/v1/questions/${question.id}`)
    ).json<QuestionDetail>();
    expect(detail.submissions[0]?.uploader).toEqual({
      id: me.id,
      // Given at sign-up.
      username: expect.stringMatching(/^user_[0-9a-f]{6}$/),
      name: "Test User",
      image,
    });

    const contributor = await (
      await api(`/api/v1/contributors/${me.id}`)
    ).json<ContributorDetail>();
    expect(contributor.image).toBe(image);
  });
});
