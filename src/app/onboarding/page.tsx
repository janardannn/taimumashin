"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AWS_REGIONS = [
  "ap-south-1",
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [roleArn, setRoleArn] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [region, setRegion] = useState("ap-south-1");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleArn, bucketName, region }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      router.push("/");
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Connect your AWS account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deploy the CloudFormation stack in your AWS account, then paste the outputs here.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="roleArn" className="text-sm font-medium">
              IAM Role ARN
            </label>
            <input
              id="roleArn"
              type="text"
              placeholder="arn:aws:iam::123456789012:role/taimumashin-role"
              value={roleArn}
              onChange={(e) => setRoleArn(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="bucketName" className="text-sm font-medium">
              S3 Bucket Name
            </label>
            <input
              id="bucketName"
              type="text"
              placeholder="my-taimumashin-bucket"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="region" className="text-sm font-medium">
              AWS Region
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {AWS_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Validating connection..." : "Connect & Continue"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground">
          We only store the Role ARN (a non-secret string). Your AWS credentials are never stored.
        </p>
      </div>
    </div>
  );
}
