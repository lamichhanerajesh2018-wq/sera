// app/login/page.tsx
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign in to Sera",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with the name you chose."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="text-foreground underline-offset-4 hover:underline">
            Pick a name
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
