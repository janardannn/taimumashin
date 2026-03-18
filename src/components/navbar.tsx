"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Search, Settings, User, Folder, FileIcon } from "lucide-react";
import { useSearch } from "@/components/search-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatFileSize } from "@/lib/file-utils";

interface SearchResult {
  files: { id: string; name: string; s3Key: string; folderPath: string; size: number; type: string }[];
  folders: { id: string; name: string; path: string }[];
}

interface NavbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  minimal?: boolean;
}

export function Navbar({ user, minimal }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { query, setQuery } = useSearch();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Clear search on navigation
  useEffect(() => {
    setQuery("");
    setSearchOpen(false);
  }, [pathname, setQuery]);

  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }

    setSearchLoading(true);
    setSearchOpen(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/archive/search?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        // silently fail
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [setQuery]);

  const navigateToResult = useCallback((path: string) => {
    setSearchOpen(false);
    setQuery("");
    router.push(path);
  }, [router, setQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isActive = (path: string) =>
    pathname === path ? "font-medium" : "text-muted-foreground hover:text-foreground";

  return (
    <header className="sticky top-0 z-40 px-4 pt-3">
      <div className="mx-auto flex h-11 max-w-7xl items-center rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] px-3 shadow-xl shadow-[var(--shadow-color)] ring-1 ring-[var(--glass-ring)]">
        <Link href="/" className="group relative mr-auto cursor-pointer overflow-hidden rounded-lg bg-[var(--logo-bg)] px-3 py-1.5 hover:bg-[var(--logo-bg-hover)] transition-colors">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-transparent to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-full animate-[logo-glow_8s_linear_infinite] bg-[conic-gradient(from_0deg,transparent,rgba(16,185,129,0.15),transparent,rgba(59,130,246,0.15),transparent)]" />
          </div>
          <span className="relative text-xs font-bold tracking-tight">taimumashin</span>
          <span className="relative text-[9px] text-muted-foreground ml-1.5">タイムマシン</span>
        </Link>

        <div className="flex items-center gap-3">
          {!minimal && (
            <nav className="flex items-center gap-0.5 text-xs">
              <Link href="/" className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                pathname === "/" ? "text-foreground bg-accent/50" : "text-muted-foreground hover:text-foreground"
              }`}>Home</Link>
              <Link href="/dashboard" className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                pathname === "/dashboard" ? "text-foreground bg-accent/50" : "text-muted-foreground hover:text-foreground"
              }`}>Dashboard</Link>
              <Link href="/settings" className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                pathname === "/settings" ? "text-foreground bg-accent/50" : "text-muted-foreground hover:text-foreground"
              }`}>Settings</Link>
            </nav>
          )}

          {!minimal && (
            <div className="relative hidden sm:block" ref={searchRef}>
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => { if (query.trim().length >= 2) setSearchOpen(true); }}
                placeholder="Search..."
                className="h-7 w-40 rounded-md bg-muted/40 border border-[var(--glass-border)] pl-7 pr-2 text-xs placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-muted/60"
              />

              {searchOpen && (
                <div className="absolute top-full right-0 z-50 mt-1.5 w-72 rounded-lg border bg-background/95 backdrop-blur-xl shadow-lg overflow-hidden">
                  {searchLoading ? (
                    <div className="p-2 space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                          <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0" />
                          <div className="h-3.5 rounded bg-muted animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                        </div>
                      ))}
                    </div>
                  ) : searchResults && (searchResults.folders.length > 0 || searchResults.files.length > 0) ? (
                    <div className="max-h-72 overflow-y-auto">
                      {searchResults.folders.length > 0 && (
                        <div className="p-1">
                          <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Folders</p>
                          {searchResults.folders.map((f) => {
                            const isInstant = f.path.startsWith("instant");
                            const href = isInstant ? `/${f.path}` : `/${f.path.replace(/^originals\/?/, "")}`;
                            return (
                              <button
                                key={f.id}
                                onClick={() => navigateToResult(href)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                              >
                                <Folder className={`h-3.5 w-3.5 shrink-0 ${isInstant ? "text-emerald-400" : "text-blue-400"}`} />
                                <span className="truncate">{f.name}</span>
                                <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[80px]">{f.path}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {searchResults.files.length > 0 && (
                        <div className="p-1">
                          <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Files</p>
                          {searchResults.files.map((f) => {
                            const folderUrl = f.folderPath === "/" ? "/" : `/${f.folderPath}`;
                            return (
                              <button
                                key={f.id}
                                onClick={() => navigateToResult(folderUrl)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                              >
                                <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{f.name}</span>
                                <span className="ml-auto text-[10px] text-muted-foreground">{formatFileSize(f.size)}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
                  )}
                </div>
              )}
            </div>
          )}

          <ThemeToggle />

          {/* Profile dropdown */}
          {user && (
            <div className="relative flex items-center" ref={dropdownRef}>
              <button
                onClick={() => setOpen(!open)}
                className="flex cursor-pointer overflow-hidden rounded-md hover:bg-accent/50 hover:ring-2 hover:ring-accent/50 transition-all"
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={user.name || ""}
                    className="h-7 w-7 rounded-md"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-popover border border-border shadow-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-medium truncate">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent transition-colors text-destructive"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
