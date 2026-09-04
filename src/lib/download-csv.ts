'use client';

/**
 * Client-only: triggers a browser download of a CSV string as a byte-exact
 * UTF-8 file that Excel opens with the right encoding.
 *
 * The CSV is encoded with an explicit UTF-8 BOM (bytes EF BB BF) at the start
 * of the physical file, NOT by relying on a JS string character. Some browsers
 * re-encode Blob strings in ways that drop the BOM as the first byte, and Excel
 * for Windows then falls back to the ANSI code page and shows mojibake
 * (e.g. "CategorÃ­a" instead of "Categoría"). Building the Blob from raw
 * Uint8Array bytes guarantees the BOM is the first physical byte.
 *
 * Newlines are normalized to CRLF because server-action round trips can turn
 * the CSV's `\r\n` into bare `\n`, and classic desktop Excel treats lone `\n`
 * as data, not as a row separator.
 */
export function downloadCsv(csv: string, filename: string): void {
  const body = new TextEncoder().encode(
    csv.replace(/^\uFEFF/, '').replace(/\r?\n/g, '\r\n'),
  );
  const bytes = new Uint8Array(3 + body.byteLength);
  bytes[0] = 0xef;
  bytes[1] = 0xbb;
  bytes[2] = 0xbf;
  bytes.set(body, 3);

  const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}