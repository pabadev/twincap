# Definition of Beta — TwinCap Beta 0.1 (Private Beta)

> **Ronda 13, Fase H2.** Definición operativa de qué significa "estar listo para la beta privada". Basada en la auditoría externa (`docs/Auditoría Pre-Beta ChatGPT.md`, §28–§42) y en el estado real del producto al cierre de R13.
>
> **Filosofía (auditoría §38):** la beta NO es "construir más", es **validar el mercado con usuarios reales**. El núcleo del producto está técnicamente maduro; lo que falta es que 10–20 usuarios reales decidan qué viene después.

---

## 1. Criterio de salida (Definition of Done de la beta)

La beta privada está **lista para abrir** cuando se cumplen TODOS estos grupos:

### Grupo A — Producto operativo (BASE, ya cumplido por Rondas previas)
- [x] **Auth completa**: registro, login, logout, recuperación de contraseña, verificación de email.
- [x] **Núcleo financiero**: dashboard, cuentas + saldo inicial, movimientos (ingreso/gasto), transferencias internas.
- [x] **Créditos y obligaciones**: créditos recibidos, créditos otorgados (amortización capital/interés), payables, ventas a crédito.
- [x] **POS**: clientes, catálogo, ventas con stock, abonos y cuentas por cobrar.
- [x] **Multiusuario estructural**: Workspace + Membership (aislamiento por `workspaceId`).
- [x] **i18n es/en, responsive móvil/tablet/desktop, PWA.**
- [x] **Multi-moneda** (COP, USD, MXN, EUR).

### Grupo B — Capa de producción (Quality)
- [x] **CI automática** (GitHub Actions: typecheck, lint, tests, build, E2E).
- [x] **Error monitoring + alertas** (fail-safe, sin PII, dedupe por fingerprint).
- [x] **Recuperación de cuenta + verificación de email** (tokens one-time, rate-limited).
- [x] **Soporte + feedback en producto** (página `/help`, widget de feedback → email).
- [x] **Analítica de producto** (activation/retention/usage, sin PII, acceso solo founder).
- [x] **Exportación CSV** (movimientos y ventas).
- [x] **Backup + restore probado** (P0-c CERRADO — `docs/BACKUP-RESTORE-RUNBOOK.md` evidencia 2026-09-07, backup `2026-09-07-214359`: 22/22 colecciones, 656 docs, tipos BSON verificados, fundador logueó y accedió a su workspace contra la DB restaurada).
- [x] **Smoke test post-deploy** (P0.7 CERRADO — `docs/beta-launch-plan.md` §9 ejecutado por el fundador contra producción `dccca1d` el 2026-09-08: pasos 1–5 OK + verificadores de índices `CONTRACT OK` + logs Vercel 0×5xx; checklist §9 8/8 ✅).
- [x] **Prueba manual de aislamiento 2 usuarios** — ✅ **CERRADA 2026-09-08** — checklist `docs/beta-qa-isolation-checklist.md` ejecutado completo por el fundador contra producción (`dccca1d`): pasos 1–5 + matriz 4.4 **10/10 PASS** (sondeo por URL + mutaciones cross-user inyectadas con ids reales de B: todas rechazadas con `error.notFound`, DB verificada server-side sin cambios; única incidencia = edición legítima desde la ventana de B durante la búsqueda de "Edit and Resend", descartada como fallo). ← **ÚLTIMO REQUISITO TÉCNICO CERRADO**

### Grupo C — Legal (Documentación registral)
- [x] Política de privacidad, términos y condiciones, cookies, política de datos (Ley 1581/2012).
- [ ] **Reemplazar placeholders legales** `[RAZÓN SOCIAL]`, `[NIT]`, `[DIRECCIÓN]`, `[CORREO]`, `[CIUDAD/PAÍS]` — **PENDIENTE pero DOCUMENTADO (2026-09-08):** el fundador aún no registra TwinCap en la Cámara de Comercio; la identidad real de contacto ya está centralizada en `src/content/legal/identity.ts`; se resuelve en cuanto exista la razón social registrada.
- [ ] **Revisión con abogado** antes de promocionar la beta comercialmente.

---

## 2. Gaps conocidos (los únicos pendientes antes de abrir)

| Ref | Pendiente | Dueño | Nota |
|-----|-----------|-------|------|
| **P0-c** | Backup + restore probado | Fundador | Atlas M0 no tiene backups automáticos. Probar: backup → restore → app usable. Decidir upgrade M10/M20 o procedimiento manual documentado. | ✅ **CERRADO 2026-09-07** — backup `2026-09-07-214359`, restore 22/22 a `globalmoney_restore_test`, tipos BSON verificados, app-check PASS (fundador logueó y vio sus datos). **Decisión fundador (2026-09-07): M0 + runbook manual** (§5); `globalmoney_restore_test` se conserva para futuras pruebas. |
| **P0-b** | Separación de entornos (staging vs producción) | Fundador | Vercel ya separa previews; documentar workflow + política de deploy directo a main. |
| — | Smoke test post-deploy | Fundador | Checklist corto post-deploy (login, dashboard, 1 movimiento) antes de avisar a beta testers. | ✅ **CERRADO 2026-09-08** — §9 de `docs/beta-launch-plan.md` ejecutado contra producción `dccca1d`: pasos 1–5 OK, verificadores de índices CONTRACT OK, logs Vercel sin 5xx (checklist 8/8 ✅). |
| — | Primer movimiento + encuesta | Fundador | El evento `returned` y la encuesta post-beta quedaron pausados; se habilitan al abrir la beta. |
| — | Legal placeholders | Fundador | **DOCUMENTADO (2026-09-08):** fundador aún no registra TwinCap en Cámara de Comercio; identidad real en `identity.ts`; se resuelve cuando exista la razón social registrada. |
| — | Onboarding orientado a activación (P1-b) | Post-beta | Opcional; se decide según métricas de activation reales. |

---

## 3. Explícitamente FUERA del alcance de la beta

- **Equipos** (invitaciones, multi-workspace, permisos) — fase post-beta (P2-b).
- **Billing/monetización** (planes, suscripciones, pagos) — fase post-beta (P2-c).
- **Módulo Compras** — no implementar (auditoría §9, confirmado por el fundador).
- **Features P1 adicionales** (comparación mensual, presupuestos, flujo de caja, onboarding mejorado) — se deciden según comportamiento real de la beta (Fase 2 del roadmap), NO por adelantado.

---

## 4. Cómo se abre la beta (resumen operativo)

1. Ejecutar y aprobar el checklist H1 (aislamiento 2 usuarios).
2. CERRADO: P0-c (backup/restore) + smoke test post-deploy (P0.7) ✅ 2026-09-08; P0-b (separación de entornos) queda documentado como policy operativa.
3. Reemplazar placeholders legales + (si aplica) revisión de abogado.
4. Avisar a los 10–20 beta testers con el plan de lanzamiento (`docs/beta-launch-plan.md`).
5. Activar `ANALYTICS_ENABLED=true` (si no está) y empezar a medir desde el día 1.

---

*Documento vivo: se actualiza con cada decisión del fundador. Última actualización: 2026-09-08 (P0-c cerrado, isolation cerrada, smoke test P0.7 cerrado, ANALYTICS_ENABLED activado — pendientes solo legales del Grupo C, documentados: placeholders por registro en Cámara de Comercio + revisión de abogado).*