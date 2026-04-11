"use client";

import { useEffect, useCallback, useState } from "react";
import { X, Download, FileText, File as FileIcon, Image as ImageIcon, Film, Music } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatFileSize, getFileType, getFileExtension, formatDate } from "@/lib/file-utils";
import { useS3 } from "@/hooks/use-s3";

interface FileViewerProps {
  file: {
    name: string;
    key: string;
    size: number;
    lastModified?: string | null;
    storageClass?: string;
    previewUrl?: string | null;
  };
  onClose: () => void;
}

type ViewSource = "original" | "preview" | null;

export function FileViewer({ file, onClose }: FileViewerProps) {
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [source, setSource] = useState<ViewSource>(null);
  const [actualStorageClass, setActualStorageClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const s3 = useS3();

  useEffect(() => {
    if (!s3.ready) return;

    let cancelled = false;

    async function resolve() {
      setLoading(true);
      try {
        // instant/ files are always directly accessible
        if (file.key.startsWith("instant/")) {
          const url = await s3.getPresignedUrl(file.key);
          if (!cancelled) {
            setViewUrl(url);
            setSource("original");
            setActualStorageClass("STANDARD");
            setLoading(false);
          }
          return;
        }

        // Probe the original with a 1-byte ranged GET.
        // If S3 returns 200/206 the file is accessible (Standard or restored Glacier).
        // If 403 the file is in Glacier and not restored.
        const url = await s3.getPresignedUrl(file.key);
        let accessible = false;
        try {
          const probe = await fetch(url, { headers: { Range: "bytes=0-0" } });
          accessible = probe.status === 200 || probe.status === 206;
        } catch {
          // Network/CORS error — assume inaccessible
        }

        if (accessible) {
          if (!cancelled) {
            setViewUrl(url);
            setSource("original");
            setActualStorageClass("STANDARD");
            setLoading(false);
          }
          return;
        }

        // File is in Glacier — try the preview copy
        if (!cancelled) setActualStorageClass("GLACIER");
        const previewKey = file.key.replace(/^originals\//, "previews/");
        try {
          const previewUrl = await s3.getPresignedUrl(previewKey);
          const previewProbe = await fetch(previewUrl, { headers: { Range: "bytes=0-0" } });
          if (previewProbe.status === 200 || previewProbe.status === 206) {
            if (!cancelled) {
              setViewUrl(previewUrl);
              setSource("preview");
              setLoading(false);
            }
            return;
          }
        } catch {
          // No preview available
        }

        if (!cancelled) {
          setViewUrl(null);
          setSource(null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          if (file.previewUrl) {
            setViewUrl(file.previewUrl);
            setSource("preview");
          }
          setLoading(false);
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [file.key, file.previewUrl, s3.ready, s3.headObject, s3.getPresignedUrl]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const fileType = getFileType(file.name);
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  const isMd = ext === "md";
  const isText = ["txt", "csv", "json", "log", "xml", "html", "css", "js", "ts", "py", "sh", "yaml", "yml", "toml", "ini", "env", "gitignore"].includes(ext);
  const isPdf = ext === "pdf";
  const isViewable = ["image", "video", "audio"].includes(fileType) || isText || isMd || isPdf;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--panel-border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
                {file.lastModified && ` · ${formatDate(file.lastModified)}`}
                {actualStorageClass && ` · ${humanStorageClass(actualStorageClass)}`}
              </p>
              {!loading && (
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  source === "original"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : source === "preview"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}>
                  {source === "original" ? "Original" : source === "preview" ? "Preview" : "Archived"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {viewUrl && source === "original" && (
              <a
                href={viewUrl}
                download={file.name}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 text-xs hover:bg-[var(--glass-hover)] active:scale-[0.97] cursor-pointer transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/30 hover:text-foreground cursor-pointer transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : !viewUrl && !isViewable ? (
            <FileDetailsView file={file} />
          ) : viewUrl && fileType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewUrl}
              alt={file.name}
              className="mx-auto max-h-[70vh] rounded-md object-contain"
            />
          ) : viewUrl && fileType === "video" ? (
            <video
              src={viewUrl}
              controls
              className="mx-auto max-h-[70vh] rounded-md"
            />
          ) : viewUrl && fileType === "audio" ? (
            <div className="flex flex-col items-center justify-center gap-6 py-16">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted/80">
                <Music className="h-10 w-10 text-muted-foreground/60" />
              </div>
              <audio src={viewUrl} controls className="w-full max-w-md" />
            </div>
          ) : viewUrl && isPdf ? (
            <iframe
              src={viewUrl}
              title={file.name}
              className="mx-auto h-[70vh] w-full rounded-md"
            />
          ) : viewUrl && isMd ? (
            <MarkdownViewer url={viewUrl} />
          ) : viewUrl && isText ? (
            <TextViewer url={viewUrl} />
          ) : (
            <FileDetailsView file={file} />
          )}
        </div>
      </div>
    </div>
  );
}

function TextViewer({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.text();
      })
      .then(setContent)
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          Could not load file content.
        </div>
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
      {content}
    </pre>
  );
}

function MarkdownViewer({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.text();
      })
      .then(setContent)
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
          Could not load file content.
        </div>
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none max-h-[70vh] overflow-auto rounded-md bg-muted/50 p-6">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

const typeDetailIcons = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  other: FileIcon,
};

function FileDetailsView({ file }: { file: FileViewerProps["file"] }) {
  const fileType = getFileType(file.name);
  const ext = getFileExtension(file.name);
  const Icon = typeDetailIcons[fileType];
  const isArchived = file.storageClass === "GLACIER" || file.storageClass === "DEEP_ARCHIVE";

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      {/* Extension badge + icon */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted/80">
          <Icon className="h-10 w-10 text-muted-foreground/60" />
        </div>
        {ext && (
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-md bg-foreground/10 px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wide text-muted-foreground">
            .{ext}
          </span>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
        <div>
          <p className="text-muted-foreground/60">Size</p>
          <p className="font-medium">{formatFileSize(file.size)}</p>
        </div>
        <div>
          <p className="text-muted-foreground/60">Type</p>
          <p className="font-medium capitalize">{fileType === "other" ? (ext || "Unknown") : fileType}</p>
        </div>
        {file.lastModified && (
          <div>
            <p className="text-muted-foreground/60">Modified</p>
            <p className="font-medium">{formatDate(file.lastModified)}</p>
          </div>
        )}
        {file.storageClass && (
          <div>
            <p className="text-muted-foreground/60">Storage</p>
            <p className="font-medium">{humanStorageClass(file.storageClass)}</p>
          </div>
        )}
      </div>

      {/* Archive hint */}
      {isArchived && (
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          This file is in {file.storageClass === "DEEP_ARCHIVE" ? "Glacier Deep Archive" : "Glacier"}. Restore the folder to download it.
        </p>
      )}
    </div>
  );
}

function humanStorageClass(sc: string): string {
  switch (sc) {
    case "GLACIER": return "Glacier Flexible";
    case "DEEP_ARCHIVE": return "Glacier Deep Archive";
    case "STANDARD": return "Standard";
    case "STANDARD_IA": return "Standard-IA";
    case "INTELLIGENT_TIERING": return "Intelligent-Tiering";
    default: return sc;
  }
}
