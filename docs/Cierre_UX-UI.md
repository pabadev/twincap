# RONDA POST-UX/UI — CIERRE DEFINITIVO DE LA ETAPA

> **Estado de auditoría (2026-09-26, `master` / `d07a729` + cambios locales): RONDA ABIERTA.** C12-5 orden por `date`/`createdAt`/`_id`, C12-7 documentos offline/PT-BR/costos/analítica y C12-8 indicador de conectividad implementados. C12-9 auditoría transversal parcial, evidencia en `docs/POST-UX-AUDIT.md`. C12-10: Vitest 1695/1695 (162 archivos, 1717.84 s), TypeScript EXIT 0, lint 0 errores/10 warnings preexistentes, Prettier limpio, build EXIT 0. E2E serial: 55.1 min, 6 passed / 8 failed / 3 flaky / 18 did not run; traces con formularios bloqueados en `Creating...`. El runner ahora requiere al menos 90 min; timeout por prueba se mantiene en 90 s hasta encontrar la causa. Re-scan axe, revisión responsive visual y C12-11 cierre siguen pendientes. No declara cierre ni reabre el freeze financiero.

## INSTRUCCIÓN PRINCIPAL

Esta sesión tiene un objetivo concreto:

> **Completar, auditar, validar, documentar y cerrar formalmente la Ronda Post-UX/UI de TwinCap.**

NO trates esta sesión como una nueva ronda abierta de desarrollo.

NO conviertas mejoras secundarias en una expansión indefinida del alcance.

NO reabras decisiones financieras que ya fueron congeladas.

NO implementes funcionalidades futuras simplemente porque parezcan interesantes.

SÍ debes corregir todo hallazgo que sea necesario para cumplir el contrato de esta ronda.

SÍ debes integrar las nuevas mejoras UX/UI descritas en este documento.

SÍ debes verificar objetivamente cada requisito.

SÍ debes dejar evidencia de cumplimiento.

SÍ debes detenerte ante cualquier modificación que pueda afectar la integridad financiera y analizarla antes de implementarla.

---

# 1. CONTEXTO OBLIGATORIO

Antes de modificar cualquier archivo:

1. Leer obligatoriamente:
   - `AGENTS.md`
   - `PROJECT-RULES.md` o archivo maestro equivalente vigente
   - `docs/AUDIT-AND-PLAN.md`
   - `docs/Ronda POST-UX.md`
   - `docs/odd/tasks/post-ux-round.md`
   - documentación UX/UI relacionada con esta ronda
   - documentación del Design System
   - documentación de Resumen/Dashboard
   - cualquier documento generado durante los clusters 1–9 que sea necesario para comprender las decisiones adoptadas.

2. Revisar el estado actual real del repositorio en `master`.

3. No asumir que la documentación coincide perfectamente con el código: comprobarlo.

4. Revisar los últimos cambios fusionados y el estado desplegado conocido.

5. Antes de implementar cualquier cosa, construir mentalmente una matriz:

   `REQUISITO → IMPLEMENTACIÓN → TEST/EVIDENCIA → ESTADO`

6. No eliminar documentación histórica. Si existe información histórica que ya no representa el estado actual, conservarla como histórico y actualizar claramente el documento que funcione como fuente vigente.

---

# 2. PRINCIPIO FUNDAMENTAL: EL FREEZE FINANCIERO SIGUE VIGENTE

El dominio financiero permanece congelado.

No modificar innecesariamente:

- atomicidad;
- transacciones;
- concurrencia;
- CAS;
- idempotencia;
- aislamiento por workspace/tenant;
- multi-moneda;
- movimientos financieros;
- saldos;
- invariantes;
- mecanismos de auditoría;
- reglas de transferencias;
- reglas de créditos;
- reglas de cuentas por pagar;
- reglas POS.

Las mejoras UX/UI deben reutilizar la lógica existente.

No crear cálculos financieros paralelos en componentes React.

No duplicar lógica de negocio en frontend.

No usar floats para representar dinero.

No introducir conversiones de moneda improvisadas.

No eliminar protecciones existentes para simplificar UX.

Si alguna nueva funcionalidad exige tocar el dominio financiero, detenerse, auditar primero el impacto y documentar la razón antes de modificarlo.

---

