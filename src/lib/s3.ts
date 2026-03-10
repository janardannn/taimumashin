import { S3Client } from "@aws-sdk/client-s3";
import { assumeRole } from "@/lib/aws";

export async function getS3Client(roleArn: string, userId: string, region: string) {
  const creds = await assumeRole(roleArn, userId);

  return new S3Client({
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}
