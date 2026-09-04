'use client';

/**
 * Client-only: triggers a browser download of a CSV string.
 * The CSV is expected to already carry a UTF-8 BOM (see buildCsv in
 * src/lib/csv.ts) so Excel opens it with the right encoding.
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}