# 3. ESTADO YA ENTREGADO: NO REIMPLEMENTAR

Los siguientes elementos ya fueron trabajados y desplegados en los clusters anteriores:

- Transferencias visibles nuevamente en sidebar.
- FAB global.
- Orden del FAB:
  1. Venta POS.
  2. Ingreso.
  3. Gasto.
- Jerarquía mejorada de Resumen.
- Movimientos recientes.
- Load More móvil.
- `defaultCurrency` del usuario.
- BRL.
- Creación de categorías inline desde Movimientos.
- Cards responsive en las listas correspondientes.
- Protección frente a desbordamiento de saldos.
- labels y accesibilidad.
- focus.
- reduced motion.
- Top 3 / Top 5 según decisiones adoptadas.
- abonos de créditos otorgados.
- mejoras del gráfico.
- headers móviles.
- skeleton.
- filtros colapsables en móvil.
- mejoras de cards de cuentas.

No rehacer estos trabajos desde cero.

Primero verificar su estado actual y corregir únicamente lo que la auditoría demuestre que sigue pendiente o defectuoso.

---

# 4. NUEVA MEJORA 1 — FORMULARIO CREAR VENTA / POS DESKTOP

## Objetivo

Aprovechar mejor el espacio disponible en laptop y PC.

La experiencia de Venta POS no debe ser simplemente el formulario móvil estirado.

Debe existir una presentación desktop más completa, fluida y apropiada para un negocio.

## Requisitos

Auditar primero el formulario actual.

Diseñar e implementar una experiencia específica para pantallas grandes cuando corresponda.

La solución debe permitir aprovechar el espacio para organizar mejor, como mínimo según resulte coherente con el dominio actual:

- búsqueda/selección de productos;
- productos agregados;
- cantidades;
- cliente;
- resumen de la venta;
- subtotal;
- descuentos si ya existen en el dominio;
- total;
- método de pago;
- acciones principales.

NO inventar funcionalidades financieras o comerciales que no existan.

NO crear una segunda lógica POS.

La operación financiera debe seguir utilizando la misma lógica de negocio existente.

La diferencia debe ser principalmente:

> **presentación + organización + eficiencia del flujo.**

En mobile debe conservarse una experiencia compacta y usable.

En tablet/laptop/desktop debe aprovecharse progresivamente el espacio disponible.

## Criterios UX

- Jerarquía visual clara.
- Producto → carrito → cliente/pago → confirmación.
- Menos desplazamiento innecesario.
- Acciones principales siempre identificables.
- No saturar la interfaz.
- Mantener accesibilidad.
- Mantener teclado.
- Mantener focus correcto.
- Mantener responsive.

---

# 5. CONFIRMACIÓN DE CIERRE ACCIDENTAL EN VENTA POS

Esta mejora es OBLIGATORIA.

Si el usuario está creando una venta y existen cambios no guardados, no debe poder perder accidentalmente todo el proceso mediante:

- `ESC`;
- botón `X`;
- acción equivalente de cierre.

Debe aparecer una confirmación clara.

Conceptualmente:

> ¿Salir de la venta?
>
> Tienes información sin guardar. Si sales ahora, perderás los datos ingresados.

Acciones:

- Continuar editando.
- Salir sin guardar.

Si no existen cambios, el cierre puede realizarse directamente.

Debe funcionar correctamente con:

- mouse;
- teclado;
- ESC;
- X;
- navegación accesible.

No introducir confirmaciones innecesarias cuando no existen cambios.

---

# 6. NUEVA MEJORA 2 — ORDEN CRONOLÓGICO DE MOVIMIENTOS

Corregir de fondo el orden de los movimientos.

Requisito:

> **Para movimientos de la misma fecha, la hora más reciente debe aparecer primero.**

No solucionar esto solamente con un sort visual en React.

Auditar el flujo completo:

`persistencia → query → API → paginación → transformación → frontend → render`.

Determinar cuál es el timestamp correcto de la operación.

No asumir automáticamente que `createdAt` equivale al momento efectivo del movimiento.

Si existe un timestamp transaccional/operacional específico, utilizar el campo correcto.

El orden debe ser determinista.

Si dos movimientos tienen exactamente el mismo timestamp, establecer un segundo criterio estable para evitar que cambien de posición entre consultas/páginas.

Verificar específicamente:

- primera página;
- Load More;
- filtros;
- cambio de período;
- movimientos del mismo día;
- movimientos con la misma hora;
- paginación;
- diferentes monedas;
- recarga;
- creación de un movimiento nuevo.

El resultado esperado debe ser:

`más reciente → más antiguo`.

Añadir pruebas de regresión.

No modificar el significado financiero de los movimientos.

---

# 7. NUEVA MEJORA 3 — CORRECCIÓN DEL SALDO INICIAL DE CUENTAS

Esta mejora requiere especial cuidado.

Actualmente, si un usuario se equivoca al establecer el saldo inicial de una cuenta, necesita una forma segura de corregirlo.

## NO implementar un "reset" destructivo

No crear un botón que simplemente:

- borre movimientos;
- cambie retrospectivamente balances;
- reconstruya la cuenta silenciosamente;
- elimine trazabilidad.

No implementar:

`balanceInicial = nuevoValor`

si eso rompe la historia o las invariantes.

## Primero auditar

Determinar:

- cómo se almacena actualmente el saldo inicial;
- cómo se calcula el saldo actual;
- cómo se representan los movimientos;
- si el saldo inicial genera una operación/movimiento;
- qué ocurre cuando ya existen movimientos;
- qué mecanismos de auditoría existen;
- qué invariantes deben preservarse.

## Objetivo UX

El usuario debe poder corregir razonablemente un saldo inicial equivocado.

Preferir una acción semánticamente clara como:

> **Corregir saldo inicial**

en lugar de un ambiguo:

> Resetear cuenta.

Si técnicamente la corrección debe representarse como un ajuste explícito para preservar historial, implementar esa solución.

## Requisitos obligatorios

La solución debe preservar:

- historial;
- trazabilidad;
- atomicidad;
- concurrencia;
- idempotencia;
- aislamiento;
- multi-moneda;
- consistencia del saldo;
- auditoría.

Añadir pruebas específicas:

1. cuenta sin movimientos;
2. cuenta con movimientos;
3. saldo inicial positivo;
4. saldo inicial cero;
5. saldo inicial negativo si el dominio lo permite;
6. corrección repetida;
7. concurrencia;
8. refresh/reintento;
9. diferentes monedas;
10. aislamiento entre workspaces.

Si la auditoría demuestra que una implementación segura exige una decisión de producto o una modificación mayor del dominio, NO improvisar.

Documentar la situación y detener esa parte hasta que exista una solución compatible con el freeze.

---

# 8. NUEVA MEJORA 4 — CATEGORÍAS SUGERIDAS

Implementar una experiencia que permita al usuario seleccionar múltiples categorías conocidas/frecuentes sin tener que crearlas una por una.

Debe coexistir con la creación personalizada actual.

## PRINCIPIO

TwinCap debe reducir la fricción de configuración inicial.

El usuario debe poder comenzar rápidamente con categorías razonables y después personalizarlas.

## MUY IMPORTANTE: CONTEXTO LATINOAMERICANO

La lista sugerida NO debe ser una lista genérica exclusivamente estadounidense/europea.

Debe contemplar:

> **Ingresos y Gastos típicos, frecuentes y conocidos en Latinoamérica.**

Debe estudiar una taxonomía práctica y suficientemente amplia.

Ejemplos de posibles categorías de gasto, sin limitarse a ellas:

- Alimentación.
- Mercado / supermercado.
- Restaurantes.
- Transporte.
- Combustible.
- Vivienda.
- Arriendo.
- Servicios públicos.
- Internet.
- Telefonía.
- Salud.
- Medicamentos.
- Educación.
- Entretenimiento.
- Compras.
- Ropa.
- Tecnología.
- Impuestos.
- Seguros.
- Deudas / obligaciones.
- Transferencias personales según corresponda al dominio.
- Cuidado personal.
- Mascotas.
- Viajes.
- Mantenimiento del hogar.
- Mantenimiento del vehículo.

Ejemplos de posibles categorías de ingreso:

- Salario.
- Honorarios.
- Ventas.
- Servicios.
- Comisiones.
- Bonificaciones.
- Intereses.
- Rendimientos.
- Alquileres.
- Reembolsos.
- Otros ingresos.

Estos ejemplos NO constituyen una lista final obligatoria.

