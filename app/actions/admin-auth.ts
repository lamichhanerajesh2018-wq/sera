// app/actions/admin-auth.ts
"use server";

import { adminSignIn, adminSignOut } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

// Called from the admin login form. On success, sets the cookie and lands on
// the dashboard; on failure, returns an error for the form to show.
export async function loginAdmin(password: string): Promise<{ ok: boolean; error?: string }> {
  const ok = await adminSignIn(password);
  if (!ok) return { ok: false, error: "Wrong password." };
  return { ok: true };
}

export async function logoutAdmin(): Promise<void> {
  await adminSignOut();
  redirect("/admin/login");
}
