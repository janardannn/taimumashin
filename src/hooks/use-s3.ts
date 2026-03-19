"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, RestoreObjectCommand } from "@aws-sdk/client-s3";
import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}

interface S3Config {
  roleArn: string;
  bucketName: string;
  region: string;
  jwt: string;
}

export function useS3({ lazy = false }: { lazy?: boolean } = {}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configRef = useRef<S3Config | null>(null);
  const credsRef = useRef<Credentials | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  // Fetch user's AWS config + JWT from the server
  const fetchConfig = useCallback(async (): Promise<S3Config> => {
    const res = await fetch("/api/archive/credentials");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to fetch credentials config");
    }
    const data = await res.json();
    configRef.current = data;
    return data;
  }, []);

  // Call STS AssumeRoleWithWebIdentity to get temporary S3 credentials
  const assumeRole = useCallback(async (config: S3Config): Promise<Credentials> => {
    const sts = new STSClient({ region: config.region });
    const response = await sts.send(
      new AssumeRoleWithWebIdentityCommand({
        RoleArn: config.roleArn,
        RoleSessionName: `taimumashin-${Date.now()}`,
        WebIdentityToken: config.jwt,
        DurationSeconds: 3600,
      })
    );

    if (!response.Credentials) {
      throw new Error("STS returned no credentials");
    }

    const creds: Credentials = {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
      expiration: response.Credentials.Expiration!,
    };

    credsRef.current = creds;
    return creds;
  }, []);

  // Ensure we have valid credentials (refresh if expired or about to expire)
  const ensureCredentials = useCallback(async () => {
    const creds = credsRef.current;
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

    if (creds && creds.expiration.getTime() > fiveMinutesFromNow) {
      return; // Still valid
    }

    // Deduplicate concurrent refresh calls
    if (refreshPromiseRef.current) {
      await refreshPromiseRef.current;
      return;
    }

    refreshPromiseRef.current = (async () => {
      try {
        const config = await fetchConfig();
        await assumeRole(config);
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    await refreshPromiseRef.current;
  }, [fetchConfig, assumeRole]);

  // Get an S3 client with current credentials
  const getClient = useCallback(async (): Promise<{ client: S3Client; bucket: string }> => {
    await ensureCredentials();
    const creds = credsRef.current!;
    const config = configRef.current!;

    const client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      },
    });

    return { client, bucket: config.bucketName };
  }, [ensureCredentials]);

  // Initialize on mount (skip in lazy mode — credentials fetched on first operation)
  useEffect(() => {
    if (lazy) return;
    fetchConfig()
      .then((config) => assumeRole(config))
      .then(() => setReady(true))
      .catch((err) => setError(err.message));
  }, [lazy, fetchConfig, assumeRole]);

  // --- S3 Operations ---

  const listObjects = useCallback(
    async (prefix: string, delimiter = "/", continuationToken?: string) => {
      const { client, bucket } = await getClient();
      return client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: delimiter,
          ContinuationToken: continuationToken,
        })
      );
    },
    [getClient]
  );

  const headObject = useCallback(
    async (key: string) => {
      const { client, bucket } = await getClient();
      return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    },
    [getClient]
  );

  const putObject = useCallback(
    async (key: string, body: string | Blob | File, contentType: string, metadata?: Record<string, string>) => {
      const { client, bucket } = await getClient();
      return client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: metadata,
        })
      );
    },
    [getClient]
  );

  const getPresignedUrl = useCallback(
    async (key: string, expiresIn = 3600) => {
      const { client, bucket } = await getClient();
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
    },
    [getClient]
  );

  const getPresignedPutUrl = useCallback(
    async (key: string, contentType: string, metadata?: Record<string, string>, expiresIn = 3600) => {
      const { client, bucket } = await getClient();
      return getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, Metadata: metadata }),
        { expiresIn }
      );
    },
    [getClient]
  );

  const deleteObject = useCallback(
    async (key: string) => {
      const { client, bucket } = await getClient();
      return client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    [getClient]
  );

  const restoreObject = useCallback(
    async (key: string, days = 7, tier: "Expedited" | "Standard" | "Bulk" = "Standard") => {
      const { client, bucket } = await getClient();
      return client.send(
        new RestoreObjectCommand({
          Bucket: bucket,
          Key: key,
          RestoreRequest: { Days: days, GlacierJobParameters: { Tier: tier } },
        })
      );
    },
    [getClient]
  );

  const listAllObjects = useCallback(
    async (prefix: string) => {
      const allObjects: { Key: string; Size: number; StorageClass?: string }[] = [];
      let continuationToken: string | undefined;
      do {
        const listing = await listObjects(prefix, "", continuationToken);
        for (const obj of listing.Contents || []) {
          if (obj.Key && !obj.Key.endsWith("/")) {
            allObjects.push({ Key: obj.Key, Size: obj.Size || 0, StorageClass: obj.StorageClass });
          }
        }
        continuationToken = listing.NextContinuationToken;
      } while (continuationToken);
      return allObjects;
    },
    [listObjects]
  );

  return {
    ready,
    error,
    listObjects,
    listAllObjects,
    headObject,
    putObject,
    getPresignedUrl,
    getPresignedPutUrl,
    deleteObject,
    restoreObject,
    ensureCredentials,
  };
}
