import { z } from "zod";

/**
 * Every public page with content, for the site's sitemap.xml: questions with at
 * least one published paper and contributors with at least one published paper.
 */
export const sitemapSchema = z.object({
  questions: z.array(
    z.object({
      id: z.number().int(),
      /** When its newest published paper was uploaded. */
      lastModified: z.iso.datetime(),
    }),
  ),
  contributors: z.array(z.object({ username: z.string() })),
});
export type Sitemap = z.infer<typeof sitemapSchema>;
