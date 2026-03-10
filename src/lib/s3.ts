import { S3Client } from "@aws-sdk/client-s3";

// Always uses local AWS credentials (from aws configure)
export function getS3Client(region: string) {
  return new S3Client({ region });
}
