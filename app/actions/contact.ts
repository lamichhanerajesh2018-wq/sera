// app/actions/contact.ts
// Handles the public contact form. Anyone (signed in or not) can send a short
// message; it's delivered to the site owner via Resend. Lightly rate-limited by
// hashed IP so the form can't be used as a spam relay. No data is persisted.
"use server";

import { sendEmail } from "@/lib/email";
import { currentIpHash } from "@/lib/safety-log";
import { db } from "@/lib/mongodb";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PER_IP = 5;

const CONTACT_TO = process.env.CONTACT_TO;

export interface ContactResult {
  ok: boolean;
  error?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function sendContactMessage(form: {
  name: string;
  email: string;
  message: string;
}): Promise<ContactResult> {
  const name = (form.name || "").trim();
  const email = (form.email || "").trim();
  const message = (form.message || "").trim();

  // ---- validation -------------------------------------------------------
  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (!isEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  if (message.length < 10)
    return { ok: false, error: "Your message is a little short — add a few more details." };
  if (message.length > 4000)
    return { ok: false, error: "That message is too long. Please keep it under 4000 characters." };

  if (!CONTACT_TO) {
    console.error("[contact] CONTACT_TO not set; cannot deliver message.");
    return { ok: false, error: "Contact isn't set up yet. Please try again later." };
  }

  // ---- rate limit by hashed IP -----------------------------------------
  try {
    const ipHash = await currentIpHash();
    const since = new Date(Date.now() - WINDOW_MS);
    const coll = db.collection("contact_rate");
    const count = await coll.countDocuments({ ipHash, createdAt: { $gte: since } });
    if (count >= MAX_PER_IP) {
      return {
        ok: false,
        error: "You've sent a few messages already. Please wait a bit before sending another.",
      };
    }
    await coll.insertOne({ ipHash, createdAt: new Date() });
  } catch {
    // Fail open — don't block a genuine user over a rate-store hiccup.
  }

  // ---- deliver ----------------------------------------------------------
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");

  const html = `
    <div style="background:#1a1614;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:520px;margin:0 auto;background:#211c19;border:1px solid #3a322c;border-radius:20px;padding:32px;">
        <div style="font-size:22px;font-weight:600;color:#f5e9da;margin-bottom:16px;letter-spacing:3px;">SERA<span style="color:#e0a458;">.</span></div>
        <h1 style="font-size:18px;color:#f5e9da;margin:0 0 16px;">New contact message</h1>
        <p style="font-size:14px;line-height:22px;color:#c8bcae;margin:0 0 6px;"><strong style="color:#f5e9da;">From:</strong> ${safeName}</p>
        <p style="font-size:14px;line-height:22px;color:#c8bcae;margin:0 0 16px;"><strong style="color:#f5e9da;">Email:</strong> ${safeEmail}</p>
        <div style="border-top:1px solid #3a322c;padding-top:16px;font-size:14px;line-height:24px;color:#c8bcae;">${safeMessage}</div>
      </div>
    </div>
  `;

  await sendEmail({
    to: CONTACT_TO,
    subject: `Sera contact — ${name}`,
    html,
    replyTo: email,
  });

  return { ok: true };
}
