"use client";

import { Image as ImageIcon, Film, Music, FileText, File as FileIcon } from "lucide-react";
import { StatusBadge } from "@/components/archive/status-badge";
import { formatFileSize, getFileType } from "@/lib/file-utils";

interface FileCardProps {
  name: string;
  size: number;
  storageClass?: string;
  previewUrl?: string | null;
  onRestore?: () => void;
  onDownload?: () => void;
}

const typeIcons = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  other: FileIcon,
};

export function FileCard({ name, size, storageClass, previewUrl, onRestore, onDownload }: FileCardProps) {
  const fileType = getFileType(name);
  const Icon = typeIcons[fileType];

  // Determine status from storageClass
  const isDeepArchive = storageClass === "DEEP_ARCHIVE" || storageClass === "GLACIER";
  const status = isDeepArchive ? "ice" : "melted";

  return (
    <div className="group flex flex-col rounded-lg border p-3 transition-colors hover:bg-accent/50">
      {/* Preview area */}
      <div className="flex aspect-square items-center justify-center rounded-md bg-muted mb-2 overflow-hidden">
        {previewUrl && (fileType === "image") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium truncate" title={name}>
          {name}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{formatFileSize(size)}</span>
          <StatusBadge status={status as "ice" | "thawing" | "melted"} />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {status === "ice" && onRestore && (
          <button
            onClick={onRestore}
            className="flex-1 rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
          >
            Restore
          </button>
        )}
        {status === "melted" && onDownload && (
          <button
            onClick={onDownload}
            className="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Download
          </button>
        )}
      </div>
    </div>
  );
}
