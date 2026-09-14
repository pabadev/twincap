# TWINCAP — INVESTIGACIÓN COMPETITIVA Y DE USUARIOS — FASE UX-2

> **Fecha:** 2026-09-13
> **Estado:** COMPLETADA — investigación documental (websearch/webfetch); sin ejecución de producto
> **Fuente normativa:** `docs/freeze + UX-UI.md` (prompt maestro, §6 y §37)
> **Documentos relacionados:** `docs/UX-UI-AUDIT.md` (UX-1), `docs/UX-INFORMATION-ARCHITECTURE.md` (UX-3), `docs/UX-DESIGN-SYSTEM.md` (UX-4), `docs/UX-ROADMAP.md` (plan maestro)

---

## 1. Método y honestidad de la investigación

- **Método:** búsqueda documental (websearch/webfetch) sobre reseñas de App Store y Google Play, TrustRadius/G2/Gartner/PCMag, discusiones de Reddit y documentación oficial de cada producto.
- **Limitaciones declaradas:** las tiendas de aplicaciones no permiten leer reseñas completas de forma sistemática → la muestra es **parcial e indexada**; las calificaciones varían por región y fecha; las citas se conservan en su idioma original.
- **Distinción honesta:** las **denuncias de usuarios se presentan como denuncias, no como hechos verificados**; las afirmaciones marcadas como **"inferido"** son análisis propio sobre el corpus, no declaraciones de los competidores.
- **Propósito (§6 del prompt maestro):** aprender, no copiar. No se copian funcionalidades, diseños, textos ni identidad visual.

---

## 2. Competidores

### 2.1. Treinta (LATAM)

**Posición:** Play 4,6-4,7★ (~99-105K reseñas); App Store 4,7-4,8★.

- **Elogio central:** facilidad de uso y utilidad cotidiana — "no necesitas ser contador".
- **Queja estrella:** regresiones tras actualizaciones (fotos, duplicados de productos, carrito; dic 2024) con **respuesta oficial pidiendo reconsiderar la calificación** — el único caso de disculpa pública del corpus.
- **Otros dolores:** transición gratis→pago con errores; estadísticas limitadas a 6 meses sin exportación; límite técnico: sin decimales >2 ni precios <0,01; denuncia puntual de precio engañoso $10→$15 (no verificada como práctica general); soporte que cuestiona la capacidad del usuario; pedidos con stock visible/reversa y agenda; actualizaciones sin aviso (Michael, Play 2026).
- **Inferido (análisis propio):** metodología de adopción incremental — día 1 configura, días 2-3 carga, día 4 opera con cuaderno de respaldo.

### 2.2. Wave (EE.UU./Canadá)

**Posición:** App Store 4,4★ (~6,6K); Play 3,2-3,8★ (~23,6K); TrustRadius 6,7/10; PCMag Editors' Choice.

- **Positivo:** "100x better [que QuickBooks], way less bugs, intuitive"; recordatorios automáticos; "accounting and reconciliation truly automatic"; dashboard con overdue invoices y upcoming payments; facturación básica gratuita.
- **Negativo:** soporte "takes days or weeks"; pagos 10-14 días; **la queja más grave: retención de dinero** (7 días con pedidos retroactivos de información; "holding my money for over a week… over $4000"; chargeback no comunicado — "Theft by Wave" — **denuncias**, con patrón consistente en el corpus).
- **Jerga contable sin traducir:** quien no sabe contabilidad se pierde; la conciliación exige saber qué es un GL.
- **Duplicación de registros:** banco+manual obliga a aprender merge.
- **Rendimiento móvil pobre** (laggy).
- **Export sin line items** ("nightmare"; "backups unhelpful") → percepción de cautiverio de datos.
- **Cuentas suspendidas sin aviso** (1,5 semanas sin acceso).
- **Soporte:** bot automatizado (Mave), sin teléfono, borrado de feedback en redes (caso Wave Payroll→Check: migración silenciosa a tercero con datos incorrectos).
- **Paywall que quita funciones antes gratis** (free bank sync legacy).

### 2.3. Alegra (LATAM)

**Posición:** App Store 4,2-4,3★; Play 4,8★ (~3,4K).

- **Positivo:** "app muy intuitiva y bastante fácil de aprender"; propuesta bien recibida: **POS offline** ("funciona aunque se caiga la conexión").
- **Negativo:** regresión destructiva por updates ("can no longer create, process, look at, or send an invoice"); módulos que cambian solos tipos de facturación y días de pago (desconfianza profunda); validaciones rígidas que rompen la edición (ciudad Quepos→cantón; soporte WhatsApp→correo); dos semanas sin poder facturar (para una PYME, facturar es el negocio).
- **Gap promesa-entrega:** sobrevende "soporte 24/7" y "facturar en 5 minutos".

