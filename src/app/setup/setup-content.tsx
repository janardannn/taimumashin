"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Copy, Check, KeyRound, Shield } from "lucide-react";

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

const STEPS = [
  {
    title: "Create an AWS account",
    body: "Sign up at aws.amazon.com if you don't have one. You'll need an email and credit card.",
  },
  {
    title: "Choose a region",
    body: "Pick the region closest to you for faster uploads, or the cheapest one to save on storage. Set it in the top-right corner of the AWS Console before creating the stack.",
  },
  {
    title: "Open CloudFormation",
    body: "CloudFormation creates all the AWS resources from a template (think of it as a one-click installer).",
  },
  {
    title: "Upload the template",
    body: "Select 'Upload a template file' and use our cloudformation.yaml. Fill in the parameters shown below, then click through and submit.",
  },
  {
    title: "Wait for CREATE_COMPLETE",
    body: "Takes 1-2 minutes. Refresh the page until the status turns green.",
  },
  {
    title: "Copy Role ARN + Bucket Name",
    body: "Go to the Outputs tab of your completed stack. Copy the RoleArn and BucketName values into the onboarding form.",
  },
];

export function SetupContent() {
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">Setup Guide</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reference guide for setting up your AWS CloudFormation stack.
        </p>
      </div>

      {/* BYOA Section */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Zero-Trust BYOA (Bring Your Own AWS)</p>
            <p className="text-xs text-muted-foreground">
              The CloudFormation template creates an S3 bucket (where your files
              live), an IAM Role with an OIDC trust (so your browser can talk to
              S3 directly), and an SNS topic for restore notifications. Everything
              lives in your AWS account, under your billing. We never store any
              keys or secrets. To disconnect, just delete the CloudFormation stack.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              When you log in, your browser presents your JWT to AWS via OIDC and
              gets temporary credentials (1 hour). All uploads, downloads, and deletes
              go straight from your browser to your S3 bucket. Our server never sees
              your files; it only stores metadata for search and your dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* CloudFormation Parameters */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
        <p className="text-sm font-semibold">CloudFormation Parameters</p>
        <p className="text-xs text-muted-foreground">
          Use these when creating or updating your CloudFormation stack:
        </p>
        <div className="space-y-2.5">
          <CopyField label="TaimumashinIssuerUrl" value={cfnParams.issuerUrl} />
          <CopyField label="WebhookUrl" value={cfnParams.webhookUrl} />
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-4">
        {STEPS.map((step, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground mt-0.5">
              {i + 1}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Links */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <A href="https://github.com/janardannn/taimumashin/blob/main/infrastructure/cloudformation.yaml">
          View CloudFormation template
        </A>
        <A href="https://github.com/janardannn/taimumashin">
          Source code
        </A>
      </div>
    </div>
  );
}
