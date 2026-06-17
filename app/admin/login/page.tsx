// app/admin/login/page.tsx
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import AdminLoginForm from "./AdminLoginForm";

export const metadata = { title: "Admin sign in — Sera" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // Already signed in? Skip straight to the dashboard.
  if (await isAdmin()) redirect("/admin/stats");

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[320px] w-[460px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[90px]"
      />
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/70 p-8 backdrop-blur">
        <h1 className="font-display text-2xl font-medium tracking-tight">Admin sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter the admin password to view the dashboard.
        </p>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
