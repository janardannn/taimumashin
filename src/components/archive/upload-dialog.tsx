"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FolderUp, X } from "lucide-react";
import { formatFileSize, getFileType } from "@/lib/file-utils";
import { canGenerateThumbnail, generateImageThumbnail } from "@/lib/preview-generator";
import { useS3 } from "@/hooks/use-s3";
import { useToast } from "@/components/toast";

interface UploadDialogProps {
  folderPath: string;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  relativePath: string; // preserves folder structure from webkitdirectory
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
}

export function UploadDialog({ folderPath, onClose, onUploadComplete }: UploadDialogProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const s3 = useS3();
  const toast = useToast();
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Smooth scroll to bottom when new files are appended
  useEffect(() => {
    if (files.length > prevCountRef.current && prevCountRef.current > 0) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
    prevCountRef.current = files.length;
  }, [files.length]);

  const processFileList = useCallback((fileList: FileList | File[], append = false) => {
    const arr = Array.from(fileList);
    const newFiles = arr.map((file) => ({
      file,
      // webkitRelativePath preserves folder structure (e.g. "trip-2022/photos/beach.jpg")
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      progress: 0,
      status: "pending" as const,
    }));
    if (append) {
      setFiles((prev) => [...prev, ...newFiles]);
    } else {
      setFiles(newFiles);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFileList(e.target.files || new FileList());
    },
    [processFileList]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();

      // Walk dropped directories recursively via webkitGetAsEntry
      const items = Array.from(e.dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry?.())
        .filter((entry): entry is FileSystemEntry => entry != null);

      if (entries.some((entry) => entry.isDirectory)) {
        const collected: File[] = [];

        async function walkEntry(entry: FileSystemEntry, path: string): Promise<void> {
          if (entry.isFile) {
            const file = await new Promise<File>((resolve) =>
              (entry as FileSystemFileEntry).file(resolve)
            );
            // Attach relative path so processFileList picks it up
            Object.defineProperty(file, "webkitRelativePath", { value: path + file.name });
            collected.push(file);
          } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            const entries = await new Promise<FileSystemEntry[]>((resolve) =>
              reader.readEntries(resolve)
            );
            for (const child of entries) {
              await walkEntry(child, path + entry.name + "/");
            }
          }
        }

        for (const entry of entries) {
          await walkEntry(entry, "");
        }
        processFileList(collected, files.length > 0);
      } else {
        processFileList(e.dataTransfer.files, files.length > 0);
      }
    },
    [processFileList, files.length]
  );

  async function uploadFiles() {
    setUploading(true);
    setError("");
    let anySuccess = false;
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const { file, relativePath } = files[i];

      setFiles((prev) =>
        prev.map((f, j) => (j === i ? { ...f, status: "uploading" } : f))
      );

      try {
        const contentType = file.type || "application/octet-stream";

        // Decode to ensure literal characters in S3 keys, not URL-encoded
        const decodedFolder = folderPath ? decodeURIComponent(folderPath) : "";

        // Determine if uploading to instant/ folder
        const isInstant = decodedFolder === "instant" || decodedFolder.startsWith("instant/");
        const prefix = isInstant ? "instant" : "originals";
        const subPath = isInstant ? decodedFolder.replace(/^instant\/?/, "") : decodedFolder;
        const key = `${prefix}/${subPath ? subPath + "/" : ""}${relativePath}`;

        // Preserve original file metadata
        const metadata: Record<string, string> = {};
        if (file.lastModified) {
          metadata["original-last-modified"] = new Date(file.lastModified).toISOString();
        }

        // Get presigned PUT URL from client-side S3
        const url = await s3.getPresignedPutUrl(
          key,
          contentType,
          Object.keys(metadata).length > 0 ? metadata : undefined
        );

        // Get preview presigned URL for non-instant images
        let previewUrl: string | null = null;
        if (!isInstant && getFileType(relativePath) === "image") {
          const previewKey = key.replace(/^originals\//, "previews/");
          previewUrl = await s3.getPresignedPutUrl(previewKey, "image/webp");
        }

        // Upload directly to S3 via presigned PUT
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", contentType);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setFiles((prev) =>
                prev.map((f, j) => (j === i ? { ...f, progress } : f))
              );
            }
          };

          xhr.onload = () => (xhr.status < 400 ? resolve() : reject());
          xhr.onerror = reject;
          xhr.send(file);
        });

        // Generate and upload thumbnail for supported image types
        let previewSize: number | null = null;
        if (previewUrl && canGenerateThumbnail(file)) {
          try {
            const thumbnail = await generateImageThumbnail(file);
            await fetch(previewUrl, {
              method: "PUT",
              headers: { "Content-Type": thumbnail.type },
              body: thumbnail,
            });
            previewSize = thumbnail.size;
          } catch (err) {
            // Thumbnail upload is best-effort; don't fail the overall upload
            console.warn("Thumbnail generation/upload failed:", err);
          }
        }

        // Track in DB
        const confirmRes = await fetch("/api/archive/upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            size: file.size,
            contentType,
            originalDate: file.lastModified ? new Date(file.lastModified).toISOString() : null,
            previewSize,
            hasPreview: previewSize !== null,
          }),
        });
        if (!confirmRes.ok) {
          throw new Error("Failed to save file record");
        }

        anySuccess = true;
        successCount++;
        setFiles((prev) =>
          prev.map((f, j) => (j === i ? { ...f, status: "done", progress: 100 } : f))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setError(msg);
        setFiles((prev) =>
          prev.map((f, j) => (j === i ? { ...f, status: "error" } : f))
        );
      }
    }

    setUploading(false);

    if (anySuccess) {
      const failCount = files.length - successCount;
      if (failCount === 0) {
        toast(
          successCount === 1 ? "Upload complete" : `All ${successCount} files uploaded`,
          "success"
        );
      } else {
        toast(`${successCount} uploaded, ${failCount} failed`, "error");
      }
      onUploadComplete();
      onClose();
    }
  }

  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={!uploading ? onClose : undefined}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upload</h2>
          <button onClick={onClose} disabled={uploading} className="flex h-7 w-7 items-center justify-center rounded-md bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/30 hover:text-foreground cursor-pointer transition-colors disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {files.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop files or folders</p>
            <div className="flex gap-2">
              <label className="cursor-pointer inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all">
                <Upload className="h-3.5 w-3.5" />
                Files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              <label className="cursor-pointer inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground/20 bg-foreground/10 px-2.5 text-xs font-medium text-foreground hover:bg-foreground/15 active:scale-[0.97] transition-all">
                <FolderUp className="h-3.5 w-3.5" />
                Folder
                <input
                  type="file"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {...({ webkitdirectory: "" } as any)}
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{doneCount}/{files.length} complete</span>
                {errorCount > 0 && <span className="text-destructive">({errorCount} failed)</span>}
              </div>
            )}

            {/* File list */}
            <div ref={listRef} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="max-h-72 space-y-1 overflow-y-scroll rounded-lg border border-border p-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20">
              {files.map((f, i) => (
                <div key={i} className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-xs">{f.relativePath}</p>
                    <p className="text-[11px] text-muted-foreground">{formatFileSize(f.file.size)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {f.status === "pending" && (
                      <>
                        <span className="text-xs text-muted-foreground">Pending</span>
                        {!uploading && (
                          <button
                            onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted-foreground/15 hover:text-foreground cursor-pointer transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                    {f.status === "uploading" && (
                      <div className="w-16 space-y-1 text-right">
                        <span className="text-[11px] tabular-nums">{f.progress}%</span>
                        <div className="h-1 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {f.status === "done" && <span className="text-xs text-green-500">Done</span>}
                    {f.status === "error" && <span className="text-xs text-destructive">Failed</span>}
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setFiles([])}
                disabled={uploading}
                className="flex-1 rounded-md border py-2 text-sm font-medium hover:bg-accent active:scale-[0.98] cursor-pointer disabled:opacity-50 transition-all"
              >
                Clear
              </button>
              <button
                onClick={uploadFiles}
                disabled={uploading}
                className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.98] cursor-pointer disabled:opacity-50 transition-all"
              >
                {uploading
                  ? `Uploading ${doneCount}/${files.length}...`
                  : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
