// app/settings/avatar/AvatarPicker.tsx
// Lets the signed-in user pick a geometric avatar. Shows a grid of preset
// options (all generated from their handle), highlights the current one, and
// saves the chosen seed via setMyAvatarSeed.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { avatarDataUri, presetSeeds } from "@/lib/avatar";
import { setMyAvatarSeed } from "@/app/actions/profile";

export default function AvatarPicker({
  handle,
  currentSeed,
}: {
  handle: string;
  currentSeed: string;
}) {
  const router = useRouter();
  const seeds = [handle, ...presetSeeds(handle)]; // first option = the default
  const [selected, setSelected] = useState(currentSeed);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(seed: string) {
    setSelected(seed);
    setSaved(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setMyAvatarSeed(selected);
      if (!res.ok) {
        setError(res.error || "Couldn't save. Try again.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div>
      {/* current preview */}
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5">
        <img
          src={avatarDataUri(selected, 64)}
          alt="Your avatar"
          width={64}
          height={64}
          className="rounded-full"
        />
        <div className="min-w-0">
          <p className="truncate font-medium">@{handle}</p>
          <p className="text-sm text-muted-foreground">This is how you appear across Sera.</p>
        </div>
      </div>

      {/* options grid */}
      <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Choose an avatar
      </p>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {seeds.map((seed) => {
          const active = seed === selected;
          return (
            <button
              key={seed}
              onClick={() => choose(seed)}
              className={`relative aspect-square overflow-hidden rounded-2xl border transition-all ${
                active
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-primary/40"
              }`}
              aria-label="Select avatar"
              aria-pressed={active}
            >
              <img src={avatarDataUri(seed, 96)} alt="" className="h-full w-full" />
            </button>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending || selected === currentSeed}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save avatar"}
        </button>
        {saved && <span className="text-sm text-primary">Saved ✓</span>}
      </div>
    </div>
  );
}
