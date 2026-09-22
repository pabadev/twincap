# RONDA POST-UX — CONSOLIDACIÓN, RECONCILIACIÓN Y PREPARACIÓN DE LA SIGUIENTE ETAPA

## 0. NATURALEZA DE ESTA RONDA

Esta ronda ocurre inmediatamente después de la primera ronda general de UX/UI de TwinCap.

NO es una nueva ronda de rediseño general.

NO debes rehacer la UX ya implementada.

NO debes reabrir el dominio financiero ni modificar arbitrariamente la arquitectura que fue congelada durante las rondas financieras anteriores.

El objetivo es:

1. auditar el estado real post-UX/UI;
2. reconciliar documentación, reglas, diseño y código;
3. corregir todos los hallazgos reales;
4. incorporar las observaciones de usuarios beta que sean coherentes con la visión de TwinCap;
5. corregir inconsistencias de responsive, accesibilidad, navegación y Design System;
6. proteger nuevamente la integridad financiera;
7. preparar arquitectónicamente internacionalización PT-BR;
8. diseñar seriamente la estrategia Offline;
9. dejar documentadas las capacidades futuras de analítica, inventario y costos;
10. ejecutar una validación final integral antes de declarar esta ronda cerrada.

La regla principal es:

> NO agregues complejidad por agregarla. Pero tampoco dejes sin corregir un hallazgo real solamente porque "no sea crítico".

---

# 1. LECTURA OBLIGATORIA ANTES DE MODIFICAR CUALQUIER ARCHIVO

Antes de tocar código debes leer obligatoriamente:

- `AGENTS.md`
- `PROJECT-RULES.md`
- `docs/AUDIT-AND-PLAN.md`
- `docs/UX-UI-AUDIT.md`
- `docs/UX-RESUMEN-DESIGN.md`
- `docs/UX-ROADMAP.md`
- documentación de las rondas financieras R15/R15.1/R15.2/R15.3 y sus documentos vigentes
- documentación de UX-11 y UX-12
- cualquier archivo de reglas persistentes creado durante las rondas anteriores

Si existe un archivo de "lectura obligatoria al inicio de cada sesión/post-compactación", debes leerlo antes de trabajar.

Ese archivo debe seguir siendo la fuente consolidada de reglas operativas del proyecto.

NO ignores documentación por considerarla antigua hasta haber comprobado si fue reemplazada formalmente.

---

# 2. REGLA DE PRECEDENCIA

Cuando encuentres contradicciones entre:

- código;
- tests;
- documentación;
- diseño;
- reportes de agentes;
- decisiones históricas;

NO elijas arbitrariamente.

Debes:

1. identificar la contradicción;
2. determinar cuál es la decisión vigente;
3. documentarla;
4. actualizar las fuentes que hayan quedado obsoletas;
5. implementar según la decisión vigente.

Especialmente importante:

> Un test que valida el comportamiento actual NO demuestra por sí solo que el comportamiento actual sea el comportamiento correcto.

Primero debe comprobarse el contrato vigente.

---

# 3. REGLA ABSOLUTA SOBRE EL DOMINIO FINANCIERO

Mantén intactas las garantías establecidas durante las rondas financieras.

NO reintroducir:

- floats para dinero;
- cálculos monetarios inseguros;
- agregaciones sin protección;
- balances derivados incorrectamente;
- doble aplicación de operaciones;
- pérdida de idempotencia;
- pérdida de atomicidad;
- pérdida de aislamiento por workspace;
- operaciones parcialmente aplicadas;
- conversiones monetarias silenciosas;
- moneda inventada;
- bypass de reglas de concurrencia.

Las mejoras UX no justifican debilitar ninguna garantía financiera.

---

# 4. TRANSFERENCIAS DEBE VOLVER AL SIDEBAR

La ruta `/transfers` continúa funcionando y la operación forma parte del producto.

Restaurar "Transferencias" en el sidebar respetando la jerarquía actual.

NO crear una segunda implementación.

Usar el módulo/ruta existente.

Verificar:

- desktop;
- móvil;
- estado activo;
- navegación;
- icono;
- traducciones;
- accesibilidad.

Agregar/actualizar tests si corresponde.

---

# 5. FAB GLOBAL DE ACCIONES RÁPIDAS

El FAB debe contener exactamente estas tres acciones:

1. Venta POS
2. Ingreso
3. Gasto

Orden:

```text
Venta POS
Ingreso
Gasto
```

Venta POS debe aparecer arriba.

Reglas:

