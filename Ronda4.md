# TwinCap — Rediseño y evolución del Dashboard financiero

## 1. CONTEXTO Y OBJETIVO

Estás trabajando sobre **TwinCap**, una aplicación SaaS de finanzas personales y pequeños negocios que ya tiene una implementación funcional y varias rondas de auditoría, corrección y evolución.

El objetivo de esta tarea es realizar una **evolución del Dashboard existente**, enfocada principalmente en:

- Mostrar información financiera relevante de forma inmediata.
- Reducir la sensación de saturación visual.
- Dar mayor protagonismo a los indicadores financieros realmente importantes.
- Convertir los reportes secundarios en accesos organizados y fáciles de descubrir.
- Incorporar un resumen tabular de ingresos y gastos que permita entender rápidamente dónde se está generando o consumiendo el dinero.
- Hacer que los filtros sean realmente útiles para responder preguntas como:
  - ¿Cuánto ingresé este mes?
  - ¿Cuánto gasté este mes?
  - ¿Cuánto ingresó únicamente en el negocio?
  - ¿Cuánto gasté únicamente en lo personal?
  - ¿Cuánto gasté en una categoría específica?
  - ¿Cuánto ingresó entre determinadas fechas?
- Mejorar la experiencia responsive, especialmente en móviles.
- Mantener intactas las reglas financieras, arquitectura, seguridad, i18n y funcionalidades existentes.

**IMPORTANTE:** esta tarea NO autoriza a reescribir TwinCap ni a rehacer desde cero el Dashboard. Debes partir del código actual y reutilizar la infraestructura, use cases, componentes UI, filtros, modelos y patrones existentes siempre que sea posible.

---

# 2. CONTEXTO DEL ESTADO ACTUAL DEL PROYECTO

La Ronda 3 ya fue completada.

El `AUDIT-AND-PLAN.md` registra que la Ronda 3 terminó el 2026-08-25 con:

- 0 hallazgos CRITICAL.
- 7 hallazgos MINOR no bloqueantes.
- 412/412 tests.
- 42 archivos de tests.
- TypeScript limpio.
- Responsive verificado en 375px, 768px y 1280px.
- i18n es/en verificado.
- Accesibilidad verificada.

No debes asumir que las observaciones históricas siguen exactamente iguales al código actual: **inspecciona el repositorio real antes de modificarlo**.

La Fase 4 de Ronda 3 ya implementó:

- Sistema de filtros composables.
- Filtros de ámbito/cuenta/categoría/período.
- Activos y pasivos por moneda.
- Evolución anual mensual.
- Use cases separados para agregaciones.
- Tests específicos de estas agregaciones.
- Orquestación mediante `dashboard-content.tsx`.

Por tanto, esta tarea debe entenderse como una **nueva evolución UX/UI y funcional del Dashboard actual**, aprovechando esas bases.

---

# 3. DOCUMENTOS Y REGLAS DE PRIORIDAD

Antes de modificar cualquier archivo:

1. Leer completamente `AGENTS.md`.
2. Leer completamente `docs/AUDIT-AND-PLAN.md`.
3. Inspeccionar el código real del Dashboard y sus componentes relacionados.
4. Revisar `package.json`.
5. Revisar `README.md`.
6. Buscar en el código los componentes, use cases, filtros, acciones y tipos actualmente utilizados por Dashboard y Movements.
7. Verificar si existen pendientes de Ronda 3 directamente relacionados con:
   - Dashboard.
   - filtros.
   - agregaciones.
   - rendimiento.
   - tablas.
   - movimientos.
   - responsive.
   - formatos monetarios.
   - moneda.
   
Los pendientes relacionados deben incorporarse si siguen siendo válidos en el código actual.

No incorporar automáticamente features del roadmap que no tengan relación directa con este requerimiento.

---

# 4. REGLAS INQUEBRANTABLES

Respeta todas las reglas de `AGENTS.md`.

Especialmente:

## Arquitectura

Mantener la arquitectura hexagonal existente:

