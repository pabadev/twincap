export type ModelDevice = "webgpu" | "wasm";

import { parseMovementDraftProposalV1 } from "@/core/domain/assistant/movement-draft-proposal-v1";
import type { MovementDraftProposalV1 } from "@/core/domain/assistant/movement-draft-proposal-v1";

export { parseMovementDraftProposalV1 as parseProposal };
export type Proposal = MovementDraftProposalV1;

export interface AssistantModel {
  id: string;
  label: string;
  revision: string;
  q4f16Size: string;
  q4Size: string;
}

export const MODELS: AssistantModel[] = [
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    label: "Qwen3 0.6B",
    revision: "a7b503b1c3f7e98e8f80b6d565f47807a5007d9c",
    q4f16Size: "570 MB",
    q4Size: "919 MB",
  },
  {
    id: "onnx-community/Qwen2.5-0.5B-Instruct-ONNX",
    label: "Qwen2.5 0.5B Instruct",
    revision: "4b32b4541cf2de9d0c0a85125e8fe8d9943f7982",
    q4f16Size: "483 MB",
    q4Size: "786 MB",
  },
];

export interface EvaluationCase {
  id: string;
  label: string;
  text: string;
  categories: string[];
  expected: Partial<Pick<Proposal, "intent" | "type" | "amountText" | "date" | "categoryHint">>;
}

export const EVALUATION_CASES: EvaluationCase[] = [
  {
    id: "expense-gas-10k",
    label: "Gasto: gasolina, 10 mil",
    text: "Gasté 10 mil en gasolina de la moto",
    categories: ["Moto", "Transporte", "Combustible"],
    expected: {
      intent: "create_movement",
      type: "expense",
      amountText: "10000",
      date: "2026-11-08",
      categoryHint: "Moto",
    },
  },
  {
    id: "expense-repair-24500",
    label: "Gasto: reparación, 24.500",
    text: "Pagué 24.500 por la reparación de la moto",
    categories: ["Moto", "Transporte", "Mantenimiento"],
    expected: { intent: "create_movement", type: "expense", amountText: "24500" },
  },
  {
    id: "unsupported-income",
    label: "Operación fuera de alcance: ingreso",
    text: "Recibí 180000 por una asesoría",
    categories: ["Servicios", "Otros"],
    expected: { intent: "unsupported" },
  },
  {
    id: "expense-yesterday-12k",
    label: "Gasto: fecha relativa, ayer",
    text: "Ayer gasté 12 mil en parqueadero",
    categories: ["Moto", "Transporte", "Parqueadero"],
    expected: {
      intent: "create_movement",
      type: "expense",
      amountText: "12000",
      date: "2026-11-07",
    },
  },
  {
    id: "missing-amount",
    label: "Falta el importe",
    text: "Anota un gasto de gasolina",
    categories: ["Moto", "Transporte", "Combustible"],
    expected: { intent: "create_movement", type: "expense", amountText: null },
  },
  {
    id: "unsupported-transfer",
    label: "Operación fuera de alcance: transferencia",
    text: "Pasé 30.000 de mis ahorros a mi cuenta corriente",
    categories: ["Ahorro", "Otros"],
    expected: { intent: "unsupported" },
  },
];

export function compareProposal(proposal: Proposal, testCase: EvaluationCase) {
  return Object.entries(testCase.expected).every(
    ([key, expected]) => proposal[key as keyof Proposal] === expected,
  );
}

export function supportsWebGpuF16(features: { has: (feature: string) => boolean } | null) {
  return features?.has("shader-f16") ?? false;
}
