/**
 * Regenerates src/components/pwa/splash-links.ts from pwa_pack/readme.txt.
 *
 * Run with: node scripts/generate-splash-links.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const readme = readFileSync(join(process.cwd(), 'pwa_pack', 'readme.txt'), 'utf8');
const re = /<link rel="apple-touch-startup-image" media="([^"]+)" href="([^"]+)">/g;

const rows = [];
let m;
while ((m = re.exec(readme))) {
  rows.push({ media: m[1].replace('screen and ', ''), href: m[2] });
}

if (rows.length === 0) {
  console.error('No apple-touch-startup-image links found in pwa_pack/readme.txt');
  process.exit(1);
}

let out = '// AUTO-GENERATED from pwa_pack/readme.txt — do not edit by hand.\n';
out += '// Regenerate: node scripts/generate-splash-links.mjs\n';
out += '// iOS startup images: Safari downloads only the entry matching the device media query.\n';
out += 'export const SPLASH_SCREENS: ReadonlyArray<{ media: string; href: string }> = [\n';
for (const r of rows) {
  out += `  { media: ${JSON.stringify(r.media)}, href: ${JSON.stringify('/' + r.href)} },\n`;
}
out += '] as const;\n';

mkdirSync(join(process.cwd(), 'src/components/pwa'), { recursive: true });
writeFileSync(join(process.cwd(), 'src/components/pwa/splash-links.ts'), out);
console.log(`wrote splash-links.ts with ${rows.length} entries`);
