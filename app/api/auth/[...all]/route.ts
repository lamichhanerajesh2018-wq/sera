// app/api/auth/[...all]/route.ts
// Mounts Better Auth's handler on /api/auth/* (sign-in, sign-up, session, etc.)
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
