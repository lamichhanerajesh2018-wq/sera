// app/api/translate/route.ts
// Translates any text into the requested language using GPT-4o.
// Called by the per-post Translate button on the client.
//
// POST /api/translate
// Body: { text: string, targetLang: string }   e.g. "ne", "hi", "en"
// Returns: { translated: string }

import { NextRequest, NextResponse } from "next/server";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ne: "Nepali (नेपाली)",
  hi: "Hindi (हिन्दी)",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese (Simplified)",
  ar: "Arabic",
  pt: "Portuguese",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Translation not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").trim();
  const targetLang: string = (body.targetLang ?? "en").toLowerCase();

  if (!text) return NextResponse.json({ error: "No text provided." }, { status: 400 });
  if (text.length > 3000) return NextResponse.json({ error: "Text too long." }, { status: 400 });

  const langName = LANG_NAMES[targetLang] ?? targetLang;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `You are a translator. Translate the user's text into ${langName}.
Rules:
- Return ONLY the translated text — no explanations, no quotes, no preamble.
- Preserve emojis, line breaks, and formatting exactly.
- If the text is already in ${langName}, return it unchanged.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[translate] OpenAI error:", err);
      return NextResponse.json({ error: "Translation failed." }, { status: 500 });
    }

    const data = await res.json();
    const translated = (data.choices?.[0]?.message?.content as string)?.trim() ?? text;

    return NextResponse.json({ translated });
  } catch (err) {
    console.error("[translate] fetch error:", err);
    return NextResponse.json({ error: "Translation failed." }, { status: 500 });
  }
}
