"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await authClient.signIn.social({ provider: "auth0", callbackURL: "/" }); // browser leaves for Okta
      }}
    >
      {loading ? "Redirecting to Auth0..." : "Sign in with Auth0"}
    </Button>
  );
}
