// app/admin/page.tsx
// /admin entry point: send signed-in admins to the dashboard, everyone else to
// the login page. No ?key= in URLs anymore.
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminIndex() {
  if (await isAdmin()) redirect("/admin/stats");
  redirect("/admin/login");
}
