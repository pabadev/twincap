import type { IntentInterpreter } from "@/core/application/ports";
import {
  parseMovementDraftProposalV1,
  type MovementDraftProposalV1,
} from "@/core/domain/assistant/movement-draft-proposal-v1";

const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const REQUEST_TIMEOUT_MS = 20_000;

const PROPOSAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    intent: { type: "string", enum: ["create_movement", "unsupported"] },
    type: { type: ["string", "null"], enum: ["expense", "income", null] },
    amountText: { type: ["string", "null"] },
    note: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
    categoryHint: { type: ["string", "null"] },
    missingFields: {
      type: "array",
      items: {
        type: "string",
        enum: ["type", "amount", "account", "category", "context", "date"],
      },
    },
    clarification: { type: ["string", "null"] },
  },
  required: [
    "schemaVersion",
    "intent",
    "type",
    "amountText",
    "note",
    "date",
    "categoryHint",
    "missingFields",
    "clarification",
  ],
  additionalProperties: false,
} as const;

const SYSTEM_INSTRUCTION = [
  "Eres un extractor de operaciones financieras para una prueba sintética de TwinCap.",
  "Devuelve únicamente la propuesta JSON del esquema; nunca guardas operaciones ni llamas herramientas.",
  "Solo se admiten gastos simples Personales; ingresos, transferencias y otras operaciones son unsupported y type=null.",
  "amountText es un decimal canónico positivo en unidades mayores, como texto, sin separadores ni moneda; si falta o es ambiguo, usa null.",
  "No infieras moneda, cuenta, contexto, workspace, IDs, identidad ni datos que no estén en la frase.",
  "note debe ser una descripción breve. categoryHint debe ser exactamente una de las categorías permitidas que recibes, o null si ninguna corresponde; nunca inventes otra.",
  "date es YYYY-MM-DD solo si la frase menciona una fecha; resuelve fechas relativas usando la fecha de hoy indicada.",
  "missingFields solo puede contener type, amount, account, category, context o date.",
  "Si hace falta aclaración, escribe una pregunta breve; no agregues texto fuera del objeto JSON.",
].join(" ");

type GeminiResponse = {
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  outputs?: Array<{ type?: string; text?: string }>;
};

export type GeminiInterpreterErrorCode =
  | "invalid_key"
  | "rate_limited"
  | "temporarily_unavailable"
  | "provider_error"
  | "invalid_output"
  | "timeout";

export class GeminiIntentInterpreterError extends Error {
  constructor(
    readonly code: GeminiInterpreterErrorCode,
    readonly providerStatus?: number,
    readonly failureKind?: "network" | "incomplete_response" | `network_${string}`,
  ) {
    super(code);
    this.name = "GeminiIntentInterpreterError";
  }
}

export class GeminiIntentInterpreter implements IntentInterpreter {
  readonly providerId = "google-gemini";

  constructor(
    private readonly apiKey: string,
    readonly modelId: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async prepareMovementDraft(input: {
    text: string;
    locale: "es" | "en";
    today: string;
    availableCategories: string[];
    signal?: AbortSignal;
  }) {
    const startedAt = performance.now();
    let response: Response | null = null;
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = input.signal ? AbortSignal.any([input.signal, timeoutSignal]) : timeoutSignal;
    const requestInit: RequestInit = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify({
        model: this.modelId,
        input: [
          `Idioma: ${input.locale}. Fecha de hoy: ${input.today}.`,
          `Frase sintética: ${input.text}`,
          `Categorías permitidas para clasificar el gasto (solo etiquetas, sin contexto ni identificadores): ${JSON.stringify(input.availableCategories)}`,
        ].join(" "),
        system_instruction: SYSTEM_INSTRUCTION,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: PROPOSAL_JSON_SCHEMA,
        },
        generation_config: { temperature: 0, max_output_tokens: 220 },
        store: false,
      }),
      signal,
      cache: "no-store",
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await this.fetcher(GEMINI_INTERACTIONS_URL, requestInit);
      } catch (error) {
        if (
          timeoutSignal.aborted ||
          (error instanceof DOMException && error.name === "TimeoutError")
        ) {
          throw new GeminiIntentInterpreterError("timeout");
        }
        throw new GeminiIntentInterpreterError(
          "provider_error",
          undefined,
          `network_${getNetworkErrorCode(error)}`,
        );
      }

      if (response.status !== 503 || attempt === 1) break;
      try {
        await waitBeforeRetry(signal);
      } catch {
        if (timeoutSignal.aborted) throw new GeminiIntentInterpreterError("timeout");
        throw new GeminiIntentInterpreterError("provider_error", undefined, "network_unknown");
      }
    }

    if (!response) throw new GeminiIntentInterpreterError("provider_error");

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new GeminiIntentInterpreterError("invalid_key");
      }
      if (response.status === 429) {
        throw new GeminiIntentInterpreterError("rate_limited");
      }
      if (response.status === 503) {
        throw new GeminiIntentInterpreterError("temporarily_unavailable", response.status);
      }
      throw new GeminiIntentInterpreterError("provider_error", response.status);
    }

    const body = (await response.json()) as GeminiResponse;
    if (body.status && body.status !== "completed") {
      throw new GeminiIntentInterpreterError("provider_error", undefined, "incomplete_response");
    }

    const raw = extractOutputText(body);
    const proposal: MovementDraftProposalV1 | null = parseMovementDraftProposalV1(raw);
    if (!proposal) throw new GeminiIntentInterpreterError("invalid_output");

    return {
      proposal: normalizeProposal(input.text, input.today, input.availableCategories, proposal),
      raw,
      durationMs: performance.now() - startedAt,
    };
  }
}

async function waitBeforeRetry(signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, 600);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function getNetworkErrorCode(error: unknown) {
  let cause: unknown = error;
  for (let depth = 0; depth < 4 && cause && typeof cause === "object"; depth += 1) {
    const candidate = cause as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" && /^[A-Z0-9_]{1,40}$/.test(candidate.code)) {
      return candidate.code;
    }
    cause = candidate.cause;
  }
  return "unknown";
}

function normalizeProposal(
  text: string,
  today: string,
  availableCategories: string[],
  proposal: MovementDraftProposalV1,
) {
  if (proposal.intent === "unsupported") return proposal;

  const missingFields = new Set(proposal.missingFields);
  missingFields.add("account");
  missingFields.add("category");
  missingFields.add("context");
  if (proposal.amountText === null) missingFields.add("amount");

  const suggestedCategory = availableCategories.find(
    (category) => category.toLocaleLowerCase() === proposal.categoryHint?.toLocaleLowerCase(),
  );

  return {
    ...proposal,
    date: hasExplicitDateReference(text) ? proposal.date : today,
    categoryHint: suggestedCategory ?? null,
    missingFields: [...missingFields],
  };
}

function hasExplicitDateReference(text: string) {
  return (
    /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(text) ||
    /\b(today|yesterday|tomorrow|day before yesterday|hoy|ayer|mañana|anteayer)\b/i.test(text) ||
    /\b\d{1,2}\s+(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      text,
    )
  );
}

function extractOutputText(body: GeminiResponse) {
  const fromSteps = body.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .find((content) => content.type === "text")?.text;
  if (fromSteps) return fromSteps;

  return body.outputs?.find((output) => output.type === "text")?.text ?? "";
}