- no convertir el FAB en navegación general;
- cada acción debe abrir el flujo correcto;
- respetar permisos/estado de sesión;
- respetar responsive;
- respetar teclado;
- respetar aria-labels;
- respetar touch targets;
- respetar dark/light;
- no duplicar lógica de formularios existentes.

Agregar tests para la navegación/acción del FAB.

---

# 6. RESUMEN — JERARQUÍA DE INFORMACIÓN

Revisar el orden actual del Resumen.

La prioridad solicitada por usuario beta es:

1. "¿Cuánto tengo disponible?"
2. "Flujo de caja del mes"

La segunda card debe dejar de llamarse ambiguamente "¿Cuánto me quedó este mes?" y utilizar una terminología coherente con:

> Flujo de caja del mes

La card que ocupe el primer lugar debe conservar el formato actual de dato principal, no convertirla en una simple card secundaria.

Mantener la filosofía:

```text
N1 = información financiera esencial
N2 = contexto
N3 = evolución/señales
N4 = detalle
```

No introducir una nueva jerarquía arbitraria.

---

# 7. MOVIMIENTOS RECIENTES

Evaluar e implementar:

- subir "Movimientos recientes" dentro del Resumen;
- hacer que el bloque sea claramente accionable/clicable;
- permitir redirección al módulo `/movements`.

Debe mantenerse accesible.

No hacer que una card completa sea clicable de forma confusa si contiene botones internos.

Preferir:

- heading + "Ver todos";
- o patrón equivalente claro.

La acción debe llevar al módulo Movimientos.

---

# 8. VARIACIÓN VS PERÍODO ANTERIOR

Revisar `docs/UX-RESUMEN-DESIGN.md`.

Actualmente el diseño contempla:

- `resultChangePct`
- `incomeChangePct`
- `expenseChangePct`

pero la implementación actual deja estos valores en `—`.

Determinar si esta funcionalidad pertenece al contrato vigente.

Si está vigente:

- implementarla correctamente;
- calcularla en server-side/domain apropiado;
- respetar moneda;
- respetar período;
- manejar ausencia de período anterior;
- evitar divisiones por cero;
- no inventar porcentajes;
- mostrar estado "sin comparación disponible" cuando corresponda.

Si se decide formalmente dejarla fuera de alcance:

- documentarlo;
- actualizar UX docs;
- actualizar tests;
- eliminar comentarios que indiquen que debería existir.

NO dejar discrepancia entre diseño y código.

---

# 9. SELECTOR DE PERÍODO DEL RESUMEN

Revisar la especificación vigente de:

- Mes
- Año
- 12 meses

Determinar si el selector general debe implementarse en esta ronda.

Si forma parte del contrato vigente:

- implementarlo;
- mantener cálculos server-side;
- respetar zona horaria;
- respetar moneda;
- mantener consistencia de métricas;
- evitar consultas innecesarias.

Si no forma parte del alcance actual:

- documentar la decisión.

NO dejar una funcionalidad documentada como vigente pero deliberadamente ausente sin explicación.

---

# 10. GRÁFICO DE EVOLUCIÓN

Evaluar el gráfico actual.

La dirección preferida es:

> gráfico de líneas en lugar de barras para evolución temporal.

Implementar el cambio si el análisis confirma que encaja mejor con las métricas actuales.

Validar:

- ingresos;
- gastos;
- flujo/resultado;
- meses sin datos;
- escalas;
- tooltips;
- leyenda;
- accesibilidad;
- dark mode;
- responsive;
- moneda.

No añadir una biblioteca innecesaria si la actual puede realizarlo.

---

# 11. SECCIÓN "¿QUÉ NECESITA MI ATENCIÓN?"

La sección debe comunicar claramente situaciones accionables.

Actualmente existen señales para:

- por cobrar;
- por pagar;
- pagos vencidos.

Revisar el contrato UX vigente para incorporar también, si corresponde:

- saldo negativo;
- gasto atípico.

No utilizar mensajes ambiguos.

Cuando no existen deudas, créditos ni alertas, NO mostrar simplemente:

> "Nada requiere tu atención"

porque puede sugerir que hubo algo que revisar y que no existe.

Preferir un estado explícito, por ejemplo conceptualmente:

> No tienes deudas ni créditos registrados que requieran seguimiento.

La redacción final debe adaptarse al sistema de i18n.

Si tampoco existen otras alertas:

> No hay alertas financieras pendientes en este momento.

Elegir el mensaje que represente exactamente el estado real.

---

# 12. INTEGRIDAD MONETARIA DEL DASHBOARD

