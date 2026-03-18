import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default async function PrivacyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session.user} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1">
        <h1 className="text-xl font-bold mb-6">Privacy</h1>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">What we store</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your GitHub profile (name, email, avatar URL) for authentication</li>
              <li>Your IAM Role ARN, S3 bucket name, and AWS region for credential exchange</li>
              <li>File metadata: names, sizes, types, folder paths, upload dates</li>
              <li>Folder structure and restore request history</li>
            </ul>
            <p>All of this lives in a Postgres database hosted on Neon.</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">What we never store</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your actual files (they go directly from your browser to your S3 bucket)</li>
              <li>AWS access keys or secrets (credentials are temporary, 1-hour STS tokens)</li>
              <li>File contents, previews, or thumbnails (these live in your S3 bucket)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">How credentials work</h2>
            <p>
              When you log in, we issue a short-lived JWT. Your browser presents this
              JWT to AWS via OIDC (AssumeRoleWithWebIdentity) to get temporary S3
              credentials. These credentials expire after 1 hour and are held only in
              your browser&apos;s memory. The server never has access to your S3 bucket.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Deleting your data</h2>
            <p>
              Delete the CloudFormation stack in your AWS account to revoke all access
              and remove the S3 bucket. Your metadata in our database can be removed
              by signing out and requesting account deletion.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Third parties</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>GitHub (OAuth login)</li>
              <li>AWS (your storage provider, under your account)</li>
              <li>Neon (Postgres hosting for metadata)</li>
              <li>Vercel (app hosting)</li>
            </ul>
            <p>We do not sell, share, or monetize your data in any way.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
