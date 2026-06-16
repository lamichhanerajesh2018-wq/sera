// lib/auth.ts
// Server-side Better Auth instance. This is the source of truth for auth:
// email/password login plus a chosen anonymous username (via the username plugin).
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { username } from "better-auth/plugins";
import { db, client } from "@/lib/mongodb";
import { sendEmail, verificationEmailHtml } from "@/lib/email";

export const auth = betterAuth({
  database: mongodbAdapter(db, { client }),

  // Hush identity model: users sign up with email + password (private, never shown)
  // and pick a public anonymous username that is the only thing other people see.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Don't force verification to log in — accounts work immediately. The
    // verification email only matters for later recovery, so we let people in
    // and nudge them to confirm. (Pure-anonymous accounts have no email at all.)
    requireEmailVerification: false,
  },

  // When a user signs up with an email (the "recoverable" path), send them a
  // verification link via Resend. Pure-anonymous signups skip this entirely
  // because they never provide an email.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      // Skip placeholder emails used by pure-anonymous accounts.
      if (!user.email || user.email.endsWith("@anon.sera.local")) return;
      // Fire-and-forget: never let a slow or failing email provider block or
      // hang the signup. The account is already created; the email is a
      // best-effort convenience for later recovery.
      sendEmail({
        to: user.email,
        subject: "Verify your email for Sera",
        html: verificationEmailHtml(url),
      }).catch((err) => {
        console.error("[auth] verification email failed:", err);
      });
    },
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      // Allow hyphens so auto-assigned handles like "hush-3540" are valid.
      // (The plugin's default validator rejects hyphens.)
      usernameValidator: (value) => /^[a-zA-Z0-9_-]+$/.test(value),
    }),
  ],

  // Used to sign session cookies. Set in .env.local.
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
