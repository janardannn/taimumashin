import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default async function ChangelogPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session?.user} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1">
        <h1 className="text-xl font-bold mb-6">Changelog</h1>

        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-base font-semibold">v0.3.0</h2>
              <span className="text-xs text-muted-foreground">March 2026</span>
            </div>
            <p className="text-sm text-muted-foreground">Security, downloads, and restore improvements.</p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
              <li>Security headers, JSON content-type enforcement, JWT audience validation, safe URI decoding</li>
              <li>Persistent operation widget tracking uploads, downloads, and deletes with real-time progress</li>
              <li>Download via presigned URLs with iframe-based browser downloads</li>
              <li>Non-ASCII filename sanitization on upload and download</li>
              <li>Glacier file accessibility probe — 1-byte ranged GET determines file availability for correct viewer tags and download button state</li>
              <li>Individual and multi-select Glacier restore with per-selection cost estimates</li>
              <li>Client-side restore completion detection as fallback for Lambda webhook</li>
              <li>Upload metadata now includes user-id and folder-path for restore notifications</li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-base font-semibold">v0.2.0</h2>
              <span className="text-xs text-muted-foreground">March 2026</span>
            </div>
            <p className="text-sm text-muted-foreground">OIDC pivot, DB-first browsing, and UI overhaul.</p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
              <li>Switched to OIDC identity provider with client-side STS AssumeRoleWithWebIdentity</li>
              <li>DB-first file browsing with lazy S3 preview loading</li>
              <li>Switched from Glacier Deep Archive to Glacier Flexible Retrieval</li>
              <li>Global search across files and folders</li>
              <li>Multi-select with Cmd+click and Shift+click for batch operations</li>
              <li>Floating glass navbar with integrated search</li>
              <li>Light/dark mode toggle</li>
              <li>Setup guide, about, pricing, privacy, and changelog pages</li>
              <li>Redesigned file browser, file viewer, and footer components</li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-base font-semibold">v0.1.0</h2>
              <span className="text-xs text-muted-foreground">March 2026</span>
            </div>
            <p className="text-sm text-muted-foreground">Initial release.</p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
              <li>BYOA setup via CloudFormation (S3, IAM Role, Lambda, lifecycle rules)</li>
              <li>Auth with GitHub OAuth via NextAuth.js</li>
              <li>Onboarding flow for AWS connection setup</li>
              <li>Archive file browser with date grouping and folder navigation</li>
              <li>Upload with metadata tracking and client-side image preview generation</li>
              <li>Glacier restore with tiered retrieval (Expedited/Standard/Bulk)</li>
              <li>Dashboard with storage stats and cost breakdown</li>
              <li>Settings page with region pricing calculator</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
