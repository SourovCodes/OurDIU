import { z } from "zod";
import { USERNAME_PATTERN, USERNAME_RULES } from "../constants";

/** A username as users type it: trimmed and lowercased before the rules apply. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, `Use ${USERNAME_RULES}`);

export const updateUsernameInputSchema = z
  .object({ username: usernameSchema })
  .meta({ id: "UpdateUsernameInput" });
export type UpdateUsernameInput = z.infer<typeof updateUsernameInputSchema>;

/** The signed-in user. */
export const profileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    username: z.string(),
    image: z.string().nullable(),
    role: z.enum(["user", "admin"]),
  })
  .meta({ id: "Profile" });
export type Profile = z.infer<typeof profileSchema>;
