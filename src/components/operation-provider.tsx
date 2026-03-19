"use client";

import { createContext, useContext, useCallback, useState, useEffect, useRef } from "react";
import { Upload, Trash2, Download, ChevronDown, ChevronUp, X, Check, AlertCircle } from "lucide-react";
import { useS3 } from "@/hooks/use-s3";
import { getFileType } from "@/lib/file-utils";
import { canGenerateThumbnail, generateImageThumbnail } from "@/lib/preview-generator";

// --- Types ---

type OperationStatus = "running" | "done" | "error";

interface OperationItem {
  label: string;
  progress: number;
  status: "pending" | "running" | "done" | "error";
  error?: string;
}

interface Operation {
  id: string;
  type: "upload" | "delete" | "download";
  label: string;
  items: OperationItem[];
  status: OperationStatus;
  startedAt: number;
}

export interface UploadFileInput {
  file: File;
  relativePath: string;
}

export interface DeleteSelection {
  type: "file" | "folder";
  name: string;
  key: string;
}

export type DownloadSelection = DeleteSelection;

interface OperationContextValue {
  startUpload: (files: UploadFileInput[], folderPath: string) => void;
  startDelete: (selections: DeleteSelection[]) => void;
  startDownload: (selections: DownloadSelection[]) => void;
  registerRefresh: (cb: () => void) => void;
  unregisterRefresh: (cb: () => void) => void;
}

const OperationContext = createContext<OperationContextValue | null>(null);

export function useOperations() {
  const ctx = useContext(OperationContext);
  if (!ctx) throw new Error("useOperations must be used within OperationProvider");
  return ctx;
}

export function useOperationRefresh(callback: () => void) {
  const ctx = useContext(OperationContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.registerRefresh(callback);
    return () => ctx.unregisterRefresh(callback);
  }, [ctx, callback]);
}

// --- Provider ---

