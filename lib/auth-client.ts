// lib/auth-client.ts
// Client-side auth helpers for use in "use client" components.
// Exposes signIn, signUp, signOut, useSession, etc.
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
