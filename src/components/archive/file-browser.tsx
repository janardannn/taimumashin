"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, RefreshCw, Pin, PinOff } from "lucide-react";
import { FolderCard } from "./folder-card";
import { FileCard } from "./file-card";
import { FileViewer } from "./file-viewer";
import { UploadDialog } from "./upload-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { FolderStatusBar } from "./folder-status-bar";
import { useS3 } from "@/hooks/use-s3";
import { useSearch } from "@/components/search-context";
import { useOperationRefresh } from "@/components/operation-provider";
import { getFileType } from "@/lib/file-utils";

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
  const [restoreJobs, setRestoreJobs] = useState<{ id: string; status: string; requestedAt: string; fileCount: number; tier: string | null; keys: string[] }[]>([]);
  const [region, setRegion] = useState("us-east-1");
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [error, setError] = useState("");

  const [previewVersion, setPreviewVersion] = useState(0);
  const [headerPinned, setHeaderPinned] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tm-header-pinned") === "true";
  });
  const [selectedItems, setSelectedItems] = useState<Map<string, { type: "file" | "folder"; name: string; size: number }>>(new Map());
  const lastClickedRef = useRef<string | null>(null);
  const [viewingFile, setViewingFile] = useState<S3File | null>(null);
  const { query: searchQuery, setQuery: setSearchQuery } = useSearch();

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
        storageClass: isInstantPath ? "STANDARD" : "GLACIER",
        previewUrl: null,
        previewKey: f.previewKey,
      }));

      previewLoadedRef.current.clear();
      setPreviewVersion((v) => v + 1);
      setFolders(folderResults);
      setFiles(fileResults);
      setStats(data.stats);
      setRestoreJobs(data.restoreJobs || []);
      setRegion(data.region || "us-east-1");
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

  // Per-job probe: check one key from each active restore job to detect completion.
  const probedJobsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const activeJobs = restoreJobs.filter((j) => j.status === "RESTORING" && j.keys.length > 0);
    if (!s3.ready || activeJobs.length === 0) return;

    let cancelled = false;
    let anyResolved = false;

    async function checkJobs() {
      for (const job of activeJobs) {
        if (cancelled || probedJobsRef.current.has(job.id)) continue;

        try {
          const url = await s3.getPresignedUrl(job.keys[0]);
          const probe = await fetch(url, { headers: { Range: "bytes=0-0" } });
          if ((probe.status === 200 || probe.status === 206) && !cancelled) {
            probedJobsRef.current.add(job.id);
            await fetch("/api/archive/restore", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId: job.id }),
            });
            anyResolved = true;
          }
        } catch {
          // Still restoring or network error
        }
      }
      if (anyResolved && !cancelled) loadContents();
    }

    checkJobs();
    return () => { cancelled = true; };
  }, [s3.ready, restoreJobs, s3.getPresignedUrl, loadContents]);

  // Lazy-load preview URLs via S3 presigned URLs
  const previewLoadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!s3.ready || files.length === 0) return;

    let cancelled = false;

    async function loadPreviews() {
      for (const file of files) {
        if (cancelled) break;
        if (previewLoadedRef.current.has(file.key)) continue;

        let keyToPresign: string | null = null;
        if (isInstantPath) {
          keyToPresign = file.key;
        } else if (file.previewKey) {
          keyToPresign = file.previewKey;
        } else if (file.key.startsWith("originals/") && getFileType(file.name) === "image") {
          // Fallback for files uploaded before preview tracking — try the conventional path
          keyToPresign = file.key.replace(/^originals\//, "previews/");
        }
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
  }, [s3.ready, files.length, isInstantPath, previewVersion]);

  // Reset preview cache and search when path changes
  useEffect(() => {
    previewLoadedRef.current.clear();
    setSearchQuery("");
  }, [decodedPath, setSearchQuery]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery) return folders;
    const q = searchQuery.toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const dateGroups = useMemo(() => groupByDate(filteredFolders, filteredFiles), [filteredFolders, filteredFiles]);

  // Flat ordered list of all item keys for shift+click range selection
  const flatItemKeys = useMemo(() => {
    const keys: { key: string; type: "file" | "folder"; name: string; size: number }[] = [];
    if (!path) keys.push({ key: "instant", type: "folder", name: "Instant", size: 0 });
    for (const group of dateGroups) {
      for (const item of group.items) {
        if (item.type === "folder") {
          const f = item.data as S3Folder;
          keys.push({ key: f.prefix, type: "folder", name: f.name, size: 0 });
        } else {
          const f = item.data as S3File;
          keys.push({ key: f.key, type: "file", name: f.name, size: f.size });
        }
      }
    }
    return keys;
  }, [path, dateGroups]);

  const handleSelect = useCallback((key: string, type: "file" | "folder", name: string, size: number, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      // Toggle individual item
      setSelectedItems(prev => {
        const next = new Map(prev);
        if (next.has(key)) next.delete(key);
        else next.set(key, { type, name, size });
        return next;
      });
      lastClickedRef.current = key;
    } else if (e.shiftKey && lastClickedRef.current) {
      // Range select
      const lastIdx = flatItemKeys.findIndex(k => k.key === lastClickedRef.current);
      const currIdx = flatItemKeys.findIndex(k => k.key === key);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        setSelectedItems(prev => {
          const next = new Map(prev);
          for (let i = start; i <= end; i++) {
            next.set(flatItemKeys[i].key, { type: flatItemKeys[i].type, name: flatItemKeys[i].name, size: flatItemKeys[i].size });
          }
          return next;
        });
      }
    } else {
      // Single select
      setSelectedItems(new Map([[key, { type, name, size }]]));
      lastClickedRef.current = key;
    }
  }, [flatItemKeys]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedItems(new Map());
  }, []);

  const handleFolderDoubleClick = useCallback((prefix: string) => {
    const urlPath = prefix.replace(/^(originals|instant)\//, "").replace(/\/$/, "");
    if (prefix.startsWith("instant/")) {
      router.push(`/instant/${urlPath}`);
    } else {
      router.push(`/${urlPath}`);
    }
  }, [router]);

  const handleFileDoubleClick = useCallback((file: S3File) => {
    setViewingFile(file);
  }, []);

  const selections = useMemo(() => {
    return Array.from(selectedItems.entries())
      .filter(([key]) => key !== "instant")
      .map(([key, { type, name, size }]) => ({ type, name, key, size }));
  }, [selectedItems]);

  const handleDeleteComplete = useCallback(() => {
    setSelectedItems(new Map());
  }, []);

  // Auto-refresh when operations (upload/delete) complete
  useOperationRefresh(loadContents);

  return (
    <div className="space-y-4" onClick={handleBackgroundClick}>
      {(error || s3.error) && (
        <div className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          {error || s3.error}
        </div>
      )}

      {/* Breadcrumb + Status bar header */}
      <div className={`rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] overflow-hidden ${headerPinned ? "sticky top-[3.75rem] z-30 mt-1 backdrop-blur-xl" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2">
          <BreadcrumbNav path={path} />
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                const next = !headerPinned;
                setHeaderPinned(next);
                localStorage.setItem("tm-header-pinned", String(next));
              }}
              className={`inline-flex h-6 items-center justify-center rounded px-1.5 transition-colors ${headerPinned ? "text-foreground bg-accent/50" : "text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground"}`}
              title={headerPinned ? "Unpin header" : "Pin header"}
            >
              {headerPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={loadContents}
              className="inline-flex h-6 items-center justify-center rounded px-1.5 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {!loading && (folders.length > 0 || files.length > 0) && (
          <div onClick={(e) => e.stopPropagation()}>
            <FolderStatusBar
              folderPath={decodedPath}
              stats={stats}
              restoreJobs={isInstantPath ? [] : restoreJobs}
              selections={selections}
              onRestoreComplete={loadContents}
              onDeleteComplete={handleDeleteComplete}
              onNewFolder={() => setShowNewFolder(true)}
              onUpload={() => setShowUpload(true)}
              isInstant={isInstantPath}
              region={region}
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 space-y-4 mt-2">
        {loading ? (
          <div className="space-y-4">
            {/* Skeleton folder row */}
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 w-40 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
            {/* Skeleton file grid */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="aspect-[4/3] animate-pulse rounded-md bg-muted" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-muted-foreground">This folder is empty</p>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.98] cursor-pointer transition-all"
            >
              <Upload className="h-4 w-4" />
              Upload files
            </button>
          </div>
        ) : (
          <>
            {!path && (
              <div className="flex flex-wrap gap-1">
                <FolderCard
                  name="Instant"
                  path="instant"
                  variant="instant"
                  pinned
                  selected={selectedItems.has("instant")}
                  onClick={(e) => handleSelect("instant", "folder", "Instant", 0, e)}
                  onDoubleClick={() => router.push("/instant")}
                />
              </div>
            )}

            {dateGroups.map((group) => {
              const groupFolders = group.items.filter((i) => i.type === "folder");
              const groupFiles = group.items.filter((i) => i.type === "file");
              return (
                <section key={group.label} className="space-y-3">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.label}</h3>
                  {groupFolders.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                      {groupFolders.map((item) => {
                        const folder = item.data as S3Folder;
                        return (
                          <FolderCard
                            key={folder.prefix}
                            name={folder.name}
                            path={folder.prefix}
                            selected={selectedItems.has(folder.prefix)}
                            onClick={(e) => handleSelect(folder.prefix, "folder", folder.name, 0, e)}
                            onDoubleClick={() => handleFolderDoubleClick(folder.prefix)}
                          />
                        );
                      })}
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
                            selected={selectedItems.has(file.key)}
                            onClick={(e) => handleSelect(file.key, "file", file.name, file.size, e)}
                            onDoubleClick={() => handleFileDoubleClick(file)}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            {searchQuery && dateGroups.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No results for &ldquo;{searchQuery}&rdquo;
              </p>
            )}
          </>
        )}
      </div>

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