El agente debe estudiar las categorías existentes en TwinCap, evitar duplicados semánticos y construir una lista coherente con el producto.

No sobrecargar al usuario con cientos de categorías.

Debe existir una selección inicial razonable, amplia pero manejable.

---

# 9. EXPERIENCIA DE CATEGORÍAS SUGERIDAS

Debe estudiarse la mejor ubicación UX.

La funcionalidad puede participar en onboarding, gestión de categorías o ambos.

Objetivo:

> permitir que el usuario configure una base útil en pocos segundos/minutos.

Una posible experiencia:

> Personaliza tus categorías
>
> Selecciona las que utilizas normalmente.
> Podrás agregar otras después.
>
> [ ] Alimentación
> [ ] Transporte
> [ ] Servicios
> [ ] Mascotas
> ...
>
> [Agregar seleccionadas]

Pero NO imponer este diseño si la auditoría UX demuestra una alternativa mejor.

Las categorías sugeridas se muestran **sin ninguna opción preseleccionada**: el usuario decide explícitamente cuáles agregar.

## Debe existir

- selección múltiple;
- agregar seleccionadas;
- posibilidad de cancelar;
- posibilidad de continuar sin seleccionar;
- feedback de éxito;
- prevención de duplicados;
- respeto del tipo Ingreso/Gasto;
- actualización inmediata de los selectores;
- creación personalizada posterior;
- aislamiento por workspace.

La creación de categorías sugeridas debe ser segura e idempotente.

No crear categorías globales accidentalmente.

---

# 10. CLIENTES Y CATÁLOGO — DECISIÓN DEL PRODUCT OWNER

Resolver explícitamente la decisión pendiente:

> ¿Clients y Catalog permanecerán como listados con búsqueda únicamente, sin filtros?

Analizar brevemente:

- cantidad esperada de registros;
- utilidad real de filtros;
- coherencia con UX actual;
- complejidad;
- mobile;
- desktop;
- escalabilidad.

Registrar la decisión en documentación.

No dejarla implícita.

---

# 11. OFFLINE — ARQUITECTURA + PRIMERA FASE SEGURA

Crear obligatoriamente la documentación de arquitectura offline.

Debe definir:

- estrategia de cache;
- detección de conectividad;
- lectura desde cache;
- sincronización futura;
- cola;
- estados;
- conflictos;
- reintentos;
- idempotencia;
- experiencia de usuario.

Estados mínimos:

- `PENDING_SYNC`
- `SYNCING`
- `SYNCED`
- `SYNC_ERROR`
- `CONFLICT`

Definir cómo se mostrarán al usuario.

## Primera fase

Implementar únicamente la fase segura:

- detección de conexión;
- indicador offline;
- lectura desde cache cuando sea seguro;
- skeletons;
- empty states;
- señal clara de sin conexión.

NO implementar sincronización financiera completa.

NO permitir operaciones financieras offline improvisadas.

NO crear una cola financiera sin arquitectura aprobada.

La sincronización financiera completa queda fuera de esta ronda.

---

# 12. PREPARACIÓN PT-BR

Preparar arquitectónicamente el sistema para `pt-BR`.

No es necesario traducir toda la aplicación ahora.

Debe quedar preparada la separación entre:

- locale;
- idioma;
- moneda;
- formato numérico;
- formato monetario;
- pluralización.

Actualmente existen `es` y `en`.

Preparar correctamente la arquitectura para incorporar:

`pt-BR`

sin tener que reestructurar posteriormente todo el sistema.

No introducir strings hardcodeados nuevos.

---

# 13. DISEÑO FUTURO DE COSTOS

Crear únicamente documentación de diseño.

NO implementar costos todavía.

El documento debe estudiar, como mínimo:

- costo promedio;
- costo de adquisición;
- valorización de inventario;
- costo de venta;
- relación producto/inventario;
- impacto futuro en rentabilidad;
- relación con POS.

Debe quedar explícitamente separado del dominio financiero actual.

No contaminar:

- movimientos;
- saldos;
- cuentas;
- transferencias;

con cálculos de costos que todavía no han sido aprobados.

---

# 14. ROADMAP DE ANALÍTICA FUTURA

Crear documento de roadmap para futuras capacidades analíticas.

Considerar:

### Ventas POS

