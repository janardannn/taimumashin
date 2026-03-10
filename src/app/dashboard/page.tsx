"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { HardDrive, FolderOpen, FileText, Pickaxe, Download } from "lucide-react";
import { Footer } from "@/components/footer";
import { formatFileSize } from "@/lib/file-utils";

// ─── Same pricing data as settings — keep in sync ───────────

const REGIONS: Record<string, { label: string; standardPerGB: number; glacierDeepPerGB: number; retrievalPerGB: number }> = {
  "ap-south-1":     { label: "Mumbai",    standardPerGB: 0.025,  glacierDeepPerGB: 0.002,   retrievalPerGB: 0.024 },
  "us-east-1":      { label: "Virginia",  standardPerGB: 0.023,  glacierDeepPerGB: 0.00099, retrievalPerGB: 0.02  },
  "us-west-2":      { label: "Oregon",    standardPerGB: 0.023,  glacierDeepPerGB: 0.00099, retrievalPerGB: 0.02  },
  "eu-west-1":      { label: "Ireland",   standardPerGB: 0.023,  glacierDeepPerGB: 0.00099, retrievalPerGB: 0.02  },
  "eu-central-1":   { label: "Frankfurt", standardPerGB: 0.0245, glacierDeepPerGB: 0.0018,  retrievalPerGB: 0.024 },
  "ap-southeast-1": { label: "Singapore", standardPerGB: 0.025,  glacierDeepPerGB: 0.002,   retrievalPerGB: 0.024 },
  "ap-northeast-1": { label: "Tokyo",     standardPerGB: 0.025,  glacierDeepPerGB: 0.002,   retrievalPerGB: 0.022 },
};

const PREVIEW_RATIO = 0.08;

// ─────────────────────────────────────────────────────────────

interface Stats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  activeRestores: number;
  restoresThisMonth: number;
  dataRestoredThisMonth: number;
  region: string;
  recentRestores: {
    id: string;
    folderPath: string;
    status: string;
    requestedAt: string;
    restoredAt: string | null;
    expiresAt: string | null;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  const costs = useMemo(() => {
    if (!stats) return null;
    const pricing = REGIONS[stats.region] || REGIONS["ap-south-1"];
    const totalGB = stats.totalSize / (1024 * 1024 * 1024);
    const previewGB = totalGB * PREVIEW_RATIO;
    const restoredGB = stats.dataRestoredThisMonth / (1024 * 1024 * 1024);

    const storageCost = totalGB * pricing.glacierDeepPerGB;
    const previewCost = previewGB * pricing.standardPerGB;
    const retrievalCost = restoredGB * pricing.retrievalPerGB;
    const totalCost = storageCost + previewCost + retrievalCost;

    return { storageCost, previewCost, retrievalCost, totalCost, restoredGB, pricing };
  }, [stats]);

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const statCards = [
    { label: "Total Files", value: stats.totalFiles.toLocaleString(), icon: FileText },
    { label: "Total Folders", value: stats.totalFolders.toLocaleString(), icon: FolderOpen },
    { label: "Storage Used", value: formatFileSize(stats.totalSize), icon: HardDrive },
    { label: "Active Restores", value: stats.activeRestores.toString(), icon: Pickaxe },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <a href="/" className="hover:opacity-80 transition-opacity">
            <span className="text-lg font-bold leading-none">taimumashin</span>
            <span className="block text-[10px] text-muted-foreground leading-none">タイムマシン</span>
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <Link href="/dashboard" className="font-medium">Dashboard</Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">Settings</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Cost breakdown */}
        {costs && (
          <div className="rounded-lg border mb-8 overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <p className="text-sm text-muted-foreground">Estimated Cost This Month</p>
              <p className="mt-1 text-3xl font-bold">
                ${costs.totalCost < 0.01 ? costs.totalCost.toFixed(4) : costs.totalCost.toFixed(2)}
              </p>
            </div>
            <div className="divide-y">
              {/* Storage */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Glacier Deep Archive</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(stats.totalSize)} @ ${costs.pricing.glacierDeepPerGB}/GB
                    </p>
                  </div>
                </div>
                <p className="text-sm font-medium">
                  ${costs.storageCost < 0.01 ? costs.storageCost.toFixed(4) : costs.storageCost.toFixed(2)}
                </p>
              </div>

              {/* Previews */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">S3 Standard (previews)</p>
                    <p className="text-xs text-muted-foreground">
                      ~{formatFileSize(stats.totalSize * PREVIEW_RATIO)} @ ${costs.pricing.standardPerGB}/GB
                    </p>
                  </div>
                </div>
                <p className="text-sm font-medium">
                  ${costs.previewCost < 0.01 ? costs.previewCost.toFixed(4) : costs.previewCost.toFixed(2)}
                </p>
              </div>

              {/* Retrievals */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Retrievals this month</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.restoresThisMonth} restore{stats.restoresThisMonth !== 1 ? "s" : ""}
                      {costs.restoredGB > 0 && ` — ${costs.restoredGB.toFixed(1)}GB @ $${costs.pricing.retrievalPerGB}/GB`}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-medium">
                  ${costs.retrievalCost < 0.01 ? costs.retrievalCost.toFixed(4) : costs.retrievalCost.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="px-4 py-2 bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Data transfer out is free under 100GB/month. Retrieval cost is for Standard tier (12-48hr).
              </p>
            </div>
          </div>
        )}

        {/* Recent restores */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Recent Restores</h2>
          {stats.recentRestores.length === 0 ? (
            <p className="text-sm text-muted-foreground">No restore history yet.</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {stats.recentRestores.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium">{job.folderPath}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested {new Date(job.requestedAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    job.status === "READY"
                      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : job.status === "RESTORING"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {job.status === "READY" ? "\u2600\uFE0F Available" :
                     job.status === "RESTORING" ? "\u26CF\uFE0F Restoring" :
                     job.status === "EXPIRED" ? "\u2744\uFE0F Expired" :
                     job.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
