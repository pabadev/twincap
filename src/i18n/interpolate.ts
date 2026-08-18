/**
 * Simple string interpolation for translation values.
 * Replaces `{key}` placeholders with values from the params object.
 *
 * Example: interpolate("Capital ({currency})", { currency: "COP" })
 *       → "Capital (COP)"
 */
export function interpolate(
  template: string,
  params: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
}
