import { z } from "zod";

export const settingsSchema = z.object({
  roleArn: z
    .string()
    .regex(/^arn:aws:iam::\d{12}:role\/.+$/, "Invalid IAM Role ARN format")
    .optional(),
  bucketName: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, "Invalid S3 bucket name")
    .optional(),
  region: z.string().min(1).optional(),
  notificationEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  restoreDays: z.coerce.number().int().min(1).max(14).optional(),
  previewQuality: z.enum(["360p", "480p", "720p"]).optional(),
  previewDurationCap: z.coerce.number().int().min(10).max(300).optional(),
  lifecycleDays: z.coerce.number().int().min(1).max(30).optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
