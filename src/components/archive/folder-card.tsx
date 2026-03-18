"use client";

import { Folder, Pin, Zap } from "lucide-react";

interface FolderCardProps {
  name: string;
  path: string;
  selected?: boolean;
  pinned?: boolean;
  variant?: "default" | "instant";
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
}

export function FolderCard({ name, selected, pinned, variant = "default", onClick, onDoubleClick }: FolderCardProps) {
  const isInstant = variant === "instant";

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      onDoubleClick={onDoubleClick}
      className={`group relative inline-flex items-center rounded-md transition-colors cursor-pointer select-none ${
        isInstant
          ? `gap-2 px-4 py-2.5 ${selected ? "bg-emerald-500/20" : "bg-emerald-500/10 hover:bg-emerald-500/15"}`
          : `gap-2 px-3.5 py-2 ${selected ? "bg-blue-500/20" : "bg-blue-500/8 hover:bg-blue-500/15"}`
      }`}
    >
      {pinned && (
        <Pin className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-muted-foreground rotate-45" />
      )}
      <Folder className={`shrink-0 ${isInstant ? "h-5 w-5 text-emerald-400" : "h-4.5 w-4.5 text-blue-400"}`} />
      {isInstant && (
        <Zap className="h-3 w-3 -ml-1.5 text-amber-400 shrink-0" />
      )}
      <span className={`font-medium ${isInstant ? "text-sm" : "text-xs"}`}>{decodeURIComponent(name)}</span>
    </div>
  );
}