- `core/domain`: dominio puro.
- `core/application`: use cases.
- `infrastructure`: adapters/repositorios.
- `components`: presentación.
- `app`: composición/rutas.

Los componentes visuales no deben realizar llamadas directas a repositorios.

No introducir lógica financiera importante directamente dentro de componentes React si puede pertenecer a un use case.

Si se requiere una nueva agregación financiera, preferir crear o extender un use case en `core/application`.

## Base de datos

Todo server action, page o route handler que acceda a MongoDB debe respetar:

- `await connectDb()`.
- Crear repositories después de conectar.
- Nunca instanciar repositories a nivel de módulo.

## Paquetes

Usar exclusivamente `pnpm`.

No instalar nuevas dependencias salvo que sea estrictamente necesario y esté justificado.

Preferir soluciones nativas y componentes existentes.

No introducir librerías nuevas de gráficos, tablas, UI o iconos.

## UI

Utilizar los componentes existentes de:

`src/components/ui/`

Antes de crear uno nuevo, verificar si ya existe uno equivalente.

Usar Lucide React mediante el wrapper existente del proyecto.

## i18n

Todo texto visible nuevo debe existir en:

- `messages/es.json`
- `messages/en.json`

No hardcodear textos visibles.

El español debe ser neutro.

## Finanzas

No modificar las reglas financieras establecidas.

En particular:

- Una transferencia interna no es ingreso ni gasto.
- Un saldo de cuenta no es resultado económico.
- Las métricas de ingreso/gasto deben respetar la naturaleza del movimiento.
- No contar dos veces las transferencias.
- No inventar conversiones FX.
- Las monedas deben mostrarse honestamente.
- No compensar fechas con offsets arbitrarios.
- Mantener la convención de fechas ya implementada.

La implementación actual de Ronda 3 excluye transferencias y movimientos de apertura de los resultados económicos de ingresos/gastos. Esa semántica debe conservarse.

## Seguridad

Mantener tenant isolation.

Nunca permitir que los filtros o agregaciones puedan consultar datos de otro usuario.

Los filtros frontend nunca deben ser considerados una frontera de seguridad.

---

# 5. OBJETIVO UX DEL NUEVO DASHBOARD

El Dashboard debe tener una jerarquía visual mucho más clara.

La prioridad debe ser:

1. Filtros.
2. Indicadores principales.
3. Cuentas.
4. Resumen de ingresos y gastos.
5. Otros reportes.

La página no debe intentar mostrar todos los reportes simultáneamente.

La idea es que el usuario pueda entrar al Dashboard y entender su situación financiera principal en pocos segundos.

---

# 6. ESTRUCTURA PROPUESTA DEL DASHBOARD

La estructura visual debe quedar aproximadamente así:

```text
Dashboard
│
├── Saludo / encabezado existente
│
├── Filtros
│
├── 4 indicadores principales
│   ├── Balance total
│   ├── Ingresos de este mes
│   ├── Gastos de este mes
│   └── Posición financiera
│
├── Cards de cuentas
│
├── Resumen financiero
│   ├── Tabla de Ingresos
│   └── Tabla de Gastos
│
└── Reportes
    ├── Gráficos
    ├── Activos y Pasivos
    ├── Resumen de movimientos
    └── Otros reportes relevantes
```

No asumir que esta estructura debe implementarse literalmente si la arquitectura actual aconseja una composición ligeramente diferente. El resultado funcional y visual debe respetar esta jerarquía.

---

# 7. FILTROS DEL DASHBOARD

El sistema de filtros existente debe conservarse y convertirse en una pieza central de la experiencia.

Los filtros deben permitir combinar:

### Ámbito

- Todos.
- Personal.
- Negocio.

La clasificación debe respetar el modelo actual del proyecto y la decisión D3-bis.

**No volver a introducir `Account.scope` ni modificar el modelo de dominio para mover la clasificación a las cuentas.**

### Cuenta

Permitir seleccionar:

- Todas las cuentas.
- Una cuenta específica.

