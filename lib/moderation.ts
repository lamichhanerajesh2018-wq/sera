// lib/moderation.ts
// AI moderation via OpenAI's free omni-moderation endpoint.
//
// IMPORTANT — Hush is a confession / mental-health space. People come here to
// say hard things ("some days getting out of bed feels like a war"). We must NOT
// block someone for expressing their own pain. So we only hard-block content
// that harms OTHERS — threats, harassment, hate, sexual content involving minors.
// Self-harm expression is allowed through (the UI can gently surface support
// resources separately).

type ModerationResult =
  | { allowed: true; flaggedSelfHarm: boolean }
  | { allowed: false; reason: string };

// Categories that mean "this harms other people" → block.
// We intentionally exclude self-harm categories from the block list.
const BLOCK_CATEGORIES = [
  "harassment",
  "harassment/threatening",
  "hate",
  "hate/threatening",
  "sexual/minors",
  "violence",
  "violence/graphic",
];

export async function moderateText(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  // If no key is configured, fail OPEN (allow) — moderation is a safety net,
  // not a hard gate, and we never want to block the whole app on a missing key.
  if (!apiKey) {
    return { allowed: true, flaggedSelfHarm: false };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text,
      }),
    });

    if (!res.ok) {
      // On API error, fail open.
      return { allowed: true, flaggedSelfHarm: false };
    }

    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return { allowed: true, flaggedSelfHarm: false };

    const categories: Record<string, boolean> = result.categories ?? {};

    // Did any "harms others" category trip?
    const blocked = BLOCK_CATEGORIES.find((c) => categories[c]);
    if (blocked) {
      return {
        allowed: false,
        reason:
          "This goes against our community guidelines (it targets or harms others). Please rephrase.",
      };
    }

    // Self-harm is allowed through, but we flag it so the UI can offer support.
    const flaggedSelfHarm =
      !!categories["self-harm"] ||
      !!categories["self-harm/intent"] ||
      !!categories["self-harm/instructions"];

    return { allowed: true, flaggedSelfHarm };
  } catch {
    // Network error → fail open.
    return { allowed: true, flaggedSelfHarm: false };
  }
}
