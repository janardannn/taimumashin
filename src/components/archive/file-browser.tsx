"use client";

import { useState, useEffect, useCallback } from "react";
import { FolderPlus, Upload, RefreshCw } from "lucide-react";
import { FolderCard } from "./folder-card";
import { FileCard } from "./file-card";
import { UploadDialog } from "./upload-dialog";
import { CreateFolderDialog } from "./create-folder-dialog";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { DownloadButton } from "./download-button";

interface S3Folder {
  name: string;
  path: string;
}

interface S3File {
  name: string;
  key: string;
  size: number;
  lastModified?: string;
  storageClass?: string;
  previewUrl?: string | null;
}

interface FileBrowserProps {
  path: string; // URL path segments joined, e.g. "2024/trips/goa"
}

export function FileBrowser({ path }: FileBrowserProps) {
  const [folders, setFolders] = useState<S3Folder[]>([]);
  const [files, setFiles] = useState<S3File[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);

  const s3Prefix = path ? `originals/${path}/` : "originals/";

  const hasRestoredFiles = files.some(
    (f) => f.storageClass !== "DEEP_ARCHIVE" && f.storageClass !== "GLACIER"
  );

  const loadContents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/archive/list?prefix=${encodeURIComponent(s3Prefix)}`);
      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err) {
      console.error("Failed to load contents:", err);
    } finally {
      setLoading(false);
    }
  }, [s3Prefix]);

  useEffect(() => {
    loadContents();
  }, [loadContents]);

  async function handleRestore(key: string) {
    try {
      await fetch("/api/archive/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      loadContents();
    } catch (err) {
      console.error("Restore failed:", err);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <BreadcrumbNav path={path} />
        <div className="flex items-center gap-2">
          {hasRestoredFiles && <DownloadButton folderPath={path} />}
          <button
            onClick={loadContents}
            className="inline-flex h-8 items-center justify-center rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <p className="text-muted-foreground">This folder is empty</p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Upload files
          </button>
        </div>
      ) : (
        <>
          {/* Folders */}
          {folders.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {folders.map((folder) => (
                <FolderCard key={folder.path} name={folder.name} path={folder.path} />
              ))}
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {files.map((file) => (
                <FileCard
                  key={file.key}
                  name={file.name}
                  size={file.size}
                  storageClass={file.storageClass}
                  previewUrl={file.previewUrl}
                  onRestore={() => handleRestore(file.key)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      {showUpload && (
        <UploadDialog
          folderPath={path}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            setShowUpload(false);
            loadContents();
          }}
        />
      )}
      {showNewFolder && (
        <CreateFolderDialog
          parentPath={path}
          onClose={() => setShowNewFolder(false)}
          onCreated={loadContents}
        />
      )}
    </div>
  );
}
