// lib/avatar.ts
// Deterministic, identity-free geometric avatars. Given a seed string (the
// user's handle by default, or a chosen seed), we derive a stable set of colors
// and a simple symmetric "blocky" pattern — like a tasteful identicon. No real
// photo, nothing tied to a real identity, and the same seed always renders the
// same avatar everywhere.

// FNV-1a hash → 32-bit unsigned int. Small, fast, stable across runs.
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A warm, on-brand palette of foreground hues (amber-leaning, plus a few cool
// accents) so avatars feel part of Sera rather than random rainbow noise.
const HUES = [28, 38, 14, 200, 260, 320, 160, 48];

export interface AvatarColors {
  bg: string;
  fg: string;
}

function colorsFor(hash: number): AvatarColors {
  const hue = HUES[hash % HUES.length];
  const fg = `hsl(${hue} 70% 62%)`;
  const bg = `hsl(${hue} 32% 18%)`;
  return { bg, fg };
}

// Build a 5x5 vertically-symmetric grid of filled/empty cells from the hash.
// We only decide the left 3 columns (0,1,2) and mirror columns 3,4 from 1,0.
function gridFor(hash: number): boolean[][] {
  const grid: boolean[][] = [];
  let bits = hash;
  for (let y = 0; y < 5; y++) {
    const row = [false, false, false, false, false];
    for (let x = 0; x < 3; x++) {
      const on = (bits & 1) === 1;
      bits = bits >>> 1;
      // re-mix occasionally so 32 bits stretch across 15 cells without bias
      if (bits === 0) bits = hashSeed(String(hash ^ (y * 7 + x)));
      row[x] = on;
      row[4 - x] = on; // mirror
    }
    grid.push(row);
  }
  return grid;
}

// Produce a self-contained SVG string for a given seed. `size` is the pixel box.
export function avatarSvg(seed: string, size = 40): string {
  const hash = hashSeed(seed || "sera");
  const { bg, fg } = colorsFor(hash);
  const grid = gridFor(hash);
  const cell = size / 5;

  let rects = "";
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (grid[y][x]) {
        rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" fill="${fg}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${rects}</svg>`;
}

// A data-URI version, handy for <img src> or CSS background.
export function avatarDataUri(seed: string, size = 40): string {
  const svg = avatarSvg(seed, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// A small set of preset seeds the user can pick from in settings. Each renders
// a distinct geometric avatar. We salt the handle so options differ per user
// yet stay stable for that user.
export function presetSeeds(handle: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${handle}#${i}`);
}
