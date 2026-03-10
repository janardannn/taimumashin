"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbNavProps {
  path: string; // e.g., "2024/trips/goa"
}

export function BreadcrumbNav({ path }: BreadcrumbNavProps) {
  const parts = path ? path.split("/").filter(Boolean) : [];

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link
        href="/"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      {parts.map((part, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        const isLast = i === parts.length - 1;

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            {isLast ? (
              <span className="font-medium text-foreground">{part}</span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {part}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
