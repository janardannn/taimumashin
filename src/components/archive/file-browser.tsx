"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Upload, RefreshCw } from "lucide-react";
import { FolderCard } from "./folder-card";
import { FileCard } from "./file-card";
import { FileViewer } from "./file-viewer";
import { UploadDialog } from "./upload-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { FolderStatusBar } from "./folder-status-bar";

interface S3Folder {
  name: string;
  prefix: string;
  lastModified?: string | null;
}

interface S3File {
  name: string;
  key: string;
  size: number;
  lastModified?: string;
  storageClass?: string;
  restoreStatus?: string | null;
  restoreExpiresAt?: string | null;
  previewUrl?: string | null;
}

type BrowseItem =
  | { type: "folder"; data: S3Folder; date: number }
  | { type: "file"; data: S3File; date: number };

interface DateGroup {
  label: string;
  items: BrowseItem[];
}

interface FileBrowserProps {
  path: string;
}

function getDateBucket(ts: number): string {
  if (ts === 0) return "Unknown date";
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDate(folders: S3Folder[], files: S3File[]): DateGroup[] {
  const items: BrowseItem[] = [];

  for (const f of folders) {
    const date = f.lastModified ? new Date(f.lastModified).getTime() : 0;
    items.push({ type: "folder", data: f, date });
  }

  for (const f of files) {
    const date = f.lastModified ? new Date(f.lastModified).getTime() : 0;
    items.push({ type: "file", data: f, date });
  }

  // Group into buckets
  const bucketMap = new Map<string, BrowseItem[]>();
  const bucketOrder: string[] = [];

  for (const item of items) {
    const label = getDateBucket(item.date);
    if (!bucketMap.has(label)) {
      bucketMap.set(label, []);
      bucketOrder.push(label);
    }
    bucketMap.get(label)!.push(item);
  }

  // Sort buckets by most recent item date (newest first)
  bucketOrder.sort((a, b) => {
    const aMax = Math.max(...(bucketMap.get(a)?.map((i) => i.date) || [0]));
    const bMax = Math.max(...(bucketMap.get(b)?.map((i) => i.date) || [0]));
    return bMax - aMax;
  });

  // Within each bucket: folders first (desc by date), then files (desc by date)
  return bucketOrder.map((label) => {
    const group = bucketMap.get(label)!;
    const groupFolders = group.filter((i) => i.type === "folder").sort((a, b) => b.date - a.date);
    const groupFiles = group.filter((i) => i.type === "file").sort((a, b) => b.date - a.date);
    return { label, items: [...groupFolders, ...groupFiles] };
  });
}

export function FileBrowser({ path }: FileBrowserProps) {
  const router = useRouter();
  const [folders, setFolders] = useState<S3Folder[]>([]);
  const [files, setFiles] = useState<S3File[]>([]);
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0, archivedCount: 0, availableCount: 0 });
  const [restoreStatus, setRestoreStatus] = useState<{ status: string; requestedAt: string; fileCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [error, setError] = useState("");

  // Selection state
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // File viewer state
  const [viewingFile, setViewingFile] = useState<S3File | null>(null);

  const s3Prefix = path ? `originals/${path}/` : "originals/";

  const loadContents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/archive/list?prefix=${encodeURIComponent(s3Prefix)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load files");
        return;
      }
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setStats(data.stats || { totalFiles: 0, totalSize: 0, archivedCount: 0, availableCount: 0 });
      setRestoreStatus(data.restoreStatus || null);
    } catch (err) {
      console.error("Failed to load contents:", err);
      setError("Failed to load files. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [s3Prefix]);

  useEffect(() => {
    loadContents();
  }, [loadContents]);

  const dateGroups = useMemo(() => groupByDate(folders, files), [folders, files]);

  // Clear selection when clicking empty area
  const handleBackgroundClick = useCallback(() => {
    setSelectedFolder(null);
    setSelectedFile(null);
  }, []);

  const handleFolderClick = useCallback((prefix: string) => {
    setSelectedFolder(prefix);
    setSelectedFile(null);
  }, []);

  const handleFolderDoubleClick = useCallback((prefix: string) => {
    const urlPath = prefix.replace(/^originals\//, "").replace(/\/$/, "");
    router.push(`/${urlPath}`);
  }, [router]);

  const handleFileClick = useCallback((key: string) => {
    setSelectedFile(key);
    setSelectedFolder(null);
  }, []);

  const handleFileDoubleClick = useCallback((file: S3File) => {
    setViewingFile(file);
  }, []);

  // Build selection object for status bar
  const selection = useMemo(() => {
    if (selectedFile) {
      const file = files.find((f) => f.key === selectedFile);
      if (file) return { type: "file" as const, name: file.name, key: file.key };
    }
    if (selectedFolder) {
      const folder = folders.find((f) => f.prefix === selectedFolder);
      if (folder) return { type: "folder" as const, name: folder.name, key: folder.prefix };
    }
    return null;
  }, [selectedFile, selectedFolder, files, folders]);

  const handleDeleteComplete = useCallback(() => {
    setSelectedFile(null);
    setSelectedFolder(null);
    loadContents();
  }, [loadContents]);

  return (
    <div className="space-y-4" onClick={handleBackgroundClick}>
      {/* Header */}
      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <BreadcrumbNav path={path} />
        <div className="flex items-center gap-2">
          <button
            onClick={loadContents}
            className="inline-flex h-8 items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <p className="text-muted-foreground">This folder is empty</p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Upload files
          </button>
        </div>
      ) : (
        <>
          {/* Status bar */}
          <div onClick={(e) => e.stopPropagation()}>
            <FolderStatusBar
              folderPath={path}
              stats={stats}
              restoreStatus={restoreStatus}
              selection={selection}
              onRestoreComplete={loadContents}
              onDeleteComplete={handleDeleteComplete}
            />
          </div>

          {/* Date-grouped content */}
          {dateGroups.map((group) => {
            const groupFolders = group.items.filter((i) => i.type === "folder");
            const groupFiles = group.items.filter((i) => i.type === "file");
            return (
              <section key={group.label} className="space-y-5">
                <div className="border-b pb-1">
                  <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
                </div>
                {groupFolders.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-2">
                    {groupFolders.map((item) => (
                      <FolderCard
                        key={item.data.prefix}
                        name={(item.data as S3Folder).name}
                        path={(item.data as S3Folder).prefix}
                        selected={selectedFolder === (item.data as S3Folder).prefix}
                        onClick={() => handleFolderClick((item.data as S3Folder).prefix)}
                        onDoubleClick={() => handleFolderDoubleClick((item.data as S3Folder).prefix)}
                      />
                    ))}
                  </div>
                )}
                {groupFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {groupFiles.map((item) => {
                      const file = item.data as S3File;
                      return (
                        <FileCard
                          key={file.key}
                          name={file.name}
                          size={file.size}
                          storageClass={file.storageClass}
                          previewUrl={file.previewUrl}
                          selected={selectedFile === file.key}
                          onClick={() => handleFileClick(file.key)}
                          onDoubleClick={() => handleFileDoubleClick(file)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}

      {/* File viewer */}
      {viewingFile && (
        <FileViewer
          file={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}

      {/* Dialogs */}
      {showUpload && (
        <UploadDialog
          folderPath={path}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            setShowUpload(false);
            loadContents();
          }}
        />
      )}
      {showNewFolder && (
        <CreateFolderDialog
          parentPath={path}
          onClose={() => setShowNewFolder(false)}
          onCreated={loadContents}
        />
      )}
    </div>
  );
}
