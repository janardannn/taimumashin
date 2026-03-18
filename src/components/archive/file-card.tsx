"use client";

import { Image as ImageIcon, Film, Music, FileText, File as FileIcon } from "lucide-react";
import { formatFileSize, getFileType } from "@/lib/file-utils";

interface FileCardProps {
  name: string;
  size: number;
  storageClass?: string;
  previewUrl?: string | null;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
}

const typeIcons = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  other: FileIcon,
};

export function FileCard({ name, size, previewUrl, selected, onClick, onDoubleClick }: FileCardProps) {
  const fileType = getFileType(name);
  const Icon = typeIcons[fileType];

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      onDoubleClick={onDoubleClick}
      className={`flex flex-col rounded-lg p-2 transition-colors cursor-pointer select-none ${
        selected ? "bg-accent" : "hover:bg-accent/50"
      }`}
    >
      {/* Preview area */}
      <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-muted mb-1.5 overflow-hidden">
        {previewUrl && fileType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon className="h-7 w-7 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <p className="text-xs font-medium truncate" title={name}>
        {name}
      </p>
      <span className="text-[11px] text-muted-foreground">{formatFileSize(size)}</span>
    </div>
  );
}
