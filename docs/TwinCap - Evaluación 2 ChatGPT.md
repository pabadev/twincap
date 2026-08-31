Sí. Hice la auditoría tomando como **fuente histórica de las rondas exclusivamente `docs/AUDIT-AND-PLAN.md`**, como pediste. No utilicé `Ronda 2.md`, `Ronda4.md` ni archivos `.zip` individuales para reconstruir el estado.

También contrasté ese documento contra el **código actual de `master`**, `AGENTS.md`, `package.json` y las piezas centrales de dominio, aplicación, infraestructura, autenticación y dashboard. El repositorio que estoy evaluando es el estado visible actualmente en GitHub.

# Auditoría integral de TwinCap — 30/08/2026

## 1\. Veredicto ejecutivo

**TwinCap ya no lo considero un simple proyecto personal/prototipo experimental.**

Mi evaluación actual es:

> **Arquitectura: sólida**  
> **Dominio financiero: sólido, pero todavía con zonas que requieren endurecimiento**  
> **Integridad de datos: mejorada de forma sustancial**  
> **UX/producto: bastante madura para MVP**  
> **Testing: excepcionalmente bueno para un proyecto individual**  
> **Seguridad: aceptable para MVP, insuficiente todavía para SaaS financiero comercial**  
> **Operación/producción: todavía inmadura**  
> **Escalabilidad: principal deuda técnica**  
> **Preparación comercial: cercana, pero no lista para crecer agresivamente**

### Mi puntuación

| Área | Evaluación |
| --- | ---: |
| Arquitectura | **9/10** |
| Dominio financiero | **8.5/10** |
| Integridad de datos | **8.5/10** |
| Backend | **8.5/10** |
| Frontend / UX | **8.5/10** |
| Testing | **9.5/10** |
| Seguridad | **7/10** |
| Performance / escalabilidad | **6.5/10** |
| Observabilidad / operación | **5.5/10** |
| Preparación comercial | **7.5/10** |
| **Global** | **≈8.0/10** |

No le daría 9/10 global todavía porque hay una diferencia importante entre **"funciona correctamente en el entorno actual"** y **"puedo ponerlo delante de cientos o miles de usuarios y confiar en él"**.

* * *

# 2\. Lo más importante: las rondas sí produjeron una evolución arquitectónica real

El documento maestro muestra una progresión bastante clara:

- R1: fundamentos UI/UX y funcionales.
- R2: arquitectura, consistencia e infraestructura.
- R3: auditoría financiera integral.
- R4: dashboard.
- R5: integridad financiera, créditos y onboarding.
- R6: huérfanos de movimientos.
- R7: raíz UUID/ObjectId.
- R8: separación entre capital financiero y resultado económico.
- R9: amortización de créditos otorgados, write-off y saldo inicial.

Esto es importante porque inicialmente TwinCap tenía un problema típico de aplicaciones financieras personales:

**el modelo de datos representaba operaciones, pero no siempre representaba correctamente su significado económico.**

Las rondas posteriores han ido corrigiendo precisamente eso.

Por ejemplo, actualmente existe una separación explícita entre:

- capital de créditos recibidos,
- capital de créditos otorgados,
- transferencias,
- saldos iniciales,
- ingresos económicos,
- gastos económicos,
- intereses,
- castigos de cartera.

El módulo `economic-result.ts` centraliza esa semántica en vez de permitir que cada dashboard/agregador invente su propia regla.

**Eso es una muy buena decisión arquitectónica.**

* * *

# 3\. Arquitectura

## Resultado: 🟢 9/10

La estructura actual:

```text
src/
├── app/
├── components/
├── core/
│   ├── application/
│   └── domain/
├── infrastructure/
│   ├── auth/
│   ├── config/
│   ├── db/
│   ├── mappers/
│   ├── migrations/
│   ├── models/
│   ├── repositories/
│   └── seeding/
├── i18n/
└── lib/
```

