"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { useLocale, useT } from "../../i18n/client";
import {
  compareProposal,
  parseProposal,
  type AssistantModel,
  type EvaluationCase,
  type ModelDevice,
  type Proposal,
  EVALUATION_CASES,
  MODELS,
  supportsWebGpuF16,
} from "./evaluation";

type WorkerResponse =
  | { type: "progress"; loaded: number; total: number; file: string }
  | { type: "loaded"; loadMs: number; device: ModelDevice; modelId: string }
  | { type: "result"; raw: string; inferenceMs: number }
  | { type: "error"; message: string };

type WebGpuStatus = "checking" | "available" | "unavailable" | "missing-f16";

export function AssistantLab() {
  const t = useT("AssistantLab");
  const locale = useLocale();
  const workerRef = useRef<Worker | null>(null);
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [device, setDevice] = useState<ModelDevice>("wasm");
  const [webGpuStatus, setWebGpuStatus] = useState<WebGpuStatus>("checking");
  const webGpuAvailable = webGpuStatus === "available";
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [acceptedWasmDownload, setAcceptedWasmDownload] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0, file: "" });
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [input, setInput] = useState(EVALUATION_CASES[0].text);
  const [rawOutput, setRawOutput] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<string[]>([]);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [geminiModel, setGeminiModel] = useState("");
  const [geminiCaseId, setGeminiCaseId] = useState(EVALUATION_CASES[0].id);
  const [geminiRunning, setGeminiRunning] = useState(false);
  const [geminiError, setGeminiError] = useState("");
  const [geminiResult, setGeminiResult] = useState<{
    proposal: Proposal;
    raw: string;
    durationMs: number;
  } | null>(null);

  const selectedModel = MODELS.find((model) => model.id === modelId) ?? MODELS[0];

  useEffect(() => {
    let active = true;
    const browserNavigator = navigator as Navigator & {
      gpu?: {
        requestAdapter: () => Promise<{
          features: { has: (feature: string) => boolean };
        } | null>;
      };
    };
    if (!window.isSecureContext || !browserNavigator.gpu) {
      setWebGpuStatus("unavailable");
      return;
    }

    browserNavigator.gpu
      .requestAdapter()
      .then((adapter) => {
        if (active) {
          if (!adapter) {
            setWebGpuStatus("unavailable");
            return;
          }

          const supportsF16 = supportsWebGpuF16(adapter.features);
          setWebGpuStatus(supportsF16 ? "available" : "missing-f16");
          setDevice(supportsF16 ? "webgpu" : "wasm");
        }
      })
      .catch(() => {
        if (active) {
          setWebGpuStatus("unavailable");
          setDevice("wasm");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetch("/api/ai-lab/gemini")
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result) {
          setGeminiConfigured(result.configured);
          setGeminiModel(result.modelId);
        }
      })
      .catch(() => setGeminiError(t("geminiStatusError")));
  }, [t]);

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const stopWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsLoading(false);
    setIsRunning(false);
    setIsReady(false);
  };

  const ensureWorker = () => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./transformers.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        setLoadProgress({
          loaded: message.loaded,
          total: message.total,
          file: message.file,
        });
      } else if (message.type === "loaded") {
        setIsLoading(false);
        setIsReady(true);
        setLoadMs(message.loadMs);
        setDevice(message.device);
      } else if (message.type === "result") {
        setIsRunning(false);
        setRawOutput(message.raw);
        setInferenceMs(message.inferenceMs);
        const parsed = parseProposal(message.raw);
        setProposal(parsed);
        if (!parsed) setError(t("invalidOutput"));
      } else {
        setIsLoading(false);
        setIsRunning(false);
        setError(message.message);
      }
    };
    worker.onerror = () => {
      setIsLoading(false);
      setIsRunning(false);
      setError(t("workerError"));
    };
    workerRef.current = worker;
    return worker;
  };

  const loadModel = () => {
    stopWorker();
    setError("");
    setRawOutput("");
    setProposal(null);
    setLoadProgress({ loaded: 0, total: 0, file: "" });
    setLoadMs(null);
    setInferenceMs(null);
    setIsLoading(true);
    const worker = ensureWorker();
    worker.postMessage({
      type: "load",
      modelId,
      revision: selectedModel.revision,
      device,
      locale,
    });
  };

  const runPrompt = () => {
    if (!isReady || isRunning || !input.trim()) return;
    setError("");
    setRawOutput("");
    setProposal(null);
    setIsRunning(true);
    ensureWorker().postMessage({
      type: "generate",
      text: input.trim(),
      today: "2026-11-08",
      locale,
      availableCategories: [
        ...new Set(EVALUATION_CASES.flatMap((testCase) => testCase.categories)),
      ],
    });
  };

  const runCase = (testCase: EvaluationCase) => {
    setInput(testCase.text);
    setError("");
    setRawOutput("");
    setProposal(null);
    if (!isReady || isRunning) return;
    setIsRunning(true);
    ensureWorker().postMessage({
      type: "generate",
      text: testCase.text,
      today: "2026-11-08",
      locale,
      availableCategories: testCase.categories,
    });
  };

  const recordEvaluation = () => {
    if (!proposal) return;
    const testCase = EVALUATION_CASES.find((item) => item.text === input);
    if (!testCase) {
      setError(t("notEvaluationPhrase"));
      return;
    }
    setEvaluation((current) => [
      `${testCase.id}: ${compareProposal(proposal, testCase) ? t("pass") : t("fail")}`,
      ...current.filter((item) => !item.startsWith(`${testCase.id}:`)),
    ]);
  };

  const runGeminiCase = async () => {
    setGeminiRunning(true);
    setGeminiError("");
    setGeminiResult(null);
    try {
      const response = await fetch("/api/ai-lab/gemini", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: geminiCaseId, locale: locale === "en" ? "en" : "es" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "provider_error");
      setGeminiResult(result);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "provider_error";
      setGeminiError(t(`geminiError_${code}`));
    } finally {
      setGeminiRunning(false);
    }
  };

  const progressPercent =
    loadProgress.total > 0
      ? Math.min(100, Math.round((loadProgress.loaded / loadProgress.total) * 100))
      : 0;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-zinc-900 dark:text-white">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("eyebrow")}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("intro")}</p>
      </header>

      <section className="space-y-4 rounded-xl border border-surface-border bg-surface-card p-4">
        <h2 className="font-semibold">{t("modelHeading")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODELS.map((model) => (
            <label
              key={model.id}
              className={`cursor-pointer rounded-lg border p-3 ${
                modelId === model.id
                  ? "border-primary ring-1 ring-primary"
                  : "border-surface-border"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="model"
                value={model.id}
                checked={modelId === model.id}
                disabled={isLoading || isRunning}
                onChange={() => {
                  stopWorker();
                  setModelId(model.id);
                  setAcceptedWasmDownload(false);
                  setEvaluation([]);
                  setError("");
                }}
              />
              <span className="block font-medium">{model.label}</span>
              <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
                {t("downloadSize", { size: model.q4f16Size })}
              </span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="device"
              value="webgpu"
              checked={device === "webgpu"}
              disabled={isLoading || isRunning || !webGpuAvailable}
              onChange={() => {
                stopWorker();
                setDevice("webgpu");
                setAcceptedWasmDownload(false);
                setError("");
              }}
            />
            {t("webgpu")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="device"
              value="wasm"
              checked={device === "wasm"}
              disabled={isLoading || isRunning}
              onChange={() => {
                stopWorker();
                setDevice("wasm");
                setAcceptedWasmDownload(false);
                setError("");
              }}
            />
            {t("wasm")}
          </label>
          <span className="text-xs text-zinc-600 dark:text-zinc-400" role="status">
            {t(
              webGpuStatus === "available"
                ? "webgpuAvailable"
                : webGpuStatus === "missing-f16"
                  ? "webgpuMissingF16"
                  : webGpuStatus === "checking"
                    ? "webgpuChecking"
                    : "webgpuUnavailable",
            )}
          </span>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {device === "webgpu"
            ? t("webgpuDownloadNotice", { size: selectedModel.q4f16Size })
            : t("wasmDownloadNotice", { size: selectedModel.q4Size })}
        </p>

        {device === "wasm" && (
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={acceptedWasmDownload}
              disabled={isLoading || isRunning || isReady}
              onChange={(event) => setAcceptedWasmDownload(event.target.checked)}
            />
            <span>{t("wasmDownloadConsent", { size: selectedModel.q4Size })}</span>
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={loadModel}
            disabled={
              isLoading ||
              isRunning ||
              webGpuStatus === "checking" ||
              (device === "wasm" && !acceptedWasmDownload)
            }
          >
            {isReady ? t("reloadModel") : t("loadModel")}
          </Button>
          {(isLoading || isRunning) && (
            <Button variant="secondary" onClick={stopWorker}>
              {t("cancel")}
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-1" aria-live="polite">
            <div className="flex justify-between text-xs">
              <span>{loadProgress.file || t("preparing")}</span>
              <span>
                {progressPercent}% · {formatBytes(loadProgress.loaded)} /{" "}
                {formatBytes(loadProgress.total)}
              </span>
            </div>
            <progress className="h-2 w-full accent-primary" value={progressPercent} max={100} />
          </div>
        )}

        {isReady && loadMs !== null && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("readyMetrics", {
              seconds: (loadMs / 1000).toFixed(1),
              device: device.toUpperCase(),
            })}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-surface-border bg-surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t("phraseHeading")}</h2>
          <label className="text-sm">
            <span className="sr-only">{t("testPhrase")}</span>
            <select
              className="rounded-md border border-surface-border bg-surface-input px-3 py-2"
              defaultValue=""
              onChange={(event) => {
                const testCase = EVALUATION_CASES.find((item) => item.id === event.target.value);
                if (testCase) runCase(testCase);
                event.currentTarget.value = "";
              }}
            >
              <option value="">{t("choosePhrase")}</option>
              {EVALUATION_CASES.map((testCase) => (
                <option key={testCase.id} value={testCase.id}>
                  {testCase.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          className="min-h-24 w-full rounded-md border border-surface-border bg-surface-input p-3 text-sm"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("phrasePlaceholder")}
          aria-label={t("phraseHeading")}
          maxLength={500}
        />
        <Button onClick={runPrompt} disabled={!isReady || isRunning || !input.trim()}>
          {isRunning ? t("running") : t("analyze")}
        </Button>
        {inferenceMs !== null && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("inferenceMetrics", { seconds: (inferenceMs / 1000).toFixed(2) })}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        {proposal && (
          <div className="space-y-2 rounded-lg border border-surface-border p-3">
            <h3 className="font-medium">{t("parsedHeading")}</h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt>{t("intent")}</dt>
              <dd>{proposal.intent}</dd>
              <dt>{t("type")}</dt>
              <dd>{proposal.type ?? "—"}</dd>
              <dt>{t("amount")}</dt>
              <dd>{proposal.amountText ?? "—"}</dd>
              <dt>{t("note")}</dt>
              <dd>{proposal.note ?? "—"}</dd>
              <dt>{t("categoryHint")}</dt>
              <dd>{proposal.categoryHint ?? "—"}</dd>
              <dt>{t("date")}</dt>
              <dd>{proposal.date ?? "—"}</dd>
              <dt>{t("missingFields")}</dt>
              <dd>{proposal.missingFields.join(", ") || "—"}</dd>
              <dt>{t("clarification")}</dt>
              <dd>{proposal.clarification ?? "—"}</dd>
            </dl>
            <Button variant="secondary" size="sm" onClick={recordEvaluation}>
              {t("recordEvaluation")}
            </Button>
          </div>
        )}
        {rawOutput && (
          <details>
            <summary className="cursor-pointer text-sm">{t("rawOutput")}</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-3 text-xs dark:bg-white/5">
              {rawOutput}
            </pre>
          </details>
        )}
        {evaluation.length > 0 && (
          <ul className="space-y-1 text-sm" aria-live="polite">
            {evaluation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-surface-border bg-surface-card p-4">
        <div>
          <h2 className="font-semibold">{t("geminiHeading")}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {t("geminiModel", { model: geminiModel || "Gemini" })}
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span>{t("testPhrase")}</span>
          <select
            className="w-full rounded-md border border-surface-border bg-surface-input px-3 py-2"
            value={geminiCaseId}
            onChange={(event) => setGeminiCaseId(event.target.value)}
          >
            {EVALUATION_CASES.map((testCase) => (
              <option key={testCase.id} value={testCase.id}>
                {testCase.label}
              </option>
            ))}
          </select>
        </label>
        <p className="rounded-md bg-warning/10 p-3 text-sm">{t("geminiPrivacyNotice")}</p>
        {!geminiConfigured && <p className="text-sm">{t("geminiMissingKey")}</p>}
        <Button onClick={runGeminiCase} disabled={!geminiConfigured || geminiRunning}>
          {geminiRunning ? t("running") : t("geminiAnalyze")}
        </Button>
        {geminiError && (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {geminiError}
          </p>
        )}
        {geminiResult && (
          <div className="space-y-2 rounded-lg border border-surface-border p-3">
            <p className="text-sm">
              {t("geminiMetrics", { seconds: (geminiResult.durationMs / 1000).toFixed(2) })}
            </p>
            <p className="text-sm" role="status">
              {t(
                compareProposal(
                  geminiResult.proposal,
                  EVALUATION_CASES.find((item) => item.id === geminiCaseId)!,
                )
                  ? "pass"
                  : "fail",
              )}
            </p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-3 text-xs dark:bg-white/5">
              {JSON.stringify(geminiResult.proposal, null, 2)}
            </pre>
            <details>
              <summary className="cursor-pointer text-sm">{t("rawOutput")}</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/5 p-3 text-xs dark:bg-white/5">
                {geminiResult.raw}
              </pre>
            </details>
          </div>
        )}
      </section>

      <aside className="rounded-lg bg-surface-card p-3 text-xs text-zinc-600 dark:text-zinc-400">
        {t("privacyNotice")}
      </aside>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
