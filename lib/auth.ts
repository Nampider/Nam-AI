import { betterAuth } from "better-auth";
import { genericOAuth, auth0 } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Sessions now live in Postgres instead of an encrypted cookie: signing out really ends them,
  // and the Auth0 tokens sit in the account table rather than in the browser.
  database: drizzleAdapter(db, { provider: "pg", schema }),
  session: {
    expiresIn: 60 * 60 * 8, // 8-hour sessions (a workday)
    updateAge: 60 * 60,     // extended at most once an hour while you're active
  },
  plugins: [
    genericOAuth({
      config: [
        auth0({
          clientId: process.env.AUTH0_CLIENT_ID!,
          clientSecret: process.env.AUTH0_CLIENT_SECRET!,
          domain: process.env.AUTH0_DOMAIN!, // e.g. dev-abc123.us.auth0.com (no https://)
        }),
      ],
    }),
    nextCookies(), // lets server code set cookies; keep it last
  ],
});