es razonable para el tamaño y naturaleza del producto. El propio árbol actual confirma la separación `core/domain`, `core/application` e `infrastructure`. ([GitHub](https://github.com/pabadev/twincap/tree/master/src/core "twincap/src/core at master · pabadev/twincap · GitHub"))

Además, `AGENTS.md` establece explícitamente:

- dominio independiente de infraestructura,
- repositories detrás de puertos,
- conexión DB antes de acceder a repositories,
- aislamiento por usuario,
- server actions como frontera de aplicación.

### Punto especialmente bueno

El dominio de `Movement` es bastante limpio.

Actualmente define explícitamente los `MovementLinkKind`:

```text
opening
transfer
creditReceivedPrincipal
creditReceivedAbono
creditGrantedPrincipal
creditGrantedAbono
creditGrantedAbonoInterest
creditGrantedWriteOff
salePayment
payableInitialPayment
payableAbono
```

y no permite tipos arbitrarios.

Esto es mucho mejor que tener strings dispersos por todo el código.

* * *

# 4\. El dominio financiero está mucho más maduro

## Resultado: 🟢 8.5/10

Aquí está probablemente la mayor fortaleza actual de TwinCap.

### Créditos otorgados

La lógica actual distingue:

```text
principal
interest
pending
writtenOff
```

y el dominio calcula `totalToPay` y `pending` de forma derivada.

La Ronda 9 introdujo además la amortización cronológica:

> primero principal → después interés.

Eso evita el error conceptual de considerar automáticamente todo abono como ingreso.

También se añadió:

```text
creditGrantedAbono
creditGrantedAbonoInterest
creditGrantedWriteOff
```

para separar recuperación de capital, ingreso por intereses y pérdida por incobrabilidad.

**Esto es contablemente mucho más coherente que el diseño inicial.**

* * *

# 5\. Resultado económico: muy buena evolución

La función:

```text
countsTowardEconomicResult()
```

centraliza una cuestión crítica:

> ¿Este movimiento representa realmente ingreso/gasto?

Actualmente excluye:

- transferencias,
- saldos iniciales,
- capital de créditos recibidos,
- capital de créditos otorgados,
- recuperación de principal de créditos personales.

Pero mantiene como económicos los intereses, gastos por castigo y operaciones comerciales correspondientes.

Esto además se utiliza en los agregadores del dashboard y evolución anual.

### Esto corrige uno de los riesgos más graves de TwinCap

Antes era fácil confundir:

> "entró dinero"

con:

> "gané dinero".

Ahora el modelo está mucho más cerca de distinguir ambos conceptos.

**Muy buena decisión.**

* * *

# 6\. Integridad de datos

## Resultado: 🟢 8.5/10

Aquí las rondas 5–7 fueron especialmente importantes.

El problema UUID ↔ ObjectId era realmente serio.

La situación anterior podía producir:

```text
Dominio:
UUID = A

Mongo:
_id = B

Movement.link.refId = A

Sale._id = B
```

y entonces:

```text
deleteSale(B)
```

no encontraba:

```text
movement.link.refId === B
```

El resultado era un movimiento huérfano que seguía afectando balances e informes.

La Ronda 7 corrigió la raíz:

- generación de ObjectId,
- persistencia explícita de `_id`,
- coincidencia entre IDs del dominio y Mongo,
- defensa adicional en lectura.

Eso es mucho mejor que limitarse a "limpiar los datos malos".

### Pero aquí existe todavía una deuda importante

El sistema **todavía necesita mecanismos defensivos contra corrupción de relaciones**.

La propia R6 documenta que el sistema llegó a necesitar reconciliación porque un movimiento huérfano podía afectar los agregados.

La solución actual es bastante robusta, pero el modelo sigue dependiendo de múltiples documentos MongoDB relacionados.

* * *

# 7\. El mayor riesgo arquitectónico que todavía veo: operaciones multi-documento

Este es uno de los puntos que **yo priorizaría en una futura ronda**, aunque no sea necesariamente un bug actual.

TwinCap representa operaciones complejas mediante varios documentos:

```text
Sale
 ├── CreditGranted
 ├── Movement
 └── Movement

Transfer
 ├── Movement
 └── Movement

CreditGranted
 ├── CreditGranted
 ├── Movement(s)
 └── eventualmente WriteOff Movement

Payable
 ├── Payable
 └── Movement(s)
```

Por tanto, una operación aparentemente atómica puede implicar múltiples escrituras.

La propia auditoría R6 documentó que el borrado no era transaccional y que un fallo a mitad podía dejar documentos huérfanos.

Aunque ahora existe una estrategia de orden:

> movimiento primero → entidad principal después

y defensas posteriores, **eso no equivale a atomicidad real**.

### Mi recomendación

No intentaría meter MongoDB transactions inmediatamente.

Primero investigaría:

1.  qué operaciones necesitan atomicidad real;
2.  cuáles pueden ser idempotentes;
3.  cuáles toleran compensación;
4.  cuáles necesitan transaction cuando el despliegue lo permita.

Esto debería ser una futura **auditoría de consistencia transaccional**, no una reescritura.

* * *

# 8\. Dashboard

## Resultado: 🟢 8.5/10

El dashboard actual está conceptualmente mucho mejor.

Hay separación entre:

- resultado económico,
- flujos de financiamiento,
- posición financiera,
- evolución,
- movimientos.

La función de dashboard trabaja sobre movimientos y separa moneda y semántica económica.

También se solucionó el problema del filtro `current_month`, que antes era prácticamente un no-op.

### Pero aparece una deuda importante

El propio diseño documentado en R4 indica que el dashboard carga:

> **TODOS los movimientos del usuario**

y luego aplica filtros mediante `useMemo` en cliente.

Eso es perfectamente razonable para:

```text
10 movimientos
100 movimientos
1.000 movimientos
```

pero empieza a ser problemático con:

```text
10.000
50.000
100.000+
```

Porque:

```text
MongoDB → servidor → serialización → navegador
```

termina transportando y procesando una cantidad de datos innecesaria.

### Este es probablemente el principal problema de escalabilidad actual de TwinCap.

No es urgente para tu MVP.

Sí es importante antes de crecer.

* * *

# 9\. Performance

## Resultado: 🟡 6.5/10

El problema anterior es el principal.

Actualmente hay una filosofía bastante clara:

> cargar datos → derivar/agrupar en funciones puras.

Eso facilita muchísimo el desarrollo y testing.

Pero no escala indefinidamente.

### La evolución natural sería:

Actualmente:

```text
Mongo
  ↓
todos los movimientos
  ↓
Next Server
  ↓
Client
  ↓
useMemo
  ↓
filtros/agregaciones
```

Futuro:

```text
Mongo
  ↓
query agregada / filtrada
  ↓
Next Server
  ↓
datos mínimos
  ↓
UI
```

No recomiendo hacer esto todavía como una "optimización preventiva".

Pero sí lo pondría como **deuda técnica de prioridad media-alta**.

* * *

# 10\. Autenticación

## Resultado: 🟡 7/10

La arquitectura de autenticación es razonable.

Actualmente:

- JWT con Jose,
- cookie `httpOnly`,
- `sameSite=lax`,
- `secure` en producción,
- expiración de 30 días,
- `sub` como user ID,
- email denormalizado en el token. ([GitHub](https://github.com/pabadev/twincap/blob/master/src/infrastructure/auth/session-cookie.ts "twincap/src/infrastructure/auth/session-cookie.ts at master · pabadev/twincap · GitHub"))

Eso está bien para un MVP.

Además, login utiliza un mensaje genérico:

```text
Invalid email or password
```

lo que evita enumeración directa de usuarios. ([GitHub](https://github.com/pabadev/twincap/blob/master/src/core/application/auth/login.ts "twincap/src/core/application/auth/login.ts at master · pabadev/twincap · GitHub"))

### Pero veo una carencia importante

No encontré en la superficie de autenticación revisada un mecanismo evidente de:

- rate limiting de login,
- bloqueo temporal por intentos,
- protección contra credential stuffing,
- recuperación de contraseña,
- verificación de email.

Esto no significa que necesariamente no exista alguna defensa externa en el hosting, pero **no forma parte claramente del núcleo de la aplicación revisada**.

Para un producto comercial financiero, esto pasa a ser importante.

### Prioridad

**Alta antes de una apertura pública significativa.**

* * *

# 11\. CSRF / Server Actions

Aquí hay una buena noticia.

Estás usando Next.js 16.3.1, y existe una vulnerabilidad documentada en versiones de Next 16.0.1 a <16.1.7 relacionada con `Origin: null`; la versión que tienes está por encima de esa ventana afectada. ([GitHub](https://github.com/advisories/GHSA-mq59-m269-xvcx?utm_source=chatgpt.com "Next.js: null origin can bypass Server Actions CSRF checks · CVE-2026-27978 · GitHub Advisory Database · GitHub"))

Por tanto, **no veo una razón para considerar vulnerable a TwinCap por ese CVE concreto**.

Aun así, para una aplicación financiera yo mantendría como requisito:

- validación server-side,
- autorización server-side,
- no confiar en estado UI,
- validación de ownership en cada use case.

Y aquí TwinCap está bastante bien encaminado.

* * *

# 12\. Multi-tenancy

## Resultado: 🟢 9/10

Esta es otra de las partes que considero fuertes.

La regla permanente es explícita:

> cada usuario administra exclusivamente sus propios datos.

Y la arquitectura utiliza `userId` como frontera transversal.

Además, las rondas anteriores hicieron spot checks precisamente sobre:

- cuentas,
- categorías,
- ventas,
- créditos,
- abonos,
- payables.

### Pero hay una mejora que recomiendo

No confiar únicamente en tests unitarios para esto.

Necesitas eventualmente una batería explícita de pruebas:

```text
User A
  ↓
intenta acceder a ID de User B
  ↓
DEBE fallar
```

para **cada agregado**.

Eso sería una excelente futura suite:

```text
tenant-isolation/
├── accounts
├── movements
├── credits
├── sales
├── payables
├── transfers
├── clients
└── categories
```

* * *

# 13\. Testing

## Resultado: 🟢 9.5/10

Aquí TwinCap está muy por encima de lo normal para un SaaS desarrollado por una sola persona.

El estado documentado después de R9 es:

> **589/589 tests**, TypeScript limpio y build exitoso.

Además, los tests no son únicamente superficiales.

Hay pruebas para:

- dominio,
- créditos,
- abonos,
- dashboard,
- resultado económico,
- activos/pasivos,
- transferencias,
- acciones,
- reconciliación,
- legacy repair,
- UI.

La estructura del core confirma una cantidad considerable de tests junto a los módulos correspondientes. ([GitHub](https://github.com/pabadev/twincap/tree/master/src/core/application "twincap/src/core/application at master · pabadev/twincap · GitHub"))

### Pero hay una diferencia importante

**589 tests no significan 589 escenarios reales de usuario.**

No veo evidencia suficiente de una estrategia fuerte de:

```text
E2E
browser
mobile
producción
database real
concurrency
```

Eso es lo que falta.

### Próximo nivel

No necesitas 1.000 tests unitarios.

Necesitas aproximadamente:

```text
20–40 E2E críticos
```

que recorran:

```text
register
→ create account
→ initial balance
→ income
→ expense
→ transfer
→ credit
→ payment
→ sale
→ delete
→ dashboard
→ logout
```

y especialmente:

```text
User A ≠ User B
```

* * *

# 14\. i18n

## Resultado: 🟢 8.5/10

El proyecto tiene ES/EN y las reglas del proyecto exigen paridad.

Las últimas rondas incluso añadieron las claves de R9 en ambos idiomas.

### Deuda

No veo evidencia de un **test automático de paridad de diccionarios**.

Ese test sería barato y valioso:

```text
keys(es) === keys(en)
```

Esto evitaría regresiones.

* * *

# 15\. UX

## Resultado: 🟢 8.5/10

La evolución documentada desde R1 hasta R4 muestra una mejora considerable:

- responsive,
- estados vacíos,
- loading,
- errores,
- icon-only actions,
- filtros,
- modales,
- dashboard,
- onboarding,
- responsive tables,
- dark/light,
- branding.

El dashboard actual tiene componentes específicos para:

- filtros,
- summary cards,
- position cards,
- gráfico,
- movimientos recientes.

Eso es una arquitectura UI razonable.

### Pero todavía no considero que UX sea "producto comercial maduro"

Faltan probablemente pruebas sistemáticas de:

- onboarding real con usuarios nuevos;
- accesibilidad;
- errores de red;
- doble click;
- navegación atrás/adelante;
- formularios interrumpidos;
- móviles pequeños;
- conexión lenta;
- estados concurrentes.

* * *

# 16\. PWA

Hay una base PWA y service worker, según el árbol actual y el historial documentado. ([GitHub](https://github.com/pabadev/twincap/tree/master/src/components "twincap/src/components at master · pabadev/twincap · GitHub"))

Pero yo **no pondría PWA como prioridad ahora**.

Para TwinCap, la prioridad debería ser:

```text
integridad
seguridad
performance
E2E
operación
```

antes que seguir perfeccionando capacidades offline.

* * *

# 17\. Dependencias

El stack está muy contenido:

```text
Next 16.3.1
React 19.2.8
Mongoose 8.24.3
Jose 6.2.9
Zod 4.4.3
Vitest 3.2.7
Tailwind 4
pnpm 11.22
```

según `package.json`.

Eso me gusta.

No veo una proliferación innecesaria de dependencias.

Especialmente bueno:

> no hay librería externa de UI, gráficos ni tablas.

Esto reduce superficie de mantenimiento.

* * *

# 18\. Hay un pequeño problema de identidad técnica

El `package.json` todavía dice:

```json
"name": "globalmoney"
```

mientras el producto se llama TwinCap.

No es un problema funcional.

Pero sí es una señal de que todavía quedan restos del origen del proyecto.

Para una futura preparación comercial convendría revisar:

- package name,
- metadata,
- manifest,
- títulos,
- description,
- nombre de variables,
- comentarios históricos,
- referencias a GlobalMoney.

No lo considero urgente.

* * *

# 19\. Observabilidad: aquí veo una deuda seria

## Resultado: 🟠 5.5/10

Para un SaaS financiero, no basta con:

```text
try/catch
toast
error.tsx
```

Necesitas eventualmente saber:

```text
qué ocurrió
a qué usuario
en qué operación
con qué entidad
cuándo
qué falló
qué movimiento generó
```

Especialmente para:

- ventas,
- créditos,
- transferencias,
- write-offs,
- eliminaciones.

### TwinCap ya tiene algo muy útil

Los `opId` en movimientos son una excelente base para idempotencia y trazabilidad. `MovementLink` los define explícitamente como marcadores de operación deterministas.

Pero falta convertir eso en una estrategia de observabilidad real.

* * *

# 20\. Idempotencia

## Resultado: 🟢 8/10

Aquí hay buenas bases.

Los movimientos vinculados tienen:

```text
kind
refId
opId
```

y el proyecto ya ha trabajado explícitamente la idempotencia.

Eso es muy valioso.

### Pero falta una pregunta importante

¿Qué ocurre si:

```text
usuario hace doble click
```

o:

```text
cliente pierde conexión
↓
request tarda
↓
usuario reintenta
```

?

La existencia de `opId` ayuda, pero yo auditaría explícitamente **cada Server Action financiera** para comprobar que realmente es idempotente cuando debe serlo.

* * *

# 21\. El modelo de datos todavía tiene una complejidad inherente

TwinCap tiene:

```text
Account
Movement
Category
Client
Sale
CreditGranted
CreditReceived
Payable
Transfer
```

Esto es correcto.

Pero también significa que cada nueva funcionalidad tiene potencial para crear nuevas relaciones.

Por ejemplo:

```text
Sale
  ↕
CreditGranted
  ↕
Movement
  ↕
Account
  ↕
Dashboard
```

La experiencia de R5–R7 demuestra precisamente que esas relaciones son la zona donde aparecen los bugs más peligrosos.

Por eso:

> **Yo evitaría agregar nuevas entidades grandes durante la próxima ronda.**

* * *

# 22\. Compras

Estoy de acuerdo con la decisión documentada de **no crear Compras todavía**.

La auditoría histórica ya concluyó que Payable puede cubrir obligaciones, mientras que una verdadera gestión de compras requeriría:

- proveedores,
- inventario,
- costos,
- posiblemente productos.

Crear Compras ahora probablemente aumentaría la complejidad más rápido de lo que aumentaría el valor comercial.

* * *

# 23\. El principal riesgo de producto

No es técnico.

Es **scope creep**.

TwinCap ya tiene:

```text
finanzas personales
+
finanzas de negocio
+
cuentas
+
movimientos
+
transferencias
+
créditos recibidos
+
créditos otorgados
+
ventas
+
clientes
+
payables
+
dashboard
+
PWA
+
i18n
```

Eso es bastante.

El peligro ahora es seguir agregando funcionalidades porque "faltan cosas".

Creo que la próxima etapa debería ser:

> **hacer TwinCap más confiable, rápido y comercializable**, no necesariamente más grande.

* * *

# 24\. ¿Está listo para usuarios reales?

Mi respuesta:

### Para beta privada:

**Sí.**

### Para primeros usuarios externos controlados:

**Sí, después de una revisión de seguridad/operación corta.**

### Para lanzamiento público:

**Todavía no.**

### Para manejar miles de usuarios:

**No todavía.**

La razón no es que el dominio esté mal.

La razón es:

```text
security hardening
+
rate limiting
+
E2E
+
observability
+
performance
+
operational safeguards
```

* * *

# 25\. Los 10 hallazgos que yo convertiría en la próxima ronda

Los ordenaría así:

| Prioridad | Hallazgo | Severidad |
| --- | --- | --- |
| **P1** | Rate limiting / protección anti-abuso de auth | 🔴 Alta |
| **P2** | E2E de flujos financieros críticos | 🔴 Alta |
| **P3** | Auditoría de tenant isolation exhaustiva | 🔴 Alta |
| **P4** | Auditoría de idempotencia de Server Actions | 🔴 Alta |
| **P5** | Estrategia de operaciones multi-documento | 🟠 Alta |
| **P6** | Reducir carga de TODOS los movimientos del dashboard | 🟠 Media-Alta |
| **P7** | Observabilidad/audit trail operacional | 🟠 Media-Alta |
| **P8** | Validación automática ES/EN | 🟡 Media |
| **P9** | E2E responsive / mobile | 🟡 Media |
| **P10** | Limpieza final de identidad `globalmoney` → TwinCap | 🟢 Baja |

* * *

# 26\. Algo que NO recomiendo hacer

No recomiendo una nueva ronda tipo:

> "auditar absolutamente todo otra vez y rehacer arquitectura".

Sería contraproducente.

Las rondas 6–9 ya muestran un patrón:

```text
bug real
↓
auditoría
↓
causa raíz
↓
fix pequeño
↓
tests
↓
QA
```

Ese proceso está funcionando.

Ahora conviene cambiar el foco.

* * *

# 27\. Mi diagnóstico de madurez

Yo pondría a TwinCap actualmente en esta etapa:

```text
                    TwinCap
                       │
                       ▼
              ┌─────────────────┐
              │ Prototipo       │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ MVP funcional   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ MVP sólido      │ ◄── ESTÁS AQUÍ
              └────────┬────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
      Hardening técnico    Validación mercado
             │                   │
             └─────────┬─────────┘
                       ▼
              ┌─────────────────┐
              │ Producto        │
              │ comercializable │
              └─────────────────┘
```

Y hay algo especialmente interesante:

**el cuello de botella ya no es principalmente programación.**

Está empezando a ser:

> **ingeniería de producto + seguridad + operación + validación con usuarios.**

* * *

# 28\. Conclusión objetiva

Después de revisar el estado actual, **mi opinión sobre TwinCap es más positiva que en la evaluación anterior**.

No porque tenga muchas funcionalidades, sino porque las últimas rondas han atacado problemas estructurales reales.

Especialmente:

- la separación de resultado económico y capital financiero;
- la semántica de créditos;
- la amortización capital/interés;
- write-off;
- la corrección UUID/ObjectId;
- la defensa contra movimientos huérfanos;
- la consistencia de balances;
- la separación entre dominio y MongoDB;
- los 589 tests;
- el aislamiento por usuario.

Eso demuestra que el proyecto **ya tiene una base técnica sobre la cual sí vale la pena construir un producto comercial**.

Pero precisamente porque ahora el núcleo está bastante bien, **yo no añadiría otra funcionalidad grande todavía**.

La siguiente ronda debería ser algo conceptualmente diferente:

## **Ronda 10 — Production & Commercial Hardening**

Con foco en:

**Seguridad → E2E → aislamiento → idempotencia → consistencia → performance → observabilidad → preparación para usuarios reales.**

Y solo después de eso tendría sentido volver a discutir funcionalidades comerciales como presupuestos, exportaciones, comparación de períodos, flujo de caja, etc.

**En resumen: TwinCap ya tiene suficiente producto. Ahora necesita demostrar que puede soportar usuarios.**