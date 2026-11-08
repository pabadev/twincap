import type { ModelDevice } from "./evaluation";

type WorkerRequest =
  | {
      type: "load";
      modelId: string;
      revision: string;
      device: ModelDevice;
      locale: string;
    }
  | {
      type: "generate";
      text: string;
      today: string;
      locale: string;
      availableCategories: string[];
    };

type ChatMessage = { role: "system" | "user"; content: string };
type Generator = (
  messages: ChatMessage[],
  options: { max_new_tokens: number; do_sample: boolean },
) => Promise<
  Array<{
    generated_text: string | Array<{ role: string; content: string }>;
  }>
>;

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};
let generator: Generator | null = null;

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    if (event.data.type === "load") {
      const startedAt = performance.now();
      const { pipeline } = await import("@huggingface/transformers");
      const dtype = event.data.device === "webgpu" ? "q4f16" : "q4";
      const loaded = await pipeline("text-generation", event.data.modelId, {
        revision: event.data.revision,
        device: event.data.device,
        dtype,
        progress_callback: (progress) => {
          if (progress.status === "progress_total") {
            workerScope.postMessage({
              type: "progress",
              loaded: progress.loaded,
              total: progress.total,
              file: progress.name,
            });
          }
        },
      });
      generator = loaded as unknown as Generator;
      workerScope.postMessage({
        type: "loaded",
        loadMs: performance.now() - startedAt,
        device: event.data.device,
        modelId: event.data.modelId,
      });
      return;
    }

    if (!generator) throw new Error("Load a model before generating a proposal.");

    const startedAt = performance.now();
    const output = await generator(
      [
        {
          role: "system",
          content: [
            "Eres un extractor de operaciones financieras para una prueba local de TwinCap.",
            "No eres asesor financiero y no escribes en ninguna base de datos.",
            "Devuelve exclusivamente un objeto JSON válido con las claves exactas:",
            "schemaVersion, intent, type, amountText, note, date, categoryHint, missingFields, clarification.",
            'schemaVersion siempre es 1; intent es "create_movement" o "unsupported"; type es "expense", "income" o null.',
            "amountText es un decimal canónico en unidades mayores, como texto, sin separadores ni moneda; si falta o es ambiguo, usa null.",
            "note debe conservar una descripción breve basada solo en la frase. categoryHint debe coincidir con una etiqueta de la lista permitida o ser null.",
            "date debe ser YYYY-MM-DD; si no se menciona fecha, usa la fecha de hoy indicada. Resuelve fechas relativas desde esa fecha.",
            'missingFields es un arreglo de claves entre "type", "amount", "account", "category", "context", "date"; no inventes cuentas ni IDs.',
            "Esta prueba solo admite gastos simples Personales. Ingresos, transferencias y otras operaciones usan intent=unsupported y type=null.",
            "No infieras moneda, cuenta, contexto, workspace, IDs, identidad ni datos no presentes. Nunca uses la categoría para decidir el contexto.",
            "Si hace falta aclaración, llena clarification con una pregunta corta; no agregues texto fuera del JSON.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Idioma: ${event.data.locale}. Fecha de hoy: ${event.data.today}. Frase: ${event.data.text}. Categorías permitidas (solo etiquetas, sin IDs ni contexto): ${JSON.stringify(event.data.availableCategories)}`,
        },
      ],
      { max_new_tokens: 220, do_sample: false },
    );
    const generated = output[0]?.generated_text;
    const raw = typeof generated === "string" ? generated : (generated?.at(-1)?.content ?? "");
    workerScope.postMessage({
      type: "result",
      raw,
      inferenceMs: performance.now() - startedAt,
    });
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown model error",
    });
  }
};