### 2.4. QuickBooks (ancla global)

**Posición:** TrustRadius 8,1/10; Gartner 4,2/5.

- **Negativo:** navegación con funciones ocultas ("require a Google search to find where they are"); migración forzada Desktop→QBO con precios crecientes ("feel like corporate monopoly"); soporte laberíntico (7 case numbers, 3+ meses; "worst customer support"); complejidad para no contadores ("their failure to convey that it is accounting software"); retención de pagos.
- **Positivo:** ecosistema de integraciones, reportes potentes, estándar profesional.
- **Matiz honesto:** QBO global no es un desastre absoluto (TrustRadius 8,1/10); el odio se concentra en Desktop y soporte.
- **Lectura estratégica:** anti-modelo de confianza que produce **cohortes de migrantes** — semillero natural de TwinCap.

### 2.5. Otras referencias

- **Yimi POS:** cierre en pocos clics, modo offline, permisos por empleado, historial de stock.
- **Flippd:** entrada mínima + reporte automático + motivación (patrón onboarding incremental).
- **Narvata:** "no accounting degree required" (traducir la contabilidad al lenguaje del negocio).
- **Anjiz:** "businesses don't lack data. They lack clarity".
- **Contexto de mercado:** miedo al software real; spreadsheets con ~94% de errores (cifra citada en el corpus investigado, no verificada contra fuente primaria); el dueño quiere ver cómo se calcula lo que ve en pantalla (origen del principio de confianza del prompt maestro §14).

---

## 3. Patrones positivos (qué experiencias funcionan)

1. **Registro en segundos, pocos pasos** — Treinta/Alegra/Yimi: el dueño registra entre cliente y cliente.
2. **Flujo venta → comprobante → cobro → recordatorio automático** — Wave: alivio del seguimiento manual.
3. **Dashboard que responde tres preguntas:** cuánto vendí hoy/mes, quién me debe y hace cuánto, cuánto tengo.
4. **Onboarding incremental, no "carga todo"** — Treinta.
5. **Export/descarga para el contador como estándar** — Treinta lo vende; su ausencia en Wave es dolor explícito.
6. **Soporte humano + tutoriales cortos y concretos.**
7. **Modo offline** — Alegra/Yimi (necesidad LATAM).
8. **Roles/permisos por empleado** — Yimi.
9. **Alertas proactivas de umbral** — stock bajo, vencidos, pagos próximos.
10. **Recuperación de confianza con disculpa pública concreta** — Treinta.

---

## 4. Patrones negativos (qué errores cometen)

1. **Regresiones por updates que tocan el flujo central sin aviso** — destrucción de confianza #1 del corpus.
2. **Quitar funciones/gratuidad que el usuario ya usaba** — expropiación percibida.
3. **Tocar el dinero (retenciones)** — TwinCap no procesa pagos, pero el patrón enseña qué no hacer con la percepción financiera.
4. **Soporte inaccesible/circular** — chatbot como primera puerta, sin teléfono, cuestionar al usuario.
5. **Jerga contable sin traducción en el momento de máximo estrés** — conciliación y GL de Wave.
6. **Duplicación de registros (banco+manual)** — el sistema debe ser idempotente por diseño.
7. **Datos bloqueados o alterados** — export sin líneas, validaciones que rompen la edición, límites de historial, decimales capados.
8. **Precio engañoso y cargos al cancelar.**
9. **Cuentas suspendidas sin aviso ni plazo.**
10. **Funciones ocultas + rendimiento móvil pobre.**
11. **Feedback ignorado o borrado de forma hostil.**

---

## 5. Oportunidades para TwinCap

1. **Explicar "flujo de caja ≠ resultado económico" dentro del producto** — confusión #1 documentada; TwinCap ya la modela en el dominio (principios financieros 1-2). Diferenciación que nadie ofrece bien.
2. **Cierre de caja guiado por cuenta** — cuadrar la caja en minutos sin conceptos contables.
3. **Créditos explicados para no contadores** — traducir `creditGrantedAbono` a lenguaje de negocio: "de lo que te pagó, X cubre lo que prestaste y Y es tu ganancia" (principio financiero 7, presentado sin jerga).
4. **Export profesional desde el día uno** — PDF/CSV por períodos con line items + vista "para tu contador".
5. **Historial completo sin límites artificiales** — "tus datos, siempre accesibles" (antítesis del límite de 6 meses de Treinta).
6. **Transparencia operativa como marca** — status page + comunicación proactiva ante cambios (antítesis de "actualizaciones sin avisar").
7. **Soporte humano con SLA honesto** — nunca prometer "24/7" que no se cumple.
8. **Recordatorios automáticos de cobro configurables** — en español neutro.
9. **Onboarding en fases + import CSV** — patrón Flippd.
10. **Tutoriales de caso real de 3 minutos** — venta a crédito, transferencia, abono.

