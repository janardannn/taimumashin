"use client";

import { useState, useCallback } from "react";
import { Upload, FolderUp, X } from "lucide-react";
import { formatFileSize, getFileType } from "@/lib/file-utils";
import { canGenerateThumbnail, generateImageThumbnail } from "@/lib/preview-generator";
import { useS3 } from "@/hooks/use-s3";

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

  const processFileList = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    setFiles(
      arr.map((file) => ({
        file,
        // webkitRelativePath preserves folder structure (e.g. "trip-2022/photos/beach.jpg")
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        progress: 0,
        status: "pending",
      }))
    );
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFileList(e.target.files || new FileList());
    },
    [processFileList]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      processFileList(e.dataTransfer.files);
    },
    [processFileList]
  );

  async function uploadFiles() {
    setUploading(true);
    setError("");
    let anySuccess = false;

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
        if (previewUrl && canGenerateThumbnail(file)) {
          try {
            const thumbnail = await generateImageThumbnail(file);
            await fetch(previewUrl, {
              method: "PUT",
              headers: { "Content-Type": thumbnail.type },
              body: thumbnail,
            });
          } catch (err) {
            // Thumbnail upload is best-effort; don't fail the overall upload
            console.warn("Thumbnail generation/upload failed:", err);
          }
        }

        // Track in DB
        await fetch("/api/archive/upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            size: file.size,
            contentType,
            originalDate: file.lastModified ? new Date(file.lastModified).toISOString() : null,
          }),
        });

        anySuccess = true;
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
      onUploadComplete();
    }
  }

  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-background/80 backdrop-blur-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upload</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
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
              <label className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <span className="flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Files
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              <label className="cursor-pointer rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
                <span className="flex items-center gap-1.5">
                  <FolderUp className="h-3.5 w-3.5" />
                  Folder
                </span>
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
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{f.relativePath}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(f.file.size)}</p>
                  </div>
                  <div className="w-20 text-right text-xs shrink-0">
                    {f.status === "pending" && <span className="text-muted-foreground">Pending</span>}
                    {f.status === "uploading" && (
                      <div className="space-y-1">
                        <span>{f.progress}%</span>
                        <div className="h-1 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${f.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {f.status === "done" && <span className="text-green-600">Done</span>}
                    {f.status === "error" && <span className="text-destructive">Failed</span>}
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
                className="flex-1 rounded-md border py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Clear
              </button>
              <button
                onClick={uploadFiles}
                disabled={uploading}
                className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