- ventas;
- frecuencia;
- ticket promedio;
- productos;
- clientes.

### Inventario

- existencias;
- rotación;
- productos de mayor movimiento;
- productos sin movimiento.

### Rentabilidad

- ingresos;
- costos futuros;
- margen;
- utilidad.

### Negocio

- tendencias;
- comportamiento temporal;
- productos;
- categorías;
- señales accionables futuras.

No implementar estas métricas ahora salvo las que ya existan.

No agregar campos prematuros al dominio.

El documento debe distinguir:

`existente → preparado → futuro`.

---

# 15. CARDS Y LISTAS

Auditar nuevamente la decisión adoptada sobre representación mediante cards.

Verificar todas las listas relevantes.

No asumir que una lista está correctamente adaptada solamente porque funciona en mobile.

Comprobar:

- mobile;
- tablet;
- laptop;
- desktop;
- overflow;
- acciones;
- densidad;
- jerarquía;
- lectura rápida;
- accesibilidad.

Las tablas que permanezcan deben tener una justificación explícita si el contrato de la ronda exige cards para esa superficie.

No convertir indiscriminadamente componentes internos si eso empeora la comprensión.

---

# 16. FORMULARIOS

Auditar formularios relevantes.

Objetivos:

- labels claros;
- inputs alineados;
- aprovechar espacio desktop;
- evitar scroll innecesario;
- agrupar campos relacionados;
- mantener una sola columna cuando sea más usable;
- utilizar dos columnas únicamente cuando mejore realmente la experiencia;
- mobile debe mantenerse cómodo.

Revisar especialmente:

- Movimientos;
- Venta POS;
- Transferencias;
- Cuentas;
- Clientes;
- Catálogo;
- Créditos;
- Cuentas por pagar.

---

# 17. RESUMEN

Auditar el Resumen contra la especificación vigente.

No introducir nuevas métricas simplemente porque sean interesantes.

Verificar:

- jerarquía;
- claridad;
- movimientos recientes;
- cuentas;
- categorías;
- evolución;
- atención;
- posición financiera;
- responsive;
- textos;
- empty states;
- saldos;
- multi-moneda.

Resolver cualquier discrepancia entre documentación y código.

Si una decisión anterior fue modificada, documentar explícitamente la nueva decisión.

---

# 18. ACCESIBILIDAD

Ejecutar auditoría real.

Verificar:

- keyboard;
- focus visible;
- focus trap;
- ESC;
- labels;
- aria;
- targets táctiles;
- contraste;
- reduced motion;
- modales;
- dropdowns;
- cards;
- formularios;
- FAB;
- Venta POS.

Especial atención al nuevo diálogo de confirmación de cierre de Venta POS.

---

# 19. RESPONSIVE

Validar al menos:

- 375 px;
- 768 px;
- 1024 px;
- 1280 px;
- desktop amplio.

Revisar:

- cards;
- formularios;
- modales;
- dropdowns;
- tablas restantes;
- FAB;
- Resumen;
- Venta POS;
- movimientos;
- transferencias.

No permitir:

- overflow horizontal accidental;
- botones cortados;
- contenido oculto;
- modales imposibles de utilizar;
- acciones inaccesibles.

---

# 20. SALDOS Y VALORES EXTREMOS

Verificar que:

- saldos grandes no rompan cards;
- valores negativos sean visibles;
- monedas con símbolos largos no rompan layouts;
- valores con muchos dígitos no generen overflow;
- desktop y mobile sean legibles.

No cambiar la lógica financiera para solucionar un problema visual.

---

# 21. AUDITORÍA GLOBAL POST-UX

Ejecutar una auditoría transversal completa.

Como mínimo cubrir:

1. Categorías.
2. FAB.
3. Transferencias.
4. Moneda.
5. Ausencia de moneda.
6. Responsive.
7. Saldo.
8. Accesibilidad.
9. Movimientos recientes.
10. Cards.
11. Formularios.
12. Mobile cards.
13. Venta POS desktop.
14. Confirmación de cierre POS.
15. Orden cronológico de movimientos.
16. Corrección segura de saldo inicial.
17. Onboarding de categorías sugeridas.

Para cada punto registrar:

- requisito;
- evidencia;
- estado;
- hallazgo;
- corrección;
- test.

---

