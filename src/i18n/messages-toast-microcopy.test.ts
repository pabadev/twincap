/**
 * H-08 toast success microcopy guard (R-3).
 *
 * The 30 Toast values in messages/es.json + en.json MUST follow the
 * verb+object microcopy pattern of the design system ("Movimiento guardado",
 * "Cuenta eliminada", "Venta registrada") — never the robotic
 * "...exitosamente" / "...successfully" pattern.
 *
 * Toast keys stay FROZEN: they double as analytics event codes
 * (core/application/ports.ts:228+), so only values may change and the
 * es/en keysets must remain byte-identical to the frozen 34-key list.
 * The 4 non-matching keys (creditMarkedAsPaid, creditWrittenOff,
 * operationFailed, unexpectedError) are deliberately covered by the key
 * list: the first two already are verb+object, the last two are error
 * messages and never match the success pattern.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type JsonTree = { [key: string]: string | JsonTree };

function loadMessages(relativePath: string): JsonTree {
  const filePath = fileURLToPath(new URL(relativePath, import.meta.url));
  return JSON.parse(readFileSync(filePath, "utf-8")) as JsonTree;
}

const FROZEN_TOAST_KEYS: string[] = [
  "clientCreated",
  "clientUpdated",
  "clientDeleted",
  "accountCreated",
  "accountUpdated",
  "accountDeleted",
  "initialBalanceSet",
  "categoryCreated",
  "categoryUpdated",
  "categoryDeleted",
  "movementCreated",
  "movementUpdated",
  "movementDeleted",
  "transferCreated",
  "transferUpdated",
  "transferDeleted",
  "creditCreated",
  "creditUpdated",
  "creditDeleted",
  "payableCreated",
  "payableUpdated",
  "payableDeleted",
  "abonoAdded",
  "abonoUpdated",
  "abonoDeleted",
  "creditMarkedAsPaid",
  "creditWrittenOff",
  "saleCreated",
  "saleDeleted",
  "catalogItemCreated",
  "catalogItemUpdated",
  "catalogItemDeleted",
  "operationFailed",
  "unexpectedError",
];

describe("H-08 toast success microcopy guard", () => {
  const es = loadMessages("../../messages/es.json");
  const en = loadMessages("../../messages/en.json");
  const esToast = es.Toast as Record<string, string>;
  const enToast = en.Toast as Record<string, string>;

  it("es/en Toast keysets both equal the frozen 34-key list (byte-identical)", () => {
    expect(Object.keys(esToast)).toEqual(FROZEN_TOAST_KEYS);
    expect(Object.keys(enToast)).toEqual(FROZEN_TOAST_KEYS);
  });

  it("no es Toast value matches /exitosamente/i", () => {
    const offenders = Object.entries(esToast)
      .filter(([, value]) => /exitosamente/i.test(value))
      .map(([key]) => key);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("no en Toast value matches /successfully/i", () => {
    const offenders = Object.entries(enToast)
      .filter(([, value]) => /successfully/i.test(value))
      .map(([key]) => key);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
