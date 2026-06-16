// lib/pusher-client.ts
// Browser-side Pusher client — used in chat components to subscribe to channels.
"use client";

import PusherClient from "pusher-js";

export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  }
);
