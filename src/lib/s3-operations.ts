import {
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  RestoreObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "@/lib/s3";

export interface S3Config {
  roleArn: string;
  userId: string;
  bucketName: string;
  region: string;
}

export async function listObjects(
  config: S3Config,
  prefix: string,
  continuationToken?: string
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  return client.send(
    new ListObjectsV2Command({
      Bucket: config.bucketName,
      Prefix: prefix,
      Delimiter: "/",
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    })
  );
}

export async function generatePresignedPutUrl(
  config: S3Config,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: contentType,
      StorageClass: "DEEP_ARCHIVE",
      ...(metadata && { Metadata: metadata }),
    }),
    { expiresIn: 3600 }
  );
}

export async function generatePresignedPutUrlStandard(
  config: S3Config,
  key: string,
  contentType: string
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 }
  );
}

export async function generatePresignedGetUrl(
  config: S3Config,
  key: string
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
    { expiresIn: 3600 }
  );
}

export async function headObject(config: S3Config, key: string) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  return client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );
}

export async function restoreObject(
  config: S3Config,
  key: string,
  days: number = 7
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  return client.send(
    new RestoreObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      RestoreRequest: {
        Days: days,
        GlacierJobParameters: { Tier: "Bulk" },
      },
    })
  );
}

export async function deleteObject(config: S3Config, key: string) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  return client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );
}
