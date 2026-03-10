"use client";

import { useEffect, useCallback, useState } from "react";
import { X, Download, FileText, File as FileIcon, Snowflake, Sun } from "lucide-react";
import { formatFileSize, getFileType, formatDate } from "@/lib/file-utils";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUrl() {
      setLoading(true);
      try {
        const res = await fetch(`/api/archive/view?key=${encodeURIComponent(file.key)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            setViewUrl(data.url);
            setSource(data.source as ViewSource);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall through to preview
      }

      if (file.previewUrl) {
        setViewUrl(file.previewUrl);
        setSource("preview");
      }
      setLoading(false);
    }

    fetchUrl();
  }, [file.key, file.previewUrl]);

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

  const isViewable = ["image", "video", "audio"].includes(fileType) ||
    ["txt", "csv", "json", "md", "log", "xml", "html", "css", "js", "ts", "py", "sh"].includes(ext);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{file.name}</p>
              {!loading && source && (
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  source === "original"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                }`}>
                  {source === "original" ? (
                    <><Sun className="h-3 w-3" /> Original</>
                  ) : (
                    <><Snowflake className="h-3 w-3" /> Preview</>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
              {file.lastModified && ` — ${formatDate(file.lastModified)}`}
              {file.storageClass === "DEEP_ARCHIVE" && " — Glacier Deep Archive"}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {/* Only show download for originals, not previews */}
            {viewUrl && source === "original" && (
              <a
                href={viewUrl}
                download={file.name}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
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
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <FileIcon className="h-16 w-16 text-muted-foreground" />
              <audio src={viewUrl} controls className="w-full max-w-md" />
            </div>
          ) : viewUrl && isViewable ? (
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

function FileDetailsView({ file }: { file: FileViewerProps["file"] }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <FileText className="h-16 w-16 text-muted-foreground" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
        {file.lastModified && (
          <p className="text-xs text-muted-foreground">Modified {formatDate(file.lastModified)}</p>
        )}
        {file.storageClass && (
          <p className="text-xs text-muted-foreground">Storage: {file.storageClass}</p>
        )}
        {file.storageClass === "DEEP_ARCHIVE" && !file.previewUrl && (
          <p className="text-xs text-muted-foreground mt-2">
            This file is archived in Glacier Deep Archive. Restore the folder to view it.
          </p>
        )}
      </div>
    </div>
  );
}