### Categoría

Permitir:

- Todas las categorías.
- Una categoría específica.

Debe respetarse la distinción entre categorías de ingreso y gasto.

### Período

Debe permitir seleccionar de forma clara:

- Mes actual.
- Mes específico.
- Año específico cuando corresponda.
- Rango de fechas.

Si el componente de filtros existente ya proporciona parte de estas capacidades, extenderlo en lugar de duplicarlo.

---

# 8. COMPORTAMIENTO FINANCIERO DE LOS FILTROS

Este punto es crítico.

Cuando el usuario modifica cualquier filtro, todas las métricas dependientes del filtro deben recalcularse.

Ejemplo:

```text
Ámbito: Negocio
Mes: Agosto 2026
```

Debe mostrar los ingresos y gastos correspondientes únicamente a ese contexto.

Otro ejemplo:

```text
Ámbito: Personal
Categoría: Alimentación
Rango: 01/08/2026 → 26/08/2026
```

La tabla de gastos debe mostrar únicamente los movimientos que cumplen todos esos criterios.

Los filtros deben ser composables:

```text
Ámbito
   +
Cuenta
   +
Categoría
   +
Período
```

No implementar múltiples estados independientes que puedan entrar en contradicción.

---

# 9. CUATRO CARDS PRINCIPALES

Mantener las cuatro métricas:

1. **Balance total**
2. **Ingresos de este mes**
3. **Gastos de este mes**
4. **Posición financiera**

Pero rediseñar su presentación para que sean más legibles y compactas.

## Desktop

Las cuatro deben ocupar:

```text
[ Balance ] [ Ingresos ] [ Gastos ] [ Posición ]
```

Una sola fila.

## Mobile

Prioridad:

```text
[ Balance ] [ Ingresos ]
[ Gastos  ] [ Posición ]
```

Dos columnas.

Solo si el viewport es demasiado estrecho y la legibilidad se ve comprometida, permitir una columna.

**Prioridad: 2 columnas.**

No reducir excesivamente tipografía ni espacio interno para conseguir dos columnas.

Los valores monetarios deben poder leerse completos.

Nunca truncar montos importantes.

---

# 10. CARDS DE CUENTAS

Debajo de las cuatro métricas principales deben permanecer las cards de cuentas.

## Desktop

Preferiblemente:

```text
[ Cuenta 1 ] [ Cuenta 2 ] [ Cuenta 3 ] [ Cuenta 4 ]
```

Una fila de cuatro cuando el espacio lo permita.

Si existen más de cuatro cuentas, mantener el mecanismo existente para mostrarlas de forma coherente; no eliminar información.

## Mobile

Prioridad:

```text
[ Cuenta 1 ] [ Cuenta 2 ]
[ Cuenta 3 ] [ Cuenta 4 ]
```

Dos columnas.

La información debe ser legible.

No permitir:

- nombres truncados de manera perjudicial.
- saldos cortados.
- monedas incompletas.
- elementos superpuestos.

## Bug visual existente

Revisar las cards de cuentas porque actualmente las esquinas superiores parecen redondeadas pero algún elemento interno —posiblemente el fondo, header o wrapper— conserva esquinas rectas.

Inspeccionar la composición real del componente.

No aplicar simplemente `overflow-hidden` sin entender qué elemento genera las esquinas incorrectas.

La solución debe conservar correctamente:

- border radius.
- fondo.
- dark mode.
- bordes.
- contenido.
- posibles badges/chips.

---

# 11. NUEVA SECCIÓN: RESUMEN DE INGRESOS Y GASTOS

Esta sección es una de las partes más importantes del nuevo Dashboard.

Debe aparecer debajo de las cards.

Crear dos tablas:

```text
[ Resumen de Ingresos ] [ Resumen de Gastos ]
```

En desktop deben estar una al lado de la otra.

En móvil deben apilarse verticalmente.

---

# 12. ESTRUCTURA DE LAS TABLAS

Cada tabla debe tener cuatro columnas.

La estructura conceptual debe ser:

```text
Categoría | Valor | ... | ...
```

El requerimiento original indica cuatro columnas. Antes de implementar, inspeccionar el modelo actual de datos y determinar las dos columnas adicionales que aporten información realmente útil sin duplicar información.

No inventar columnas arbitrarias.

La información mínima obligatoria es:

- Categoría.
- Valor total de esa categoría.

Las columnas restantes deben justificarse por utilidad real y no simplemente rellenar espacio.

---

# 13. CÁLCULO DE LOS VALORES

### Tabla de ingresos

Para cada categoría:

```text
SUM(movimientos de ingreso de esa categoría)
```

respetando:

- período seleccionado.
- ámbito seleccionado.
- cuenta seleccionada.
- categoría seleccionada.
- reglas financieras de TwinCap.
- moneda.

### Tabla de gastos

Análogo:

```text
SUM(movimientos de gasto de esa categoría)
```

respetando exactamente los mismos filtros.

No sumar simplemente por `type` si la naturaleza financiera del movimiento indica otra cosa.

No incluir transferencias internas como ingreso/gasto.

---

# 14. TOTALIZADOR

Cada tabla debe tener un footer fijo.

Ejemplo conceptual:

```text
┌──────────────────────────────┐
│ Categoría       │ Valor      │
├──────────────────────────────┤
│ Alimentación    │ $500.000   │
│ Transporte      │ $200.000   │
│ Servicios       │ $300.000   │
│ ...                          │
├──────────────────────────────┤
│ TOTAL           │ $1.000.000 │
└──────────────────────────────┘
```

El totalizador debe recalcularse siempre que cambien los filtros.

Debe representar exactamente la suma de las filas visibles/consultadas.

---

# 15. SCROLL INTERNO DE LAS TABLAS

La tabla debe tener altura adaptable según viewport.

La estructura deseada es:

```text
┌───────────────────────┐
│ Header fijo           │
├───────────────────────┤
│                       │
│ cuerpo scrolleable    │
│                       │
│ categorías            │
│ categorías            │
│ categorías            │
│                       │
├───────────────────────┤
│ Footer fijo           │
└───────────────────────┘
```

Requisitos:

- Header siempre visible.
- Footer siempre visible.
- Solo el cuerpo debe hacer scroll.
- No hacer scroll de toda la card.
- La altura debe adaptarse razonablemente al viewport.
- En móvil debe conservar una altura útil sin ocupar toda la pantalla.
- Evitar tablas infinitamente altas.

Si ya existe una primitive de tabla reutilizable, extenderla únicamente si resulta apropiado.

No crear una solución duplicada específica del Dashboard si el patrón puede reutilizarse.

---

# 16. FILTROS Y TOTALIZADORES

Esta regla es obligatoria:

> Siempre que se aplique cualquier filtro en un reporte, todos los totales mostrados deben corresponder al conjunto filtrado.

Por ejemplo:

```text
Sin filtro:
Ingresos = $5.000.000

Filtro:
Ámbito = Negocio

Resultado:
Ingresos = $2.800.000
```

El footer de la tabla también debe mostrar:

```text
Total = $2.800.000
```

Nunca mostrar un total global mientras las filas están filtradas.

---

# 17. MULTIMONEDA

TwinCap no dispone de FX real.

Por tanto:

- No convertir monedas.
- No inventar una tasa.
- No sumar COP + USD como si fueran la misma unidad.
- Si una consulta puede producir resultados en varias monedas, presentarlos agrupados por moneda de forma honesta.

Antes de decidir la UI final, inspeccionar cómo las agregaciones actuales manejan multi-moneda y reutilizar ese patrón.

---

# 18. MENÚ DE REPORTES

El Dashboard no debe mostrar todos los reportes detallados simultáneamente.

Crear una sección de acceso a reportes mediante un grid de cards clicables.

Conceptualmente:

```text
┌─────────────┐ ┌─────────────┐
│    icono    │ │    icono    │
│             │ │             │
│  Gráficos   │ │ Activos y   │
│             │ │  Pasivos    │
└─────────────┘ └─────────────┘

┌─────────────┐ ┌─────────────┐
│    icono    │ │    icono    │
│             │ │             │
│ Movimientos │ │   Reporte   │
│             │ │     ...     │
└─────────────┘ └─────────────┘
```

Cada card debe contener:

- Icono Lucide de tamaño medio.
- Texto debajo.
- Área clicable completa.
- Feedback hover/focus.
- Estado accesible.
- Compatibilidad light/dark.
- Navegación hacia la vista correspondiente.

No usar iconos gigantes.

No llenar la pantalla de elementos gráficos.

El estilo debe ser profesional, limpio y coherente con el design system actual.

---

# 19. REPORTES QUE DEBEN APARECER

Como mínimo evaluar estos accesos:

### Gráficos

Debe llevar al reporte/gráfico existente de evolución financiera.

### Activos y Pasivos

Debe llevar a la vista existente correspondiente a la posición financiera detallada.

### Resumen de movimientos

Debe llevar a una vista donde el usuario pueda analizar movimientos.

### Otros reportes relevantes

Inspeccionar las rutas actuales del proyecto y determinar qué otros reportes existentes tienen sentido.

**No inventar funcionalidades nuevas solamente para llenar el grid.**

Si no existe un reporte apropiado, no crear una feature comercial nueva como parte de esta tarea.

---

# 20. TABLA DE MOVIMIENTOS

Modificar el orden visual de columnas de la tabla de Movimientos.

Orden requerido:

```text
1. Fecha
2. Monto
3. Categoría
4. Nota
5. Tipo
6. Acciones
```

Actualmente la categoría no está visible correctamente y debe incorporarse.

Las acciones deben seguir siendo:

- Editar.
- Eliminar.

Deben conservar el patrón icon-only ya existente cuando corresponda.

---

# 21. RESPONSIVE DE MOVIMIENTOS

La prioridad en móvil es mostrar primero la información más importante.

En pantallas pequeñas:

```text
Fecha | Monto | Categoría | Nota | Tipo | Acciones
```

Las primeras columnas deben quedar visibles.

Si no cabe todo horizontalmente, el resto puede desplazarse horizontalmente.

Pero:

- No ocultar información importante.
- No truncar datos críticos innecesariamente.
- Mantener acciones accesibles.
- Mantener la tabla legible.
- Evitar que la solución dependa exclusivamente de `overflow-x: auto`.

Respetar la regla existente de responsive:

- 375px.
- 768px.
- 1280px.

---

# 22. CATEGORÍA EN MOVIMIENTOS

La columna Categoría debe mostrar correctamente:

- Categorías reales.
- Categorías sintéticas/sistema cuando corresponda.
- Etiquetas localizadas mediante i18n.

No mostrar:

- `uncategorized` innecesariamente.
- claves internas.
- IDs.
- texto técnico.

La solución debe reutilizar la infraestructura de categorías/i18n ya implementada en Ronda 3.

---

# 23. FORMATO DE MONEDA

Utilizar el formatter monetario canónico existente.

No crear un nuevo formatter.

No concatenar manualmente códigos de moneda cuando el formatter ya los produce.

Evitar definitivamente problemas como:

```text
12.000 COP COP
```

o cualquier equivalente.

---

# 24. PERFORMANCE

La auditoría de Ronda 3 registró que el Dashboard podía cargar todos los movimientos para posteriormente procesarlos en memoria.

Antes de finalizar la implementación, comprobar el estado actual de este problema.

Si todavía existe y afecta al nuevo Dashboard:

- Evitar cargar datos innecesarios.
- Preferir consultas/agregaciones acotadas.
- Aprovechar los use cases existentes.
- No romper la arquitectura.
- No introducir una optimización improvisada específica de un componente si el problema pertenece a application/infrastructure.

No convertir esta tarea en una reescritura completa de la capa de persistencia.

---

# 25. ESTADO Y ARQUITECTURA DE FILTROS

