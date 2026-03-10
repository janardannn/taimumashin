"use client";

import Link from "next/link";
import { Folder } from "lucide-react";

interface FolderCardProps {
  name: string;
  path: string;
}

export function FolderCard({ name, path }: FolderCardProps) {
  // Convert S3 prefix to URL path: "originals/2024/trips/" -> "/2024/trips"
  const urlPath = path
    .replace(/^originals\//, "")
    .replace(/\/$/, "");

  return (
    <Link
      href={`/${urlPath}`}
      className="group flex flex-col items-center gap-2 rounded-lg border border-transparent p-4 transition-colors hover:border-border hover:bg-accent"
    >
      <Folder className="h-12 w-12 text-blue-500 transition-transform group-hover:scale-105" />
      <span className="text-sm font-medium text-center truncate w-full">{name}</span>
    </Link>
  );
}
