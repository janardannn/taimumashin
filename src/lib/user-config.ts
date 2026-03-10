import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import type { S3Config } from "@/lib/s3-operations";

/**
 * Get S3 config for the current user.
 * Reads bucketName/region from user's DB record, falls back to env vars.
 */
export async function getUserS3Config(): Promise<{
  config: S3Config;
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      bucketName: true,
      region: true,
    },
  });

  if (!user) return null;

  // Use DB values, fall back to env vars
  const bucketName = user.bucketName || process.env.DEV_S3_BUCKET;
  const region = user.region || process.env.AWS_REGION || "ap-south-1";

  if (!bucketName) return null;

  return {
    config: { bucketName, region },
    user,
  };
}
