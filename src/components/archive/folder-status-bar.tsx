"use client";

import { useState } from "react";
import { Snowflake, Pickaxe, Zap, Trash2, Folder, FileIcon, X, Download, FolderPlus, Upload } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import { useS3 } from "@/hooks/use-s3";
import { useOperations, type DeleteSelection } from "@/components/operation-provider";
import { getRegionPricing, PRICING_DATE, type RestoreTier } from "@/lib/pricing";

interface FolderStats {
  totalFiles: number;
  totalSize: number;
  availableCount: number;
}

interface RestoreStatus {
  status: string;
  requestedAt: string;
  fileCount: number;
}

interface Selection {
  type: "file" | "folder";
  name: string;
  key: string; // S3 key for files, prefix for folders
}

interface FolderStatusBarProps {
  folderPath: string;
  stats: FolderStats;
  restoreStatus: RestoreStatus | null;
  selections: Selection[];
  onRestoreComplete: () => void;
  onDeleteComplete: () => void;
  onNewFolder: () => void;
  onUpload: () => void;
  isInstant?: boolean;
  region?: string;
}

export function FolderStatusBar({
  folderPath,
  stats,
  restoreStatus,
  selections,
  onRestoreComplete,
  onDeleteComplete,
  onNewFolder,
  onUpload,
  isInstant,
  region,
}: FolderStatusBarProps) {
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const s3 = useS3();
  const ops = useOperations();

  const { totalFiles, totalSize, availableCount } = stats;
  const sizeLabel = formatFileSize(totalSize);

  // Helper: compute S3 prefix from folderPath
  function getS3Prefix(): string {
    if (isInstant) {
      const subPath = folderPath.replace(/^instant\/?/, "");
      return subPath ? `instant/${subPath}/` : "instant/";
    }
    if (folderPath.startsWith("originals/") || folderPath.startsWith("instant/")) {
      return folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    }
    return folderPath ? `originals/${folderPath}/` : "originals/";
  }

  async function handleRestore(tier: "Expedited" | "Standard" | "Bulk", estimatedCost: number) {
    setShowRestoreConfirm(false);
    setRestoring(true);
    setError("");

    try {
      if (!s3.ready) {
        setError("S3 credentials not ready yet");
        return;
      }

      const prefix = getS3Prefix();
      const objects = await s3.listAllObjects(prefix);

      let fileCount = 0;
      let totalSizeBytes = 0;

      // Issue restore requests directly from the client
      for (const obj of objects) {
        try {
          await s3.restoreObject(obj.Key, 7, tier);
          fileCount++;
          totalSizeBytes += obj.Size;
        } catch {
          // Already restoring, not in Glacier, or standard -- skip
        }
      }

      // Only track in DB if at least one file actually needed restoring
      if (fileCount === 0) {
        setError("No files need restoring — they may still be in standard storage.");
        return;
      }

      // Notify server for DB tracking only
      const res = await fetch("/api/archive/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath, fileCount, totalSize: totalSizeBytes, tier: tier.toLowerCase(), estimatedCost }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Restore tracking failed");
        return;
      }

      onRestoreComplete();
    } catch {
      setError("Restore request failed.");
    } finally {
      setRestoring(false);
    }
  }

  function handleDelete(items?: DeleteSelection[]) {
    const toDelete = items || selections;
    if (toDelete.length === 0) return;
    setShowDeleteConfirm(false);
    ops.startDelete(toDelete);
    onDeleteComplete();
  }

  async function handleDownloadAll() {
    setDownloading(true);
    setError("");

    try {
      if (!s3.ready) {
        setError("S3 credentials not ready yet");
        return;
      }

      const JSZip = (await import("jszip")).default;
      const prefix = getS3Prefix();
      const objects = await s3.listAllObjects(prefix);

      if (!objects.length) {
        setError("No files to download");
        return;
      }

      const zip = new JSZip();

      for (const obj of objects) {
        const url = await s3.getPresignedUrl(obj.Key);
        const blob = await fetch(url).then((r) => r.blob());
        const name = obj.Key.split("/").pop()!;
        zip.file(name, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${folderPath.split("/").pop() || "archive"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  // Archive status chip
  function ArchiveChip() {
    if (isInstant) {
      return (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30">
          <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-xs">
            {totalFiles} file{totalFiles !== 1 ? "s" : ""} ({sizeLabel}) — S3 Standard, always available, no restore wait
          </span>
        </div>
      );
    }

    if (restoreStatus && (restoreStatus.status === "PENDING" || restoreStatus.status === "RESTORING")) {
      const timeAgo = getTimeAgo(new Date(restoreStatus.requestedAt));
      return (
        <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 dark:bg-blue-950/30">
          <Pickaxe className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
          <span className="text-xs">
            Thawing {restoreStatus.fileCount} file{restoreStatus.fileCount !== 1 ? "s" : ""} — {timeAgo}
          </span>
        </div>
      );
    }

    if (totalFiles === 0) return null;

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5">
          <Snowflake className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs">
            {totalFiles} file{totalFiles !== 1 ? "s" : ""} ({sizeLabel})
          </span>
        </div>
        <button
          onClick={() => setShowRestoreConfirm(true)}
          disabled={restoring}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 text-xs font-medium text-amber-500 hover:bg-amber-500/25 active:scale-[0.97] cursor-pointer disabled:opacity-50 transition-all"
        >
          <Pickaxe className="h-3 w-3" />
          {restoring ? "..." : "Restore"}
        </button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--panel-border)]">
        {/* Left: archive status */}
        <ArchiveChip />

        {/* Right: selection actions + toolbar */}
        <div className="flex items-center gap-2">
          {selections.length > 0 ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 ring-1 ring-blue-500/40 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                {selections.length === 1 ? (
                  <>
                    {selections[0].type === "folder" ? <Folder className="h-3 w-3 text-muted-foreground" /> : <FileIcon className="h-3 w-3 text-muted-foreground" />}
                    <span className="max-w-[150px] truncate">{selections[0].name}</span>
                  </>
                ) : (
                  <>{selections.length} items selected</>
                )}
              </span>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-red-600 px-2.5 text-xs font-medium text-white hover:bg-red-700 active:scale-[0.97] cursor-pointer transition-all"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
              <div className="h-4 w-px bg-border" />
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {totalFiles} item{totalFiles !== 1 ? "s" : ""}
              </span>
              {totalFiles > 0 && (availableCount > 0 || isInstant) && (
                <button
                  onClick={handleDownloadAll}
                  disabled={downloading}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.97] cursor-pointer disabled:opacity-50 transition-all"
                  title="Download all files as ZIP"
                >
                  <Download className="h-3 w-3" />
                  {downloading ? "..." : "ZIP"}
                </button>
              )}
              <div className="h-4 w-px bg-border" />
            </>
          )}
          <button
            onClick={onNewFolder}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground/20 bg-foreground/10 px-2.5 text-xs font-medium text-foreground hover:bg-foreground/15 active:scale-[0.97] cursor-pointer transition-all"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Folder</span>
          </button>
          <button
            onClick={onUpload}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.97] cursor-pointer transition-all"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>
      </div>

      {/* Restore confirm modal */}
      {showRestoreConfirm && (
        <RestoreConfirmModal
          fileCount={totalFiles}
          totalSizeBytes={totalSize}
          size={sizeLabel}
          region={region}
          onConfirm={handleRestore}
          onCancel={() => setShowRestoreConfirm(false)}
        />
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && selections.length > 0 && (
        <DeleteConfirmModal
          selections={selections}
          onConfirm={(items) => handleDelete(items)}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}

const TIER_KEYS: { key: RestoreTier; label: string }[] = [
  { key: "expedited", label: "Expedited" },
  { key: "standard", label: "Standard" },
  { key: "bulk", label: "Bulk" },
];

function RestoreConfirmModal({
  fileCount,
  totalSizeBytes,
  size,
  region,
  onConfirm,
  onCancel,
}: {
  fileCount: number;
  totalSizeBytes: number;
  size: string;
  region?: string;
  onConfirm: (tier: "Expedited" | "Standard" | "Bulk", estimatedCost: number) => void;
  onCancel: () => void;
}) {
  const [selectedTier, setSelectedTier] = useState<RestoreTier>("bulk");
  const pricing = getRegionPricing(region || "us-east-1");
  const sizeGb = totalSizeBytes / (1024 * 1024 * 1024);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Restore Files</h2>
          <button onClick={onCancel} className="flex h-7 w-7 items-center justify-center rounded-md bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/30 hover:text-foreground cursor-pointer transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm mb-4">
          Restore <span className="font-medium">{fileCount} file{fileCount !== 1 ? "s" : ""}</span> ({size}) from Glacier.
        </p>

        <div className="space-y-2 mb-4">
          {TIER_KEYS.map(({ key, label }) => {
            const tier = pricing.restore[key];
            const dataCost = sizeGb * tier.perGB;
            const requestCost = (fileCount / 1000) * tier.perRequest;
            const cost = dataCost + requestCost;
            const isSelected = selectedTier === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedTier(key)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "border-amber-500 bg-amber-500/10"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{label}</span>
                      <p className="text-xs text-muted-foreground">{tier.time}</p>
                    </div>
                    <span className="text-sm font-semibold">
                      {cost === 0 ? "Free" : `~$${cost < 0.01 ? "<0.01" : cost.toFixed(2)}`}
                    </span>
                  </div>
                  {cost > 0 && (
                    <div className="text-[11px] text-muted-foreground space-y-0.5 mt-1">
                      <p>${tier.perGB}/GB × {sizeGb.toFixed(2)} GB = {formatCostPart(dataCost)}</p>
                      <p>${tier.perRequest}/1K req × {fileCount} files = {formatCostPart(requestCost)}</p>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground mb-4 space-y-1">
          <p>Restored files stay available for <span className="font-medium">7 days</span> before re-archiving.</p>
          <p>Costs are estimates based on AWS {pricing.shortLabel} pricing as of {PRICING_DATE}.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border py-2 text-sm font-medium hover:bg-accent active:scale-[0.98] cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const tier = pricing.restore[selectedTier];
              const cost = sizeGb * tier.perGB + (fileCount / 1000) * tier.perRequest;
              onConfirm(selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1) as "Expedited" | "Standard" | "Bulk", cost);
            }}
            className="flex-1 rounded-md bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-600 active:scale-[0.98] cursor-pointer transition-all"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Pickaxe className="h-3.5 w-3.5" />
              Restore
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  selections: initialSelections,
  onConfirm,
  onCancel,
}: {
  selections: Selection[];
  onConfirm: (items: Selection[]) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState(initialSelections);
  const count = items.length;
  const isSingle = count === 1;
  const folderCount = items.filter(s => s.type === "folder").length;
  const fileCount = count - folderCount;

  const itemLabel = isSingle
    ? items[0].type === "folder" ? "Folder" : "File"
    : `${count} Items`;

  const description = isSingle
    ? <>Permanently delete <span className="font-medium">{items[0].name}</span>{items[0].type === "folder" ? " and all its contents" : ""}?</>
    : <>Permanently delete <span className="font-medium">{fileCount > 0 ? `${fileCount} file${fileCount !== 1 ? "s" : ""}` : ""}{fileCount > 0 && folderCount > 0 ? " and " : ""}{folderCount > 0 ? `${folderCount} folder${folderCount !== 1 ? "s" : ""}` : ""}</span>?</>;

  function removeItem(key: string) {
    const next = items.filter(s => s.key !== key);
    if (next.length === 0) {
      onCancel();
    } else {
      setItems(next);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-8 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Delete {itemLabel}</h2>
          <button onClick={onCancel} className="flex h-7 w-7 items-center justify-center rounded-md bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/30 hover:text-foreground cursor-pointer transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <p className="text-sm">{description}</p>
          {!isSingle && (
            <ul className="max-h-48 overflow-y-scroll rounded-lg bg-muted/50 px-4 py-3 space-y-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20">
              {items.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground" title={s.name}>
                  {s.type === "folder" ? (
                    <Folder className="h-3 w-3 shrink-0" />
                  ) : (
                    <FileIcon className="h-3 w-3 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{s.name}</span>
                  <button
                    onClick={() => removeItem(s.key)}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted-foreground/15 hover:text-foreground cursor-pointer transition-colors shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isSingle && (
            <div className="rounded-lg bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {items[0].type === "folder" ? <Folder className="h-3 w-3 shrink-0" /> : <FileIcon className="h-3 w-3 shrink-0" />}
                <span className="truncate">{items[0].name}</span>
              </div>
            </div>
          )}
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <p>This action cannot be undone. {isSingle ? `The ${items[0].type}` : "These items"} will be removed from S3 permanently.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border py-2 text-sm font-medium hover:bg-accent active:scale-[0.98] cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(items)}
            className="flex-1 rounded-md bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 active:scale-[0.98] cursor-pointer transition-all"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Delete{!isSingle ? ` (${count})` : ""}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCostPart(cost: number): string {
  if (cost === 0) return "$0";
  if (cost < 0.01) return "$<0.01";
  return `$${cost.toFixed(2)}`;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
