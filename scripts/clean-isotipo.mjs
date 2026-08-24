/**
 * Cleans isotipo_twincap2.svg (raw vectorizer output) into an app-ready asset.
 *
 * Stages (each verified by rasterized pixel-diff against the original):
 *   1. Recolor tracer artifacts (#FF0000 / #00FF00 do not exist in the
 *      design's navy/teal/gold/cream palette) to their nearest real family.
 *   2. Drop micro-sliver paths whose bounding box is under MIN_AREA px^2 —
 *      invisible at every display size and the source of fuzzy edges.
 *   3. Round coordinates to 2 decimals and collapse whitespace.
 *
 * Run: node scripts/clean-isotipo.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'isotipo_twincap2.svg';
const OUT = 'public/isotipo-twincap.svg';
const MIN_AREA = 20;

const ARTIFACT_MAP = {
  '#FF0000': '#F0AB20', // stray red -> gold family representative
  '#00FF00': '#10EFE8', // stray green -> teal family representative
};

let svg = readFileSync(SRC, 'utf8');

// Extract the inner body (everything between the opening/closing <svg> tags).
const openEnd = svg.indexOf('>') + 1;
const closeStart = svg.lastIndexOf('</svg>');
let body = svg.slice(openEnd, closeStart);
const viewBox = svg.match(/viewBox="([^"]+)"/)[1];

function pathStats(tag) {
  const fillMatch = tag.match(/fill="#([0-9A-Fa-f]{6})"/);
  const dMatch = tag.match(/ d="([^"]+)"/s);
  if (!dMatch) return null;
  const nums = dMatch[1].match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 4) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = parseFloat(nums[i]), y = parseFloat(nums[i + 1]);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { fill: fillMatch ? `#${fillMatch[1]}` : null, area: (maxX - minX) * (maxY - minY), d: dMatch[1] };
}

let dropped = 0, recolored = 0;
const kept = [];
for (const tag of body.match(/<path\b[^>]*>(?:<\/path>)?/gs) ?? []) {
  const st = pathStats(tag);
  if (!st) continue;
  if (st.area < MIN_AREA) { dropped++; continue; }
  let t = tag.replace(/\s+d="/, ' d="');
  if (st.fill && ARTIFACT_MAP[st.fill.toUpperCase()]) {
    t = t.replace(/fill="#[0-9A-Fa-f]{6}"/i, `fill="${ARTIFACT_MAP[st.fill.toUpperCase()]}"`);
    recolored++;
  }
  kept.push(t);
}

// Rebuild: rounded coords, collapsed whitespace.
body = kept
  .map((t) => t.replace(/(-?\d+\.\d{2})\d+/g, '$1').replace(/\s+/g, ' ').trim())
  .join('');

const out =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1254" height="1254">` +
  body +
  `</svg>\n`;

writeFileSync(OUT, out);
console.log(`paths kept: ${kept.length}, dropped slivers: ${dropped}, recolored artifacts: ${recolored}`);
console.log(`size: ${(svg.length / 1024).toFixed(0)}KB -> ${(out.length / 1024).toFixed(0)}KB`);
