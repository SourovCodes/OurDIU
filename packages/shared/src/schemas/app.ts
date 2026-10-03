import { z } from "zod";

/** A version as the app names itself: MAJOR.MINOR.PATCH, as in its mobile-v* tag. */
export const appVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/)
  .meta({ id: "AppVersion" });

/** What the Android app needs to know about itself from the server. */
export const androidAppSchema = z
  .object({
    /**
     * The oldest version that still works. An older app asks to be updated
     * before anything else; newer ones are told about updates by Google Play.
     */
    minVersion: appVersionSchema,
  })
  .meta({ id: "AndroidApp" });
export type AndroidApp = z.infer<typeof androidAppSchema>;
