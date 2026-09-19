"use strict";
// WCAG 2.x relative-luminance ratio calculator for the UX-12 token pre-check.
// Supports sRGB hex (#rgb/#rrggbb), rgb(), and oklch() (Bjh CSS Color 4 math).
// Usage: node ratio-check.cjs "<fg> <bg>" "<fg> <bg>" ...

function srgbToLinear(c) {
  const v = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return v;
}
function linFromRaw(raw) {
  const c = raw / 255;
  return srgbToLinear(c);
}
function lumRGB(r, g, b) {
  return (
    0.2126 * linFromRaw(r) + 0.7152 * linFromRaw(g) + 0.0722 * linFromRaw(b)
  );
}
function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toSrgb = (c) =>
    c >= 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
  return [r, g, bb].map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255));
}
function parseOkLch(str) {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(str);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
function parseColor(str) {
  const s = str.trim();
  if (s.startsWith("#") || /^[0-9a-fA-F]{6}$/.test(s)) {
    return hexToRgb(s.startsWith("#") ? s : "#" + s);
  }
  const ok = parseOkLch(s);
  if (ok) return oklchToRgb(ok[0], ok[1], ok[2]);
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}
function lum(str) {
  const rgb = parseColor(str);
  return { rgb, L: lumRGB(rgb[0], rgb[1], rgb[2]) };
}
function ratio(fg, bg) {
  const f = lum(fg);
  const b = lum(bg);
  const hi = Math.max(f.L, b.L);
  const lo = Math.min(f.L, b.L);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = process.argv.slice(2);
if (pairs.length === 0) {
  console.log("usage: node ratio-check.cjs \"<fg> <bg>\" ...");
  process.exit(1);
}
for (const p of pairs) {
  const parts = p.trim().split("|");
  if (parts.length !== 2) {
    console.error("Bad pair spec: " + p);
    process.exit(1);
  }
  const r = ratio(parts[0], parts[1]);
  const f = parseColor(parts[0]);
  const b = parseColor(parts[1]);
  const hex = (rgb) =>
    "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
  console.log(
    `${hex(f).toUpperCase()} on ${hex(b).toUpperCase()}  =  ${r.toFixed(2)}:1`
  );
}
