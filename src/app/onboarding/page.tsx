"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Github, ExternalLink } from "lucide-react";

const AWS_REGIONS = [
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
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
          <a href="/" className="hover:opacity-80 transition-opacity">
            <span className="text-2xl font-bold leading-none">taimumashin</span>
            <span className="block text-xs text-muted-foreground leading-none">タイムマシン</span>
          </a>
          <h1 className="text-xl font-bold mt-6">Connect your AWS account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deploy the CloudFormation stack in your AWS account, then paste the outputs here.
          </p>
        </div>

        {/* BYOK Trust Section */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Bring Your Own Keys (BYOK)</p>
              <p className="text-xs text-muted-foreground">
                Your data lives in your AWS account. We never store your AWS credentials —
                only a Role ARN (a non-secret identifier) that lets us manage objects on your behalf
                via temporary STS tokens that expire every hour.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <a
              href="https://github.com/janardannn/taimumashin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              View source code
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://github.com/janardannn/taimumashin/blob/main/infrastructure/cloudformation.yaml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Review CloudFormation template
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
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
                <option key={r.value} value={r.value}>
                  {r.label} ({r.value})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Validating connection..." : "Connect & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
