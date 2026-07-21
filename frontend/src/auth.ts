import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  session: { strategy: "jwt" },
  providers: [
    // allowDangerousEmailAccountLinking: when ON, NextAuth auto-links a new
    // OAuth login to an existing user with the same email, instead of throwing
    // OAuthAccountNotLinked. Dangerous in general because a provider that does
    // NOT verify email ownership (some custom OIDC / SSO IdPs) would let an
    // attacker claim any email and take over the matching account. Safe here
    // because every provider we enable (GitHub, Google) verifies email
    // ownership server-side before returning it — neither can be tricked into
    // vouching for an email the user doesn't control. If you ever add a
    // provider that does not strictly verify emails, do NOT set this flag for
    // that provider.
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Cool-off gate: a user who just deleted their account cannot immediately
      // re-create one to reset their daily limits. We look up their identity in
      // the *_to_be_terminated mirrors within the cool-off window. Two checks:
      // (a) the OAuth provider+providerAccountId pair (exact match on the same
      // third-party identity), and (b) the email — catches cross-provider
      // recreate attempts (delete via GitHub, re-create via Google, same email).
      const hours = Number(process.env.DELETE_COOL_OFF_HOURS ?? "24");
      const sinceSec = Date.now() / 1000 - hours * 3600;
      const db = (await clientPromise).db();

      let hit = null;
      if (account?.provider && account?.providerAccountId) {
        hit = await db.collection("accounts_to_be_terminated").findOne({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          _terminatedAt: { $gt: sinceSec },
        });
      }
      if (!hit && user?.email) {
        hit = await db.collection("users_to_be_terminated").findOne({
          email: user.email,
          _terminatedAt: { $gt: sinceSec },
        });
      }
      if (hit) {
        // Returning a URL string makes Auth.js redirect there instead of
        // completing the sign-in.
        return "/auth/signin?error=AccountRecentlyDeleted";
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = (token.role as string) ?? "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
