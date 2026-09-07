# H4 — Plan de lanzamiento de la Beta privada

> **Ronda 13, Fase H4.** Plan operativo para abrir TwinCap Beta 0.1 a 10–20 usuarios reales durante 30 días, medir, entrevistar y decidir qué viene después. Basado en la auditoría externa (§35–§39) y la Definition of Beta (`docs/definition-of-beta.md`).

---

## 1. Objetivo

**Validar el mercado, no construir más.** Las preguntas que la beta debe responder a los 30 días:

1. **Activation:** ¿el usuario registra movimientos reales?
2. **Retention:** ¿vuelve a los 7 días? ¿a los 30?
3. **Willingness to pay:** *"Si mañana TwinCap dejara de ser gratuito, ¿pagarías para seguir usándolo?"* y después *"¿cuánto pagarías?"* (auditoría §37).

---

## 2. Reclutamiento (mix objetivo — auditoría §35)

| Segmento | Cantidad | Perfil |
|----------|:--------:|--------|
| Finanzas personales | **5** | Personas que hoy usan Excel/notas para presupuestar |
| Pequeños negocios | **10** | Negocios con ingresos/gastos regulares, ventas a crédito |
| Negocios con POS | **5** | Negocios que venden productos con stock y cuentas por cobrar |
| **Total** | **20** | Rango objetivo 10–20; 20=techo, 10=mínimo viable |

**Fuentes de reclutamiento (orden sugerido):** red personal del fundador → negocios de barrio/zona → referidos de los primeros testers. Preferir usuarios con dolor visible (hoy usan cuadernos/Excel) sobre curiosos sin necesidad real.

---

## 3. Timeline (30 días)

| Día | Actividad |
|-----|-----------|
| **0** | Aviso de apertura + guía de bienvenida (1–2 min: qué es, cómo empezar, a quién escribir) |
| **1–3** | Acompañamiento de onboarding: primer login → creación de cuenta → primer movimiento (objetivo: evitar activation 0) |
| **7** | Check-in: ¿siguen usando? ¿qué les frena? (correlacionar con retention 7d del dashboard) |
| **14** | Mid-check: primeras features pedidas, bugs críticos, entrevistas cortas (15 min) |
| **21** | Recordatorio + segunda ronda de entrevistas; corregir bugs críticos si los hay |
| **30** | **Cierre**: entrevista final + pregunta de willingness to pay + encuesta post-beta (evento `returned`) |

---

## 4. Métricas a observar (dashboard `/analytics` + entrevistas)

**Medibles (automáticas):**

| Métrica | Definición | Umbral de alerta |
|---------|-----------|------------------|
| Activation | ≥3 movimientos en primeros 2 días | <40% → revisar onboarding |
| Retention 7d | Workspaces con actividad en últimos 7 días | <30% → revisar valor percibido |
| Retention 30d | Actividad en últimos 30 días | <20% → crítica |
| Usage | Movimientos por usuario | <10/mes → poco uso real |
| POS | Ventas por negocio | <5/mes → si el perfil es POS, falla el fit |
| Dashboard | Frecuencia de consulta | Sirve para priorizar features |
| Support | Problemas por usuario | >3 → fricción operativa |

