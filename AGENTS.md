<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MongoDB Connection Rule

Every server entry point that touches Mongoose **must** call `await connectDb()` from `@/infrastructure/db/connection` before using any repository or model. This includes:

- Server actions (`'use server'`)
- Route handlers (`app/**/route.ts`)
- Layouts and Pages that query the DB directly

Do **not** instantiate repositories at module level — create them inside the function after `connectDb()` has resolved. The connection singleton is cached globally (survives HMR) so repeated calls are cheap no-ops.

```ts
import { connectDb } from '@/infrastructure/db/connection';
import { MongoUserRepository } from '@/infrastructure/repositories/user-repository';

export async function myAction() {
  await connectDb();
  const userRepo = new MongoUserRepository();
  // ... use repo
}
```

Violating this pattern causes `buffering timed out after 10000ms` because Mongoose buffers commands when there is no active connection.

---

## Next.js 16 Proxy (NOT middleware)

Next.js 16 **no longer uses `middleware.ts`**. The equivalent is `src/proxy.ts`.

This project uses `src/proxy.ts` for:
- DB connection on cold start
- Locale detection and cookie setting
- **Auth protection** (checking session cookie, redirecting to /login)

Do NOT create a `middleware.ts` file. All request-level interception goes in `src/proxy.ts`.

```ts
// src/proxy.ts — the single entry point for request interception
export async function proxy(request: NextRequest) {
  await connectDb();
  // ... locale, auth checks, redirects
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
```

---

<!-- BEGIN:globalmoney-project-rules -->

# TwinCap — Reglas Permanentes del Proyecto

**ESTE ARCHIVO ES OBLIGATORIO.** Todo agente DEBE leerlo antes de implementar cualquier cambio.

## Contexto

TwinCap es un **SaaS de finanzas personales y pequeños negocios** en etapa de prototipo funcional.

- NO es un proyecto nuevo — ya existe implementación funcional.
- La funcionalidad existente tiene PRIORIDAD sobre cualquier mejora estética.
- Cada usuario administra exclusivamente sus propios datos (aislamiento de tenant).
- No existen equipos, colaboradores ni permisos internos.
- Actualmente NO existe módulo de Compras — no inventarlo ni implementarlo.

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16 (App Router, React 19) |
| Lenguaje | TypeScript |
| Paquetes | **pnpm** (NUNCA npm ni yarn) |
| Base de datos | MongoDB Atlas + Mongoose 8 |
| Estilo | Tailwind CSS v4 |
| UI | Componentes custom en `src/components/ui/` (sin librería externa) |
| Auth | Jose (JWT encriptado A256GCM) + bcryptjs |
| i18n | Custom en `src/i18n/` (no next-intl) — mensajes en `messages/es.json` y `messages/en.json` |
| Testing | Vitest — ejecutar con `pnpm test` |
| Estado | Sin librería global — React state + Server Actions |
| Iconos | Lucide React (`lucide-react`) — wrapper en `src/components/ui/icon.tsx` |
| Memoria | Engram MCP |

## Arquitectura Hexagonal (inquebrantable)

