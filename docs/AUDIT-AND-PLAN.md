# GLOBALMONEY — AUDITORÍA, PLANIFICACIÓN E IMPLEMENTACIÓN POR FASES

> **Este documento define el workflow completo para la auditoría, planificación e implementación por fases de GlobalMoney.**
>
> **Cualquier agente que trabaje en el proyecto DEBE leer `AGENTS.md` (reglas permanentes) y este documento (workflow) antes de empezar.**

---

## 1. CONTEXTO DEL PROYECTO

Estás trabajando sobre **GlobalMoney**, una aplicación SaaS de finanzas personales y de pequeños negocios.

El proyecto **NO debe tratarse como una aplicación nueva**. Ya existe una implementación funcional y varias de las funcionalidades descritas en este documento ya están implementadas.

El objetivo de este trabajo es:

- Mejorar la experiencia de usuario.
- Corregir inconsistencias de UI/UX.
- Completar funcionalidades pendientes.
- Mejorar responsive design.
- Mejorar arquitectura/reutilización de componentes cuando sea necesario.
- Mantener y proteger la funcionalidad existente.
- Preparar una base visual y técnica coherente para futuras funcionalidades.

La aplicación actualmente incluye, entre otros:

- Dashboard
- Movimientos
- Cuentas
- Transferencias
- Venta POS
- Créditos recibidos
- Créditos otorgados
- Categorías
- Catálogo de productos/servicios
- Usuarios/autenticación
- Reportes y/o información financiera existente

Actualmente NO existe módulo de Compras, por lo que **no debe inventarse ni implementarse como parte de este trabajo**, salvo que durante la auditoría se identifique una dependencia técnica que deba ser documentada.

GlobalMoney es un **SaaS público en etapa de prototipo**.

Los usuarios pueden registrarse mediante email y contraseña y, una vez autenticados, acceden a un dashboard privado.

Cada usuario administra exclusivamente sus propios datos.

Aunque la arquitectura utiliza el concepto de tenant/multi-tenant, actualmente **no existen equipos, colaboradores, subusuarios ni permisos internos**. Un usuario registrado administra únicamente sus propios datos.

---

## 2. STACK TECNOLÓGICO

**Runtime y Framework:**
- Next.js 16 (App Router)
- React 19
- TypeScript
- Node.js
- pnpm como gestor de paquetes (**NUNCA usar npm o yarn**)

**Base de datos:**
- MongoDB Atlas
- Mongoose 8

**Estilo:**
- Tailwind CSS v4
- Sin librería de componentes externa (componentes UI custom en `src/components/ui/`)

**Autenticación:**
- Jose (JWT encriptado con A256GCM)
- bcryptjs para hashing de contraseñas

**Internacionalización:**
- Sistema i18n custom en `src/i18n/` (no usa next-intl ni next-i18next)
- Archivos de mensajes en `messages/es.json` e `messages/en.json`

**Testing:**
- Vitest
- Ejecutar con: `pnpm test`

**Estado:**
- Sin librería de estado global (no usa zustand, redux, jotai ni context global)
- Componentes usan estado local de React y Server Actions

**Iconografía:**
- Sin librería de iconos instalada actualmente
- Se debe instalar **Lucide React** (`lucide-react`) como parte de la fase de sistema visual antes de usar iconos en componentes nuevos

**Memoria:**
- Engram como mecanismo de contexto/memoria del proyecto

### Arquitectura Hexagonal (OBLIGATORIO respetar)

```
src/
├── core/
│   ├── domain/              ← Entidades, value objects, errores de dominio
│   ├── application/         ← Use cases organizados por feature
│   │   └── ports.ts         ← Interfaces de repositorios y servicios
├── infrastructure/
│   ├── models/              ← Modelos Mongoose
│   ├── repositories/        ← Implementaciones de repositorios
│   ├── auth/                ← Lógica de autenticación
│   └── config/              ← Configuración
├── components/
│   ├── ui/                  ← Componentes reutilizables (button, card, input, modal, select, table)
│   └── [feature]/           ← Componentes de presentación por módulo
├── i18n/                    ← Internacionalización custom
└── app/                     ← App Router (rutas, layouts, pages, API routes)
```

#### Reglas de arquitectura que NUNCA se violan:

