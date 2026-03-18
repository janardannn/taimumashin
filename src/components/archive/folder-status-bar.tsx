"use client";

import { useState } from "react";
import { Snowflake, Pickaxe, Zap, Trash2, Folder, FileIcon, X, Download, FolderPlus, Upload } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import { useS3 } from "@/hooks/use-s3";
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
  selection: Selection | null;
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
  selection,
  onRestoreComplete,
  onDeleteComplete,
  onNewFolder,
  onUpload,
  isInstant,
  region,
}: FolderStatusBarProps) {
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const s3 = useS3();

  const { totalFiles, totalSize, availableCount } = stats;
  const sizeLabel = formatFileSize(totalSize);

  // Helper: list all objects recursively under a prefix
  async function listAllObjects(prefix: string) {
    const allObjects: { Key: string; Size: number; StorageClass?: string }[] = [];
    let continuationToken: string | undefined;

    do {
      const listing = await s3.listObjects(prefix, "", continuationToken);
      for (const obj of listing.Contents || []) {
        if (obj.Key && !obj.Key.endsWith("/")) {
          allObjects.push({
            Key: obj.Key,
            Size: obj.Size || 0,
            StorageClass: obj.StorageClass,
          });
        }
      }
      continuationToken = listing.NextContinuationToken;
    } while (continuationToken);

    return allObjects;
  }

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

  async function handleRestore(tier: "Expedited" | "Standard" | "Bulk") {
    setShowRestoreConfirm(false);
    setRestoring(true);
    setError("");

    try {
      if (!s3.ready) {
        setError("S3 credentials not ready yet");
        return;
      }

      const prefix = getS3Prefix();
      const objects = await listAllObjects(prefix);

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
        body: JSON.stringify({ folderPath, fileCount, totalSize: totalSizeBytes }),
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

  async function handleDelete() {
    if (!selection) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    setError("");

    try {
      if (!s3.ready) {
        setError("S3 credentials not ready yet");
        return;
      }

      if (selection.type === "file") {
        // Delete the file from S3
        await s3.deleteObject(selection.key);

        // Try to delete the preview too
        if (selection.key.startsWith("originals/")) {
          const previewKey = selection.key.replace(/^originals\//, "previews/");
          try {
            await s3.deleteObject(previewKey);
          } catch {
            // Preview might not exist
          }
        }

        // Notify server for DB cleanup only
        const res = await fetch("/api/archive/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: selection.key }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Delete tracking failed");
          return;
        }
      } else {
        // Folder: list all objects recursively and delete each one
        const objects = await listAllObjects(selection.key);

        for (const obj of objects) {
          await s3.deleteObject(obj.Key);

          // Delete corresponding preview
          if (obj.Key.startsWith("originals/")) {
            const previewKey = obj.Key.replace(/^originals\//, "previews/");
            try {
              await s3.deleteObject(previewKey);
            } catch {
              // Preview might not exist
            }
          }
        }

        // Notify server for DB cleanup only
        const res = await fetch("/api/archive/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: selection.key }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Delete tracking failed");
          return;
        }
      }

      onDeleteComplete();
    } catch {
      setError("Delete request failed.");
    } finally {
      setDeleting(false);
    }
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
      const objects = await listAllObjects(prefix);

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
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 text-xs font-medium text-amber-500 hover:bg-amber-500/25 disabled:opacity-50"
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
          {selection ? (
            <>
              <div className="flex items-center gap-2 rounded-md bg-red-500/5 px-2.5 py-1">
                <div className="flex items-center gap-1.5 text-xs">
                  {selection.type === "folder" ? (
                    <Folder className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <FileIcon className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span className="font-medium max-w-[150px] truncate text-red-300">{selection.name}</span>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium bg-red-500/25 text-red-400 hover:bg-red-500/35 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
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
                  className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
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
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-2.5 text-xs text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Folder</span>
          </button>
          <button
            onClick={onUpload}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
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
      {showDeleteConfirm && selection && (
        <DeleteConfirmModal
          name={selection.name}
          type={selection.type}
          onConfirm={handleDelete}
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
  onConfirm: (tier: "Expedited" | "Standard" | "Bulk") => void;
  onCancel: () => void;
}) {
  const [selectedTier, setSelectedTier] = useState<RestoreTier>("bulk");
  const pricing = getRegionPricing(region || "us-east-1");
  const sizeGb = totalSizeBytes / (1024 * 1024 * 1024);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Restore Files</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm mb-4">
          Restore <span className="font-medium">{fileCount} file{fileCount !== 1 ? "s" : ""}</span> ({size}) from Glacier.
        </p>

        <div className="space-y-2 mb-4">
          {TIER_KEYS.map(({ key, label }) => {
            const tier = pricing.restore[key];
            const cost = sizeGb * tier.perGB + (fileCount / 1000) * tier.perRequest;
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
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{label}</span>
                    <p className="text-xs text-muted-foreground">{tier.time}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold">
                      {cost === 0 ? "Free" : `~$${cost < 0.01 ? "<0.01" : cost.toFixed(2)}`}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {tier.perGB === 0 ? "No retrieval fee" : `$${tier.perGB}/GB`}
                    </p>
                  </div>
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
            className="flex-1 rounded-md border py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1) as "Expedited" | "Standard" | "Bulk")}
            className="flex-1 rounded-md bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-600"
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
  name,
  type,
  onConfirm,
  onCancel,
}: {
  name: string;
  type: "file" | "folder";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Delete {type === "folder" ? "Folder" : "File"}</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-sm">
            Permanently delete <span className="font-medium">{name}</span>
            {type === "folder" ? " and all its contents" : ""}?
          </p>
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">
            <p>This action cannot be undone. The {type} will be removed from S3 permanently.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-md bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </span>
          </button>
        </div>
      </div>
    </div>
  );
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
