import type { MovementLinkKind } from '../core/domain/movement';

/**
 * Presentation-layer derivation of system movement notes.
 *
 * System-linked movements (opening, transfers, credits, sales, payables)
 * must NOT persist human-language notes (AGENTS.md i18n rule): their
 * display text is derived at render time from the structural `link.kind`
 * plus the parent operation's counterparty label, using the `SystemNotes`
 * message namespace. The persisted `note` is only a fallback for
 * historical/unknown cases.
 */
export type TranslateFn = (key: string, params?: Record<string, string>) => string;

export const SYSTEM_NOTES_NAMESPACE = 'SystemNotes';

/** Minimal structural shape needed to derive a display note. */
export interface SystemNoteSource {
  note?: string;
  accountId?: string;
  link?: { kind: string; refId: string; saleId?: string };
}

/**
 * Kinds whose parent operation carries a counterparty/client label. Includes
 * the derived 'creditGrantedAbonoSale' variant: sale-born abonos (I12) label
 * from the SALES map (link.saleId), not from the credit map (link.refId).
 */
const COUNTERPARTY_KINDS = new Set<string>([
  'creditReceivedPrincipal',
  'creditReceivedAbono',
  'creditGrantedPrincipal',
  'creditGrantedAbono',
  'creditGrantedAbonoSale',
  'salePayment',
  'payableInitialPayment',
  'payableAbono',
]);

/** Kinds with a fixed template that never takes a name parameter. */
const PLAIN_KINDS = new Set<MovementLinkKind>(['opening', 'transfer']);

/**
 * i18n template key for a link kind; null when the kind is unknown
 * to this presentation layer (e.g. data written by a newer version).
 *
 * 'creditGrantedAbono' resolves to the sale variant ('creditGrantedAbonoSale')
 * when the link carries saleId — that abono originated in an on-credit sale.
 */
export function systemNoteTemplateKey(kind: string, saleId?: string): string | null {
  if (kind === 'creditGrantedAbono' && saleId !== undefined) {
    return 'creditGrantedAbonoSale';
  }
  if (PLAIN_KINDS.has(kind as MovementLinkKind)) return kind;
  if (COUNTERPARTY_KINDS.has(kind)) return kind;
  return null;
}

/** Legacy default persisted by old transfer flows ("Transfer"). */
function isLegacyAutoTransferNote(note: string | undefined): boolean {
  return note !== undefined && note.trim().toLowerCase() === 'transfer';
}

/**
 * Whether the persisted note on a linked movement is user-authored data
 * (and thus wins over the derived template). Only transfers ever carried
 * user-typed notes into movements; every other system kind was always
 * auto-generated text.
 */
function persistedNoteIsUserAuthored(source: SystemNoteSource): boolean {
  if (!source.link || !source.note || source.note.trim().length === 0) {
    return false;
  }
  if (source.link.kind === 'transfer') {
    // Old generators defaulted to the literal "Transfer" — treat as auto.
    return !isLegacyAutoTransferNote(source.note);
  }
  return false;
}

/**
 * Derive the localized display text of a system-linked movement.
 *
 * Resolution order:
 *   1. User-authored persisted note (transfer form note) — shown verbatim.
 *   2. Localized template from link.kind (+ counterparty label when the
 *      parent operation is available in `refLabels`, plain variant otherwise).
 *   3. undefined → caller falls back to the raw persisted note (historical
 *      rows) or an em dash.
 *
 * Returns undefined for non-system movements (caller shows manual note).
 */
export function deriveSystemNote(
  source: SystemNoteSource,
  t: TranslateFn,
  refLabels?: Record<string, string>,
): string | undefined {
  if (!source.link || persistedNoteIsUserAuthored(source)) return undefined;

  const templateKey = systemNoteTemplateKey(source.link.kind, source.link.saleId);
  if (!templateKey) return undefined;

  if (COUNTERPARTY_KINDS.has(templateKey)) {
    // Sale-born abonos label from the sales map via link.saleId; all other
    // counterparty kinds label from the parent operation via link.refId.
    const labelRefId = templateKey === 'creditGrantedAbonoSale'
      ? (source.link.saleId ?? source.link.refId)
      : source.link.refId;
    const label = refLabels?.[labelRefId];
    if (label && label.trim().length > 0) {
      return t(templateKey, { name: label });
    }
    return t(`${templateKey}Plain`);
  }

  return t(templateKey);
}
