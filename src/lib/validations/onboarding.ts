import { z } from "zod";

export const onboardingSchema = z.object({
  roleArn: z
    .string()
    .min(1, "Role ARN is required")
    .regex(
      /^arn:aws:iam::\d{12}:role\/.+$/,
      "Invalid IAM Role ARN format (expected: arn:aws:iam::<account-id>:role/<role-name>)"
    ),
  bucketName: z
    .string()
    .min(3, "Bucket name is required")
    .max(63, "Bucket name too long")
    .regex(
      /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/,
      "Invalid S3 bucket name"
    ),
  region: z.string().min(1, "Region is required"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