El estado actual de los filtros fue implementado como estado React y no como parámetros URL.

No cambiar automáticamente esa decisión.

Primero evaluar si el nuevo Dashboard necesita realmente persistencia en URL.

Si no es necesario, conservar la solución existente.

Evitar introducir complejidad innecesaria.

---

# 26. REPORTES Y FILTROS: DECISIÓN DE ALCANCE

Los filtros del Dashboard deben controlar los elementos que conceptualmente representan actividad financiera filtrable:

- ingresos.
- gastos.
- evolución o resúmenes dependientes del período.
- tablas de categorías.

No asumir que Activos/Pasivos deben reaccionar a filtros de movimientos.

La implementación de Ronda 3 dejó explícitamente Activos/Pasivos independientes de los filtros de actividad.

**No cambiar esa semántica sin evidencia y sin justificarlo.**

---

# 27. NO ROMPER LAS FUNCIONES EXISTENTES

No eliminar ni degradar:

- saludo personalizado.
- filtros existentes.
- Activos/Pasivos.
- evolución anual.
- cards de cuentas.
- balances.
- dark mode.
- i18n.
- responsive.
- loading states.
- empty states.
- error states.
- accesibilidad.
- navegación existente.
- seguridad/tenant isolation.

Si una funcionalidad existente debe moverse visualmente, conservar su comportamiento.

---

# 28. REUTILIZACIÓN

Antes de crear componentes nuevos, inspeccionar:

```text
src/components/ui/
src/components/
src/app/(main)/dashboard/
src/app/(main)/movements/
src/core/application/
src/lib/
```

Identificar y reutilizar:

- Card.
- Table.
- Button.
- Icon.
- estados loading/empty/error.
- formatter.
- filtros.
- agregaciones.
- componentes del Dashboard existentes.

No duplicar componentes.

---

# 29. POSIBLE ESTRUCTURA DE COMPONENTES

No es una instrucción rígida; úsala únicamente si encaja con la arquitectura actual.

Podrían existir conceptos como:

```text
dashboard-content
dashboard-filters
dashboard-summary-cards
account-cards
income-expense-summary
income-summary-table
expense-summary-table
dashboard-reports-grid
report-card
```

Pero primero inspecciona qué ya existe.

Si un componente existente ya cumple una función, extiéndelo.

---

# 30. CRITERIOS VISUALES

El nuevo Dashboard debe sentirse:

- limpio.
- profesional.
- financiero.
- ordenado.
- rápido de interpretar.
- consistente con TwinCap.
- moderno sin ser excesivamente decorativo.

Evitar:

- exceso de gradientes.
- exceso de colores.
- iconos gigantes.
- demasiados bordes.
- cards innecesariamente altas.
- textos pequeños.
- información truncada.
- layouts saturados.
- elementos decorativos que compitan con los números.

La información financiera debe ser el protagonista.

---

# 31. ACCESIBILIDAD

Mantener los estándares ya verificados en Ronda 3.

Todos los elementos interactivos deben:

- ser accesibles mediante teclado.
- tener estados focus visibles.
- tener nombres accesibles.
- funcionar correctamente en dark/light mode.
- conservar contraste adecuado.

Las cards de reportes clicables deben comportarse como elementos interactivos reales, no como simples `div`.

---

# 32. I18N

Agregar todas las claves necesarias en:

```text
messages/es.json
messages/en.json
```

Debe existir paridad.

Ejemplos conceptuales de claves:

```text
Dashboard.incomeSummary
Dashboard.expenseSummary
Dashboard.total
Dashboard.reports
Dashboard.reportCharts
Dashboard.reportAssetsLiabilities
Dashboard.reportMovements
```

No necesariamente uses estos nombres: respeta el namespace/patrón actual del proyecto.

No hardcodear textos.

---

# 33. AUDITORÍA PREVIA OBLIGATORIA

Antes de escribir código:

1. Inspecciona la implementación actual del Dashboard.
2. Identifica todos sus componentes.
3. Identifica sus server components/client components.
4. Identifica cómo llegan actualmente los datos.
5. Identifica cómo funcionan los filtros.
6. Identifica las agregaciones existentes.
7. Identifica cómo se calcula cada una de las cuatro métricas.
8. Identifica cómo se calculan Activos/Pasivos.
9. Identifica el gráfico actual.
10. Identifica las rutas existentes de reportes.
11. Inspecciona la tabla de Movimientos.
12. Inspecciona el componente Card utilizado para cuentas.
13. Revisa los formatter monetarios.
14. Revisa los textos i18n existentes.
15. Revisa los pendientes de Ronda 3 relevantes.
16. Verifica si el problema de carga completa del Dashboard continúa.
17. Verifica si existen problemas actuales de cross-currency.
18. Verifica si existen problemas de categorías sintéticas.
19. Verifica si existe alguna regresión desde el cierre de Ronda 3.

No modificar código durante esta auditoría inicial.

---

# 34. PLAN ANTES DE IMPLEMENTAR

Después de la auditoría, presenta un plan breve y concreto indicando:

- qué archivos/componentes serán modificados;
- qué componentes serán reutilizados;
- qué componentes nuevos son realmente necesarios;
- qué lógica financiera nueva, si alguna, será necesaria;
- qué use cases serán modificados o creados;
- qué cambios de i18n son necesarios;
- qué tests serán agregados/modificados;
- riesgos detectados;
- posibles pendientes de Ronda 3 que se incorporarán.

No rehagas una auditoría completa de toda la aplicación si no es necesaria.

La auditoría debe concentrarse en el alcance de este requerimiento.

---

# 35. IMPLEMENTACIÓN POR FASES

Divide el trabajo en unidades lógicas pequeñas.

Una posible división es:

### Fase A — Auditoría y preparación
Solo inspección.

### Fase B — Rediseño estructural del Dashboard
- jerarquía.
- cards principales.
- cards de cuentas.
- grid de reportes.

### Fase C — Resumen de ingresos/gastos
- tablas.
- agregaciones.
- totalizadores.
- scroll interno.
- responsive.

### Fase D — Integración y comportamiento de filtros
- asegurar que todas las tablas y métricas filtrables respondan correctamente.
- revisar multi-moneda.
- revisar rendimiento.

### Fase E — Movimientos responsive
- orden de columnas.
- categoría.
- mobile UX.

### Fase F — QA final
- i18n.
- dark/light.
- responsive.
- accesibilidad.
- tests.
- typecheck.
- lint.
- build.

La división definitiva puede cambiar después de inspeccionar el código.

---

# 36. TESTING

Toda lógica nueva de agregación debe tener tests.

Agregar tests para:

### Ingresos por categoría

- múltiples movimientos.
- categorías diferentes.
- filtro por período.
- filtro Personal.
- filtro Negocio.
- filtro por cuenta.
- combinación de filtros.
- ausencia de resultados.

### Gastos por categoría

Mismos escenarios.

### Totales

Verificar:

```text
sum(filas) === totalFooter
```

### Transferencias

Verificar que no aparezcan como ingresos/gastos.

### Multi-moneda

Verificar que no se mezclen monedas.

### Filtros combinados

Por ejemplo:

```text
Negocio + cuenta X + categoría Y + rango de fechas
```

### Responsive

No necesariamente mediante tests unitarios, sino mediante verificación manual/automatizada apropiada en:

- 375px.
- 768px.
- 1280px.

---

# 37. VALIDACIONES OBLIGATORIAS AL FINAL

Ejecutar:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

No ocultar ni suprimir tests fallidos.

Si algo falla:

1. investigar la causa;
2. corregirla si pertenece al alcance;
3. volver a ejecutar las verificaciones.

---

# 38. CRITERIOS DE ACEPTACIÓN FUNCIONALES

La tarea se considera correcta cuando:

- El Dashboard presenta la información principal inmediatamente.
- Las cuatro métricas aparecen en una fila en desktop.
- Las cuatro métricas aparecen preferentemente en 2 columnas en móvil.
- Las cards de cuentas utilizan una distribución legible.
- Las esquinas de las cards de cuentas se ven correctamente redondeadas.
- Existe un resumen de ingresos.
- Existe un resumen de gastos.
- Las tablas muestran categorías y valores correctamente.
- Los totalizadores están siempre visibles.
- El cuerpo de las tablas es scrolleable.
- Los headers permanecen visibles.
- Los footers permanecen visibles.
- Los totales cambian al aplicar filtros.
- Se puede analizar Personal vs Negocio.
- Se puede filtrar por cuenta.
- Se puede filtrar por categoría.
- Se puede filtrar por período.
- Se pueden combinar los filtros.
- No se cuentan transferencias como ingresos/gastos.
- No se mezclan monedas incorrectamente.
- Los reportes secundarios aparecen agrupados en cards clicables.
- Los reportes existentes siguen funcionando.
- Movimientos tiene el nuevo orden de columnas.
- Categoría es visible.
- En móvil, Fecha y Monto aparecen primero.
- No existen textos críticos truncados.
- No existen montos truncados.
- No existen `COP COP` ni formatos monetarios duplicados.
- No hay textos nuevos hardcodeados.
- ES y EN tienen paridad.
- Dark/light funcionan correctamente.
- No se rompe tenant isolation.
- Los tests pasan.
- TypeScript pasa.
- ESLint pasa.
- Build pasa.

---

# 39. RESTRICCIONES EXPLÍCITAS

NO:

- reescribir TwinCap;
- cambiar Next.js;
- cambiar React;
- cambiar Tailwind;
- cambiar Mongoose;
- cambiar arquitectura;
- instalar librerías de UI;
- instalar librerías de gráficos;
- instalar librerías de tablas;
- crear módulo Compras;
- crear equipos/colaboradores/roles;
- inventar FX;
- mover Personal/Negocio nuevamente a `Account.scope`;
- eliminar los filtros existentes;
- eliminar Activos/Pasivos;
- eliminar evolución anual;
- contar transferencias como ingresos/gastos;
- hardcodear textos;
- usar `window.location.reload()` como solución;
- crear soluciones duplicadas para problemas que ya tienen componentes reutilizables;
- sacrificar accesibilidad por estética;
- sacrificar legibilidad por conseguir un determinado número de columnas;
- ocultar información importante en móvil.

---

# 40. REGLA ESPECIAL SOBRE LA RONDA 3

La Ronda 3 está cerrada.

No trates los documentos de Ronda 3 como si sus fases estuvieran pendientes de ejecutar nuevamente.

Usa `AUDIT-AND-PLAN.md` como contexto histórico y fuente de decisiones ya tomadas.

En particular, F4 ya fue implementada y verificada.

Si encuentras un comportamiento que contradice lo documentado como completado, primero determina si:

1. el código actual cambió después de la documentación;
2. existe una regresión;
3. el comportamiento documentado ya no corresponde al producto;
4. o simplemente estás interpretando incorrectamente la implementación.

No rehacer fases anteriores automáticamente.

Los pendientes históricos solo deben incorporarse cuando sigan siendo relevantes para el alcance actual.

---

# 41. REGLA FINAL DE IMPLEMENTACIÓN

Trabaja con una mentalidad de **evolución incremental**, no de reconstrucción.

Antes de crear cualquier solución:

> "¿TwinCap ya tiene algo que haga esto?"

Si existe:

> reutilizar/extender.

Si no existe:

> crear la mínima pieza necesaria respetando la arquitectura.

La calidad del resultado se mide no solamente por que el Dashboard se vea mejor, sino porque:

- los números sigan siendo financieramente correctos;
- los filtros sean confiables;
- la información sea inmediatamente comprensible;
- móvil y desktop sean realmente utilizables;
- el código permanezca mantenible;
- no se introduzcan regresiones.

**Primero inspecciona. Luego presenta el plan. Después implementa por fases pequeñas y verificables.**