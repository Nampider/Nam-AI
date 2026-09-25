import { betterAuth } from "better-auth";
import { genericOAuth, auth0 } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // No database yet, so Better Auth runs "stateless": the session is kept in an
  // encrypted cookie instead of a database table. Adding Postgres later = add a `database` line.
  session: {
    expiresIn: 60 * 60 * 8, // sessions last 8 hours (a workday)
    updateAge: 60 * 60,     // extended at most once an hour while you're active
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 8, // 8 hours, then sign in again
      strategy: "jwe",     // encrypted: the browser can't read or change it
      refreshCache: true,  // quietly extends it while you're active
    },
  },
  account: {
    storeStateStrategy: "cookie", // the one-time login "state" also lives in a cookie
    storeAccountCookie: true,     // the Okta account link, too
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