export function OperationProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const refreshCallbacks = useRef(new Set<() => void>());
  const s3 = useS3({ lazy: true });

  // Stable ref so async loops always see latest s3
  const s3Ref = useRef(s3);
  s3Ref.current = s3;

  const notifyRefresh = useCallback(() => {
    refreshCallbacks.current.forEach((cb) => cb());
  }, []);

  const registerRefresh = useCallback((cb: () => void) => {
    refreshCallbacks.current.add(cb);
  }, []);

  const unregisterRefresh = useCallback((cb: () => void) => {
    refreshCallbacks.current.delete(cb);
  }, []);

  // Helper: update a specific operation
  const updateOp = useCallback((id: string, updater: (op: Operation) => Operation) => {
    setOperations((prev) => prev.map((op) => (op.id === id ? updater(op) : op)));
  }, []);

  // --- Upload ---

  const startUpload = useCallback(
    (files: UploadFileInput[], folderPath: string) => {
      const opId = crypto.randomUUID();
      const items: OperationItem[] = files.map((f) => ({
        label: f.relativePath,
        progress: 0,
        status: "pending",
      }));

      const op: Operation = {
        id: opId,
        type: "upload",
        label: `Uploading ${files.length} file${files.length > 1 ? "s" : ""}`,
        items,
        status: "running",
        startedAt: Date.now(),
      };

      setOperations((prev) => [...prev, op]);
      setCollapsed(false);

      // Run async upload loop
      (async () => {
        const s3 = s3Ref.current;
        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
          const { file, relativePath } = files[i];

          updateOp(opId, (op) => ({
            ...op,
            items: op.items.map((item, j) => (j === i ? { ...item, status: "running" } : item)),
          }));

          try {
            const contentType = file.type || "application/octet-stream";
            const decodedFolder = folderPath ? decodeURIComponent(folderPath) : "";
            const isInstant = decodedFolder === "instant" || decodedFolder.startsWith("instant/");
            const prefix = isInstant ? "instant" : "originals";
            const subPath = isInstant ? decodedFolder.replace(/^instant\/?/, "") : decodedFolder;
            const key = `${prefix}/${subPath ? subPath + "/" : ""}${relativePath}`;

            const metadata: Record<string, string> = {};
            if (file.lastModified) {
              metadata["original-last-modified"] = new Date(file.lastModified).toISOString();
            }

            const url = await s3.getPresignedPutUrl(
              key,
              contentType,
              Object.keys(metadata).length > 0 ? metadata : undefined
            );

            let previewPutUrl: string | null = null;
            if (!isInstant && getFileType(relativePath) === "image") {
              const previewKey = key.replace(/^originals\//, "previews/");
              previewPutUrl = await s3.getPresignedPutUrl(previewKey, "image/webp");
            }

            // XHR for upload progress
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open("PUT", url);
              xhr.setRequestHeader("Content-Type", contentType);

              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const progress = Math.round((e.loaded / e.total) * 100);
                  updateOp(opId, (op) => ({
                    ...op,
                    items: op.items.map((item, j) => (j === i ? { ...item, progress } : item)),
                  }));
                }
              };

              xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
              xhr.onerror = () => reject(new Error("Network error"));
              xhr.send(file);
            });

            // Thumbnail generation (best-effort)
            let previewSize: number | null = null;
            if (previewPutUrl && canGenerateThumbnail(file)) {
              try {
                const thumbnail = await generateImageThumbnail(file);
                await fetch(previewPutUrl, {
                  method: "PUT",
                  headers: { "Content-Type": thumbnail.type },
                  body: thumbnail,
                });
                previewSize = thumbnail.size;
              } catch (err) {
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

            successCount++;
            updateOp(opId, (op) => ({
              ...op,
              items: op.items.map((item, j) => (j === i ? { ...item, status: "done", progress: 100 } : item)),
            }));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Upload failed";
            updateOp(opId, (op) => ({
              ...op,
              items: op.items.map((item, j) => (j === i ? { ...item, status: "error", error: msg } : item)),
            }));
          }
        }

        // Finalize
        const failCount = files.length - successCount;
        const finalStatus: OperationStatus = successCount === 0 ? "error" : failCount > 0 ? "error" : "done";

        updateOp(opId, (op) => ({ ...op, status: finalStatus }));

        if (successCount > 0) {
          notifyRefresh();
        }
      })();
    },
    [updateOp, notifyRefresh]
  );

  // --- Delete ---

  const startDelete = useCallback(
    (selections: DeleteSelection[]) => {
      const opId = crypto.randomUUID();
      const items: OperationItem[] = selections.map((s) => ({
        label: s.name,
        progress: 0,
        status: "pending",
      }));

      const op: Operation = {
        id: opId,
        type: "delete",
        label: `Deleting ${selections.length} item${selections.length > 1 ? "s" : ""}`,
        items,
        status: "running",
        startedAt: Date.now(),
      };

      setOperations((prev) => [...prev, op]);
      setCollapsed(false);

      (async () => {
        const s3 = s3Ref.current;
        let successCount = 0;

        for (let i = 0; i < selections.length; i++) {
          const sel = selections[i];

          updateOp(opId, (op) => ({
            ...op,
            items: op.items.map((item, j) => (j === i ? { ...item, status: "running" } : item)),
          }));

          try {
            if (sel.type === "file") {
              await s3.deleteObject(sel.key);
              if (sel.key.startsWith("originals/")) {
                const previewKey = sel.key.replace(/^originals\//, "previews/");
                try { await s3.deleteObject(previewKey); } catch { /* Preview might not exist */ }
              }
              const res = await fetch("/api/archive/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: sel.key }),
              });
              if (!res.ok) throw new Error("Delete tracking failed");
            } else {
              const objects = await s3.listAllObjects(sel.key);
              for (const obj of objects) {
                await s3.deleteObject(obj.Key);
                if (obj.Key.startsWith("originals/")) {
                  const previewKey = obj.Key.replace(/^originals\//, "previews/");
                  try { await s3.deleteObject(previewKey); } catch { /* Preview might not exist */ }
                }
              }
              const res = await fetch("/api/archive/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prefix: sel.key }),
              });
              if (!res.ok) throw new Error("Delete tracking failed");
            }

            successCount++;
            updateOp(opId, (op) => ({
              ...op,
              items: op.items.map((item, j) => (j === i ? { ...item, status: "done", progress: 100 } : item)),
            }));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Delete failed";
            updateOp(opId, (op) => ({
              ...op,
              items: op.items.map((item, j) => (j === i ? { ...item, status: "error", error: msg } : item)),
            }));
          }
        }

        const failCount = selections.length - successCount;
        const finalStatus: OperationStatus = successCount === 0 ? "error" : failCount > 0 ? "error" : "done";

        updateOp(opId, (op) => ({ ...op, status: finalStatus }));

        if (successCount > 0) {
          notifyRefresh();
        }
      })();
    },
    [updateOp, notifyRefresh]
  );

  // --- Download ---
  // Hidden iframes with ResponseContentDisposition: attachment.
  // Each iframe triggers a native browser download. Sequential with delay
  // so the browser registers each download before the next one starts.

  const startDownload = useCallback(
    (selections: DownloadSelection[]) => {
      const opId = crypto.randomUUID();
      setCollapsed(false);

      (async () => {
        const s3 = s3Ref.current;

        // Resolve folder selections into individual files
        const files: { name: string; key: string }[] = [];
        for (const sel of selections) {
          if (sel.type === "file") {
            files.push({ name: sel.name, key: sel.key });
          } else {
            const objects = await s3.listAllObjects(sel.key);
            for (const obj of objects) {
              files.push({ name: obj.Key.split("/").pop()!, key: obj.Key });
            }
          }
        }

        if (files.length === 0) return;

        const items: OperationItem[] = files.map((f) => ({
          label: f.name,
          progress: 0,
          status: "pending",
        }));

        const op: Operation = {
          id: opId,
          type: "download",
          label: `Downloading ${files.length} file${files.length > 1 ? "s" : ""}`,
          items,
          status: "running",
          startedAt: Date.now(),
        };

        setOperations((prev) => [...prev, op]);

        // Presign all URLs upfront
        const urls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          updateOp(opId, (op) => ({
            ...op,
            items: op.items.map((item, j) => (j === i ? { ...item, status: "running" } : item)),
          }));
          try {
            urls.push(await s3.getPresignedUrl(files[i].key, 3600, files[i].name));
          } catch (err) {
            urls.push("");
            const msg = err instanceof Error ? err.message : "Presign failed";
            updateOp(opId, (op) => ({
              ...op,
              items: op.items.map((item, j) => (j === i ? { ...item, status: "error", error: msg } : item)),
            }));
          }
        }

        // Create all iframes in a burst with minimal delay between for UX
        let successCount = 0;

        for (let i = 0; i < urls.length; i++) {
          if (!urls[i]) continue;

          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          document.body.appendChild(iframe);
          iframe.src = urls[i];
          setTimeout(() => iframe.remove(), 60000);

          successCount++;
          updateOp(opId, (op) => ({
            ...op,
            items: op.items.map((item, j) => (j === i ? { ...item, status: "done", progress: 100 } : item)),
          }));

          // Small delay between iframes for browser + widget breathing room
          if (i < urls.length - 1) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        const failCount = files.length - successCount;
        const finalStatus: OperationStatus = successCount === 0 ? "error" : failCount > 0 ? "error" : "done";
        updateOp(opId, (op) => ({ ...op, status: finalStatus }));
      })();
    },
    [updateOp]
  );

  const dismissCompleted = useCallback(() => {
    setOperations((prev) => prev.filter((op) => op.status === "running"));
  }, []);

  const hasOperations = operations.length > 0;
  const allDone = hasOperations && operations.every((op) => op.status !== "running");
  return (
    <OperationContext.Provider value={{ startUpload, startDelete, startDownload, registerRefresh, unregisterRefresh }}>
      {children}
      {hasOperations && (
        <OperationWidget
          operations={operations}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onDismiss={dismissCompleted}
          allDone={allDone}
        />
      )}
    </OperationContext.Provider>
  );
}

