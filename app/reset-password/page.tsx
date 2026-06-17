// app/reset-password/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = {
  title: "Choose a new password — Sera",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick a new password for your account. Your handle stays the same."
      footer={
        <>
          Changed your mind?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
