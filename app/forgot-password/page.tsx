// app/forgot-password/page.tsx
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = {
  title: "Reset your Sera password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="If you signed up with an email, we'll send you a reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
