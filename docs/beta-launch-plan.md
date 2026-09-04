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

---

*Documento vivo. Última actualización: 2026-09-04.*