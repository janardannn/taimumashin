import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default async function ChangelogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session.user} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1">
        <h1 className="text-xl font-bold mb-6">Changelog</h1>

        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-base font-semibold">v0.1.0</h2>
              <span className="text-xs text-muted-foreground">March 2026</span>
            </div>
            <p className="text-sm text-muted-foreground">Initial release.</p>
            <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
              <li>BYOA setup via CloudFormation (S3, IAM Role, OIDC, SNS)</li>
              <li>Client-side S3 operations via STS AssumeRoleWithWebIdentity</li>
              <li>File browser with date grouping, folder navigation, and selection</li>
              <li>Upload with metadata tracking and preview generation</li>
              <li>Glacier Flexible Retrieval with tiered restore (Expedited/Standard/Bulk)</li>
              <li>Global search across files and folders</li>
              <li>Dashboard with storage stats and cost breakdown</li>
              <li>Light/dark mode with film grain texture</li>
              <li>GitHub OAuth via NextAuth.js</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
