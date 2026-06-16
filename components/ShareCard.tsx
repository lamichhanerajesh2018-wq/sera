// components/ShareCard.tsx
// Turns an anonymous message (and optional answer) into a beautiful, branded
// card that can be downloaded as a PNG for sharing on social media — the viral
// loop. We render the card as an SVG, then rasterize it to PNG via a canvas, so
// there's no heavy html-to-image dependency.
"use client";

import { useRef, useState } from "react";

// Wrap text to a given character width (rough, monospace-ish heuristic). Returns
// an array of lines. Good enough for short anonymous messages.
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 8); // cap height
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSvg(message: string, handle: string, variant: "question" | "post"): string {
  const W = 1080;
  const H = 1080;
  const lines = wrapText(message, 28);
  const lineHeight = 64;
  const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;

  const textEls = lines
    .map(
      (ln, i) =>
        `<text x="${W / 2}" y="${startY + i * lineHeight}" text-anchor="middle" fill="#f5e9da" font-family="Georgia, serif" font-size="48" font-weight="500">${escapeXml(ln)}</text>`
    )
    .join("");

  const eyebrow = variant === "post" ? "anonymous confession" : "anonymous message";
  const footTop = variant === "post" ? `by @${escapeXml(handle)}` : `to @${escapeXml(handle)}`;
  const footBottom = variant === "post" ? "read more on sera" : "send yours on sera";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#2a211b"/>
      <stop offset="100%" stop-color="#161210"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="60" y="60" width="${W - 120}" height="${H - 120}" rx="48" fill="none" stroke="#3a322c" stroke-width="2"/>

  <text x="${W / 2}" y="170" text-anchor="middle" fill="#e0a458" font-family="Georgia, serif" font-size="40" font-weight="600" letter-spacing="8">SERA</text>
  <text x="${W / 2}" y="240" text-anchor="middle" fill="#8a7d70" font-family="Helvetica, Arial, sans-serif" font-size="24">${eyebrow}</text>

  <text x="${W / 2}" y="330" text-anchor="middle" fill="#e0a458" font-size="60">&#10077;</text>

  ${textEls}

  <text x="${W / 2}" y="${H - 150}" text-anchor="middle" fill="#c8bcae" font-family="Helvetica, Arial, sans-serif" font-size="28">${footTop}</text>
  <text x="${W / 2}" y="${H - 100}" text-anchor="middle" fill="#8a7d70" font-family="Helvetica, Arial, sans-serif" font-size="24">${footBottom}</text>
</svg>`.trim();
}

export default function ShareCard({
  message,
  handle,
  variant = "question",
  onClose,
}: {
  message: string;
  handle: string;
  variant?: "question" | "post";
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const svg = buildSvg(message, handle, variant);
  const previewRef = useRef<HTMLDivElement>(null);

  async function download() {
    setDownloading(true);
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("render failed"));
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `sera-message.png`;
      a.click();
    } catch {
      // ignore — preview is still visible to screenshot manually
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-lg font-medium">Share this message</p>
          <button
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* preview (the SVG itself, scaled down) */}
        <div
          ref={previewRef}
          className="overflow-hidden rounded-2xl border border-border"
          dangerouslySetInnerHTML={{
            __html: svg.replace("<svg ", '<svg style="width:100%;height:auto;display:block" '),
          }}
        />

        <div className="mt-4 flex gap-2">
          <button
            onClick={download}
            disabled={downloading}
            className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {downloading ? "Preparing…" : "Download image"}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-border px-5 py-2.5 text-sm transition-colors hover:bg-secondary/40"
          >
            Done
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground/70">
          Save the card and post it to your story to get more messages.
        </p>
      </div>
    </div>
  );
}
