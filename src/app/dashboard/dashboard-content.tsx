"use client";

import { useState, useEffect, useMemo } from "react";
import { HardDrive, FolderOpen, FileText, Pickaxe, Download } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import { REGIONS as PRICING_REGIONS, getRegionPricing, PRICING_DATE } from "@/lib/pricing";

const PREVIEW_RATIO = 0.08;

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

export function DashboardContent() {
  const [stats, setStats] = useState<Stats | null>(null);

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
    const previewGB = totalGB * PREVIEW_RATIO;
    const restoredGB = stats.dataRestoredThisMonth / (1024 * 1024 * 1024);

    const storageCost = totalGB * pricing.glacierPerGB;
    const previewCost = previewGB * pricing.standardPerGB;
    const retrievalCost = restoredGB * pricing.restore.standard.perGB;
    const totalCost = storageCost + previewCost + retrievalCost;

    return { storageCost, previewCost, retrievalCost, totalCost, restoredGB, pricing };
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
                    ~{formatFileSize(stats.totalSize * PREVIEW_RATIO)} @ ${costs.pricing.standardPerGB}/GB
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
                    {costs.restoredGB > 0 && ` — ${costs.restoredGB.toFixed(1)}GB @ $${costs.pricing.restore.standard.perGB}/GB`}
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
              Data transfer out is free under 100GB/month. Retrieval cost shown for Standard tier (3-5hr). Pricing as of {PRICING_DATE}.
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
    </>
  );
}
