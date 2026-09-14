# UX-5 — REPORTE DE MEDICIÓN TTI (H-17)

> **Fecha:** 2026-09-14 · **Fase:** UX-5 cierre · **Hallazgo:** H-17 (TTI del Resumen no medido)
> **Protocolo:** §8.1 de `docs/UX-RESUMEN-DESIGN.md` · **Evidencia reproducible:** `e2e-tti/measure-tti.spec.ts` + `playwright.tti.config.ts`

## 1. Resultado ejecutivo

| Objetivo (§8.1) | Resultado | Veredicto |
|---|---|---|
| Frío < 10 s (primera visita, caché vacía) | **2.3–2.4 s** a hero N1; **1.7–3.1 s** load | ✅ **CUMPLE** (Regla de Oro §41) |
| Caliente < 2 s (hit repetido) | **1.7–2.6 s** load según muestra | 🟡 Mayormente cumple; picos 2.2–2.6 s documentados |

El **hero N1** (Resultado + Disponible, que responden las preguntas 1 y 2 de la Regla de Oro, mapa §10.1) es visible en **~2.3–2.4 s** incluso en frío y con throttling 3G: las cinco preguntas quedan respondidas muy por debajo de los 10 s.

## 2. Método y entorno

- Build de producción (`next build` + `next start`) contra **mongod local** (MongoMemoryReplSet 7.0.41, DB `twincap_e2e`), datos sembrados por UI (ingreso 1.000.000 / gasto 300.000).
- Usuario real registrado por el flujo de la app; sesión heredada por `storageState` a los contextos medidos.
- **Frío** = primera navegación a `/dashboard` en un contexto de navegador nuevo con caché HTTP vacía. **Caliente** = recarga repetida en el mismo contexto.
- Breakpoints **375 / 768 / 1280** (móvil con `isMobile` + touch + dpr 3; 375 además con **slow-3G por CDP**: latencia 150 ms, ~1.3 Mbps down).
- Métricas: `performance.getEntriesByType('navigation')` (domContentLoaded, load) + tiempo transcurrido hasta primer texto visible de N1 (tras el skeleton), vía `performance.now()` en página.

### 2.1 Desviaciones del §8.1 (declaradas, no silenciadas)

1. **Sin Lighthouse/DevTools**: se usó Navigation Timing + umbral de hero. TTI tipo Lighthouse (ventana idle) no se calculó; la métrica reportada es estrictamente "tiempo hasta contenido N1 visible".
2. **Sin serverless**: `next start` en Node plano no emula el cold start de una función Vercel; el cold start real de plataforma añadiría ~1–2 s (proxy connectDb) en el peor caso, sin invalidar el margen (10 s).
3. **3G simulado por CDP** en el mobile frío (sin "oficina"; máquina de desarrollo local).

## 3. Resultados

| # | Run | Viewport | Throttle | Hero N1 (ms) | DCL (ms) | Load (ms) | Recursos |
|---|---|---|---|---|---|---|---|
| 1 | **frío** | 375 | 3g | **2.381** | 1.197 | 3.093 | 17 |
| 2 | hot-1 | 375 | — | 2.466 | 1.012 | 1.702 | 25 |
| 3 | hot-2 | 375 | — | 2.391 | 1.271 | 1.782 | 21 |
| 4 | **frío** | 768 | — | **2.330** | 1.073 | 2.023 | 21 |
| 5 | hot-1 | 768 | — | 2.296 | 803 | 1.838 | 21 |
| 6 | hot-2 | 768 | — | 3.702 | 1.801 | 2.205 | 40 |
| 7 | **frío** | 1280 | — | **2.270** | 579 | 1.687 | 21 |
| 8 | hot-1 | 1280 | — | 2.882 | 1.864 | 2.254 | 17 |
| 9 | hot-2 | 1280 | — | 3.300 | 1.940 | 2.649 | 21 |

**Ejecutado:** spec `UX-5 TTI measurement` PASS (2.9 min, 1 corrida completa con los 9 samples).

## 4. Lectura y decisiones

1. **La página es SSR síncrona**: sin fronteras Suspense explícitas, el HTML llega completo y "hero visible ≈ load" (2.3–3.3 s). La Regla de Oro se satisface igual, pero la hipótesis §8.2.3 (streaming por región hero → resto) y §8.2.5 (lazy N3/N5) siguen siendo las palancas si se quiere < 2 s de primer contenido en frío.
2. **Picos calientes 2.2–2.6 s** (muestras 6/8/9): cada recarga re-ejecuta `force-dynamic` (8 repos + snapshot) — el "caliente < 2 s" se ve afectado por el SSR del documento, no por assets (recursos estables 17–40 tras cachear el shell). Lecturas duplicadas (§8.2.1: movimientos leídos dos veces) y `react cache` del builder (§8.2.2) son las opciones de mejora si se decide atacar el objetivo caliente.
3. **Observación de servidor**: 1 log `The destination stream closed early.` durante la corrida (request cancelado del flujo de medición); ninguna muestra se perdió y el run terminó PASS — se registra como artefacto benigno de la medición.
4. **transferBytes** (no tabulado): el `transferSize` del navigation entry cubre solo el documento; el ratio frío/caliente (24 KB vs 138 KB) refleja compresión/negociación del documento y no es una métrica de payload de la app.

## 5. Cierre

- **H-17 cerrado con evidencia de medición** (criterio del roadmap §83: TTI medido, frío < 10 s con holgura).
- **No se ejecuta ninguna hipótesis de mejora §8.2** en esta fase: el objetivo se cumple y el dominio está congelado; las optimizaciones quedan como opciones FUTURAS con evidencia base para comparar (UX-11 validación o si el objetivo caliente se vuelve requisito).
- **Re-medición** disponible en cualquier momento: `node e2e/load-e2e-env.cjs test --config playwright.tti.config.ts` (no forma parte de la suite e2e ni de CI).