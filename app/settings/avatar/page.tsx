// app/settings/avatar/page.tsx
// Avatar settings: pick a geometric avatar generated from your handle. No photo
// upload — keeps the platform identity-free while still letting you personalize.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMyAvatarSeed } from "@/app/actions/profile";
import AppBar from "@/components/AppBar";
import AvatarPicker from "./AvatarPicker";

export const metadata = { title: "Avatar — Sera" };

export default async function AvatarSettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const handle = (me as any).username || (me as any).displayUsername || "anon";
  const seed = (await getMyAvatarSeed()) || handle;

  return (
    <div className="flex flex-1 flex-col">
      <AppBar handle={handle} />

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          href={`/u/${handle}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to profile
        </Link>

        <div className="mb-6">
          <h1 className="font-display text-2xl font-medium">Your avatar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a geometric avatar. It&apos;s generated from your handle — no photo, nothing
            tied to a real identity.
          </p>
        </div>

        <AvatarPicker handle={handle} currentSeed={seed} />
      </main>
    </div>
  );
}
