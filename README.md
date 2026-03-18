# taimumashin

タイムマシン — "time machine"

A personal file archival app that puts a clean interface on top of your own AWS bucket. Throw your files into the archive, forget about them, and pull them back out when you need them. Like a time capsule, but on your own AWS account.

## Why

I was hitting 175 GB on my iCloud 200 GB plan with no middle ground between 200 GB and 2 TB. Upgrading to Apple's 2 TB plan would take years to fill since my data grows at maybe 50-60 GB per year. Every other cloud provider has the same rigid tier problem.

So I built a third option. S3 Standard at $0.023/GB adds up fast, but Glacier Flexible Retrieval at ~$3.60/TB/month is absurdly cheap. Expedited tier gets files back in 1-5 minutes when it's urgent, Standard in 3-5 hours when it can wait, and Bulk for free when there's no rush at all.

S3 browsers already exist (Cyberduck, Mountain Duck, S3 Browser, etc.) but none of them handle Glacier restore tiers, preview generation, or cost estimation the way I needed.

## Architecture

Completely BYOA (Bring Your Own AWS). Your files never pass through our servers. Walk away at any time by deleting a single CloudFormation stack.

**Your AWS account (data plane)** — A CloudFormation template provisions an S3 bucket with lifecycle rules, an IAM Role scoped to that bucket, an OIDC identity provider that trusts JWTs from this app, and an SNS topic for restore-complete notifications.

**Your browser (client)** — On login, the browser receives a JWT and presents it directly to AWS STS (AssumeRoleWithWebIdentity) to get temporary S3 credentials valid for 1 hour. All uploads, downloads, deletes, and restore requests go straight from the browser to S3.

**Our server (metadata plane)** — A Next.js app on Vercel with Postgres on Neon. Handles authentication (GitHub/Google OAuth via NextAuth.js), stores file metadata, and serves the dashboard, search, and file browser. Also hosts the OIDC discovery endpoint that AWS uses to verify JWTs.

## Storage tiers

| Tier | Storage | Retrieval | Use case |
|------|---------|-----------|----------|
| **Glacier Flexible** | ~$3.60/TB/month | 1-5 min (Expedited), 3-5 hr (Standard), 5-12 hr (Bulk) | Default for all uploads |
| **Previews (S3 Standard)** | ~$0.023/GB/month | Instant | Compressed thumbnails for images/videos (~8% of original) |
| **Instant folder** | ~$0.023/GB/month | Instant | Files you need frequently, skips Glacier lifecycle |

## Security

- No long-term AWS credentials stored anywhere — OIDC federation, not access keys
- STS temporary credentials expire after 1 hour, held only in browser memory
- IAM Role scoped to a single bucket with JWT issuer + user ID conditions
- Server never has S3 access — can't read, write, or delete your files
- JWTs signed with RS256; AWS verifies via the JWKS endpoint
- Deleting the CloudFormation stack instantly revokes all access

## Tech stack

| | |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, Lucide icons |
| **Auth** | NextAuth.js v5, GitHub/Google OAuth, RS256 JWTs |
| **Database** | Prisma ORM, Neon Postgres (serverless) |
| **AWS** | S3, Glacier Flexible, IAM, STS, SNS, CloudFormation |
| **Hosting** | Vercel (app), Neon (database) |
| **S3 Client** | @aws-sdk/client-s3 + @aws-sdk/client-sts (browser) |

## Getting started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

You'll need to complete the onboarding flow to connect your AWS account (deploy the CloudFormation template, paste your Role ARN and bucket name).

## License

MIT