Auditar exhaustivamente `build-dashboard-snapshot.ts` y todos los cálculos derivados.

Encontrar específicamente:

```text
entry.receivables += ...
entry.payables += ...
```

y cualquier agregación monetaria equivalente.

Todo cálculo monetario debe cumplir las reglas financieras vigentes y utilizar `sumSafeMinorUnits()` o la abstracción monetaria aprobada.

No basta con corregir una línea.

Buscar todos los caminos creados o modificados durante UX/UI.

Auditar:

- dashboard;
- summary;
- attention;
- position;
- charts;
- cards;
- movimientos derivados;
- POS;
- cualquier cálculo agregado.

---

# 13. ELIMINAR FALLBACKS SILENCIOSOS A COP

Buscar exhaustivamente:

```text
?? "COP"
|| "COP"
currency ?? ...
currency || ...
```

y equivalentes.

NO inventar COP cuando no existe moneda determinada.

La moneda predeterminada debe provenir de una fuente explícita.

---

# 14. MONEDA PREDETERMINADA DEL USUARIO

Implementar soporte para:

```text
User
└── defaultCurrency
```

La moneda predeterminada debe poder configurarse desde el perfil/configuración.

Debe utilizarse como:

> sugerencia/default para nuevas operaciones.

NO debe convertirse en:

> moneda obligatoria para todas las operaciones.

La moneda real de cada entidad/operación debe continuar siendo explícita.

Cuando exista:

```text
defaultCurrency = COP
```

un nuevo formulario puede abrir con COP.

Cuando sea:

```text
defaultCurrency = USD
```

debe abrir con USD.

Nunca utilizar COP como fallback silencioso.

Validar:

- formularios;
- cuentas;
- movimientos;
- POS;
- transferencias;
- créditos;
- payables;
- cualquier creación de entidad financiera.

---

# 15. CREACIÓN DE CATEGORÍAS DESDE MOVIMIENTOS

Agregar creación rápida de categorías directamente desde el formulario de:

- ingreso;
- gasto.

Usar como referencia de UX el patrón existente de creación rápida de:

- clientes;
- artículos/productos;

desde Venta POS.

Flujo:

```text
Categoría
[ Seleccionar categoría ▼ ] [+]
```

El usuario puede crear una categoría sin abandonar el formulario.

Al crearla:

1. guardar en backend;
2. actualizar el estado/query correspondiente;
3. mostrarla inmediatamente;
4. seleccionarla correctamente;
5. conservar el resto del formulario;
6. no requerir refresh manual.

---

# 16. BUG DE CATEGORÍAS NUEVAS NO DISPONIBLES EN EL FAB

Existe un problema donde una categoría recién creada aparece en el render de una parte de la interfaz, pero no está disponible inmediatamente al accionar el FAB hasta refrescar la página.

Investigar la causa real.

NO solucionar simplemente con:

```text
window.location.reload()
```

ni refresh global.

La solución debe utilizar la estrategia de invalidación/revalidación/estado que corresponda a la arquitectura actual.

Regla:

> Una mutación que crea/modifica/elimina una entidad debe actualizar o invalidar correctamente todas las fuentes derivadas relevantes de esa entidad.

Agregar regresión automatizada para demostrar:

```text
crear categoría
→ cerrar/continuar
→ abrir FAB/formulario
→ categoría disponible inmediatamente
```

---

# 17. FORMULARIOS — DENSIDAD Y LAYOUT

Revisar los formularios principales.

Cuando sea semánticamente apropiado:

```text
Label + input
```

en la misma línea en desktop/tablet.

También:

```text
Input A        Input B
```

en la misma fila cuando los campos estén relacionados y tengan ancho razonable.

Ejemplos:

- cantidad + unidad;
- fecha + cuenta;
- moneda + monto;
- campos de datos relacionados.

En móvil:

> volver a layout vertical cuando la disposición horizontal reduzca legibilidad.

No sacrificar:

- labels;
- accesibilidad;
- foco;
- touch targets;
- mensajes de error.

---

# 18. MOVIMIENTOS — NOTA

La columna Nota no debe truncarse agresivamente.

En desktop:

- permitir wrapping;
- máximo razonable de líneas;
- mantener la tabla usable;
- evitar overflow horizontal.

En móvil:

- permitir mayor número de líneas dentro de la card.

El contenido completo debe seguir siendo accesible.

Si se implementa clamp visual:

- debe existir forma clara de acceder al contenido completo.

---

