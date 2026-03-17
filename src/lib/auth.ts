import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { SignJWT, jwtVerify } from "jose";
import { getPrivateKey, getPublicKey, ALG, KID } from "@/lib/jwt-keys";

const issuer = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3333";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google, GitHub],
  callbacks: {
    async signIn({ user, account }) {
      try {
        if (!user.email) return false;
        const { getPrisma } = await import("@/lib/db");
        const prisma = await getPrisma();

        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existing) {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              image: user.image,
            },
          });
        }

        if (account) {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (existingUser) {
            await prisma.account.upsert({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              update: {
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
              },
              create: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }
        }

        return true;
      } catch (err) {
        console.error("[auth] signIn callback error:", err);
        return false;
      }
    },
    async jwt({ token, user, trigger }) {
      if (user || trigger === "update") {
        const { getPrisma } = await import("@/lib/db");
        const prisma = await getPrisma();
        const dbUser = await prisma.user.findUnique({
          where: { email: (user?.email || token.email) as string },
          select: { id: true, roleArn: true, bucketName: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.onboarded = !!(dbUser.roleArn && dbUser.bucketName);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).onboarded = token.onboarded as boolean;
      }
      return session;
    },
  },
  jwt: {
    async encode({ token }) {
      if (!token) return "";
      const privateKey = await getPrivateKey();
      return new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: ALG, kid: KID })
        .setIssuer(issuer)
        .setSubject((token.id as string) || (token.sub as string) || "")
        .setAudience("sts.amazonaws.com")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);
    },
    async decode({ token }) {
      if (!token) return null;
      try {
        const publicKey = await getPublicKey();
        const { payload } = await jwtVerify(token, publicKey, {
          issuer,
          algorithms: [ALG],
        });
        return payload;
      } catch (err) {
        console.error("[auth] JWT decode failed:", (err as Error).message);
        return null;
      }
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
