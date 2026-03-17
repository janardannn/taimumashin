"use client";

import { Folder, Pin } from "lucide-react";

interface FolderCardProps {
  name: string;
  path: string;
  selected?: boolean;
  pinned?: boolean;
  variant?: "default" | "instant";
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export function FolderCard({ name, selected, pinned, variant = "default", onClick, onDoubleClick }: FolderCardProps) {
  const isInstant = variant === "instant";

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onDoubleClick={onDoubleClick}
      className={`group relative flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer select-none ${
        selected
          ? "border-primary bg-accent"
          : isInstant
            ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
            : "hover:bg-accent/50"
      }`}
    >
      {pinned && (
        <Pin className="absolute -top-1.5 -right-1.5 h-3 w-3 text-muted-foreground rotate-45" />
      )}
      <Folder className={`h-7 w-7 shrink-0 ${isInstant ? "text-emerald-500" : "text-blue-500"}`} />
      <span className="text-sm font-medium truncate">{decodeURIComponent(name)}</span>
    </div>
  );
}