1. **`core/domain/`** — Solo entidades, value objects y errores de dominio. Sin dependencias de infraestructura.
2. **`core/application/`** — Solo use cases. Dependen de `ports.ts` (interfaces), nunca de implementaciones concretas.
3. **`infrastructure/`** — Implementa los puertos definidos en `application/ports.ts`. Aquí van Mongoose models, repositories, auth.
4. **`components/`** — Solo presentación. Sin lógica de negocio, sin llamadas directas a repositorios, sin acceso a Mongoose.
5. **`app/`** — Rutas, layouts, pages y API routes. Conectan infrastructure con components. Cada server action o route handler DEBE:
   - Llamar `await connectDb()` antes de usar repositories
   - Crear repositories DESPUÉS de conectar
   - No instanciar repositories a nivel de módulo

#### Inspección previa obligatoria

Antes de realizar cualquier modificación:

1. Inspecciona el stack real utilizado por el proyecto.
2. Identifica la arquitectura actual.
3. Identifica cómo está implementado actualmente el estado de la aplicación.
4. Identifica cómo está implementado i18n.
5. Identifica los componentes UI reutilizables existentes.
6. Identifica la estrategia actual de autenticación/autorización.
7. Identifica cómo se garantiza el aislamiento de datos entre usuarios/tenants.
8. Consulta el contexto disponible mediante Engram.
9. No reemplaces tecnologías existentes simplemente porque prefieras otra alternativa.
10. **NUNCA usar npm o yarn** — el proyecto usa pnpm.
11. **Respetar la arquitectura hexagonal** — lógica de negocio NUNCA en componentes, repos NUNCA en application/, presentación NUNCA en infrastructure/.

Si una decisión técnica no está clara, primero analiza el código existente antes de asumirla.

---

## 3. REGLA FUNDAMENTAL DE TRABAJO

### NO IMPLEMENTAR TODO DE UNA VEZ.

Este trabajo debe ejecutarse mediante un proceso controlado:

**AUDITAR → ANALIZAR → PLANIFICAR → PRESENTAR PLAN → ESPERAR APROBACIÓN → IMPLEMENTAR UNA FASE → PROBAR → REPORTAR → ESPERAR APROBACIÓN**

En este primer momento tu objetivo es:

### SOLO AUDITAR Y PLANIFICAR.

No debes comenzar todavía a modificar código.

No debes crear archivos.

No debes ejecutar migraciones.

No debes cambiar componentes.

No debes instalar dependencias.

No debes hacer commits.

Primero debes analizar el estado real del proyecto y presentar un plan de ejecución.

El usuario aprobará cada fase individualmente.

---

## 4. REGLA DE SEGURIDAD CONTRA REGRESIONES

La aplicación ya funciona y las solicitudes descritas provienen de pruebas reales realizadas sobre la aplicación.

Por lo tanto:

> **La funcionalidad existente tiene prioridad sobre cualquier mejora estética.**

No elimines, reemplaces ni simplifiques una funcionalidad existente sin comprobar previamente qué comportamiento proporciona.

No supongas que algo puede eliminarse porque parece innecesario.

Antes de modificar un componente o flujo:

1. Identifica qué funcionalidades dependen de él.
2. Identifica sus consumidores.
3. Identifica sus modelos/API/endpoints relacionados.
4. Identifica posibles efectos secundarios.
5. Propón la modificación más pequeña que resuelva el problema.

Siempre prioriza cambios incrementales y mantenibles sobre grandes refactorizaciones innecesarias.

---

## 5. REGLA SOBRE PROBLEMAS ADICIONALES

Durante la auditoría puedes detectar problemas que no aparecen explícitamente en este documento.

Puedes identificar problemas relacionados con:

- UX, UI, Responsive, Accesibilidad
- Arquitectura, Rendimiento, Seguridad
- Internacionalización, SEO
- Consistencia visual, Componentización
- Validaciones, Manejo de errores
- Integridad de datos, Experiencia móvil

Sin embargo:

> **NO IMPLEMENTES automáticamente ningún problema adicional que descubras.**

Debes incluirlo en una sección denominada **"Hallazgos adicionales"**. Para cada hallazgo indica:

- Problema
- Evidencia
- Impacto
- Prioridad
- Recomendación
- Fase sugerida