**Cualitativas (entrevistas):**
- ¿Qué problema concreto resolvió? (si no sabe decirlo → no hay fit real)
- Top 3 features pedidas (esto "es oro" — auditoría §36).
- Bugs críticos que afectan cifras financieras (PRIORIDAD #1 sobre cualquier feature).
- **Willingness to pay** (§37) + precio razonable percibido.

---

## 5. Reglas de la beta (para el fundador)

1. **No añadir features indiscriminadamente** durante la beta (auditoría §38). Solo bugs críticos (cifras incorrectas, pérdida de datos, aislamiento roto) se corrigen en caliente.
2. **Un bug crítico se reporta con pasos + captura**: el usuario no investiga, vos sí.
3. **Los pedidos de features se registran** (feedback widget ya lo hace por email) y se priorizan al cierre.
4. **Las entrevistas son 15 min**, guiadas por las métricas reales del usuario (mirar su dashboard antes de llamar).
5. **Si un segmento no activa** (ej. POS), no insistir en "arreglar" el producto a ciegas: anotar la hipótesis y revisar en Fase 2.

---

## 6. Cierre de la beta (día 30+)

| Salida | Definición |
|--------|-----------|
| **Éxito** | ≥60% activation, ≥30% retention 7d, ≥50% de entrevistados con willingness to pay → planear monetización (Fase 5) |
| **Iterar** | Uso real pero sin willingness to pay → ajustar propuesta de valor/pricing, segunda mini-campaña |
| **Pivotar** | Sin use case claro ni retención → entrevistar a fondo antes de decidir Ronda 14 |

**Decisión de Ronda 14:** NO se planifica antes de tener los datos. La beta define el roadmap (features P1: comparación mensual, presupuestos, cashflow, onboarding — según lo que pidan los usuarios reales).

---

## 7. Checklist de pre-lanzamiento

- [ ] Definition of Beta cumplida (ver `docs/definition-of-beta.md`): backup/restore, legal, smoke test, H1 aprobado.
- [ ] `ANALYTICS_ENABLED=true` activo desde el día 0.
- [ ] Primeros 2–3 testers probados manualmente por el fundador antes de abrir al grupo completo.
- [ ] Plantilla de bienvenida + plantilla de entrevista listas.
- [ ] Canal de soporte (`/help` + email) probado de punta a punta.
- [x] **P0 (R14-G) — Contrato de índices de seguridad del monitor verificado en Atlas** (paso explícito del auditor 2026-09-07; NO es recomendación informal) — **EJECUTADO 2026-09-07:** `scripts/ensure-monitor-indexes.mjs --apply` (dry-run aprobado previamente por el usuario) materializó `monitorfingerprints` + `monitorcooldowns` y sus 4 índices ANTES de que `/api/monitor` reciba tráfico; `scripts/verify-monitor-indexes.mjs` confirmó `CONTRACT OK` (2 colecciones + 4 índices reales, directo contra Atlas, sin depender de Next.js/Mongoose); re-dry-run idempotente → 4× `[PASS] no-op`. En un deploy futuro, re-ejecutar siempre el verificador:
  ```bash
  node --env-file=.env.local scripts/verify-monitor-indexes.mjs
  ```
  Debe imprimir `CONTRACT OK — security indexes verified on production.` Detalle del contrato esperado:

  | Colección | Índice | Propiedad esperada | Garantía que aporta |
  |-----------|--------|--------------------|----------------------|
  | `monitorfingerprints` | `key_1` | unique sobre `{ key: 1 }` | Cupo por IP/window con E11000 → retry: dos requests concurrentes NO crean dos buckets para la misma IP+ventana |
  | `monitorfingerprints` | `expiresAt_1` | TTL `expireAfterSeconds: 0` | El estado de la ventana de 15 min desaparece solo |
  | `monitorcooldowns` | `key_1` | unique sobre `{ key: 1 }` | Singleton `monitor:global` no se duplica entre instancias |
  | `monitorcooldowns` | `expiresAt_1` | TTL `expireAfterSeconds: 0` | El cooldown global se limpia a los 10 min (extendido mientras está activo) |

  Regla: **si el script falla (missing/wrong property), el deploy NO se considera completo** — corregir índices antes de abrir el monitor a tráfico. Los índices viven en el cluster (persisten reinicios e instancias múltiples); una vez presentes, `unique` y TTL son garantías del servidor, no de la app.
  - [ ] Comportamiento post-reinicio: `monitorfingerprints`/`monitorcooldowns` siguen existiendo con los mismos índices (lo verifica el script en un segundo `--env-file` local o desde otra instancia).
  - [ ] Race condition concurrente: cubierta en CI por el suite §25-C del guard (40 fingerprints concurrentes → exactamente 30 admitidos; N concurrentes con el mismo fingerprint → exactamente 1 `isNew:true`).

### 7.1 Semántica temporal de `/api/monitor` (política de producto/seguridad, R14-G)

Los límites del monitor NO son números arbitrarios — son política de producto/seguridad a ajustar con datos reales del beta. Documentación de POR QUÉ (auditor 2026-09-07, P1):

| Límite | Valor | Razonamiento |
|--------|-------|--------------|
| Cupo por IP | **30 fingerprints únicos / 15 min** | Una app legítima genera pocos fingerprints nuevos por IP en 15 min (el mismo error repetido NO consume cupo — solo fingerprints NUEVOS). 30 da margen generoso a clientes reales y corta a un atacante que falsifica fingerprints para agotar logs/alertas. Multiplica el gate IP 120 req/15 min: un atacante puede llegar a 120 requests, pero solo 30 fingerprints únicos pasan. |
| Cooldown global | **>30 fingerprints NUEVOS / 5 min** | Detecta un ataque **distribuido** (varias IPs, cada una bajo su cupo): más de 30 fingerprints nunca vistos en todo el producto en 5 min es señal inequívoca de flooding. 5 min es la ventana de observación: suficiente para acumular señal, corta para no reaccionar tarde. |
| Duración del cooldown | **10 min** | Una vez detectado el flood, se apagan las nuevas fingerprints durante 10 min (2× la ventana de observación): tiempo de sobra para que el atacante se aburra y el operador mire los logs, sin castigar usuarios legítimos (el monitor solo escribe logs de error, no sirve datos de producción). |
| Throttle de alertas | **1 email / fingerprint / 30 min** | El email es el canal caro: si un error real se repite (p.ej. un endpoint roto que millones de requests golpean), el operador recibe UN email por fingerprint distinto por media hora — suficiente para enterarse, imposible de spamear. Los errores repetidos del MISMO fingerprint no re-alertan (solo `isFirst` al crear el doc). |

**Regla de ajuste:** estos valores se revisan al cierre del beta con datos reales (métricas §4). Si un usuario legítimo toca el límite (falso positivo), se sube `MAX_FINGERPRINTS_PER_IP` o `GLOBAL_COOLDOWN_THRESHOLD`; si un ataque lo esquiva, se baja. Fuente: `src/infrastructure/monitoring/monitor-guard.ts` (constantes exportadas + tests).

---

## 8. CI sobre `master` y branch protection (R14-J)

**Qué se corrigió (2026-09-07):** el workflow `.github/workflows/ci.yml` disparaba en push a `main` (rama inexistente — el repo usa `master`), por lo que los checks de CI **nunca corrieron en el deploy de producción**. Fase J: trigger `[master]` + `npx` → `pnpm exec playwright install --with-deps chromium` (regla pnpm-only del proyecto). **Segundo fix al correr el CI por primera vez:** los jobs instalaban Node 20, incompatible con pnpm 11.22.0 (requiere Node ≥ 22.13; `node:sqlite` no existe en Node 20) → `node-version: 24` en ambos jobs (coherente con el dev local). **Tercer fix:** el typecheck fallaba en CI con `Cannot find name 'LayoutProps'` — el job corría `tsc --noEmit` sin `.next/types` (generados solo por build o `next typegen`); se añadió `pnpm exec next typegen` antes del typecheck. **Cuarto fix:** el job E2E fallaba por `Missing env file: .env.e2e` (archivo git-ignored) → el job declara MONGODB_URI placeholder local/AUTH_SECRET/NEXT_LOCALE y genera `.env.e2e` antes de la suite. **Quinto fix (deuda de Fase E):** el webServer `next start` corre en `NODE_ENV=production` y `env.ts` exige `RESEND_API_KEY`/`RESEND_FROM`/`APP_BASE_URL` desde R14-E; el E2E fallaba con `Invalid environment configuration` en cada request (suite entera en timeout). El E2E nunca envía emails reales (envío best-effort con log), así que `.env.e2e` (local + CI) gana placeholders de prueba que pasan la validación.

**Branch protection requerida en GitHub** (Settings → Branches → `master` — auditoría P1.9). Requisito mínimo antes de abrir la beta:

- **Require status checks to pass before merging** (nuevos PRs) y **require branches to be up to date** — con los checks `quality` y `e2e` del workflow CI.
- **Block force pushes** y **block deletions**.
- Require pull request before merging + required approvals **NO aplican**: el fundador es el único mantenedor y el flujo actual es push directo a `master` (dispara el deploy Vercel). Se documenta como decisión explícita para que un futuro mantenedor la revise, no como omisión.

**Nota de orden CI/deploy:** el push a `master` dispara CI y Vercel en paralelo: el deploy puede estar vivo ANTES de que terminen los checks. Por eso el smoke test (§9) corre después del deploy y el criterio de aceptación de cada release es: CI verde **o** smoke test §9 pasado — si CI falla después del deploy, se corrige en caliente o se revierte; un cambio no debe considerarse "liberado" hasta que una de las dos verificaciones confirmó.

---

## 9. Smoke test post-deploy (P0.7 — después de CADA deploy)

La auditoría P0.7 exige smoke test real después de cada deployment, no documental. Al terminar cada deploy de producción, el fundador ejecuta esta checklist (5–10 min) contra `https://twincap.vercel.app` (dominio actual de producción; **usar una pestaña de incógnito para no heredar sesión**):

- [ ] `/login` responde 200 y renderiza el formulario.
- [ ] Login real con cuenta de tester funciona y redirige a `/dashboard` sin errores visibles.
- [ ] Dashboard carga movimientos del workspace de prueba (datos reales, no vacío).
- [ ] Alta de movimiento (ingreso y gasto) funciona de punta a punta y el dashboard actualiza el balance.
- [ ] `/help`, `/privacy` y `/terms` responden 200.
- [ ] Índices en Atlas intactos: `node --env-file=.env.local scripts/verify-dashboard-indexes.mjs` → `CONTRACT OK` y `node --env-file=.env.local scripts/verify-monitor-indexes.mjs` → `CONTRACT OK` (los índices viven en el cluster y no deberían cambiar con un deploy, pero el verificador es la prueba de que el contrato sigue).
- [ ] `/api/monitor` no reporta errores en Vercel (Logs) tras las acciones anteriores.
- [ ] `ANALYTICS_ENABLED=true` y `ANALYTICS_EXCLUDE_EMAILS` correctos en Vercel (si aplica a este deploy).

Si cualquier paso falla, el deploy NO está completo: resolver antes de considerar el release cerrado.

---

*Documento vivo. Última actualización: 2026-09-07 (R14-J: branch protection + smoke test P0.7, CI sobre master).*