### 18.1 HALLAZGO NUEVO: BOTÓN "CARGAR MÁS" DESAPARECIÓ EN MÓVIL

**Verificado en código** (`src/app/(main)/movements/movements-list.tsx`):

- El bloque "Load more" (botón `tCommon("loadMore")`) vive DENTRO de `<TableShell>`, es decir, solo se renderiza en la variante tabla.
- La variante cards (`<640px`, `sm:hidden`) NO tiene botón "Cargar más": paginación por cursor existe (`nextCursor`, `handleLoadMore`) pero en móvil es inalcanzable.
- Consecuencia real: un usuario en móvil solo ve la primera página de movimientos y NO tiene forma de ver más historial. Es una pérdida de funcionalidad, no un detalle estético.

Corrección requerida:

1. Recuperar el botón "Cargar más" y adaptarlo a la vista de cards, fuera de `TableShell`, a nivel de lista compartida (una sola instancia visible en ambas variantes), de modo que `nextCursor &&` rija para tableView y cardView por igual.
2. Mantener la paginación por cursor existente (no reemplazarla por offset).
3. Preservar el estado acumulado de filas al cargar más (la lógica de reset en `movements-list.tsx` ya lo contempla — no regresar a página 1).
4. Estado de carga: spinner + `tCommon("loading")`, touch target ≥44px (el `h-11` actual cumple).
5. Agregar regresión automatizada: con `nextCursor` definido, el botón se renderiza también en variante cards; al agotar cursor, desaparece.
6. i18n: reutilizar `loadMore` de `messages/es.json` / `en.json` (ya existe).

---

# 19. CARDS COMO ESTÁNDAR GENERAL

Adoptar formalmente:

> Cards como patrón visual primario de TwinCap.

Usar especialmente el patrón de Movimientos móvil como referencia de diseño.

Auditar y mejorar:

- Créditos recibidos;
- Créditos otorgados;
- Catálogo;
- Ventas;
- Detalle de venta;
- Transferencias;
- Cuentas;
- Clientes;
- Categorías.

En móvil, las cards deben priorizar:

```text
fila 1 → entidad/dato principal
fila 2 → metadatos
fila 3 → información secundaria
fila final → acciones
```

Evitar múltiples columnas estrechas dentro de una card móvil.

> **DECISIÓN DE PRODUCTO (2026-09-21, fundador):** la vista de tablas se ELIMINA
> en todas las resoluciones (laptop, PC, etc.). Todas las listas renderizan
> cards en todos los breakpoints, siguiendo el patrón de Movimientos. En PC las
> cards pueden disponerse en grillas de dos columnas (por ejemplo créditos y
> cuentas por pagar). El ordenamiento por encabezados de tabla queda retirado
> junto con la tabla (el orden por defecto de cada listado se conserva).

---

# 20. CRÉDITOS, CATÁLOGO Y VENTAS — RESPONSIVE

Corregir específicamente:

### Créditos recibidos

La información debe disponerse en filas.

### Créditos otorgados

La información debe disponerse en filas.

### Catálogo

Evaluar y corregir columnas apiñadas.

### Ventas

Evaluar y corregir columnas apiñadas.

### Detalle de venta

Evaluar y corregir columnas apiñadas.

### Transferencias

El patrón de referencia es ahora la propia card (sin variante de tabla).

### Cuentas

El patrón de referencia es ahora la propia card (sin variante de tabla).

No limitarse a añadir `overflow-x-auto`.

La solución preferida en móvil es:

> rediseñar la representación como card cuando la tabla deja de ser legible.

---

# 21. SALDOS QUE SE DESBORDAN

Corregir el desbordamiento de saldos en cards de Cuentas dentro del Resumen.

Evaluar en este orden:

1. estructura flex/grid;
2. `min-width: 0`;
3. `tabular-nums`;
4. wrapping;
5. tamaño responsive;
6. `clamp()` u otra estrategia de escala controlada.

No ocultar cifras.

No usar truncamiento que impida conocer el valor.

Probar con cantidades extremadamente grandes.

---

# 22. CATEGORÍAS EN DESKTOP

En pantallas grandes:

```text
Ingresos        Gastos
─────────       ─────────
...
```

pueden aparecer lado a lado.

En móvil:

```text
Ingresos
...

Gastos
...
```

Implementar responsive real, no simplemente reducir tamaños.

---

# 23. BOTÓN "QUITAR" EN VENTA

El botón para quitar un artículo del formulario de Venta POS debe ser icon-only.

Debe incluir:

- icono apropiado;
- `aria-label`;
- tooltip cuando corresponda;
- touch target suficiente.

