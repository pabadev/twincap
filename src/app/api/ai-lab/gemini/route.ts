import { NextResponse } from "next/server";
import { EVALUATION_CASES } from "@/app/ai-lab/evaluation";
import {
  GeminiIntentInterpreter,
  GeminiIntentInterpreterError,
} from "@/infrastructure/ai/gemini/gemini-intent-interpreter";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const EVALUATION_TODAY = "2026-11-08";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  return NextResponse.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    modelId: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const testCase = EVALUATION_CASES.find((item) => item.id === input.caseId);
  if (!testCase || (input.locale !== "es" && input.locale !== "en")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const modelId = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const interpreter = new GeminiIntentInterpreter(process.env.GEMINI_API_KEY, modelId);
  try {
    const result = await interpreter.prepareMovementDraft({
      text: testCase.text,
      locale: input.locale,
      today: EVALUATION_TODAY,
      availableCategories: testCase.categories,
      signal: request.signal,
    });
    return NextResponse.json({
      providerId: interpreter.providerId,
      modelId,
      caseId: testCase.id,
      durationMs: result.durationMs,
      raw: result.raw,
      proposal: result.proposal,
    });
  } catch (error) {
    const status =
      error instanceof GeminiIntentInterpreterError && error.code === "rate_limited"
        ? 429
        : error instanceof GeminiIntentInterpreterError && error.code === "temporarily_unavailable"
          ? 503
          : error instanceof GeminiIntentInterpreterError && error.code === "invalid_key"
            ? 503
            : error instanceof GeminiIntentInterpreterError && error.code === "timeout"
              ? 504
              : 502;
    const diagnostic =
      error instanceof GeminiIntentInterpreterError
        ? error.code === "timeout"
          ? "request_timeout"
          : error.providerStatus
            ? `upstream_http_${error.providerStatus}`
            : error.failureKind || "provider_response"
        : "unexpected_error";
    return NextResponse.json(
      {
        error: error instanceof GeminiIntentInterpreterError ? error.code : "provider_error",
        diagnostic,
      },
      { status },
    );
  }
}