El usuario decidirá si se incorpora al alcance.

---

## 6. TAREAS FUNCIONALES SOLICITADAS

### 6.1 MOVIMIENTOS — FILTRO "TODO"

Actualmente el módulo Movimientos muestra movimientos filtrados por cuenta.

Debe agregarse una opción **Todo / All** que:

- Mostré movimientos pertenecientes a todas las cuentas disponibles para el usuario.
- Sea la opción seleccionada por defecto.
- Mantenga disponibles las opciones individuales por cuenta.
- Respete siempre el aislamiento del tenant/usuario.
- Mantenga paginación, ordenamiento, filtros y demás funcionalidades existentes.

### 6.2 VENTA POS — CLIENTES

En Venta POS debe existir un cliente asociado a la venta. Por defecto: **Cliente general**.

Debe ser posible:

- Mantener "Cliente general" para ventas normales.
- Seleccionar un cliente existente.
- Crear un nuevo cliente directamente desde Venta POS.
- Acceder a la administración de clientes desde un nuevo módulo **Clientes**.

**Regla para ventas a crédito:**

- No debe permitirse registrar una venta a crédito sin un cliente real asociado.
- "Cliente general" no debe utilizarse para representar una deuda cuando sea necesario identificar al deudor.
- La venta a crédito debe quedar correctamente relacionada con el cliente y con **Créditos Otorgados**.

### 6.3 MÓDULO CLIENTES

Crear un nuevo apartado **Clientes** con operaciones CRUD básicas:

- Listar, crear, editar, eliminar/desactivar, buscar.
- Campos: Nombre, Documento/identificación, Teléfono, Email, Dirección, Notas, Estado.
- No convertir en CRM complejo — prioridad como entidad financiera/comercial.

### 6.4 BUSCADOR DE PRODUCTOS/SERVICIOS EN VENTA POS

Buscador dinámico en el selector de artículos/servicios:

- Buscar por nombre con debounce (300–500 ms).
- Mostrar coincidencias dinámicamente.
- Experiencia fluida en escritorio y móvil.

### 6.5 CRÉDITOS — EDICIÓN DE ABONOS

En Créditos Recibidos y Créditos Otorgados, los abonos deben poder editarse (monto, fecha).

La edición debe recalcular correctamente: saldo pendiente, total abonado, estado del crédito, fechas, relación con cuenta/movimiento, dashboard y reportes.

### 6.6 CATEGORÍAS

Cambiar el formulario de crear categorías de la posición inferior a un patrón consistente:

- Botón de acción en la parte superior derecha.
- Al pulsarlo se muestra el formulario.
- Después de crear, el formulario se oculta.

---

## 7. ESTÁNDAR DE FORMULARIOS

### Fechas

> La fecha por defecto debe ser la fecha actual (HOY). Respetar zona horaria. No hardcodear fechas.

### Formularios largos

- **Desktop:** dos columnas cuando tenga sentido, agrupación lógica.
- **Móvil:** adaptarse automáticamente a una sola columna.
- Referencia: formulario de Catálogo → Crear artículo/Servicio.

### Visibilidad

> Los formularios CRUD no deberían ocupar permanentemente el espacio principal.

Patrón preferido: **Botón → Modal → Formulario**. Modal cerrable con X, ESC y accesibilidad.

---

## 8. DISEÑO RESPONSIVE

Toda la aplicación debe funcionar en: teléfonos pequeños/grandes, tablets, laptops, escritorio, pantallas grandes.

Prioridad: **experiencia móvil**.

No aceptar `overflow-x: auto` como única solución para tablas. Evaluar: tarjetas, lista compacta, columnas prioritarias, acciones agrupadas.

---

## 9. UI/UX GLOBAL

Diseño: moderno, minimalista, ordenado, consistente, intuitivo, profesional, financiero, accesible, responsive.

Priorizar: Claridad > Jerarquía visual > Legibilidad > Consistencia > Velocidad > Accesibilidad > Estética.

---

## 10. SISTEMA DE DISEÑO

Proponer un **design system reutilizable** basado en inspiración Kanagawa Dragon (o alternativa justificada).

