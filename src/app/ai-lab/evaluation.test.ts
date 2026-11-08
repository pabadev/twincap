import { describe, expect, it } from "vitest";
import {
  compareProposal,
  EVALUATION_CASES,
  parseProposal,
  supportsWebGpuF16,
  type Proposal,
} from "./evaluation";

const validProposal: Proposal = {
  schemaVersion: 1,
  intent: "create_movement",
  type: "expense",
  amountText: "10000",
  note: "gasolina de la moto",
  date: "2026-11-08",
  categoryHint: "Moto",
  missingFields: ["account", "category", "context"],
  clarification: null,
};

describe("assistant lab proposal parsing", () => {
  it("requires WebGPU shader f16 support before offering the GPU path", () => {
    expect(supportsWebGpuF16({ has: (feature) => feature === "shader-f16" })).toBe(true);
    expect(supportsWebGpuF16({ has: () => false })).toBe(false);
    expect(supportsWebGpuF16(null)).toBe(false);
  });

  it("parses a valid proposal from surrounding model text", () => {
    expect(parseProposal(`\n${JSON.stringify(validProposal)}\n`)).toEqual(validProposal);
  });

  it("rejects unknown properties such as account IDs", () => {
    expect(parseProposal(JSON.stringify({ ...validProposal, accountId: "private-id" }))).toBeNull();
  });

  it("rejects non-canonical monetary amounts", () => {
    expect(parseProposal(JSON.stringify({ ...validProposal, amountText: "10.000" }))).toBeNull();
  });

  it("rejects income proposals because the local pilot only admits expenses", () => {
    expect(parseProposal(JSON.stringify({ ...validProposal, type: "income" }))).toBeNull();
  });

  it("compares only the expected extraction fields for an evaluation phrase", () => {
    expect(compareProposal(validProposal, EVALUATION_CASES[0])).toBe(true);
    expect(compareProposal({ ...validProposal, type: "income" }, EVALUATION_CASES[0])).toBe(false);
  });
});
