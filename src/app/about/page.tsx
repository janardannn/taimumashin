import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default async function AboutPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={session.user} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1">
        <h1 className="text-xl font-bold mb-2">About taimumashin</h1>
        <p className="text-sm text-muted-foreground mb-8">タイムマシン — &quot;time machine&quot;</p>

        <div className="space-y-10 text-sm text-muted-foreground leading-relaxed">
          {/* What it is */}
          <div className="space-y-3">
            <p className="text-foreground text-base">
              A personal file archival app that puts a clean interface on top of your
              own AWS S3 bucket. You get Glacier cold storage pricing ($3.60/TB/month)
              without ever touching the AWS Console after initial setup.
            </p>
            <p>
              The name comes from the Japanese word for &quot;time machine&quot;. The idea is
              simple: throw your files into the archive, forget about them, and pull
              them back out when you need them. Like a time capsule, but with a search bar.
            </p>
          </div>

          {/* Why it exists */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Why</h2>
            <p>
              Cloud storage is either expensive (Google Drive, iCloud, Dropbox) or
              complex (raw AWS). Glacier Flexible Retrieval is absurdly cheap for
              long-term storage, but the AWS Console is hostile to casual use.
              taimumashin bridges that gap: you get a familiar file browser, folder
              organization, search, and one-click restore, all backed by your own
              AWS account.
            </p>
            <p>
              It&apos;s also a BYOA (Bring Your Own AWS) app. Your files never touch
              our servers. You own the bucket, you own the data, and you can
              disconnect at any time by deleting a single CloudFormation stack.
            </p>
          </div>

          {/* Architecture */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Architecture</h2>
            <p>The app has three layers:</p>

            <div className="space-y-4 pl-1">
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-foreground">Your AWS account (data plane)</h3>
                <p>
                  A CloudFormation template provisions everything: an S3 bucket with
                  lifecycle rules (Standard → Glacier Flexible after N days), an IAM
                  Role scoped to that bucket, an OIDC identity provider that trusts
                  JWTs from this app, and an SNS topic for restore-complete notifications.
                  All file storage and retrieval happens here.
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-foreground">Your browser (client)</h3>
                <p>
                  On login, the browser receives a JWT. It presents this JWT directly
                  to AWS STS (AssumeRoleWithWebIdentity) to get temporary S3 credentials
                  valid for 1 hour. All uploads, downloads, deletes, and restore requests
                  go straight from the browser to S3. The server is never in the data path.
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-foreground">Our server (metadata plane)</h3>
                <p>
                  A Next.js app on Vercel with a Postgres database on Neon. It handles
                  authentication (GitHub OAuth via NextAuth.js), stores file metadata
                  (names, sizes, types, folder paths, upload dates), and serves the
                  dashboard, search, and file browser. It also hosts the OIDC discovery
                  endpoint (/.well-known/openid-configuration) that AWS uses to verify
                  your JWTs.
                </p>
              </div>
            </div>
          </div>

          {/* Storage tiers */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Storage tiers</h2>
            <div className="space-y-4 pl-1">
              <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-foreground">Originals (Glacier Flexible Retrieval)</h3>
                <p>
                  Your uploaded files are stored in S3 Standard initially, then
                  transitioned to Glacier Flexible Retrieval by a lifecycle rule.
                  Glacier is extremely cheap (~$3.60/TB/month) but files aren&apos;t
                  immediately accessible. To download, you issue a restore request
                  which takes 1-5 minutes (Expedited), 3-5 hours (Standard), or
                  5-12 hours (Bulk).
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-foreground">Previews (S3 Standard)</h3>
                <p>
                  When you upload a file, a small preview copy is generated and stored
                  in S3 Standard (always available). This powers the thumbnail grid in
                  the file browser without needing to restore from Glacier. Previews
                  are roughly 8% of the original data size.
                </p>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-foreground">Instant folder (S3 Standard)</h3>
                <p>
                  Files in the &quot;Instant&quot; folder skip the Glacier lifecycle entirely
                  and stay in S3 Standard. Useful for files you need to access
                  frequently. More expensive ($0.023/GB/month) but always available
                  with no restore wait.
                </p>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Security model</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                No long-term AWS credentials are stored anywhere. The IAM Role uses
                OIDC federation, not access keys.
              </li>
              <li>
                STS temporary credentials expire after 1 hour and are held only in
                browser memory.
              </li>
              <li>
                The IAM Role is scoped to a single S3 bucket with a condition that
                the JWT must come from this app&apos;s OIDC issuer and match your user ID.
              </li>
              <li>
                The server never has S3 access. It can&apos;t read, write, or delete
                your files. It only stores metadata.
              </li>
              <li>
                JWTs are signed with RS256 (asymmetric). The private key signs tokens;
                AWS verifies them using the public key from the JWKS endpoint.
              </li>
              <li>
                Deleting the CloudFormation stack instantly revokes all access. The
                OIDC trust, the IAM Role, and the bucket are all removed.
              </li>
            </ul>
          </div>

          {/* Tech stack */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Tech stack</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-1">
              <div>
                <p className="text-xs font-medium text-foreground">Frontend</p>
                <p className="text-xs">Next.js 15 (App Router), React 19, TypeScript</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Styling</p>
                <p className="text-xs">Tailwind CSS v4, Lucide icons</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Auth</p>
                <p className="text-xs">NextAuth.js v5, GitHub OAuth, RS256 JWTs</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Database</p>
                <p className="text-xs">Prisma ORM, Neon Postgres (serverless)</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">AWS</p>
                <p className="text-xs">S3, Glacier Flexible, IAM, STS, SNS, CloudFormation</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Hosting</p>
                <p className="text-xs">Vercel (app), Neon (database)</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">S3 Client</p>
                <p className="text-xs">@aws-sdk/client-s3 + @aws-sdk/client-sts (browser)</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Font</p>
                <p className="text-xs">Sora (sans), Geist Mono (mono)</p>
              </div>
            </div>
          </div>

          {/* Open source */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Open source</h2>
            <p>
              taimumashin is fully open source under the MIT license. You can inspect
              the CloudFormation template, the OIDC flow, every API route, and the
              Prisma schema on{" "}
              <a
                href="https://github.com/janardannn/taimumashin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>.
              Contributions and feedback are welcome.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
