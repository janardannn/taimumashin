"use client";

import { Folder } from "lucide-react";

interface FolderCardProps {
  name: string;
  path: string;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export function FolderCard({ name, selected, onClick, onDoubleClick }: FolderCardProps) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onDoubleClick={onDoubleClick}
      className={`group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer select-none ${
        selected ? "border-primary bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <Folder className="h-7 w-7 shrink-0 text-blue-500" />
      <span className="text-sm font-medium truncate">{decodeURIComponent(name)}</span>
    </div>
  );
}
