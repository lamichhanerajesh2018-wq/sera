// lib/email.ts
// Thin wrapper around Resend for transactional emails (account verification,
// recovery). The API key and "from" address come from the environment so no
// secrets live in the codebase.
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM || "Sera <onboarding@resend.dev>";

// Lazily construct the client so a missing key only errors when we actually
// try to send (e.g. pure-anonymous signups never touch this).
function getResend(): Resend | null {
  if (!apiKey) return null;
  return new Resend(apiKey);
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<void> {
  const resend = getResend();
  console.log("[email] sendEmail called →", { to, subject, hasKey: !!apiKey, from });
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping send to", to);
    return;
  }
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("[email] Resend send failed:", error);
    } else {
      console.log("[email] Resend sent OK, id:", data?.id);
    }
  } catch (err) {
    console.error("[email] Resend threw:", err);
  }
}

// ---- templates ----------------------------------------------------------

const WRAP = (inner: string) => `
  <div style="background:#1a1614;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#211c19;border:1px solid #3a322c;border-radius:20px;padding:32px;">
      <div style="font-size:22px;font-weight:600;color:#f5e9da;margin-bottom:8px;letter-spacing:3px;">SERA<span style="color:#e0a458;">.</span></div>
      ${inner}
      <div style="margin-top:28px;border-top:1px solid #3a322c;padding-top:16px;font-size:12px;color:#8a7d70;">
        You're receiving this because someone used this email to sign up for Sera.
        If that wasn't you, you can safely ignore it.
      </div>
    </div>
  </div>
`;

export function verificationEmailHtml(url: string): string {
  return WRAP(`
    <h1 style="font-size:18px;color:#f5e9da;margin:0 0 12px;">Confirm your email</h1>
    <p style="font-size:14px;line-height:22px;color:#c8bcae;margin:0 0 24px;">
      Verify this email so you can recover your anonymous account if you ever lose access.
      Your email is never shown to anyone on Sera.
    </p>
    <a href="${url}" style="display:inline-block;background:#e0a458;color:#1a1614;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px;">
      Verify email
    </a>
    <p style="font-size:12px;color:#8a7d70;margin:20px 0 0;">
      Or paste this link: <br/>${url}
    </p>
  `);
}

export function resetPasswordEmailHtml(url: string): string {
  return WRAP(`
    <h1 style="font-size:18px;color:#f5e9da;margin:0 0 12px;">Reset your password</h1>
    <p style="font-size:14px;line-height:22px;color:#c8bcae;margin:0 0 24px;">
      We got a request to reset the password for your Sera account. Click below to
      choose a new one. This link expires soon, and your handle stays the same.
    </p>
    <a href="${url}" style="display:inline-block;background:#e0a458;color:#1a1614;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px;">
      Reset password
    </a>
    <p style="font-size:12px;color:#8a7d70;margin:20px 0 0;">
      Or paste this link: <br/>${url}
    </p>
    <p style="font-size:12px;color:#8a7d70;margin:16px 0 0;">
      Didn't ask for this? You can safely ignore this email — your password won't change.
    </p>
  `);
}
