"use client";

import { useState, useEffect, useMemo } from "react";
import { HardDrive, FolderOpen, FileText, Pickaxe, Download, X, File as FileIcon } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import { REGIONS as PRICING_REGIONS, getRegionPricing, PRICING_DATE } from "@/lib/pricing";

const PREVIEW_RATIO = 0.08;

interface Stats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  totalPreviewSize: number;
  activeRestores: number;
  restoresThisMonth: number;
  dataRestoredThisMonth: number;
  retrievalCostThisMonth: number;
  region: string;
  recentRestores: {
    id: string;
    folderPath: string;
    status: string;
    tier: string | null;
    fileCount: number;
    estimatedCost: number | null;
    requestedAt: string;
    restoredAt: string | null;
    expiresAt: string | null;
    keys: string[];
  }[];
}

export function DashboardContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [viewingJob, setViewingJob] = useState<Stats["recentRestores"][number] | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setStats)
      .catch((err) => console.error("Dashboard stats error:", err));
  }, []);

  const costs = useMemo(() => {
    if (!stats) return null;
    const pricing = getRegionPricing(stats.region);
    const totalGB = stats.totalSize / (1024 * 1024 * 1024);
    // Use actual preview size if available, fall back to estimate for old files
    const previewBytes = stats.totalPreviewSize > 0 ? stats.totalPreviewSize : stats.totalSize * PREVIEW_RATIO;
    const previewGB = previewBytes / (1024 * 1024 * 1024);
    const storageCost = totalGB * pricing.glacierPerGB;
    const previewCost = previewGB * pricing.standardPerGB;
    // Use stored cost if available, fall back to estimate
    const retrievalCost = stats.retrievalCostThisMonth > 0
      ? stats.retrievalCostThisMonth
      : (stats.dataRestoredThisMonth / (1024 * 1024 * 1024)) * pricing.restore.standard.perGB;
    const totalCost = storageCost + previewCost + retrievalCost;

    return { storageCost, previewCost, retrievalCost, totalCost, previewBytes, pricing };
  }, [stats]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
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
    <>
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
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Glacier Flexible</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(stats.totalSize)} @ ${costs.pricing.glacierPerGB}/GB
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium">
                ${costs.storageCost < 0.01 ? costs.storageCost.toFixed(4) : costs.storageCost.toFixed(2)}
              </p>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">S3 Standard (previews)</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalPreviewSize > 0 ? "" : "~"}{formatFileSize(costs.previewBytes)} @ ${costs.pricing.standardPerGB}/GB
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium">
                ${costs.previewCost < 0.01 ? costs.previewCost.toFixed(4) : costs.previewCost.toFixed(2)}
              </p>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Retrievals this month</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.restoresThisMonth} restore{stats.restoresThisMonth !== 1 ? "s" : ""}
                    {stats.dataRestoredThisMonth > 0 && ` — ${formatFileSize(stats.dataRestoredThisMonth)}`}
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
              Data transfer out is free under 100GB/month. Retrieval costs based on tier selected at restore time. Pricing as of {PRICING_DATE}.
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
              <button
                key={job.id}
                onClick={() => setViewingJob(job)}
                className="flex items-center justify-between p-3 w-full text-left hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{job.folderPath}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.fileCount} file{job.fileCount !== 1 ? "s" : ""}
                    {job.tier && ` · ${job.tier.charAt(0).toUpperCase() + job.tier.slice(1)}`}
                    {job.estimatedCost != null && job.estimatedCost > 0 && ` · ~$${job.estimatedCost < 0.01 ? job.estimatedCost.toFixed(4) : job.estimatedCost.toFixed(2)}`}
                    {" · "}{new Date(job.requestedAt).toLocaleDateString("en-IN", {
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
                  {job.status === "READY" ? "Available" :
                   job.status === "RESTORING" ? "Restoring" :
                   job.status === "EXPIRED" ? "Expired" :
                   job.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewingJob(null)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Restore Job</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {viewingJob.folderPath} · {viewingJob.fileCount} file{viewingJob.fileCount !== 1 ? "s" : ""}
                  {viewingJob.tier ? ` · ${viewingJob.tier}` : ""}
                  {" · "}{new Date(viewingJob.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <button onClick={() => setViewingJob(null)} className="flex h-7 w-7 items-center justify-center rounded-md bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/30 hover:text-foreground cursor-pointer transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                viewingJob.status === "READY"
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : viewingJob.status === "RESTORING"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
              }`}>
                {viewingJob.status === "READY" ? "Available" :
                 viewingJob.status === "RESTORING" ? "Restoring" :
                 viewingJob.status === "EXPIRED" ? "Expired" :
                 viewingJob.status}
              </span>
              {viewingJob.estimatedCost != null && viewingJob.estimatedCost > 0 && (
                <span className="text-xs text-muted-foreground">~${viewingJob.estimatedCost < 0.01 ? viewingJob.estimatedCost.toFixed(4) : viewingJob.estimatedCost.toFixed(2)}</span>
              )}
              {viewingJob.expiresAt && (
                <span className="text-xs text-muted-foreground">
                  Expires {new Date(viewingJob.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>

            {viewingJob.keys.length > 0 ? (
              <ul className="max-h-64 overflow-y-scroll rounded-lg bg-muted/50 px-4 py-3 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20">
                {viewingJob.keys.map((key) => (
                  <li key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{key.split("/").pop()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No file details available for this job.</p>
            )}

          </div>
        </div>
      )}
    </>
  );
}
