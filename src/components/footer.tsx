"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Github, Circle } from "lucide-react";


export function Footer() {
  const { data: session } = useSession();
  const [region, setRegion] = useState<string | null>(null);
  const onboarded = (session?.user as unknown as Record<string, unknown>)?.onboarded;

  useEffect(() => {
    if (onboarded) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((d) => setRegion(d.region))
        .catch(() => {});
    }
  }, [onboarded]);

  return (
    <footer className="mt-auto border-t border-[var(--panel-border)]">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: status + version */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Circle
                className={`h-2 w-2 fill-current ${onboarded ? "text-emerald-500" : "text-red-400"}`}
              />
              <span>{onboarded ? "Connected" : "Not connected"}</span>
            </div>
            {region && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span>{region}</span>
              </>
            )}
          </div>

          {/* Center: quick links */}
          <nav className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <Link href="/setup" className="hover:text-foreground transition-colors">Setup Guide</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/changelog" className="hover:text-foreground transition-colors">Changelog</Link>
          </nav>

          {/* Right: copyright + github */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} janardannn</span>
            <a
              href="https://github.com/janardannn/taimumashin"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