No sacrificar accesibilidad.

---

# 24. MENÚ VERTICAL

Los menús verticales actuales tienen demasiado espacio entre opciones.

Reducir moderadamente:

- padding vertical;
- gap;
- altura visual.

Mantener touch targets adecuados.

No comprimir de manera excesiva.

Verificar desktop y móvil.

---

# 25. ACCESIBILIDAD POST-UX

No asumir que:

> axe 0 en 5 rutas = aplicación completa sin problemas.

Ampliar auditoría a todas las superficies principales.

Como mínimo revisar:

- landing;
- login;
- register;
- forgot password;
- reset password;
- verify email;
- dashboard;
- movements;
- transfers;
- POS;
- accounts;
- categories;
- clients;
- credits granted;
- credits received;
- payables;
- catalog;
- profile;
- help;
- feedback;
- errores/404;
- estados vacíos.

Validar:

- labels;
- nombres accesibles;
- keyboard;
- focus;
- focus-visible;
- contraste;
- dark mode;
- light mode;
- touch targets;
- dialogs;
- drawers;
- tooltips;
- reduced motion.

---

# 26. LABELS EXPLÍCITOS

Auditar especialmente buscadores e inputs que actualmente dependen de:

```text
placeholder
```

como sustituto del label.

Todo control de formulario debe tener nombre accesible.

Puede utilizarse:

- `<label>`;
- `aria-label`;
- `aria-labelledby`;

según el caso.

Preferir `<label>` visible cuando corresponda.

---

# 27. FOCUS

Unificar progresivamente:

```text
focus-visible
```

sobre:

```text
focus
```

cuando corresponda.

No eliminar estados de foco existentes sin reemplazarlos.

Mantener:

- keyboard navigation;
- focus trap;
- focus restoration;
- Escape.

---

# 28. REDUCED MOTION

Implementar soporte para:

```text
prefers-reduced-motion: reduce
```

en las animaciones/transiciones relevantes.

Debe aplicarse especialmente a:

- theme transitions;
- toast;
- accordion;
- drawers;
- animaciones futuras.

No introducir animaciones adicionales solamente para "hacerlo moderno".

---

# 29. DESIGN SYSTEM — CARD

Auditar el componente `Card`.

Actualmente existe una combinación problemática donde el componente aplica padding interno y algunos consumidores aplican padding externo mediante `className`.

Esto puede provocar:

```text
padding externo
+
padding interno
```

Evaluar una API más limpia, por ejemplo mediante:

```text
contentClassName
```

o una estructura equivalente.

No romper consumidores existentes.

Actualizar tests y documentación.

---

# 30. DESIGN SYSTEM — TOKENS

No hacer una migración masiva e indiscriminada de todos los `zinc-*`.

Pero establecer como regla:

> Cuando exista un token semántico del Design System, utilizarlo antes que un color raw.

Auditar especialmente:

- text;
- background;
- border;
- muted;
- primary;
- destructive;
- success;
- warning.

Los nuevos componentes no deben introducir nuevos colores raw sin justificación.

---

# 31. TOP 3 VS TOP 5

Existe una discrepancia:

Diseño:

> Top 5

Implementación:

> Top 3

NO elegir automáticamente uno.

Determinar cuál es la especificación vigente.

Si se decide Top 5:

- implementar;
- actualizar tests.

Si se decide Top 3:

- actualizar documentación de diseño.

Debe desaparecer la contradicción.

---

# 32. ABONOS A CAPITAL DE CRÉDITOS OTORGADOS

NO modificar esto a ciegas.

Auditar:

1. modelo de movimiento;
2. creación del abono;
3. clasificación actual;
4. módulo Movimientos;
5. dashboard;
6. flujo de caja;
7. métricas de ingresos;
8. reportes actuales/futuros.

Distinguir claramente:

```text
Entrada de dinero
```

de:

```text
Ingreso económico / rentabilidad
```

Determinar si la clasificación actual es correcta según la semántica financiera vigente.

Si es incorrecta:

- corregir;
- agregar tests;
- documentar.

Si es correcta para flujo de caja pero incorrecta para alguna métrica:

- no alterar la transacción;
- corregir la clasificación de la métrica correspondiente.

La decisión debe quedar documentada como regla permanente.

---

# 33. COSTOS DE PRODUCTOS — NO IMPLEMENTAR EL DOMINIO COMPLETO TODAVÍA

La visión futura de TwinCap requiere poder manejar:

