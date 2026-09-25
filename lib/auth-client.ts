import { createAuthClient } from "better-auth/react";

// Runs in the browser. Talks to /api/auth/* on the same site.
export const authClient = createAuthClient();
