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
  /** Needed to resolve which transfer leg this movement is (D3 remediation). */
  accountId?: string;
  link?: { kind: string; refId: string };
}

/** One endpoint of a transfer, with its account's raw scope enum value. */
export interface TransferEndpointInfo {
  accountId: string;
  name: string;
  scope: string;
}

/** Per-transfer lookup entry built by the caller from loaded accounts. */
export interface TransferLegsInfo {
  origin: TransferEndpointInfo;
  destination: TransferEndpointInfo;
}

/** Kinds whose parent operation carries a counterparty/client label. */
const COUNTERPARTY_KINDS = new Set<MovementLinkKind>([
  'creditReceivedPrincipal',
  'creditReceivedAbono',
  'creditGrantedPrincipal',
  'creditGrantedAbono',
  'salePayment',
  'payableInitialPayment',
  'payableAbono',
]);

/** Kinds with a fixed template that never takes a name parameter. */
const PLAIN_KINDS = new Set<MovementLinkKind>(['opening', 'transfer']);

/**
 * i18n template key for a link kind; null when the kind is unknown
 * to this presentation layer (e.g. data written by a newer version).
 */
export function systemNoteTemplateKey(kind: string): string | null {
  if (PLAIN_KINDS.has(kind as MovementLinkKind)) return kind;
  if (COUNTERPARTY_KINDS.has(kind as MovementLinkKind)) return kind;
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
 *      Transfers additionally render directionally with the counterpart
 *      account name + its localized scope when `transferLegs` has an entry
 *      for `link.refId` (D3 remediation); plain template otherwise.
 *   3. undefined → caller falls back to the raw persisted note (historical
 *      rows) or an em dash.
 *
 * Returns undefined for non-system movements (caller shows manual note).
 */
export function deriveSystemNote(
  source: SystemNoteSource,
  t: TranslateFn,
  refLabels?: Record<string, string>,
  transferLegs?: Record<string, TransferLegsInfo>,
): string | undefined {
  if (!source.link || persistedNoteIsUserAuthored(source)) return undefined;

  const templateKey = systemNoteTemplateKey(source.link.kind);
  if (!templateKey) return undefined;

  if (templateKey === 'transfer') {
    return deriveTransferNote(source, t, transferLegs);
  }

  if (COUNTERPARTY_KINDS.has(templateKey as MovementLinkKind)) {
    const label = refLabels?.[source.link.refId];
    if (label && label.trim().length > 0) {
      return t(templateKey, { name: label });
    }
    return t(`${templateKey}Plain`);
  }

  return t(templateKey);
}

/**
 * Directional transfer note (D3 remediation): the leg whose account is the
 * rendered movement's account names the COUNTERPART account + its scope,
 * e.g. "Transferencia hacia Efectivo (Negocio)". Falls back to the plain
 * "own accounts" template when the transfer is unknown, the movement's
 * account matches neither endpoint, or the counterpart data is blank —
 * never showing a directional claim that cannot be backed by data.
 */
function deriveTransferNote(
  source: SystemNoteSource,
  t: TranslateFn,
  transferLegs?: Record<string, TransferLegsInfo>,
): string {
  const legs = source.link ? transferLegs?.[source.link.refId] : undefined;
  const accountId = source.accountId;
  if (!legs || !accountId) return t('transfer');

  let counterpart: TransferEndpointInfo;
  let templateKey: string;
  if (legs.origin.accountId === accountId) {
    counterpart = legs.destination;
    templateKey = 'transferTo';
  } else if (legs.destination.accountId === accountId) {
    counterpart = legs.origin;
    templateKey = 'transferFrom';
  } else {
    return t('transfer');
  }

  const name = counterpart.name.trim();
  if (name.length === 0) return t('transfer');

  const scopeLabel =
    counterpart.scope === 'Business' ? t('scopeBusiness') : t('scopePersonal');
  return t(templateKey, { name, scope: scopeLabel });
}