- costo manual inicial;
- compras individuales;
- compras de múltiples productos;
- historial de costos;
- existencias;
- costo promedio ponderado;
- costo vigente;
- margen por producto;
- utilidad.

Pero esta ronda NO debe introducir un sistema improvisado de inventario.

Debe producir un documento técnico de diseño futuro que defina:

```text
Producto
├── precio de venta
├── costo manual/inicial
├── costo promedio vigente
├── existencias
└── historial de costos
```

y diferencie:

- costo histórico;
- costo de adquisición;
- costo promedio;
- costo vigente;
- costo aplicado a una venta;
- valor del inventario;
- margen;
- utilidad.

Analizar también:

- devoluciones;
- ajustes;
- compras;
- ventas;
- eliminación de productos;
- edición de compras;
- monedas;
- redondeo;
- concurrencia;
- idempotencia.

NO modificar el dominio actual hasta que el modelo futuro esté formalmente definido.

---

# 34. ANALÍTICA FUTURA

Documentar roadmap para:

## Ventas POS

- ventas por período;
- unidades;
- ticket promedio;
- productos más vendidos;
- clientes;
- categorías.

## Inventario

- existencias;
- valor;
- rotación;
- productos sin movimiento;
- costo promedio.

## Rentabilidad

- ingresos;
- costo;
- utilidad;
- margen;
- margen por producto;
- productos más rentables.

## Negocio

- ingresos;
- gastos;
- flujo de caja;
- utilidad;
- cuentas por cobrar;
- cuentas por pagar.

No implementar ahora salvo que alguna pieza sea necesaria para resolver un hallazgo actual.

La arquitectura debe permitir construirlo después sin rehacer el dominio.

---

# 35. PORTUGUÉS BRASILEÑO — PREPARACIÓN

TwinCap debe prepararse para soportar:

```text
es
en
pt-BR
```

en una fase cercana.

No basta con traducir strings.

Auditar la arquitectura i18n y garantizar que pueda manejar:

- locale;
- currency;
- number formatting;
- date formatting;
- pluralización;
- mensajes;
- metadata;
- Open Graph;
- SEO;
- landing;
- navegación;
- errores;
- emails;
- contenido de marketing.

Para Brasil deben contemplarse:

```text
R$ 1.234,56
```

y formatos apropiados de fechas/números.

NO codificar Brasil directamente dentro de componentes.

Debe existir separación entre:

```text
idioma
moneda
formato regional
```

Preparar documentación para futuras campañas:

- landing localizada;
- metadata localizada;
- rutas/locales;
- sitemap;
- contenido traducible.

No es necesario completar toda la traducción PT-BR en esta ronda si eso convierte la ronda en una traducción masiva.

Pero la arquitectura debe quedar lista.

---

# 36. DEPENDENCIAS

No eliminar automáticamente el caret de `package.json`.

Auditar:

- package.json;
- lockfile;
- scripts;
- CI;
- build;
- versiones críticas.

Establecer una política:

> Las actualizaciones de dependencias no se realizan automáticamente en producción.

Preferir:

```text
Dependabot / Renovate
→ PR
→ tests
→ lint
→ typecheck
→ build
→ revisión
→ merge
```

No ejecutar una actualización masiva de dependencias durante esta ronda salvo que sea necesaria por seguridad o compatibilidad.

Si existe una vulnerabilidad crítica:

- investigarla;
- actualizar solamente lo necesario;
- ejecutar regresión completa.

Documentar la política.

---

# 37. OFFLINE — PRIORIDAD ESTRATÉGICA

El modo offline es ahora una prioridad alta de producto.

PERO:

TwinCap es financiero.

NO implementar un sistema simplista basado en:

```text
localStorage + navigator.onLine
```

sin arquitectura de sincronización.

Primero realizar una auditoría técnica completa de la arquitectura actual para determinar:

- qué datos pueden cachearse;
- qué datos pueden leerse offline;
- qué operaciones pueden registrarse offline;
- qué operaciones NO deben permitirse offline;
- cómo identificar operaciones;
- cómo evitar duplicados;
- cómo sincronizar;
- cómo resolver conflictos;
- cómo informar estados al usuario.

Diseñar como mínimo:

```text
ONLINE
OFFLINE
PENDING_SYNC
SYNCING
SYNCED
SYNC_ERROR
CONFLICT
```

Considerar una cola local persistente.

Cada operación offline que pueda sincronizarse debe tener una identidad/idempotency key que sobreviva:

- reload;
- cierre del navegador;
- reconexión.

La sincronización debe respetar las garantías existentes de:

