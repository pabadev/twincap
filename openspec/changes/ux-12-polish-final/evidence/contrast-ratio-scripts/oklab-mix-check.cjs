"use strict";
// OKLab color-mix probe (Tailwind v4 uses color-mix(in oklab) for /opacity).
function hexToRgb(h) {
  h = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function lin(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function unlin(v) {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}
function rgbToOklab([r, g, b]) {
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6807054445 * g + 0.0728583666 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299235229 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const x = (v) => v * v * v;
  let r = 4.0767416621 * x(l_) - 3.3077115913 * x(m_) + 0.2309699292 * x(s_);
  let g = -1.2684380046 * x(l_) + 2.6097574011 * x(m_) - 0.3413193965 * x(s_);
  let b2 = -0.0041960863 * x(l_) - 0.7034186157 * x(m_) + 1.707614701 * x(s_);
  return [r, g, b2].map((v) =>
    Math.round(Math.max(0, Math.min(1, unlin(v))) * 255)
  );
}
function lum([r, g, b]) {
  return 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
}
function ratio(fg, bg) {
  const f = lum(fg), b = lum(bg);
  return (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05);
}
function mixrate(fgHex, bgHex, alpha) {
  const bg = oklabToRgb(
    rgbToOklab(hexToRgb(bgHex)).map((v, i) => v * (1 - alpha) + rgbToOklab(hexToRgb(fgHex))[i] * alpha)
  );
  const r = ratio(hexToRgb(fgHex), bg);
  return `#${rgbHexStr(bg)}  ratio(${fgHex}) ${r.toFixed(2)}`;
}
function rgbHexStr(a) {
  return a.map((v) => v.toString(16).padStart(2, "0")).join("");
}
// Income chips: bg-income/10 over surfaces; expense too, both themes.
for (const [fg, bg, a] of [
  ["#056a4c", "#e8ecf0", 0.1],
  ["#056a4c", "#f0f3f5", 0.1],
  ["#0d9488", "#e8ecf0", 0.1],
  ["#b91c1c", "#e8ecf0", 0.1],
  ["#00bc7d", "#151921", 0.1],
  ["#ff3936", "#151921", 0.1],
]) {
  console.log(fg, "over", bg, "@", a, "->", mixrate(fg, bg, a));
}
