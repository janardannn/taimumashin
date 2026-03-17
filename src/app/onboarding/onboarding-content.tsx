"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { KeyRound, Github, ExternalLink, Copy, Check, Shield } from "lucide-react";

const AWS_REGIONS = [
  { value: "ap-south-1",     label: "Asia Pacific (Mumbai)",    glacierDeepPerGB: 0.002   },
  { value: "us-east-1",      label: "US East (N. Virginia)",    glacierDeepPerGB: 0.00099 },
  { value: "us-west-2",      label: "US West (Oregon)",         glacierDeepPerGB: 0.00099 },
  { value: "eu-west-1",      label: "Europe (Ireland)",         glacierDeepPerGB: 0.00099 },
  { value: "eu-central-1",   label: "Europe (Frankfurt)",       glacierDeepPerGB: 0.0018  },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)", glacierDeepPerGB: 0.002   },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)",     glacierDeepPerGB: 0.002   },
];

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-primary hover:underline font-medium"
    >
      {children}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Create an AWS account",
    body: (
      <>
        If you don&apos;t have one, go to{" "}
        <A href="https://aws.amazon.com/free/">aws.amazon.com</A> and sign up.
        You&apos;ll need an email and a credit card. Don&apos;t worry — Glacier
        Deep Archive costs about <strong>$1 per TB/month</strong>, so storing a
        few hundred GB is practically free.
      </>
    ),
  },
  {
    title: "Open CloudFormation",
    body: (
      <>
        CloudFormation is an AWS service that creates resources from a template
        — think of it as a one-click installer. Open the{" "}
        <A href="https://console.aws.amazon.com/cloudformation/home#/stacks/create">
          CloudFormation console
        </A>{" "}
        (you&apos;ll need to be signed into AWS).
      </>
    ),
  },
  {
    title: "Upload the template",
    body: (
      <>
        On the &quot;Create stack&quot; page, select{" "}
        <strong>&quot;Upload a template file&quot;</strong>, then upload our{" "}
        <A href="https://github.com/janardannn/taimumashin/blob/main/infrastructure/cloudformation.yaml">
          cloudformation.yaml
        </A>{" "}
        file (download it from GitHub first). Give the stack any name, e.g.{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
          taimumashin
        </code>
        . On the next page, you&apos;ll be asked for parameters — use the
        values shown in the box below. Click <strong>Next</strong> through
        the remaining options. On the final review page, tick the{" "}
        <strong>&quot;I acknowledge that AWS CloudFormation might create IAM
        resources with custom names&quot;</strong> checkbox at the bottom,
        then hit <strong>Submit</strong>.
      </>
    ),
  },
  {
    title: "Wait for it to finish",
    body: (
      <>
        The stack takes 1–2 minutes. Refresh the page until the status turns{" "}
        <strong className="text-green-500">CREATE_COMPLETE</strong>. If it
        fails, click the stack name → <strong>Events</strong> tab to see
        what went wrong.
      </>
    ),
  },
  {
    title: "Find your Role ARN",
    body: (
      <>
        Click your completed stack → go to the <strong>Outputs</strong> tab.
        You&apos;ll see a key called <strong>RoleArn</strong> with a value like{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px] break-all">
          arn:aws:iam::123456789012:role/taimumashin-role
        </code>
        . Copy this — it&apos;s what lets your browser access your bucket
        securely.
      </>
    ),
  },
  {
    title: "Find your Bucket Name",
    body: (
      <>
        In the same <strong>Outputs</strong> tab, copy the{" "}
        <strong>BucketName</strong> value. This is the S3 bucket the template
        created — your files will be archived here.
      </>
    ),
  },
  {
    title: "Paste here and connect",
    body: (
      <>
        Paste the <strong>Role ARN</strong> and <strong>Bucket Name</strong>{" "}
        into the form on the left. Make sure the <strong>Region</strong> matches
        where you deployed the stack (check the top-right corner of the{" "}
        <A href="https://console.aws.amazon.com/console/home">AWS Console</A>).
        Hit <strong>Connect &amp; Continue</strong> and you&apos;re done.
      </>
    ),
  },
];

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-xs break-all select-all">
          {value || "Loading..."}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value}
          className="shrink-0 rounded-md border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function OnboardingContent() {
  const router = useRouter();
  const { update } = useSession();
  const [roleArn, setRoleArn] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [region, setRegion] = useState("ap-south-1");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [cfnParams, setCfnParams] = useState({ issuerUrl: "", webhookUrl: "" });

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => setCfnParams({
        issuerUrl: data.issuerUrl || "",
        webhookUrl: data.webhookUrl || "",
      }))
      .catch(() => {});
  }, []);

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

      // Pass data to trigger JWT callback with trigger === "update"
      await update({ onboarded: true });
      // Hard navigation ensures the middleware gets the fresh cookie
      window.location.href = "/";
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* Left: Form */}
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Connect your AWS account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deploy the CloudFormation stack in your AWS account, then paste the
            outputs here.
          </p>
        </div>

        {/* BYOK Trust Section */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Zero-Trust BYOK</p>
              <p className="text-xs text-muted-foreground">
                Your files live in your AWS account. All S3 operations happen
                directly in your browser via OIDC — our server never has access
                to your files. We only store metadata (file names, sizes) to
                serve your dashboard.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                The CloudFormation template creates an OIDC trust — your browser
                gets temporary credentials (1 hour) by presenting your login
                token directly to AWS. Even the platform creator cannot access
                your bucket.
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
                  {r.label} ({r.value}) — ${r.glacierDeepPerGB}/GB
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
            {loading ? "Saving..." : "Connect & Continue"}
          </button>
        </form>
      </div>

      {/* Right: Step-by-step guide */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Setup guide</h2>
        <p className="text-sm text-muted-foreground">
          New to AWS? Follow these steps to get set up in ~5 minutes.
        </p>

        <ol className="space-y-5">
          {STEPS.map((step, i) => (
            <li key={i}>
              <div className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground mt-0.5">
                  {i + 1}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </div>

              {/* CloudFormation parameters — shown after Step 3 (Upload template) */}
              {i === 2 && (
                <div className="mt-3 ml-9 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-semibold">CloudFormation Parameters</p>
                  <p className="text-[11px] text-muted-foreground">
                    Copy these values into the CloudFormation parameters page:
                  </p>
                  <div className="space-y-2.5">
                    <CopyField label="TaimumashinIssuerUrl" value={cfnParams.issuerUrl} />
                    <CopyField label="WebhookUrl" value={cfnParams.webhookUrl} />
                    <CopyField label="NotificationEmail" value="your email for restore alerts" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    The remaining parameters (LifecycleDays, PreviewQuality, PreviewDurationCap) have sensible defaults — you can change them later in Settings.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
