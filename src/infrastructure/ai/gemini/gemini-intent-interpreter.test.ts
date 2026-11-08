import { describe, expect, it, vi } from "vitest";
import { GeminiIntentInterpreter, GeminiIntentInterpreterError } from "./gemini-intent-interpreter";

const proposal = {
  schemaVersion: 1,
  intent: "create_movement",
  type: "expense",
  amountText: "10000",
  note: "gasolina de la moto",
  date: null,
  categoryHint: "moto",
  missingFields: ["account", "category", "context"],
  clarification: null,
};

describe("GeminiIntentInterpreter", () => {
  it("sends server-side structured output without provider storage", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        status: "completed",
        steps: [
          { type: "model_output", content: [{ type: "text", text: JSON.stringify(proposal) }] },
        ],
      }),
    );
    const interpreter = new GeminiIntentInterpreter("server-only-key", "gemini-test", fetcher);

    const result = await interpreter.prepareMovementDraft({
      text: "Gasté 10 mil en gasolina de la moto",
      locale: "es",
      today: "2026-11-08",
      availableCategories: ["Moto", "Transporte"],
    });

    expect(result.proposal).toEqual({
      ...proposal,
      date: "2026-11-08",
      categoryHint: "Moto",
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain("/v1beta/interactions");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("server-only-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "gemini-test",
      store: false,
      response_format: { mime_type: "application/json" },
    });
    expect(JSON.parse(String(init?.body)).input).toContain('["Moto","Transporte"]');
    expect(result.proposal.categoryHint).toBe("Moto");
  });

  it("rejects output containing untrusted financial identifiers", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [
              { type: "text", text: JSON.stringify({ ...proposal, accountId: "secret-id" }) },
            ],
          },
        ],
      }),
    );
    const interpreter = new GeminiIntentInterpreter("key", "model", fetcher);

    await expect(
      interpreter.prepareMovementDraft({
        text: "test",
        locale: "es",
        today: "2026-11-08",
        availableCategories: [],
      }),
    ).rejects.toMatchObject({
      code: "invalid_output",
    } satisfies Partial<GeminiIntentInterpreterError>);
  });

  it("retries once on temporary service overload", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: JSON.stringify(proposal) }],
            },
          ],
        }),
      );
    const interpreter = new GeminiIntentInterpreter("key", "model", fetcher);

    const result = await interpreter.prepareMovementDraft({
      text: "Gasté 10 mil en gasolina de la moto",
      locale: "es",
      today: "2026-11-08",
      availableCategories: ["Moto", "Transporte"],
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.proposal.categoryHint).toBe("Moto");
  });

  it("reports sustained 503 responses as temporary unavailability, not a quota limit", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const interpreter = new GeminiIntentInterpreter("key", "model", fetcher);

    await expect(
      interpreter.prepareMovementDraft({
        text: "test",
        locale: "es",
        today: "2026-11-08",
        availableCategories: [],
      }),
    ).rejects.toMatchObject({ code: "temporarily_unavailable", providerStatus: 503 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("defaults the date to today, resolves category case-insensitively, and restores required fields", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "text",
                text: JSON.stringify({ ...proposal, date: "2026-11-08", missingFields: [] }),
              },
            ],
          },
        ],
      }),
    );
    const interpreter = new GeminiIntentInterpreter("key", "model", fetcher);

    const result = await interpreter.prepareMovementDraft({
      text: "Gasté 10 mil en gasolina de la moto",
      locale: "es",
      today: "2026-11-08",
      availableCategories: ["Moto", "Transporte"],
    });

    expect(result.proposal.date).toBe("2026-11-08");
    expect(result.proposal.categoryHint).toBe("Moto");
    expect(result.proposal.missingFields).toEqual(["account", "category", "context"]);
  });

  it("maps rate limits without exposing provider response text", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private provider details", { status: 429 }));
    const interpreter = new GeminiIntentInterpreter("key", "model", fetcher);

    await expect(
      interpreter.prepareMovementDraft({
        text: "test",
        locale: "es",
        today: "2026-11-08",
        availableCategories: [],
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});
