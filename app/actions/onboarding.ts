// app/actions/onboarding.ts
"use server";

import { ObjectId } from "mongodb";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongodb";
import { generateUniqueUsername } from "@/lib/username";
import { logSignup } from "@/app/actions/signup";

// Social sign-in (Google/Apple) creates a user with no username — the
// username plugin only assigns one on the email/password path. Called once
// the onboarding wizard detects a fresh session; assigns a handle if the
// account doesn't already have one, so social users get the same "sera-1234"
// identity as everyone else. Idempotent — safe to call on every mount.
export async function ensureUsernameForCurrentUser(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) return null;
  if (user.username) return user.username as string;

  const handle = await generateUniqueUsername();

  await db.collection("user").updateOne(
    { _id: new ObjectId(user.id) },
    { $set: { username: handle, displayUsername: handle } }
  );

  try {
    await logSignup(handle);
  } catch {
    // best-effort — the account already exists and works regardless
  }

  return handle;
}

export interface OnboardingProfile {
  interests: string[];
  goals: string[];
  identity: string | null;
  skills: string[];
}

// Called once, from Step 6 ("Finish setup"), after the username itself has
// already been confirmed via authClient.updateUser client-side. Writes the
// rest of the Interest Graph inputs straight onto the user document — these
// fields aren't part of Better Auth's own schema, so we set them directly,
// the same way logSignup() already does for referredBy/referralCount.
export async function saveOnboardingProfile(profile: OnboardingProfile): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  if (!user) throw new Error("You need to be signed in to finish setup.");

  await db.collection("user").updateOne(
    { _id: new ObjectId(user.id) },
    {
      $set: {
        interests: profile.interests,
        goals: profile.goals,
        primaryIdentity: profile.identity,
        skills: profile.skills,
        onboardingCompletedAt: new Date(),
      },
    }
  );
}
