"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Download, Loader2 } from "lucide-react";

interface DownloadButtonProps {
  folderPath: string;
}

export function DownloadButton({ folderPath }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleDownload() {
    setDownloading(true);
    setProgress({ done: 0, total: 0 });

    try {
      // Get presigned URLs for all files in the folder
      const res = await fetch("/api/archive/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });

      if (!res.ok) {
        throw new Error("Failed to get download URLs");
      }

      const { files } = (await res.json()) as {
        files: { key: string; name: string; url: string }[];
      };

      if (!files || files.length === 0) {
        throw new Error("No files to download");
      }

      setProgress({ done: 0, total: files.length });

      const zip = new JSZip();

      // Fetch each file and add to zip
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const response = await fetch(file.url);
        const blob = await response.blob();

        // Use the relative path within the folder for the zip entry
        // Strip the originals/ prefix and folderPath to get relative name
        const prefix = folderPath
          ? `originals/${folderPath}/`
          : "originals/";
        const relativeName = file.key.startsWith(prefix)
          ? file.key.slice(prefix.length)
          : file.name;

        zip.file(relativeName, blob);
        setProgress({ done: i + 1, total: files.length });
      }

      // Generate the zip and trigger download
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;

      // Name the zip after the folder
      const folderName = folderPath
        ? folderPath.split("/").filter(Boolean).pop() || "download"
        : "archive";
      a.download = `${folderName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
      title="Download folder as ZIP"
    >
      {downloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress.total > 0
            ? `${progress.done}/${progress.total}`
            : "Preparing..."}
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download
        </>
      )}
    </button>
  );
}
