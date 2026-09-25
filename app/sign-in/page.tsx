import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInButton } from "@/components/sign-in-button";
import { getCurrentUser } from "@/lib/session";

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/"); // already signed in
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Nam-AI</CardTitle>
          <CardDescription>Sign in with your Auth0 account.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInButton />
        </CardContent>
      </Card>
    </main>
  );
}