# 22. PRUEBAS CONSOLIDADAS

Antes de declarar la ronda cerrada ejecutar una corrida integral.

Debe incluir:

- TypeScript;
- ESLint;
- build;
- Vitest completo;
- E2E;
- accesibilidad;
- responsive;
- pruebas específicas nuevas.

Vitest debe ejecutarse respetando el timeout mínimo establecido por las reglas del proyecto:

> **45 minutos o más.**

No declarar éxito basándose únicamente en ejecuciones parciales de clusters.

---

# 23. NUEVAS PRUEBAS OBLIGATORIAS

Agregar regresiones para:

### Categorías

- creación inline;
- categorías sugeridas;
- selección múltiple;
- duplicados;
- actualización inmediata.

### FAB

- Venta POS;
- Ingreso;
- Gasto;
- orden correcto;
- navegación.

### Moneda

- `defaultCurrency`;
- BRL;
- ausencia de moneda;
- creación de operaciones;
- formularios.

### Saldos

- valores negativos;
- valores grandes;
- overflow;
- corrección segura de saldo inicial.

### Movimientos

- orden por hora;
- mismo día;
- misma hora;
- paginación;
- Load More;
- filtros.

### Venta POS

- desktop;
- mobile;
- cierre mediante X;
- cierre mediante ESC;
- confirmación con cambios;
- cierre directo sin cambios;
- keyboard;
- focus.

---

# 24. FLAKY TESTS CONOCIDOS

Existe un flaky E2E conocido relacionado con:

- `destination stream closed early`;
- register limiter `3/15min`.

Aplicar la regla existente:

> rerun una única vez, no más.

No ocultar fallos detrás de múltiples reintentos.

Documentar claramente cualquier fallo que permanezca.

---

# 25. DOCUMENTACIÓN OBLIGATORIA DE CIERRE

Actualizar la documentación necesaria.

Como mínimo:

- PROJECT-RULES / archivo maestro;
- documentación UX;
- Design System;
- Resumen;
- política de dependencias;
- arquitectura offline;
- roadmap analítica;
- diseño costos/inventario;
- preparación i18n/PT-BR;
- decisiones de producto;
- auditoría global.

No borrar documentación histórica.

Diferenciar:

`implementado`

`preparado`

`diseñado`

`pendiente`

`fuera de alcance`.

---

# 26. INFORME FINAL OBLIGATORIO

Generar el informe final de la ronda con secciones:

### A. Hallazgos

Clasificados por severidad.

### B. Correcciones

Qué se modificó y dónde.

### C. Decisiones

Qué decisiones de producto se tomaron.

### D. No implementado deliberadamente

Todo aquello que conscientemente quedó fuera.

### E. Riesgos restantes

Solamente riesgos reales.

### F. Tests

Resultados completos.

### G. Confirmación financiera

Confirmar explícitamente que permanecen intactos:

- atomicidad;
- idempotencia;
- concurrencia;
- aislamiento;
- multi-moneda;
- invariantes financieras.

### H. Offline

Separar claramente:

- implementado;
- preparado;
- diseñado;
- pendiente.

---

# 27. REGLA DE ORO SOBRE EL ALCANCE

Durante esta sesión pueden aparecer nuevas ideas.

NO implementarlas automáticamente.

Clasificarlas:

1. necesaria para cumplir el contrato;
2. necesaria para corregir un defecto;
3. mejora UX/UI claramente compatible con el alcance;
4. futura;
5. fuera de alcance.

Solo implementar 1–3.

Las demás deben documentarse.

La existencia de una buena idea NO convierte automáticamente esa idea en requisito de esta ronda.

---

# 28. NO HACER

Está expresamente prohibido:

- reescribir módulos completos sin necesidad;
- reemplazar librerías sin justificación;
- introducir dependencias innecesarias;
- modificar el dominio financiero para resolver problemas visuales;
- crear cálculos financieros en frontend;
- implementar sincronización financiera offline improvisada;
- crear analytics prematuramente;
- implementar costos antes de su diseño;
- crear categorías globales;
- duplicar categorías existentes;
- borrar historial financiero para corregir UX;
- hacer resets destructivos de cuentas;
- utilizar `window.location.reload()` como mecanismo normal de actualización de estado;
- esconder errores para conseguir tests verdes;
- desactivar tests;
- aumentar arbitrariamente retries;
- ignorar TypeScript;
- ignorar ESLint;
- declarar cierre con pruebas parciales.

