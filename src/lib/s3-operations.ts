import {
  ListObjectsV2Command,
  PutObjectCommand,
  HeadObjectCommand,
  RestoreObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "@/lib/s3";

interface UserS3Config {
  roleArn: string;
  userId: string;
  bucketName: string;
  region: string;
}

export async function listObjects(
  config: UserS3Config,
  prefix: string,
  continuationToken?: string
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  const command = new ListObjectsV2Command({
    Bucket: config.bucketName,
    Prefix: prefix,
    Delimiter: "/",
    MaxKeys: 1000,
    ContinuationToken: continuationToken,
  });

  return client.send(command);
}

export async function generatePresignedPutUrl(
  config: UserS3Config,
  key: string,
  contentType: string
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
    StorageClass: "DEEP_ARCHIVE",
  });

  return getSignedUrl(client, command, { expiresIn: 3600 });
}

export async function generatePresignedPutUrlStandard(
  config: UserS3Config,
  key: string,
  contentType: string
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: 3600 });
}

export async function generatePresignedGetUrl(
  config: UserS3Config,
  key: string
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  const command = new HeadObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  // Use GetObjectCommand for actual download URLs
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const getCommand = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return getSignedUrl(client, getCommand, { expiresIn: 3600 });
}

export async function headObject(config: UserS3Config, key: string) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  const command = new HeadObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return client.send(command);
}

export async function restoreObject(
  config: UserS3Config,
  key: string,
  days: number = 7
) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  const command = new RestoreObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    RestoreRequest: {
      Days: days,
      GlacierJobParameters: {
        Tier: "Bulk",
      },
    },
  });

  return client.send(command);
}

export async function deleteObject(config: UserS3Config, key: string) {
  const client = await getS3Client(config.roleArn, config.userId, config.region);

  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });

  return client.send(command);
}
