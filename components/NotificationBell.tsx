// components/NotificationBell.tsx
// Bell icon with an unread-count badge in the app bar. Links to the
// notifications page. Count is fetched once on mount and polled lightly.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { unreadNotificationCount } from "@/app/actions/notifications";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const n = await unreadNotificationCount();
      if (active) setCount(n);
    };
    load();
    // light polling every 30s so the badge stays roughly current
    const t = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Notifications"
    >
      <span className="text-base">🔔</span>
      {count > 0 && (
        <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
