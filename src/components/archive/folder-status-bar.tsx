"use client";

import { useState } from "react";
import { Snowflake, Pickaxe, Sun, Download, Trash2, Folder, FileIcon, X } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";

interface FolderStats {
  totalFiles: number;
  totalSize: number;
  archivedCount: number;
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
}

export function FolderStatusBar({
  folderPath,
  stats,
  restoreStatus,
  selection,
  onRestoreComplete,
  onDeleteComplete,
}: FolderStatusBarProps) {
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { totalFiles, totalSize, archivedCount, availableCount } = stats;
  const sizeLabel = formatFileSize(totalSize);

  async function handleRestore() {
    setShowRestoreConfirm(false);
    setRestoring(true);
    setError("");

    try {
      const res = await fetch("/api/archive/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Restore failed");
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
      const body =
        selection.type === "file"
          ? { key: selection.key }
          : { prefix: selection.key };

      const res = await fetch("/api/archive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Delete failed");
        return;
      }

      onDeleteComplete();
    } catch {
      setError("Delete request failed.");
    } finally {
      setDeleting(false);
    }
  }

  // Archive status chip
  function ArchiveChip() {
    if (restoreStatus && (restoreStatus.status === "PENDING" || restoreStatus.status === "RESTORING")) {
      const timeAgo = getTimeAgo(new Date(restoreStatus.requestedAt));
      return (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 dark:border-blue-900 dark:bg-blue-950/30">
          <Pickaxe className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
          <span className="text-xs">
            Thawing {restoreStatus.fileCount} file{restoreStatus.fileCount !== 1 ? "s" : ""} — {timeAgo}
          </span>
        </div>
      );
    }

    if (totalFiles === 0) return null;

    const allArchived = archivedCount === totalFiles;
    const allAvailable = availableCount === totalFiles;

    if (allAvailable) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 dark:border-green-900 dark:bg-green-950/30">
          <Sun className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs">
            {totalFiles} file{totalFiles !== 1 ? "s" : ""} available ({sizeLabel})
          </span>
        </div>
      );
    }

    if (allArchived) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
            <Snowflake className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs">
              {totalFiles} file{totalFiles !== 1 ? "s" : ""} archived ({sizeLabel})
            </span>
          </div>
          <button
            onClick={() => setShowRestoreConfirm(true)}
            disabled={restoring}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-500 px-2.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            <Pickaxe className="h-3 w-3" />
            {restoring ? "..." : "Restore"}
          </button>
        </div>
      );
    }

    // Mixed
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Pickaxe className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs">
            {availableCount} available, {archivedCount} archived ({sizeLabel})
          </span>
        </div>
        {archivedCount > 0 && (
          <button
            onClick={() => setShowRestoreConfirm(true)}
            disabled={restoring}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-500 px-2.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            <Pickaxe className="h-3 w-3" />
            {restoring ? "..." : "Restore"}
          </button>
        )}
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

      <div className="flex items-center justify-between rounded-lg border px-4 py-2.5">
        {/* Left: archive status */}
        <ArchiveChip />

        {/* Right: selection actions */}
        {selection ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              {selection.type === "folder" ? (
                <Folder className="h-4 w-4 text-blue-500" />
              ) : (
                <FileIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium max-w-[200px] truncate">{selection.name}</span>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {totalFiles} item{totalFiles !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Restore confirm modal */}
      {showRestoreConfirm && (
        <RestoreConfirmModal
          fileCount={archivedCount || totalFiles}
          size={sizeLabel}
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

function RestoreConfirmModal({
  fileCount,
  size,
  onConfirm,
  onCancel,
}: {
  fileCount: number;
  size: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Confirm Restore</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-sm">
            This will restore <span className="font-medium">{fileCount} file{fileCount !== 1 ? "s" : ""}</span> ({size}) from Glacier Deep Archive.
          </p>
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 space-y-1">
            <p>Restoration takes <span className="font-medium">12-48 hours</span> (Bulk tier).</p>
            <p>Restored files stay available for <span className="font-medium">7 days</span> before re-archiving.</p>
            <p>AWS charges a retrieval fee per GB restored.</p>
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
            className="flex-1 rounded-md bg-amber-500 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            <span className="flex items-center justify-center gap-1.5">
              <Pickaxe className="h-3.5 w-3.5" />
              Start Restore
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