- atomicidad;
- idempotencia;
- concurrencia;
- aislamiento.

---

# 38. OFFLINE — PRIMERA FASE SEGURA

En esta ronda, si es viable sin riesgo:

Implementar únicamente la base segura para:

- detectar estado de conexión;
- mostrar indicador offline;
- mantener app shell disponible;
- documentar capacidades;
- preparar almacenamiento persistente;
- preparar estructura de sync.

NO implementar todavía sincronización financiera compleja si el diseño no está completamente definido.

NO permitir que una operación financiera parezca registrada en servidor cuando solamente está local.

El usuario debe distinguir claramente:

```text
Guardado en este dispositivo
Pendiente de sincronización
Sincronizado
Error de sincronización
```

---

# 39. ARQUITECTURA OFFLINE — DOCUMENTO OBLIGATORIO

Crear un documento específico, por ejemplo:

```text
docs/OFFLINE-ARCHITECTURE.md
```

Debe incluir:

1. objetivos;
2. alcance;
3. operaciones soportadas;
4. operaciones no soportadas;
5. almacenamiento local;
6. cola;
7. idempotency keys;
8. estados;
9. sincronización;
10. conflictos;
11. reintentos;
12. rollback;
13. seguridad;
14. expiración;
15. multi-tab;
16. múltiples dispositivos;
17. concurrencia;
18. observabilidad;
19. métricas;
20. roadmap de implementación.

No dejar el diseño offline únicamente en comentarios del código.

---

# 40. AUDITORÍA GLOBAL POST-UX

Realizar búsqueda completa del repositorio para detectar:

- TODO/FIXME relevantes;
- código muerto;
- imports muertos;
- rutas no enlazadas;
- componentes duplicados;
- patrones visuales duplicados;
- fallbacks monetarios;
- agregaciones monetarias inseguras;
- `zinc-*` innecesarios;
- `focus:` legacy;
- inputs sin label;
- overflow;
- tablas que deberían convertirse en cards en móvil;
- strings no traducidos;
- strings hardcoded;
- locales incompletos;
- errores silenciosos;
- loading states;
- empty states;
- error states.

No detenerse en los hallazgos conocidos.

Si encuentras algo nuevo que afecte la calidad o integridad del producto:

> corrígelo si está dentro del alcance seguro de esta ronda.

---

# 41. TESTING OBLIGATORIO

Después de implementar:

## TypeScript

```text
0 errores
```

## ESLint

```text
0 errores
```

## Build

Debe completar correctamente.

## Tests

Ejecutar suite completa.

## Accesibilidad

Ampliar la matriz respecto a UX-12.

Como mínimo:

- desktop;
- móvil;
- light;
- dark;
- keyboard.

## Responsive

Validar como mínimo:

- 375px;
- 768px;
- 1280px.

## Financiero

Ejecutar especialmente:

- atomicidad;
- concurrencia;
- idempotencia;
- multi-moneda;
- saldos negativos;
- transferencias;
- créditos;
- payables;
- POS.

## UX

Validar:

- FAB;
- Transferencias;
- creación rápida de categorías;
- categoría inmediatamente disponible;
- Resumen;
- Movimientos recientes;
- cards;
- formularios;
- mobile cards.

---

# 42. PRUEBAS ESPECÍFICAS NUEVAS

Agregar regresiones para:

### Categorías

```text
crear categoría desde movimiento
→ aparece inmediatamente
→ queda seleccionada
→ aparece también en otras fuentes relevantes
```

### FAB

```text
FAB
→ Venta POS
→ Ingreso
→ Gasto
```

### Transferencias

```text
sidebar
→ /transfers
→ activo correctamente
```

### Moneda

```text
defaultCurrency = USD
→ nuevo movimiento = USD
```

y:

```text
defaultCurrency = BRL
→ nuevo movimiento = BRL
```

### Sin moneda

```text
no currency
→ NO inventar COP
```

### Responsive

Validar cards de:

- créditos;
- catálogo;
- ventas;
- detalle de venta.

### Saldo

Probar valores extremadamente grandes.

### Accesibilidad

Inputs/searches deben tener nombre accesible.

---

# 43. NO HACER

Está prohibido durante esta ronda:

