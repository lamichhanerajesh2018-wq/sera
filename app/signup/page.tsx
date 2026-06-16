// app/signup/page.tsx
import Link from "next/link";
import { Suspense } from "react";
import AuthShell from "@/components/AuthShell";
import SignupForm from "./SignupForm";

export const metadata = {
  title: "Join Sera — pick a name no one knows",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Pick a name no one knows"
      subtitle="No real identity required. Just a handle and a way back in."
      footer={
        <>
          Already have a name?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
