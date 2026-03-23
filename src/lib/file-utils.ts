export function formatFileSize(bytes: number | bigint): string {
  const b = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileType(name: string): "image" | "video" | "audio" | "document" | "other" {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "svg"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp"].includes(ext)) return "video";
  if (["mp3", "wav", "aac", "flac", "ogg", "m4a"].includes(ext)) return "audio";
  if (["pdf", "doc", "docx", "txt", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "document";
  return "other";
}

export function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

/** Strip non-ASCII and problematic characters from a filename (no slashes). */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "_").replace(/_{2,}/g, "_");
}

/** Sanitize each segment of a path (preserves `/` separators). */
export function sanitizePath(path: string): string {
  return path.split("/").map(sanitizeFilename).join("/");
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getPreviewKey(originalKey: string): string {
  return originalKey.replace(/^originals\//, "previews/");
}

export function getOriginalKey(previewKey: string): string {
  return previewKey.replace(/^previews\//, "originals/");
}
