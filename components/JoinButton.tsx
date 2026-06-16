// components/JoinButton.tsx
// Toggles membership in a community. Optimistic.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinCommunity } from "@/app/actions/communities";

export default function JoinButton({
  communityId,
  initialJoined,
}: {
  communityId: string;
  initialJoined: boolean;
}) {
  const router = useRouter();
  const [joined, setJoined] = useState(initialJoined);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setJoined((v) => !v); // optimistic
    startTransition(async () => {
      await joinCommunity(communityId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        joined
          ? "border border-border text-muted-foreground hover:text-foreground"
          : "bg-primary text-primary-foreground hover:opacity-90"
      }`}
    >
      {joined ? "Joined" : "Join"}
    </button>
  );
}
