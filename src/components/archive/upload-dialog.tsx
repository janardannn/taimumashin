"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FolderUp, X } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";
import { useOperations } from "@/components/operation-provider";

interface UploadDialogProps {
  folderPath: string;
  onClose: () => void;
}

interface StagedFile {
  file: File;
  relativePath: string;
}

export function UploadDialog({ folderPath, onClose }: UploadDialogProps) {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const ops = useOperations();
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Smooth scroll to bottom when new files are appended
  useEffect(() => {
    if (files.length > prevCountRef.current && prevCountRef.current > 0) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
    prevCountRef.current = files.length;
  }, [files.length]);

  const processFileList = useCallback((fileList: FileList | File[], append = false) => {
    const arr = Array.from(fileList);
    const newFiles = arr.map((file) => ({
      file,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
    if (append) {
      setFiles((prev) => [...prev, ...newFiles]);
    } else {
      setFiles(newFiles);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFileList(e.target.files || new FileList());
    },
    [processFileList]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();

      const items = Array.from(e.dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry?.())
        .filter((entry): entry is FileSystemEntry => entry != null);

      if (entries.some((entry) => entry.isDirectory)) {
        const collected: File[] = [];

        async function walkEntry(entry: FileSystemEntry, path: string): Promise<void> {
          if (entry.isFile) {
            const file = await new Promise<File>((resolve) =>
              (entry as FileSystemFileEntry).file(resolve)
            );
            Object.defineProperty(file, "webkitRelativePath", { value: path + file.name });
            collected.push(file);
          } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            const entries = await new Promise<FileSystemEntry[]>((resolve) =>
              reader.readEntries(resolve)
            );
            for (const child of entries) {
              await walkEntry(child, path + entry.name + "/");
            }
          }
        }

        for (const entry of entries) {
          await walkEntry(entry, "");
        }
        processFileList(collected, files.length > 0);
      } else {
        processFileList(e.dataTransfer.files, files.length > 0);
      }
    },
    [processFileList, files.length]
  );

  function handleUpload() {
    ops.startUpload(files, folderPath);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upload</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/30 hover:text-foreground cursor-pointer transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {files.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop files or folders</p>
            <div className="flex gap-2">
              <label className="cursor-pointer inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all">
                <Upload className="h-3.5 w-3.5" />
                Files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
              <label className="cursor-pointer inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground/20 bg-foreground/10 px-2.5 text-xs font-medium text-foreground hover:bg-foreground/15 active:scale-[0.97] transition-all">
                <FolderUp className="h-3.5 w-3.5" />
                Folder
                <input
                  type="file"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  {...({ webkitdirectory: "" } as any)}
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* File list */}
            <div ref={listRef} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} className="max-h-72 space-y-1 overflow-y-scroll rounded-lg border border-border p-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-xs">{f.relativePath}</p>
                    <p className="text-[11px] text-muted-foreground">{formatFileSize(f.file.size)}</p>
                  </div>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted-foreground/15 hover:text-foreground cursor-pointer transition-colors shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFiles([])}
                className="flex-1 rounded-md border py-2 text-sm font-medium hover:bg-accent active:scale-[0.98] cursor-pointer transition-all"
              >
                Clear
              </button>
              <button
                onClick={handleUpload}
                className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.98] cursor-pointer transition-all"
              >
                Upload {files.length} file{files.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