Debe contemplar: colores, fondos, superficies, texto, bordes, estados (éxito/error/advertencia/info), ingresos/gastos/deudas/créditos, botones, inputs, selects, modales, tablas, badges, navegación.

No crear estilos independientes para cada pantalla cuando un componente reutilizable sea apropiado.

---

## 11. ICONOGRAFÍA

**Estado actual:** No hay librería instalada.

**Instalación obligatoria:** `pnpm add lucide-react`

Crear wrapper local en `src/components/ui/icon.tsx`. Tamaños: sm(16px), md(20px), lg(24px), xl(32px). Stroke width: 1.5.

No crear SVG manualmente. No usar múltiples librerías.

---

## 12. BOTONES, ENLACES Y CONTROLES

- `cursor: pointer` en elementos interactivos.
- Feedback visual: hover, focus, active, disabled, loading.
- Selects: accesibles, responsive, con búsqueda si la lista es larga (usar debounce).

---

## 13. IDIOMAS (i18n)

Todo texto visible nuevo DEBE existir en `messages/es.json` y `messages/en.json`.

No escribir textos directamente en componentes. Mantener el patrón i18n existente.

---

## 14. SELECTOR DE IDIOMA

Mejora visual: icono representativo, altura consistente, alineación consistente, responsive.

---

## 15. LOGO GLOBALMONEY

Logo moderno construido con SVG/CSS/componentes. Concepto: finanzas, crecimiento, tecnología, confianza.

Versiones: logotipo, isotipo, favicon, fondo claro, fondo oscuro.

No usar imágenes rasterizadas externas.

---

## 16. LANDING PAGE PÚBLICA

La ruta principal pública debe ser una **landing page** (no dashboard).

Secciones mínimas: Hero, Características, Beneficios, Sección visual, FAQ, CTA final, Footer.

SEO: title, meta description, Open Graph, metadata, favicon, estructura semántica, headings jerarquizados, robots, sitemap.

---

## 17. COMPORTAMIENTO DE AUTENTICACIÓN EN LA LANDING

- **Sin sesión:** Mostrar landing con opciones Registrarse / Iniciar sesión.
- **Con sesión:** Redirigir automáticamente al Dashboard.
- Respetar mecanismo JWT/Jose existente.

---

## 18. AUDITORÍA DE COMPONENTES

Identificar: componentes reutilizables, formularios duplicados, modales, botones, inputs, selects, tablas, cards, badges, iconos, layout, navegación, sistema de colores, responsive.

Reutilizar antes de crear. No refactorizar automáticamente todo.

---

## 19. CRITERIO DE ARQUITECTURA

Preguntar antes de crear: ¿Ya existe equivalente? ¿Se puede reutilizar o extender?

Evitar duplicación, overengineering y abstracciones prematuras.

---

## 20. RENDIMIENTO

Identificar: consultas innecesarias, renders innecesarios, listas grandes, búsquedas sin debounce, llamadas duplicadas, carga excesiva, server/client boundaries.

No optimizar prematuramente.

---

## 21. SEGURIDAD

Verificar: aislamiento de tenant, autorización, autenticación, endpoints, acceso por ID, validación, operaciones sobre créditos/ventas/clientes.

Nunca confiar solo en restricciones del frontend.

---

## 22. DATOS Y BASE DE DATOS

Solo datos de prueba, pero no asumir que esto permite modificaciones destructivas.

Antes de modificar modelos Mongoose: identificar relaciones, índices, referencias, queries dependientes.

Si migración es necesaria: documentar, explicar impacto, esperar aprobación.

---

## 23. FASE 0 — AUDITORÍA

La primera fase es exclusivamente de análisis:

- **Frontend:** rutas, layouts, componentes, formularios, modales, tablas, navegación, i18n, estilos, responsive.
- **Backend:** APIs, servicios, modelos, validaciones, autenticación, autorización, relaciones.
- **Base de datos:** modelos Mongoose, índices, referencias, campos relevantes.
- **UX:** revisión visual y estructural de módulos relacionados.
- **Autenticación:** cómo se detecta sesión activa y se protege el dashboard.

---

## 24. PLANIFICACIÓN

Después de la auditoría, presentar plan dividido en fases reorganizadas según: dependencias, riesgo, impacto, reutilización, prioridad, facilidad de prueba, UX.