```
src/
├── core/
│   ├── domain/              ← Entidades, value objects, errores de dominio
│   ├── application/         ← Use cases por feature
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

### Reglas de arquitectura

1. **`core/domain/`** — Solo entidades, value objects y errores. Sin dependencias de infraestructura.
2. **`core/application/`** — Solo use cases. Dependen de `ports.ts` (interfaces), nunca de implementaciones.
3. **`infrastructure/`** — Implementa puertos de `ports.ts`. Modelos Mongoose, repositories, auth.
4. **`components/`** — Solo presentación. Sin lógica de negocio, sin llamadas directas a repositorios.
5. **`app/`** — Rutas y pages. Conectan infrastructure con components.

### Conexión a base de datos

Cada server action o route handler DEBE:
- Llamar `await connectDb()` antes de usar repositories
- Crear repositories DESPUÉS de conectar
- No instanciar repositories a nivel de módulo

## Reglas de trabajo

### Gestor de paquetes
**NUNCA usar npm o yarn.** El proyecto usa pnpm.
- Instalar: `pnpm add [paquete]`
- Desinstalar: `pnpm remove [paquete]`
- Ejecutar: `pnpm [script]`

### Autenticación
- NUNCA hardcodear tokens, secrets o credenciales.
- NUNCA exponer datos de un usuario a otro.
- Toda operación sensible DEBE validar JWT en backend.
- NUNCA confiar solo en restricciones del frontend.

### i18n
- Todo texto visible nuevo DEBE existir en `messages/es.json` y `messages/en.json`.
- NUNCA escribir textos directamente en componentes.
- Mantener el patrón i18n existente.

### Componentes UI
- Antes de crear, verificar si `src/components/ui/` ya tiene uno equivalente.
- Nuevos reutilizables → `src/components/ui/`.
- Específicos de módulo → `src/components/[modulo]/`.

### Testing
- Cada fase que agregue funcionalidad DEBE incluir tests.
- Ejecutar `pnpm test` después de cada fase.
- No suppressar tests que fallen.

### Dependencias
- No instalar nuevas sin documentar por qué.
- Preferir soluciones nativas sobre librerías externas.
- Máximo una librería nueva por fase.

### Git
- Commits convencionales: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`.
- Un commit por unidad de trabajo lógica.
- No commitear secrets o datos sensibles.
- El hook de pre-commit GGA (`gga run`) está **DESHABILITADO** permanentemente (guardado como `.git/hooks/pre-commit.disabled.gga`): su sesión de revisión hace staging masivo de archivos no solicitados y al morir por timeout del proveedor deja el índice corrupto (`invalid object ... Error building trees`). NO volver a habilitarlo sin corregir primero esos defectos. Los agentes NO deben confiar en él ni reintentar commits a través del hook; la verificación de calidad se hace con `pnpm test` + `tsc --noEmit`.

### Responsive
- Mobile-first: diseñar primero para móvil.
- No usar `overflow-x: auto` como única solución.
- Verificar en 3 breakpoints: mobile (375px), tablet (768px), desktop (1280px).

### Seguridad
- Validar datos en backend siempre.
- Sanitizar inputs del usuario.
- Verificar autorización antes de cada operación sobre datos.

### Frontera server→client (serialización)
React solo acepta objetos planos y built-ins (`Date`, `Map`, `Set`) como props de un Server Component a un Client Component. Las instancias con prototipo de clase explotan en runtime (`Only plain objects... can be passed to Client Components`).

- Dentro del `toJSON()` de una entidad, todo valor DEBE ser literal, primitivo, `Date` o una llamada explícita a `.toJSON()`.
- NUNCA pasar instancias de clases de dominio (`Money`, entidades, etc.) directamente dentro del snapshot.
- Todo value object serializable implementa su propio `toJSON()` (ver `src/core/domain/money.ts`).
- La frontera NO está protegida por TypeScript: `Money` es estructuralmente idéntico a `{amount, currency}` — que compile no significa que sea JSON-safe.
- Los tipos `Serialized*` se derivan de `ReturnType<Entidad['toJSON']>`; al agregar campos a una entidad, revisar que el snapshot no arrastre prototipos de clase.

### Documento de referencia

El workflow completo de auditoría, planificación e implementación por fases está en:

> `docs/AUDIT-AND-PLAN.md`

**⚠️ OBLIGATORIO:** Después de una compactación o al iniciar nueva sesión, lo PRIMERO es leer `docs/AUDIT-AND-PLAN.md` para identificar la fase actual y continuar desde ahí. El archivo contiene el estado completo del proyecto, las 12 fases pendientes, y el protocolo de continuación.

<!-- END:globalmoney-project-rules -->