- reescribir el dominio financiero;
- reemplazar arquitectura hexagonal;
- migrar de MongoDB;
- reemplazar Next.js;
- introducir Zustand/Redux/etc. sin necesidad demostrada;
- introducir una nueva librería de gráficos sin necesidad;
- introducir una nueva librería UI completa;
- implementar Teams;
- implementar Billing;
- implementar suscripciones;
- implementar IA financiera avanzada;
- implementar predicciones;
- implementar inventario completo;
- implementar costo promedio completo sin diseño aprobado;
- implementar sincronización offline financiera incompleta;
- eliminar tests para hacerlos pasar;
- ocultar errores;
- usar `window.location.reload()` como solución de sincronización de estado;
- utilizar COP como fallback silencioso;
- utilizar floats monetarios;
- introducir cambios financieros no documentados.

---

# 44. DOCUMENTACIÓN FINAL OBLIGATORIA

Al terminar debes actualizar:

- `PROJECT-RULES.md` o el archivo maestro vigente;
- documentación UX que haya quedado desactualizada;
- documentación del Design System;
- documentación del Resumen;
- política de dependencias;
- arquitectura offline;
- roadmap de analítica/inventario/costos;
- internacionalización.

Toda decisión nueva debe convertirse en regla explícita cuando tenga impacto futuro.

---

# 45. INFORME FINAL OBLIGATORIO

Crear un reporte final de la ronda que contenga:

## A. Hallazgos encontrados

Separados por:

- crítico;
- alto;
- medio;
- bajo;
- futuro.

## B. Correcciones realizadas

Archivo + explicación.

## C. Decisiones tomadas

Especialmente:

- Resumen;
- Transferencias;
- FAB;
- categorías;
- cards;
- tablas;
- créditos;
- monedas;
- costos;
- dependencias;
- PT-BR;
- offline.

## D. Elementos deliberadamente NO implementados

Explicar por qué.

## E. Riesgos restantes

No ocultarlos.

## F. Tests

Reportar:

- TypeScript;
- ESLint;
- build;
- tests;
- a11y;
- responsive.

## G. Estado financiero

Confirmar explícitamente que no se degradaron:

- atomicidad;
- idempotencia;
- concurrencia;
- aislamiento;
- multi-moneda.

## H. Estado offline

Separar claramente:

```text
implementado
preparado
diseñado
pendiente
```

---

# 46. CRITERIO DE CIERRE

Esta ronda NO se considera terminada simplemente porque:

```text
npm test
npm run lint
npm run build
```

pasen.

Debe cumplirse simultáneamente:

1. No existen contradicciones UX ↔ código sin documentar.
2. No existen fallbacks monetarios silenciosos a COP.
3. Las nuevas agregaciones monetarias cumplen las reglas financieras.
4. Transferencias vuelve a ser descubrible.
5. FAB funciona con Venta POS / Ingreso / Gasto.
6. Creación de categorías funciona dentro de Movimientos.
7. Las categorías nuevas aparecen inmediatamente en todos los contextos relevantes.
8. Resumen tiene jerarquía coherente.
9. Movimientos recientes tiene acceso claro al módulo completo.
10. Cards móviles no tienen columnas apiñadas.
11. Saldos no se desbordan.
12. Formularios son más compactos en desktop sin perjudicar móvil.
13. Notas no pierden información innecesariamente.
14. Accesibilidad se validó en una superficie significativamente mayor.
15. Design System no recibe nueva deuda innecesaria.
16. PT-BR queda arquitectónicamente preparado.
17. Política de dependencias queda definida.
18. Offline tiene arquitectura documentada y una primera base segura si técnicamente viable.
19. Analítica/costos/inventario futuros quedan documentados sin contaminar prematuramente el dominio.
20. Tests, lint, typecheck y build pasan.
21. No quedan hallazgos conocidos sin clasificar.
22. El reporte final deja claro qué quedó implementado, qué quedó preparado y qué queda para futuras rondas.

---

# 47. PRINCIPIO FINAL

TwinCap no debe convertirse en una colección de funcionalidades.

La dirección estratégica sigue siendo:

> **ayudar al usuario a entender su situación financiera y tomar mejores decisiones mediante información clara, señales y posteriormente inteligencia financiera accionable.**

Por eso cada cambio UX debe responder a:

```text
¿Hace más fácil registrar?
¿Hace más fácil entender?
¿Hace más fácil detectar?
¿Hace más fácil actuar?
```

Si una modificación solamente agrega complejidad visual o técnica sin mejorar alguna de esas cuatro dimensiones, cuestionarla antes de implementarla.

El objetivo de esta ronda es dejar TwinCap:

> **más coherente, más claro, más robusto, más accesible, más preparado para móvil, más preparado para internacionalización y con los cimientos correctos para Offline y la futura inteligencia financiera, sin sacrificar la integridad financiera ya alcanzada.**