---

# 29. CRITERIO DE ÉXITO

La ronda solo puede declararse cerrada cuando:

- todos los pendientes del contrato estén resueltos;
- la decisión Clients/Catalog esté registrada;
- las nuevas mejoras aprobadas estén implementadas o justificadamente documentadas;
- la arquitectura offline esté documentada;
- la primera fase offline segura esté resuelta;
- PT-BR esté preparada arquitectónicamente;
- costos estén diseñados pero no implementados;
- analítica futura esté documentada;
- la auditoría global esté completada;
- las pruebas completas estén ejecutadas;
- las regresiones nuevas estén cubiertas;
- la documentación esté actualizada;
- el informe final esté generado;
- los 22 criterios de cierre estén comprobados;
- no exista regresión financiera.

NO declarar "ronda cerrada" simplemente porque la aplicación compile.

NO declarar "ronda cerrada" porque todos los PR estén fusionados.

NO declarar "ronda cerrada" porque los clusters anteriores hayan pasado.

El cierre requiere evidencia integral.

---

# 30. PROCEDIMIENTO DE EJECUCIÓN

Trabajar en este orden:

## FASE 1 — Lectura y auditoría inicial

Leer documentación obligatoria.

Inspeccionar código actual.

Construir matriz de requisitos.

## FASE 2 — Decisiones

Resolver Clients/Catalog.

Identificar cualquier contradicción entre documentación y código.

## FASE 3 — Documentación arquitectónica

Crear:

- offline;
- PT-BR;
- costos;
- analítica.

## FASE 4 — Correcciones UX/UI aprobadas

Implementar:

- Venta POS desktop;
- confirmación de cierre POS;
- orden cronológico;
- corrección segura de saldo inicial;
- categorías sugeridas.

## FASE 5 — Auditoría transversal

Ejecutar §40 completo.

## FASE 6 — Correcciones derivadas

Corregir todos los hallazgos necesarios.

No dejar hallazgos conocidos sin resolver simplemente porque sean incómodos.

## FASE 7 — Validación

Ejecutar:

- typecheck;
- lint;
- build;
- Vitest;
- E2E;
- a11y;
- responsive;
- regresiones específicas.

## FASE 8 — Documentación

Actualizar todos los documentos afectados.

## FASE 9 — Informe final

Generar informe A-H.

## FASE 10 — Cierre

Comprobar uno por uno los 22 criterios.

Solo entonces declarar:

> **Ronda Post-UX/UI cerrada.**

---

# 31. REGLA FINAL PARA EL AGENTE

Quiero que trabajes con mentalidad de **auditor + ingeniero + diseñador de producto**, no solamente como implementador.

El objetivo no es producir más código.

El objetivo es que, al finalizar esta sesión:

> **TwinCap tenga una experiencia significativamente más clara, fluida y confiable, especialmente para un usuario nuevo, sin sacrificar la robustez financiera construida durante las rondas anteriores.**

Presta especial atención a la fricción de primer uso.

Un usuario nuevo no debería tener que hacer trabajo innecesario para comenzar:

- configurar categorías una por una;
- entender interfaces confusas;
- descubrir acciones escondidas;
- corregir errores sin una ruta clara;
- perder accidentalmente una venta;
- interpretar incorrectamente el orden de sus movimientos.

Las categorías sugeridas deben ser especialmente útiles para el contexto latinoamericano, incluyendo **ingresos y gastos típicos, frecuentes y conocidos en Latinoamérica**, sin limitarse a categorías genéricas importadas de otros mercados.

La experiencia debe transmitir:

> **claridad + control + confianza + facilidad.**

Pero nunca a costa de:

> **integridad financiera + trazabilidad + seguridad + consistencia.**

Si encuentras un conflicto entre ambos grupos, la integridad financiera tiene prioridad y debes documentar el conflicto antes de continuar.

No dejes cabos sueltos.

No ocultes hallazgos.

No asumas que algo está bien porque "parece funcionar".

Verifica.

Corrige.

Prueba.

Documenta.

Y únicamente cuando toda la evidencia esté completa, cierra formalmente la Ronda Post-UX/UI.
