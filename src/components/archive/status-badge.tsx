"use client";

import { cn } from "@/lib/utils";

type FileStatus = "ice" | "thawing" | "melted";

interface StatusBadgeProps {
  status: FileStatus;
  expiresAt?: string;
  className?: string;
}

export function StatusBadge({ status, expiresAt, className }: StatusBadgeProps) {
  const config = {
    ice: {
      icon: "\u2744\uFE0F",
      label: "Archived",
      className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    thawing: {
      icon: "\u26CF\uFE0F",
      label: "Restoring",
      className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    },
    melted: {
      icon: "\u2600\uFE0F",
      label: "Available",
      className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    },
  };

  const { icon, label, className: badgeClass } = config[status];

  const timeLeft = expiresAt ? getTimeLeft(expiresAt) : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        badgeClass,
        className
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {timeLeft && <span className="opacity-70">({timeLeft})</span>}
    </span>
  );
}

function getTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export function getFileStatus(storageClass?: string, restoreStatus?: string): FileStatus {
  if (restoreStatus?.includes('ongoing-request="true"')) return "thawing";
  if (restoreStatus?.includes('ongoing-request="false"')) return "melted";
  if (storageClass === "DEEP_ARCHIVE" || storageClass === "GLACIER") return "ice";
  return "melted"; // S3 Standard
}
