/**
 * PWA icon pipeline — regenerates every app icon from the master asset.
 *
 * Source of truth: pwa_pack/splash_screens/icon.png (512x512, white background).
 * Run with: node scripts/generate-icons.mjs
 *
 * Outputs (all in public/):
 *   icon-512.png           manifest "any" purpose
 *   icon-192.png           manifest "any" purpose
 *   apple-touch-icon.png   iOS home screen (180x180, opaque)
 *   icon-maskable-512.png  manifest "maskable" — artwork scaled into the safe zone
 *   icon-maskable-192.png  maskable, small size
 *   favicon-32.png         browser tab fallback for engines without SVG favicon
 *
 * Maskable math: launchers crop to shapes inscribed around the center. The
 * conservative safe zone is a circle of radius 40% of the canvas (204.8px on a
 * 512 canvas). The master artwork is 292x467; scaling it by ~0.74 keeps its
 * bounding-box corners inside that circle ((146s)^2 + (233.5s)^2 <= 204.8^2).
 */
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'public');
const MASTER = join(process.cwd(), 'pwa_pack', 'splash_screens', 'icon.png');

if (!existsSync(MASTER)) {
  console.error(`Master icon not found at ${MASTER}`);
  process.exit(1);
}

// Maskable scale derived from the artwork bounding box (see header comment).
const MASKABLE_SCALE = 0.74;

async function render(size) {
  return sharp(MASTER).resize(size, size, { fit: 'cover' }).png().toBuffer();
}

async function plainIcon(size) {
  await sharp(await render(512))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(ROOT, `icon-${size}.png`));
  console.log(`icon-${size}.png`);
}

async function maskableIcon(size) {
  const inner = Math.round(size * MASKABLE_SCALE);
  const content = await sharp(await render(512)).resize(inner, inner).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: content, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(join(ROOT, `icon-maskable-${size}.png`));
  console.log(`icon-maskable-${size}.png`);
}

await plainIcon(512);
await plainIcon(192);
await sharp(await render(512))
  .resize(180, 180)
  .png({ compressionLevel: 9 })
  .toFile(join(ROOT, 'apple-touch-icon.png'));
console.log('apple-touch-icon.png');
await sharp(await render(512))
  .resize(32, 32)
  .png({ compressionLevel: 9 })
  .toFile(join(ROOT, 'favicon-32.png'));
console.log('favicon-32.png');
await maskableIcon(512);
await maskableIcon(192);
console.log('done');
