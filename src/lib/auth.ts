import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google, GitHub],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // Lazily import to avoid edge runtime issues
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
          // Upsert the account link
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
    },
    async jwt({ token, user, trigger }) {
      if (user || trigger === "update") {
        const { getPrisma } = await import("@/lib/db");
        const prisma = await getPrisma();
        const dbUser = await prisma.user.findUnique({
          where: { email: (user?.email || token.email) as string },
          select: { id: true, bucketName: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.onboarded = !!dbUser.bucketName;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as Record<string, unknown>).onboarded = token.onboarded as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