---

## 6. Cosas que NO copiar

- Identidad visual verbatim de Treinta.
- Ecosistema WhatsApp de Treinta (no es nuestro negocio).
- Freemium con jerga contable de Wave.
- Modelo "el contador define la UI" de QuickBooks.
- Promesa insostenible "soporte 24/7" / "factura en 5 minutos" (Alegra).
- Paywall de funciones que ya eran gratis.
- Retención y condiciones opacas del dinero.
- Precios ancla + sorpresa.
- Marketing IA/ERP multi-país de Alegra.

---

## 7. SECCIÓN OBLIGATORIA — LECCIONES PARA TWINCAP

1. **El Resumen ES el producto:** responder en <5s — cuánto vendí hoy/mes, quién me debe y desde cuándo, cuánto tengo por cuenta, qué gasté (converge con §41, Regla de Oro).
2. **Registrar una venta/gasto = la menor fricción del sistema.**
3. **Terminología traducida al lenguaje del negocio** en el lugar y momento de la acción (no en una sección de ayuda).
4. **El error humano no se castiga: se previene y repara** — idempotencia, validaciones amables, edición siempre posible.
5. **La confianza se gana a diario y se pierde en una actualización** — aviso previo, modo continuidad, feedback real.
6. **Los datos son del usuario siempre** — historial completo, descarga, export.
7. **El soporte humano es una función, no un coste.**
8. **El dueño LATAM opera con conexión intermitente y el celular como herramienta principal** — robustez offline, cargas mínimas, la caída nunca bloquea vender o cobrar.
9. **El contador es usuario invisible pero decisivo** — modo contador desde el inicio.
10. **La educación vende más que las funciones** — tutoriales de 3 minutos con casos reales.

---

## 8. SECCIÓN OBLIGATORIA — ERRORES QUE TWINCAP DEBE EVITAR

1. **Regresiones por updates que tocan venta/cobro o saldos** sin aviso previo ni migración cuidada.
2. **Quitar o limitar características que el usuario ya usa.**
3. **Jerga contable sin traducir o métricas contradictorias entre pantallas** sin explicación.
4. **Duplicación de movimientos** (banco+manual, reintentos sin idempotencia).
5. **Sin camino de salida** — bloquear export, límites de historial, formatos propietarios.
6. **Silencio ante incidentes o borrado de feedback.**
7. **Precios opacos y cobros sorpresa.**
8. **Soporte que cuestiona al usuario en vez del bug.**
9. **Suspensiones o bloqueos sin aviso, plazo y canal humano.**
10. **Ocultar funciones + rendimiento móvil deficiente.**
11. **Sin registro de auditoría visible cuando el sistema toca datos.**
12. **Sobre-vender lo que no se cumple.**

---

## 9. Fuentes consultadas (trazabilidad por plataforma y competidor)

Las URLs específicas fueron recopiladas por el subagente de investigación durante la búsqueda (websearch/webfetch). Este informe conserva la **trazabilidad por plataforma y competidor**; no se reproducen URLs literales para evitar referencias no verificables en un documento normativo.

| Competidor | Plataformas / fuentes |
|---|---|
| Treinta | Google Play (reseñas, ~99-105K), App Store (reseñas); comentarios de update en tienda (dic 2024; 2026) |
| Wave | App Store, Google Play, TrustRadius (6,7/10), G2, PCMag (Editors' Choice); Reddit (caso Wave Payroll→Check) |
| Alegra | App Store, Google Play; web oficial (facturación, POS offline); reseñas de update |
| QuickBooks | TrustRadius (8,1/10), Gartner (4,2/5), G2, PCMag; Reddit (soporte, migración Desktop→QBO) |
| Yimi POS | Web oficial; reseñas en tiendas; docs de producto (cierre de caja, offline, permisos) |
| Flippd / Narvata / Anjiz | Sitios oficiales y material de producto; reseñas públicas indexadas |

---

## 10. Uso de este informe en la etapa

| Documento | Qué consume de este benchmark |
|---|---|
| `UX-INFORMATION-ARCHITECTURE.md` | Lecciones 1-3 y 8 (Resumen como centro, fricción mínima, terminología de negocio, contexto LATAM móvil) |
| `UX-DESIGN-SYSTEM.md` | Lecciones 4-7 y 10 (errores no punitivos, confianza, datos del usuario, soporte humano, educación) |
| `UX-ROADMAP.md` | Errores a evitar como criterios de rechazo en fases; oportunidades mapeadas a UX-5/UX-6/UX-8 |