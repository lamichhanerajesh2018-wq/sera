// components/CreateCommunity.tsx
// Collapsible "start a community" form. Anyone can create one.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCommunity } from "@/app/actions/communities";

export default function CreateCommunity() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (name.trim().length < 3) {
      setError("Name must be at least 3 characters.");
      return;
    }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("description", description.trim());

    startTransition(async () => {
      const res = await createCommunity(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.slug) {
        router.push(`/c/${res.slug}`);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        + Start a community
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium">Start a community</p>
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 30))}
          placeholder="Community name (e.g. midnight thoughts)"
          className="h-11 w-full rounded-xl border border-border bg-background/40 px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 200))}
          placeholder="What's it about? (optional)"
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || name.trim().length < 3}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
