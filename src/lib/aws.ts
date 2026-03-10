import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

interface CachedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiresAt: number;
}

const credentialCache = new Map<string, CachedCredentials>();

const stsClient = new STSClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

export async function assumeRole(roleArn: string, userId: string) {
  const cached = credentialCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached;
  }

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `taimumashin-${userId}`,
    DurationSeconds: 3600,
  });

  const response = await stsClient.send(command);
  const credentials = response.Credentials!;

  const result: CachedCredentials = {
    accessKeyId: credentials.AccessKeyId!,
    secretAccessKey: credentials.SecretAccessKey!,
    sessionToken: credentials.SessionToken!,
    expiresAt: credentials.Expiration!.getTime(),
  };

  credentialCache.set(userId, result);
  return result;
}
