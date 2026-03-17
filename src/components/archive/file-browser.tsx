"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Upload, RefreshCw, Zap } from "lucide-react";
import { FolderCard } from "./folder-card";
import { FileCard } from "./file-card";
import { FileViewer } from "./file-viewer";
import { UploadDialog } from "./upload-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { FolderStatusBar } from "./folder-status-bar";
import { useS3 } from "@/hooks/use-s3";

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
  previewUrl?: string | null;
  previewKey?: string | null;
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

  bucketOrder.sort((a, b) => {
    const aMax = Math.max(...(bucketMap.get(a)?.map((i) => i.date) || [0]));
    const bMax = Math.max(...(bucketMap.get(b)?.map((i) => i.date) || [0]));
    return bMax - aMax;
  });

  return bucketOrder.map((label) => {
    const group = bucketMap.get(label)!;
    const groupFolders = group.filter((i) => i.type === "folder").sort((a, b) => b.date - a.date);
    const groupFiles = group.filter((i) => i.type === "file").sort((a, b) => b.date - a.date);
    return { label, items: [...groupFolders, ...groupFiles] };
  });
}

export function FileBrowser({ path }: FileBrowserProps) {
  const router = useRouter();
  const s3 = useS3();
  const [folders, setFolders] = useState<S3Folder[]>([]);
  const [files, setFiles] = useState<S3File[]>([]);
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0, archivedCount: 0, availableCount: 0 });
  const [restoreStatus, setRestoreStatus] = useState<{ status: string; requestedAt: string; fileCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [error, setError] = useState("");

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<S3File | null>(null);

  const decodedPath = decodeURIComponent(path);
  const isInstantPath = decodedPath === "instant" || decodedPath.startsWith("instant/");

  // Load folder contents from DB
  const loadContents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/archive/browse?path=${encodeURIComponent(decodedPath)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load contents");
      }
      const data = await res.json();

      const folderResults: S3Folder[] = data.folders.map((f: { name: string; path: string; createdAt: string }) => ({
        name: f.name,
        prefix: isInstantPath ? `instant/${f.path.replace(/^instant\/?/, "")}/` : `originals/${f.path}/`,
        lastModified: f.createdAt,
      }));

      const fileResults: S3File[] = data.files.map((f: { name: string; s3Key: string; previewKey: string | null; size: number; type: string; originalDate: string | null; createdAt: string }) => ({
        name: f.name,
        key: f.s3Key,
        size: f.size,
        lastModified: f.originalDate || f.createdAt,
        storageClass: isInstantPath ? "STANDARD" : "DEEP_ARCHIVE",
        previewUrl: null,
        previewKey: f.previewKey,
      }));

      setFolders(folderResults);
      setFiles(fileResults);
      setStats(data.stats);
      setRestoreStatus(data.restoreStatus);
    } catch (err) {
      console.error("Failed to load contents:", err);
      setError("Failed to load files. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [decodedPath, isInstantPath]);

  // Load contents on path change
  useEffect(() => {
    loadContents();
  }, [loadContents]);

  // Lazy-load preview URLs via S3 presigned URLs
  const previewLoadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!s3.ready || files.length === 0) return;

    let cancelled = false;

    async function loadPreviews() {
      for (const file of files) {
        if (cancelled) break;
        if (previewLoadedRef.current.has(file.key)) continue;

        const keyToPresign = isInstantPath ? file.key : file.previewKey;
        if (!keyToPresign) continue;

        previewLoadedRef.current.add(file.key);

        try {
          const url = await s3.getPresignedUrl(keyToPresign);
          if (!cancelled) {
            setFiles((prev) =>
              prev.map((f) => (f.key === file.key ? { ...f, previewUrl: url } : f))
            );
          }
        } catch {
          // no preview available
        }
      }
    }

    loadPreviews();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when s3 ready or files change
  }, [s3.ready, files.length, isInstantPath]);

  // Reset preview cache when path changes
  useEffect(() => {
    previewLoadedRef.current.clear();
  }, [decodedPath]);

  const dateGroups = useMemo(() => groupByDate(folders, files), [folders, files]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedFolder(null);
    setSelectedFile(null);
  }, []);

  const handleFolderClick = useCallback((prefix: string) => {
    setSelectedFolder(prefix);
    setSelectedFile(null);
  }, []);

  const handleFolderDoubleClick = useCallback((prefix: string) => {
    const urlPath = prefix.replace(/^(originals|instant)\//, "").replace(/\/$/, "");
    if (prefix.startsWith("instant/")) {
      router.push(`/instant/${urlPath}`);
    } else {
      router.push(`/${urlPath}`);
    }
  }, [router]);

  const handleFileClick = useCallback((key: string) => {
    setSelectedFile(key);
    setSelectedFolder(null);
  }, []);

  const handleFileDoubleClick = useCallback((file: S3File) => {
    setViewingFile(file);
  }, []);

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

      {(error || s3.error) && (
        <div className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          {error || s3.error}
        </div>
      )}

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
          {!path && (
            <button
              onClick={() => router.push("/instant")}
              className="flex w-full items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left transition-colors hover:bg-amber-500/20"
            >
              <Zap className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Instant</p>
                <p className="text-xs text-muted-foreground">Always available — no archiving, no restore wait</p>
              </div>
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()}>
            <FolderStatusBar
              folderPath={decodedPath}
              stats={stats}
              restoreStatus={isInstantPath ? null : restoreStatus}
              selection={selection}
              onRestoreComplete={loadContents}
              onDeleteComplete={handleDeleteComplete}
              isInstant={isInstantPath}
            />
          </div>

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

      {viewingFile && (
        <FileViewer
          file={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}

      {showUpload && (
        <UploadDialog
          folderPath={decodedPath}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            setShowUpload(false);
            loadContents();
          }}
        />
      )}
      {showNewFolder && (
        <CreateFolderDialog
          parentPath={decodedPath}
          onClose={() => setShowNewFolder(false)}
          onCreated={loadContents}
        />
      )}
    </div>
  );
}