Para cada fase: Objetivo, Cambios, Archivos probables, Dependencias, Riesgo, Pruebas, Criterios de aceptación.

---

## 25. PRIORIZACIÓN

- **P0 — Crítico:** funcionalidad, datos, seguridad, bloqueo de fases.
- **P1 — Alta:** funcionalidades importantes y mejoras significativas.
- **P2 — Media:** mejoras de UX/UI y consistencia.
- **P3 — Baja:** detalles visuales y refinamientos no esenciales.

---

## 26. CRITERIOS DE ACEPTACIÓN GENERALES

Una fase está terminada cuando:

- Funciona correctamente.
- No rompe funcionalidades existentes.
- Funciona en desktop y móvil (cuando corresponda).
- Respeta español/inglés, autenticación, aislamiento de tenant.
- No genera errores de TypeScript ni lint.
- Tests existentes siguen pasando.
- Nuevos flujos comprobados.
- Estados de error/loading/empty contemplados.

---

## 27. PROTOCOLO DESPUÉS DE CADA FASE

Ejecutar en orden exacto:

```bash
pnpm tsc --noEmit    # 1. Type checking
pnpm lint            # 2. Lint
pnpm test            # 3. Tests
pnpm build           # 4. Build
```

**Si algún paso falla, la fase NO está terminada.**

### Reglas de testing

- Cada fase nueva DEBE incluir al menos un Happy path test.
- UI: verificar renderizado y estados interactivos.
- Use cases: Happy path + edge case principal.
- Repositories: consulta retorna lo esperado.

### Reporte de fase

Presentar: Implementado, Archivos modificados, Pruebas ejecutadas, Pruebas escritas, Resultado, Pendientes, Riesgos.

> **DETENER Y ESPERAR APROBACIÓN ANTES DE CONTINUAR.**

---

## 28. REGLA CONTRA CAMBIOS NO AUTORIZADOS

No cambiar: framework, base de datos, autenticación, arquitectura completa, i18n, instalar múltiples librerías, migraciones masivas, funcionalidades no relacionadas, eliminar componentes sin justificación.

Cualquier cambio de arquitectura significativo: proponer primero.

---

## 29. RESULTADO ESPERADO DE LA PRIMERA INTERACCIÓN

NO quiero código. Quiero exclusivamente:

- **A.** Resumen del estado actual
- **B.** Arquitectura actual
- **C.** Auditoría de cada solicitud (estado, qué falta, complejidad, dependencias, riesgo)
- **D.** Hallazgos adicionales
- **E.** Propuesta de sistema visual
- **F.** Plan de ejecución por fases
- **G.** Criterios de aceptación por fase
- **H.** Preguntas pendientes

---

## 30. REGLAS PERMANENTES DEL PROYECTO

> Las reglas completas están en `AGENTS.md` en la raíz del proyecto. Este resumen es solo para referencia — **siempre consultar `AGENTS.md` como fuente autoritativa.**

- **pnpm siempre**, nunca npm/yarn.
- **Arquitectura hexagonal** inquebrantable.
- **Autenticación:** nunca hardcodear, siempre validar JWT en backend.
- **i18n:** todo texto en es.json y en.json.
- **Componentes:** reutilizar antes de crear. UI reutilizables en `src/components/ui/`.
- **Testing:** `pnpm test` después de cada fase. Tests obligatorios.
- **Estado:** preferir Server Components. Sin librerías globales sin aprobación.
- **Dependencias:** máximo una nueva por fase, documentar por qué.
- **Git:** commits convencionales, un commit por unidad lógica.
- **Responsive:** mobile-first, 3 breakpoints.
- **Seguridad:** validar en backend, sanitizar inputs, verificar autorización.

---

## 31. REGLA FINAL

**Primero comprender el proyecto.**

**Después planificar.**

**Después obtener aprobación.**

**Después implementar.**

**Después probar.**

**Después detenerse.**

No confundas velocidad con calidad.

El objetivo no es simplemente agregar funcionalidades, sino convertir GlobalMoney en una aplicación coherente, profesional, mantenible, intuitiva, responsive y preparada para evolucionar como SaaS.

**NO MODIFIQUES EL CÓDIGO EN ESTA PRIMERA FASE.**

Comienza realizando la auditoría completa y presenta el plan.