// --- Widget UI ---

function OperationWidget({
  operations,
  collapsed,
  onToggleCollapse,
  onDismiss,
  allDone,
}: {
  operations: Operation[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDismiss: () => void;
  allDone: boolean;
}) {
  const totalItems = operations.reduce((sum, op) => sum + op.items.length, 0);
  const doneItems = operations.reduce(
    (sum, op) => sum + op.items.filter((i) => i.status === "done").length,
    0
  );
  const errorItems = operations.reduce(
    (sum, op) => sum + op.items.filter((i) => i.status === "error").length,
    0
  );

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-96 rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-accent/50 transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="flex-1 min-w-0">
          {allDone ? (
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/15">
                <Check className="h-3 w-3 text-green-500" />
              </div>
              <span className="text-sm font-medium">
                {errorItems > 0
                  ? `${doneItems} complete, ${errorItems} failed`
                  : `All ${doneItems} complete`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <div>
                <span className="text-sm font-medium">
                  {doneItems}/{totalItems} complete
                </span>
                {errorItems > 0 && <span className="text-sm text-destructive ml-1">({errorItems} failed)</span>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {allDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground cursor-pointer transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {collapsed ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Item list */}
      {!collapsed && (
        <div className="max-h-72 overflow-y-scroll border-t border-border [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20">
          {operations.map((op) => (
            <div key={op.id}>
              {/* Operation header */}
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b border-border/50">
                {op.type === "upload" && <Upload className="h-3.5 w-3.5 text-muted-foreground" />}
                {op.type === "delete" && <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />}
                {op.type === "download" && <Download className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-xs font-medium text-muted-foreground">{op.label}</span>
              </div>
              {/* Items */}
              {op.items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2 ${
                    item.status === "error" ? "bg-red-500/5" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`truncate text-xs ${
                      item.status === "error" ? "text-destructive" : item.status === "pending" ? "text-muted-foreground" : ""
                    }`}>{item.label}</p>
                  </div>
                  <div className="shrink-0">
                    {item.status === "pending" && (
                      <span className="text-[11px] text-muted-foreground/60">Pending</span>
                    )}
                    {item.status === "running" && op.type === "upload" && (
                      <div className="flex items-center gap-2 w-20">
                        <div className="flex-1 h-1.5 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">{item.progress}%</span>
                      </div>
                    )}
                    {item.status === "running" && (op.type === "delete" || op.type === "download") && (
                      <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    )}
                    {item.status === "done" && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {item.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
