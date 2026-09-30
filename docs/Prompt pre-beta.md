# TWINCAP — RONDA FINAL PRE-BETA

## BETA READINESS / HARDENING / CIERRE DE PENDIENTES

**AGENTE EJECUTOR:** OpenCode Build\
**MODELO:** GLM 5.3 Flash\
**TIPO DE RONDA:** Pre-Beta Hardening / Beta Readiness\
**OBJETIVO:** Dejar TwinCap técnicamente, funcionalmente, documentalmente y operativamente listo para iniciar una beta controlada.

---

# 0. ORDEN PRINCIPAL

Esta ronda NO es una nueva ronda abierta de desarrollo de funcionalidades.

Es una ronda de **cierre**.

Debes:

1. Auditar el estado REAL del repositorio antes de modificarlo.
2. Revisar obligatoriamente la documentación de proyecto.
3. Identificar todos los pendientes históricos todavía vigentes.
4. Implementar todos los pendientes que correspondan al alcance de esta ronda.
5. Corregir todos los defectos encontrados que puedan comprometer la beta.
6. Crear o ampliar las pruebas necesarias para demostrar que las funcionalidades nuevas funcionan de extremo a extremo.
7. Verificar que las mejoras recientes de POS, inventario, fórmulas, combos, clientes, dashboard y UX/UI no hayan introducido regresiones.
8. Revisar la preparación de producción.
9. Actualizar la documentación para que refleje el estado REAL del proyecto.
10. Dejar claramente documentado qué queda fuera de beta y por qué.
11. No introducir funcionalidades nuevas que no sean necesarias para cerrar los pendientes definidos en esta orden.
12. No reabrir decisiones ya congeladas del dominio financiero salvo que encuentres un defecto real de integridad, atomicidad, concurrencia, aislamiento, idempotencia o semántica financiera.
13. No considerar una tarea “terminada” solamente porque compile. Debe existir evidencia suficiente mediante tests, inspección, validación o documentación.

**TODOS LOS HALLAZGOS RELEVANTES DEBEN SER CORREGIDOS EN ESTA RONDA.**

No quiero una lista de recomendaciones para que otro agente las implemente posteriormente.

Quiero que investigues → implementes → pruebes → verifiques → documentes.

---

# 1. DOCUMENTACIÓN OBLIGATORIA ANTES DE EMPEZAR

Lee completamente, en este orden cuando sea posible:

- `AGENTS.md`
- `docs/PROJECT-RULES.md`
- `docs/AUDIT-AND-PLAN.md`
- `docs/POST-UX-ROUND-REPORT.md`
- `docs/POST-UX-AUDIT.md`
- `docs/Cierre_UX-UI.md`
- `docs/definition-of-beta.md`
- `docs/beta-launch-plan.md`
- `docs/beta-qa-isolation-checklist.md`
- `docs/OFFLINE-ARCHITECTURE.md`
- `docs/I18N-PT-BR-PREP.md`
- `docs/COSTS-DESIGN.md`
- `docs/ANALYTICS-ROADMAP.md`
- `docs/odd/tasks/product-round-1.md`
- `docs/odd/tasks/inventory-mvp-contract.md`

Después revisa el código real.

La documentación NO es una autoridad superior al código cuando ambos contradicen el estado real. Debes reconciliar ambos.

---

# 2. REGLAS PERMANENTES DEL PROYECTO

Debes respetar íntegramente las reglas existentes en `AGENTS.md` y `docs/PROJECT-RULES.md`.

Especialmente:

## 2.1 Dominio financiero congelado

El dominio financiero fue congelado después de R15.3.

No reabras decisiones financieras solamente por preferencia arquitectónica.

Pero el freeze NO protege bugs.

Si encuentras:

- pérdida de dinero;
- doble contabilización;
- movimientos huérfanos;
- inconsistencias entre entidades;
- violación de atomicidad;
- problemas de concurrencia;
- errores de idempotencia;
- aislamiento multi-tenant defectuoso;
- reversas incorrectas;
- errores de moneda;
- errores de semántica financiera;

debes corregirlos.

---

## 2.2 No bloquear artificialmente saldos negativos

TwinCap NO debe impedir operaciones financieras simplemente porque el usuario no tenga fondos suficientes.

Debe:

- registrar correctamente el movimiento;
- permitir el saldo negativo cuando corresponda;
- mostrarlo claramente;
- mantener la integridad contable.

No conviertas TwinCap en un sistema que bloquea operaciones legítimas por una regla artificial de saldo.

---

## 2.3 Transferencias

Una transferencia:

- NO es ingreso;
- NO es gasto;
- NO debe inflar resultados;
- NO debe desaparecer de los balances.

En transferencias entre monedas:

- pedir monto de origen;
- pedir monto de destino;
- calcular y mostrar tasa de cambio;
- conservar correctamente ambos valores.

No modificar esta semántica.

---

## 2.4 Crédito

Mantener las distinciones existentes entre:

- venta;
- cobro;
- crédito otorgado;
- abono;
- compra a crédito;
- payable;
- gasto;
- ingreso financiero;
- transferencia.

No convertir movimientos de balance en movimientos de resultado.

---

# 3. ESTADO DE REFERENCIA QUE DEBES PRESERVAR

La ronda de UX/UI ya fue cerrada.

La Ronda Producto 1 también fue cerrada documentalmente.

Producto 1 incorporó, entre otras cosas:

- inventario;
- unidades y conversiones;
- cantidades fraccionarias;
- stock;
- ajustes;
- recepción de inventario;
- proveedores/referencia opcionales;
- payables relacionados;
- fórmulas/versionado;
- productos preparados;
- combos;
- consumo atómico de componentes;
- reversas;
- snapshots históricos;
- búsqueda de artículos;
- búsqueda de clientes;
- clientes con teléfono E.164;
- unicidad de teléfono por workspace;
- catálogo diferenciado entre productos/servicios/insumos;
- nuevas interfaces de catálogo;
- POS ampliado.

La documentación de Producto 1 reporta:

- 342/342 pruebas enfocadas;
- 1808/1808 Vitest;
- TypeScript sin errores;
- ESLint sin errores de código;
- Prettier correcto;
- build correcto;
- CI master verde;
- smoke test de producción realizado.

NO aceptes esos números únicamente como afirmaciones documentales.

Verifica que el estado actual del repositorio siga siendo coherente con ellos.

---

# 4. PRIMERA FASE — AUDITORÍA REAL DEL ESTADO ACTUAL

Antes de implementar:

## 4.1 Ejecuta/verifica

Cuando el entorno lo permita:

- tests unitarios;
- tests de integración;
- TypeScript;
- ESLint;
- Prettier;
- build;
- E2E;
- cualquier suite específica de inventario/POS;
- cualquier suite financiera;
- cualquier prueba de aislamiento.

Si alguna prueba no puede ejecutarse por limitación del entorno, documenta exactamente:

- cuál;
- por qué;
- qué evidencia alternativa utilizaste;
- qué debe ejecutarse posteriormente.

No inventes resultados.

---

# 5. SEGUNDA FASE — PENDIENTES HISTÓRICOS DEL RESUMEN

Estos pendientes NO deben perderse solamente porque la ronda UX/UI fue cerrada.

Debes verificar el estado actual de cada uno.

---

## 5.1 Comparación contra período anterior

El Resumen necesita permitir entender no solamente:

> “¿Cómo estoy ahora?”

sino también:

> “¿Estoy mejorando o empeorando?”

Implementa, si continúa ausente, comparación contra período anterior para las métricas apropiadas.

Como mínimo revisar:

- resultado del período;
- ingresos;
- gastos.

La implementación histórica prevista incluía conceptos equivalentes a:

- `resultChangePct`
- `incomeChangePct`
- `expenseChangePct`

No implementes porcentajes sin una semántica financiera clara.

Debes definir correctamente:

### Período actual

Ejemplo:

- mes actual;
- mes anterior.

Si se utiliza otra granularidad, debe existir una regla consistente.

### Período comparable

El período anterior debe tener la misma duración comparable.

Ejemplo:

- septiembre vs agosto;
- semana actual vs semana anterior;
- año actual vs año anterior.

No compares arbitrariamente fechas de distinta duración.

### División por cero

Si el período anterior es cero:

NO produzcas:

- `Infinity`;
- `NaN`;
- porcentajes engañosos.

Define una presentación segura como:

- “Sin referencia comparable”;
- “Nuevo”;
- “—”;

según el contexto.

### Valores negativos

Debes manejar correctamente cambios cuando:

- el período anterior es negativo;
- el actual es positivo;
- ambos son negativos;
- ambos son cero.

No uses una fórmula ingenua que genere una interpretación financiera absurda.

### Multi-moneda

NO compares COP contra USD sumándolos.

Las comparaciones deben respetar moneda.

Si el Resumen trabaja por moneda:

- comparar cada moneda consigo misma;
- evitar conversiones implícitas no soportadas.

### UX

El cambio debe ser:

- comprensible;
- visible;
- contextual;
- accesible;
- traducible.

No convertir el Resumen en una pantalla de KPIs.

---

# 6. SELECTOR DE PERÍODO DEL RESUMEN

Verifica el pendiente histórico sobre selector general de período.

Se había identificado la ausencia de una selección consistente como:

- Mes;
- Año;
- 12 meses;

o equivalente según la arquitectura final.

No implementes un selector únicamente por agregarlo.

Debe afectar coherentemente:

- métricas;
- comparación;
- gráfico;
- categorías;
- movimientos relevantes;
- alertas que dependan del período.

Si el alcance actual de beta justifica mantener un período fijo, documenta explícitamente esa decisión y asegúrate de que el comparativo implementado sea coherente.

---

# 7. ALERTAS DEL RESUMEN

Verifica los pendientes históricos relacionados con inteligencia financiera básica.

## 7.1 Saldo negativo

El Resumen debe poder identificar situaciones relevantes de saldo negativo cuando existan.

No debe bloquear la operación.

Debe informar.

El mensaje debe:

- explicar qué ocurre;
- señalar la cuenta/moneda relevante;
- evitar alarmismo;
- permitir al usuario investigar.

---

## 7.2 Gasto atípico

Se había identificado como pendiente la detección de gasto atípico.

Antes de implementarlo, define claramente:

- qué significa “atípico”;
- cuál es la referencia;
- período mínimo requerido;
- cómo manejar pocos datos;
- cómo manejar estacionalidad básica;
- cómo evitar falsos positivos;
- cómo tratar multi-moneda.

NO implementes una “IA” arbitraria.

Una regla estadística/simple y explicable es preferible para beta si permite resultados confiables.

Si la información disponible todavía no permite una detección confiable, documenta el requisito y NO inventes una alerta engañosa.

---

# 8. TOP CATEGORÍAS

Revisar la vigencia del diseño actual:

- diseño esperado: Top 3 ingresos y Top 5 gastos.

Determina cuál es el comportamiento actual.

Verifica que:

- Diseño responsive;
- respeta multi-moneda;
- evita mezclar monedas;
- muestra claramente qué representa el ranking.

Si existe una razón para mantener el diseño actual, actualiza la documentación .

---

# 9. ORDEN Y JERARQUÍA DEL RESUMEN

Mantener la jerarquía definida durante UX/UI:

1. disponible / dónde está el dinero;
2. flujo de caja del período;
3. cuentas;
4. movimientos recientes;
5. categorías;
6. análisis;
7. atención;
8. posición financiera y demás bloques relevantes.

Verificar que:

- el disponible sea visualmente dominante;
- el usuario pueda entender su situación rápidamente;
- los movimientos recientes sean accesibles;
- “Ver todos” lleve correctamente a Movimientos;
- no haya bloques decorativos que compitan con información financiera importante.

---

# 10. GRÁFICO DEL RESUMEN

Debe mantenerse el gráfico de líneas implementado.

Verificar:

- ingresos;
- gastos;
- período;
- moneda;
- multi-moneda;
- accesibilidad;
- tooltip;
- valores extremos;
- valores cero;
- ausencia de datos;
- responsive.

Debe existir una representación accesible equivalente, no depender exclusivamente de la visualización gráfica.

---

# 11. DISPONIBLE POR MONEDA

La tarjeta:

> “¿Cuánto tengo disponible?”

debe:

- mostrar saldos por moneda;
- no sumar monedas incompatibles;
- evitar conversiones silenciosas;
- manejar valores grandes;
- no romper el layout;
- indicar claramente la moneda.

No presentar un total ficticio en una moneda base.

---

# 12. MONEDA PREDETERMINADA

Ya existe configuración de `defaultCurrency`.

Auditar todo uso de:

`DEFAULT_CURRENCY = "COP"`

y determinar caso por caso si representa:

### Caso A — valor predeterminado legítimo

El usuario todavía no configuró moneda y COP es realmente el default del producto.

Puede ser válido.

### Caso B — fallback silencioso de datos desconocidos

Si la moneda real no se pudo determinar y el sistema simplemente usa COP:

Esto NO es aceptable.

Debe:

- resolver la moneda real;
- mostrar estado de error/inconsistencia;
- o impedir la operación si no puede determinarse correctamente.

No confundir:

> “moneda predeterminada del usuario”

con:

> “moneda desconocida reemplazada silenciosamente por COP”.

Audita especialmente:

- cuentas;
- dashboard;
- transferencias;
- POS;
- abonos;
- formularios de venta;
- correcciones;
- resúmenes;
- acciones server-side.

---

# 13. FAB GLOBAL

Verificar que el orden siga siendo:

1. Venta POS
2. Ingreso
3. Gasto

La Venta POS debe:

- abrir correctamente;
- respetar dirty state;
- limpiar correctamente al cerrar;
- obtener datos frescos cuando corresponda.

Los formularios deben conservar:

- categorías recién creadas;
- referencias actualizadas;
- datos coherentes después de crear entidades desde modales.

---

# 14. CREACIÓN DE CATEGORÍAS DESDE MOVIMIENTOS

Verificar:

- crear categoría desde formulario de ingreso/gasto;
- cerrar modal correctamente;
- actualizar lista;
- seleccionar categoría nueva;
- no exigir refresh de página.

Debe mantenerse la solución actual basada en actualización del estado local/referencias.

No reintroducir el bug:

> “la categoría aparece en la lista general pero no en el selector del FAB/formulario hasta refrescar”.

---

# 15. TRANSFERENCIAS EN NAVEGACIÓN

Verificar que Transferencias esté visible nuevamente en la navegación principal.

No ocultar la funcionalidad si sigue formando parte del producto beta.

---

# 16. FORMULARIOS

Mantener el principio UX de:

- label + input en la misma fila cuando sea apropiado;
- campos relacionados juntos;
- dos inputs relacionados en una misma fila cuando el espacio lo permita;
- responsive en móvil.

Verificar especialmente:

- desktop;
- 375 px;
- 768 px;
- 1280 px.
- Botón X para limpiar el input en todos los buscadores dentro o fuera de los formularios.

No sacrificar accesibilidad por compactar.

---

# 17. SELECTORES

Mantener la regla:

> Los selects de creación deben comenzar en estado neutral “Seleccionar”.

No precargar silenciosamente una cuenta/categoría/cliente/producto cuando la selección tiene significado financiero.

Excepciones solamente cuando el producto tenga una razón explícita y documentada.

---

# 18. POS — AUDITORÍA COMPLETA

El POS fue ampliado considerablemente.

No asumir que porque sus servicios funcionan unitariamente está listo para beta.

Auditar:

- búsqueda de artículos;
- búsqueda de clientes;
- selección de cliente;
- cliente general;
- creación rápida de cliente;
- cantidades;
- cantidades fraccionarias cuando corresponda;
- productos;
- servicios;
- stock;
- fórmulas;
- combos;
- descuentos si existen;
- pagos;
- abonos;
- ventas a crédito;
- reversas;
- movimientos financieros;
- snapshot histórico.

---

# 19. BETA E2E PACK — OBLIGATORIO

Crear o completar pruebas E2E/integradas suficientes para demostrar los flujos nuevos.

Como mínimo:

## E2E-01 — Producto

Crear producto →

configurar unidad →

configurar stock →

aparece en catálogo →

aparece en POS.

---

## E2E-02 — Venta normal

Producto →

venta POS →

venta registrada →

stock decrementado →

movimiento/resultado financiero correcto.

Verificar que no haya doble descuento de stock ni doble movimiento financiero.

---

## E2E-03 — Venta con cantidad granular

Venta con cantidad fraccionaria cuando el producto/unidad lo permita.

Verificar:

- cantidad;
- conversión;
- stock;
- importe;
- persistencia;
- reversa.

---

## E2E-04 — Recepción de inventario

Recepción multi-línea →

stock aumenta →

ningún gasto financiero automático.

Esto es CRÍTICO.

La recepción física de inventario NO debe crear automáticamente un gasto.

---

## E2E-05 — Recepción a crédito

Recepción →

payable →

posterior pago →

gasto correspondiente →

sin doble contabilización.

Verificar relación exacta entre:

- receipt;
- payable;
- payment;
- movement.

---

## E2E-06 — Fórmula

Crear producto preparado →

crear fórmula/version →

vender →

consumir componentes →

registrar snapshot histórico →

revertir →

restaurar correctamente componentes.

---

## E2E-07 — Combo

Crear combo →

vender →

consumir componentes →

verificar composición histórica →

revertir.

---

## E2E-08 — Cliente

Crear cliente →

teléfono E.164 →

venta →

actividad del cliente →

verificar que solamente aparezcan relaciones realmente verificables.

---

## E2E-09 — Stock adjustment

Ajuste de stock →

historial →

stock actualizado →

NINGÚN movimiento financiero automático.

---

## E2E-10 — Reversas

Probar reversas de:

- venta;
- fórmula;
- combo;
- movimientos relacionados cuando aplique.

Verificar que nunca se duplique ni se pierda el efecto original.

---

# 20. INVENTARIO — AUDITORÍA DE INTEGRIDAD

Verificar especialmente:

- tenant isolation;
- atomicidad;
- conversiones;
- unidades base;
- cantidades fraccionarias;
- consumo;
- reversas;
- historial;
- stock negativo según política existente;
- concurrencia;
- idempotencia;
- referencias;
- snapshots.

---

# 21. INCIDENTES YA ENCONTRADOS EN PRODUCT ROUND 1

Verificar que las correcciones sigan presentes y no hayan regresado.

Especialmente:

### 21.1 Índice payable

Existió un índice:

`workspaceId_1_payableId_1`

que provocaba E11000 al crear un segundo receipt completamente pagado.

Verificar que la solución final:

- no genere falsos conflictos;
- mantenga la unicidad donde realmente corresponde;
- utilice correctamente el filtro parcial si esa es la solución;
- esté materializada en Atlas.

---

### 21.2 Receipt `_id`

Existió un problema donde el mapper no persistía correctamente `_id`.

Verificar:

- referencias;
- persistencia;
- reconstrucción;
- relaciones;
- ausencia de huérfanos.

---

### 21.3 Stock validation

Verificar que la corrección de la regresión de validación de stock continúe aplicada.

---

### 21.4 Delete catalog guard

Verificar que el orden de las protecciones de eliminación siga evitando estados inconsistentes.

---

### 21.5 CI unmount

Verificar que la solución del problema de unmount en CI continúe estable.

---

### 21.6 E2E helpers

Verificar que los helpers continúen alineados con los nuevos selects neutrales.

---

# 22. POS / INVENTARIO Y E2E — PRINCIPIO CRÍTICO

La Ronda Producto 1 pudo haber tenido CI verde sin que cada flujo nuevo tenga una suite E2E dedicada.

Eso debe corregirse donde sea necesario.

No aceptar:

> “los unit tests pasan, por lo tanto POS/inventario están listos”.

Los flujos de mayor riesgo necesitan validación integrada.

---

# 23. MULTI-TENANT / AISLAMIENTO

Revalidar aislamiento.

Como mínimo:

- Workspace A no puede leer datos de Workspace B.
- Workspace A no puede modificar datos de Workspace B.
- Workspace A no puede eliminar datos de Workspace B.
- referencias indirectas no deben permitir fuga de datos;
- POS;
- inventario;
- receipts;
- formulas;
- combos;
- clientes;
- movimientos;
- cuentas;
- payables.

La checklist antigua de aislamiento fue ejecutada sobre una versión anterior.

Debe realizarse una nueva verificación sobre la versión actual.

---

# 24. CONCURRENCIA

No reabrir toda la arquitectura financiera, pero sí ejecutar regresiones relevantes.

Especialmente:

- venta simultánea;
- consumo de stock simultáneo;
- recepción simultánea;
- pago simultáneo;
- reversa simultánea;
- idempotencia.

Buscar:

- doble movimiento;
- doble decremento;
- stock incorrecto;
- payable duplicado;
- orphan references;
- estados parcialmente persistidos.

---

# 25. BACKUP Y RESTORE

El backup/restore documentado anteriormente es anterior a las ampliaciones importantes de inventario.

Por tanto:

## Ejecutar un nuevo ciclo de:

1. backup;
2. verificación del backup;
3. restore en entorno seguro/aislado;
4. verificación de integridad;
5. documentación del procedimiento.

El backup debe incluir correctamente las nuevas colecciones/modelos relevantes.

No declarar “backup listo” solamente porque existe un backup.

Debe demostrarse que puede restaurarse.

---

# 26. ATLAS / ÍNDICES

Verificar directamente los índices necesarios.

Especialmente los nuevos contratos de:

- inventario;
- receipts;
- stock;
- payables;
- teléfonos;
- workspace;
- monitorización;
- TTL;
- índices únicos;
- índices parciales.

No asumir que definir un índice en Mongoose significa que ya está materializado en Atlas.

Documentar:

- índice;
- colección;
- propósito;
- unicidad;
- TTL si aplica;
- estado real.

---

# 27. MONITORIZACIÓN

Verificar que continúe funcionando la infraestructura de monitoring existente.

Revisar:

- `/api/monitor`;
- fingerprints;
- cooldowns;
- índices;
- TTL;
- alertas;
- throttle;
- errores MongoDB;
- rate limiting.

Recordar la corrección histórica:

El rate limiter no debe reintentar indiscriminadamente ante cualquier error MongoDB.

El comportamiento especial corresponde a conflictos de unicidad `E11000`, no a cualquier fallo de MongoDB.

---

# 28. IDEMPOTENCIA

Auditar operaciones financieras y de inventario sensibles.

Especialmente:

- ventas;
- pagos;
- abonos;
- receipts;
- reversas;
- movimientos derivados;
- consumo de stock.

Verificar que una repetición accidental de una request no produzca doble efecto.

La liberación de una `idempotencyKey` NO debe ocurrir de forma que permita una repetición después de haber ejecutado parcialmente una operación financiera.

---

# 29. PRODUCCIÓN

Antes de declarar beta-ready:

Verificar el entorno de producción actual.

## Revisar:

- Vercel;
- variables de entorno;
- MongoDB Atlas;
- APP_BASE_URL;
- URLs públicas;
- monitoring;
- email/Resend si corresponde;
- analytics;
- autenticación;
- cookies/JWT;
- CORS si aplica;
- dominios;
- PWA;
- service worker;
- producción vs staging/test.

No confundir:

- `.env.example`;
- entorno local;
- preview;
- producción.

---

# 30. STAGING / PRODUCCIÓN

Verificar que:

- tests no apunten a producción;
- E2E no modifique datos reales;
- MongoMemory/local DB se utilice cuando corresponda;
- producción esté aislada;
- no existan credenciales reales en fixtures;
- no existan datos de pruebas mezclados con usuarios beta.

---

# 31. BRANCH PROTECTION

Verificar directamente, si las herramientas disponibles lo permiten, que `master` tenga:

- branch protection;
- CI requerido;
- Quality requerido;
- E2E requerido cuando corresponda;
- branches actualizados antes de merge si la política lo exige;
- force push bloqueado;
- eliminación de master bloqueada.

NO basta con que `docs/beta-launch-plan.md` diga que existe.

Si no puedes verificarlo desde el entorno, documenta que requiere verificación externa antes de beta.

---

# 32. CI/CD

Confirmar:

- CI de master;
- PR;
- Quality;
- E2E;
- build;
- deploy;
- relación entre commit desplegado y commit validado.

La cadena correcta debe ser:

**commit exacto → CI verde → deploy → smoke test → beta**

No aceptar:

**“CI estaba verde en algún commit”**

si no se puede demostrar que ese es el commit desplegado.

---

# 33. SMOKE TEST DE PRODUCCIÓN

Ejecutar un smoke test actual.

Como mínimo:

1. login;
2. dashboard;
3. cuenta;
4. movimiento;
5. transferencia;
6. cliente;
7. POS;
8. venta;
9. inventario;
10. receipt;
11. fórmula;
12. combo;
13. reversa;
14. logout;
15. responsive básico.

Documentar resultado.

---

# 34. PWA / OFFLINE

NO implementar en esta ronda sincronización financiera offline completa.

La arquitectura actual deliberadamente:

- cachea shell público/estático;
- no cachea datos financieros autenticados;
- no permite guardar operaciones financieras offline;
- muestra estado de conectividad;
- preserva formularios ante errores de red.

Esto es correcto como alcance de beta.

Verificar que:

- no se cacheen accidentalmente datos financieros privados;
- no se creen escrituras offline silenciosas;
- el usuario reciba feedback claro cuando está offline;
- un error de red no borre el formulario.

NO construir ahora:

- cola offline financiera;
- sincronización automática;
- resolución de conflictos;
- almacenamiento financiero local complejo.

Eso queda post-beta según `docs/OFFLINE-ARCHITECTURE.md`.

---

# 35. ANALYTICS

Distinguir:

### Product analytics

Ya existente:

- usuarios;
- activación;
- retención;
- movimientos;
- ventas;
- dashboard;
- etc.

### Business analytics del usuario

NO confundirlo con el anterior.

No implementar todavía como parte obligatoria de beta:

- margen;
- utilidad por producto;
- rentabilidad avanzada;
- COGS;
- predicciones;
- análisis avanzado de inventario.

Pero sí verificar que los eventos necesarios para entender uso beta estén funcionando.

---

# 36. COSTOS / COGS / MARGEN

NO implementar improvisadamente.

Actualmente existe diseño conceptual.

No convertir:

- stock;
- precio de venta;
- compras;
- costos;

en una fórmula improvisada de margen.

No mostrar:

> “ganancia”

si el sistema todavía no tiene una definición de costo históricamente confiable.

Queda fuera del alcance de beta salvo que algún pendiente crítico ya definido lo requiera.

---

# 37. INVENTARIO ERP / COMPRAS

NO construir:

- módulo ERP completo;
- órdenes de compra;
- proveedores completos;
- compras avanzadas;
- cuentas por pagar como ERP completo.

El receipt actual debe mantenerse como:

> registro de entrada de inventario

y no transformarlo silenciosamente en un sistema de compras.

---

# 38. PT-BR

NO habilitar portugués brasileño todavía.

Mantener:

- español;
- inglés;

según estado actual.

PT-BR continúa preparado documentalmente, pero requiere trabajo posterior de:

- mensajes;
- paridad;
- revisión;
- pruebas;
- habilitación.

---

# 39. TEAMS / BILLING

NO implementar antes de beta:

- equipos;
- colaboradores;
- roles;
- permisos avanzados;
- billing SaaS.

El modelo actual de un usuario por workspace continúa vigente.

---

# 40. IA / PREDICCIONES

NO introducir ahora:

- IA financiera;
- predicciones;
- recomendaciones automáticas complejas;
- scoring;
- “insights” inventados.

Primero debe existir una base de datos suficientemente confiable y definiciones financieras sólidas.

---

# 41. ACCESIBILIDAD

Realizar regresión de accesibilidad sobre funcionalidades nuevas.

Revisar:

- keyboard navigation;
- focus;
- modales;
- selects;
- formularios;
- icon-only buttons;
- labels;
- aria;
- contraste;
- dark mode;
- mensajes de error;
- tablas accesibles donde existan;
- gráficos accesibles.

No asumir que un componente viejo sigue accesible después de integrarlo en nuevos flujos.

---

# 42. RESPONSIVE

Validar como mínimo:

- 375 px;
- 768 px;
- 1280 px.

Especial atención a:

- catálogo;
- POS;
- receipts;
- fórmulas;
- combos;
- cards;
- formularios;
- modales;
- dropdowns;
- FAB;
- tablas;
- movimientos;
- tarjetas de crédito;
- valores monetarios grandes.

No permitir:

- overflow horizontal accidental;
- botones cortados;
- texto monetario desbordado;
- dropdowns fuera de pantalla;
- modales imposibles de usar;
- grids deformados.

---

# 43. CARDS VS TABLES

Mantener la regla UX establecida:

En móvil, priorizar cards para información financiera y de negocio.

Las tablas pueden existir donde sean realmente necesarias, pero deben:

- ser usables;
- tener alternativa responsive;
- no producir overflow;
- mantener accesibilidad.

No convertir todas las tablas existentes en cards indiscriminadamente.

---

# 44. MOVIMIENTOS

Verificar:

- Todo/All como estado inicial;
- ingresos;
- gastos;
- transferencias;
- categorías;
- creación inline de categorías;
- selector de cliente cuando corresponda;
- responsive;
- iconos de eliminar;
- estados vacíos;
- paginación/filtros;
- coherencia con el Resumen.

---

# 45. CLIENTES

Verificar:

- creación;
- edición;
- teléfono E.164;
- unicidad por workspace;
- búsqueda;
- actividad;
- relaciones verificables;
- ausencia de actividad fantasma.

La actividad del cliente debe provenir de relaciones reales, no de asociaciones inferidas.

---

# 46. CATÁLOGO

Verificar:

- productos;
- servicios;
- insumos;
- agrupación;
- stock;
- unidades;
- precio;
- venta;
- cards;
- responsive;
- eliminación protegida;
- búsqueda.

---

# 47. REFERENCIAS / ESTADO FRESCO

Auditar todos los formularios que dependen de:

- cuentas;
- categorías;
- clientes;
- productos;
- unidades;
- referencias.

Después de crear/modificar una entidad:

- el selector debe reflejar el estado actualizado;
- no depender de refresh manual;
- no mantener referencias obsoletas.

---

# 48. I18N

Auditar todos los textos nuevos.

No permitir:

- strings hardcodeados;
- mensajes solamente en español;
- errores sin traducción;
- labels sin traducción;
- estados vacíos sin traducción.

Si una funcionalidad está soportada por inglés, debe tener paridad.

---

# 49. DOCUMENTACIÓN DESACTUALIZADA

Existe documentación histórica que puede contener estados anteriores.

Especialmente:

- `docs/definition-of-beta.md`
- `docs/AUDIT-AND-PLAN.md`
- reportes históricos de UX.

Debes reconciliarla.

Eliminar contradicciones como:

- “pendiente de push” cuando ya fue pushed;
- hashes antiguos presentados como estado actual;
- funcionalidades marcadas como pendientes cuando ya existen;
- funcionalidades marcadas como listas cuando todavía no lo están.

NO borrar historia útil.

Distinguir:

- histórico;
- estado actual;
- pendiente.

---

# 50. DEFINITION OF BETA

Actualizar `docs/definition-of-beta.md` para que refleje el estado actual después de:

- R15.3;
- UX/UI;
- Product Round 1;
- esta ronda.

Debe quedar claro:

### Producto

Qué está incluido.

### Calidad

Qué pruebas existen.

### Seguridad

Qué está verificado.

### Operación

Qué está verificado.

### Legal

Qué falta.

### Fuera de beta

Qué queda deliberadamente para después.

La definición de beta debe convertirse en la fuente documental clara para decidir si TwinCap puede abrirse a usuarios beta.

---

# 51. LEGAL

Este es un GATE REAL.

Actualmente la identidad legal contiene placeholders como:

- `[RAZÓN SOCIAL]`
- `[NIT]`

No modificar inventando datos.

Antes de beta comercial deben completarse los datos legales reales y realizar la revisión jurídica correspondiente.

Verificar:

- razón social;
- NIT;
- términos;
- privacidad;
- tratamiento de datos;
- cookies si aplica;
- contacto;
- identidad empresarial;
- claims comerciales;
- cualquier texto legal público.

Si el agente no tiene datos reales, debe dejar el pendiente explícito.

NO inventar:

- razón social;
- NIT;
- registro;
- número legal;
- abogado;
- políticas aprobadas.

---

# 52. CLAIMS DE SEGURIDAD Y MULTIMONEDA

Revisar textos de marketing/landing/legal.

No afirmar:

- seguridad absoluta;
- protección absoluta;
- cumplimiento legal inexistente;
- capacidades offline inexistentes;
- soporte multimoneda que no corresponda;
- capacidades de IA que no existan;
- capacidades empresariales no implementadas.

Los claims deben coincidir con el producto real.

---

# 53. MONITOREO DE ERRORES

Verificar que los errores críticos de producción sean:

- capturados;
- identificables;
- trazables;
- limitados para evitar spam;
- compatibles con privacidad.

Revisar especialmente la infraestructura histórica de monitorización y las correcciones realizadas durante R14/R15.

---

# 54. SEGURIDAD

Realizar una pasada final sobre:

- auth;
- autorización;
- tenant isolation;
- inputs;
- IDs;
- ownership;
- endpoints;
- server actions;
- API routes;
- mutaciones;
- rate limiting;
- idempotencia;
- datos sensibles;
- logs.

No registrar secretos ni información financiera innecesaria.

---

# 55. DATOS DE PRUEBA

Auditar fixtures y helpers.

No permitir que:

- tests dependan de datos persistentes;
- tests se contaminen entre sí;
- E2E dependa de producción;
- IDs fijos creen conflictos;
- fixtures violen nuevas restricciones.

---

# 56. REGRESIÓN FINANCIERA

Ejecutar una pasada específica sobre:

- ingreso;
- gasto;
- transferencia;
- venta;
- cobro;
- crédito;
- abono;
- payable;
- receipt;
- reversa.

Para cada operación verificar:

### Balance

¿El saldo cambia correctamente?

### Resultado

¿El ingreso/gasto cambia correctamente?

### Stock

¿Debe cambiar?

### Relaciones

¿Se crean las referencias correctas?

### Reversa

¿Se revierte exactamente el efecto correspondiente?

### Moneda

¿Se mantiene correctamente?

### Idempotencia

¿Una repetición produce un único efecto?

---

# 57. CRITERIO ESPECIAL PARA RECEIPTS

Repetir explícitamente:

**Receipt ≠ gasto automático.**

Una entrada física de inventario no debe generar automáticamente un gasto financiero.

Cuando exista pago real:

- el pago debe reflejarse correctamente;
- el payable debe relacionarse;
- el gasto debe ocurrir según la semántica definida;
- no duplicar el efecto.

---

# 58. PRODUCTOS PREPARADOS

Verificar que una fórmula sea histórica.

Una modificación posterior de la receta NO debe alterar retroactivamente una venta anterior.

La venta debe conservar snapshot suficiente para:

- consumo;
- reversa;
- auditoría.

---

# 59. COMBOS

La composición utilizada por una venta debe poder determinarse históricamente.

No permitir que editar un combo hoy cambie la interpretación de una venta pasada.

---

# 60. STOCK

Verificar que:

- una venta descuente;
- una reversa restaure;
- un receipt incremente;
- un adjustment modifique según razón;
- ninguno de esos efectos financieros sea inventado.

---

# 61. PERFORMANCE

No hacer optimizaciones especulativas.

Pero revisar:

- queries repetitivas;
- N+1;
- payloads excesivos;
- consultas innecesarias;
- dashboard;
- catálogo;
- POS;
- inventario;
- paginación;
- índices.

Priorizar problemas reales observables.

---

# 62. ERRORES / EMPTY STATES

Todos los estados deben diferenciar:

- cargando;
- vacío;
- error;
- offline;
- sin permisos;
- datos inconsistentes.

No usar un empty state cuando realmente ocurrió un error.

---

# 63. MENSAJES DE ATENCIÓN

Revisar el empty state de Atención.

Debe evitar mensajes genéricos que no expliquen por qué no hay alertas.

Debe transmitir claramente algo equivalente a:

- no hay alertas relevantes actualmente;
- o no hay suficiente información;
- o existe una condición que requiere atención.

No generar falsa sensación de seguridad.

---

# 64. BETA CONTROLADA

El beta launch plan establece aproximadamente:

- 10–20 usuarios;
- período inicial de aproximadamente 30 días;
- seguimiento de activación;
- retención;
- uso;
- POS;
- dashboard;
- soporte;
- entrevistas.

No aumentar indiscriminadamente funcionalidades durante beta.

Una vez abierta la beta:

Prioridad:

1. bugs críticos;
2. pérdida/integridad de datos;
3. problemas de seguridad;
4. problemas de onboarding;
5. problemas de comprensión/UX;
6. mejoras basadas en evidencia.

No convertir la beta en una nueva ronda de feature creep.

---

# 65. ANALÍTICA PARA BETA

Verificar que puedan medirse como mínimo:

- registro;
- activación;
- primer movimiento;
- uso de Resumen;
- movimientos;
- transferencias;
- POS;
- ventas;
- inventario;
- uso recurrente;
- retención;
- errores críticos.

No medir información sensible innecesaria.

---

# 66. COSAS QUE NO DEBES IMPLEMENTAR EN ESTA RONDA

Salvo que descubras una dependencia crítica inesperada, NO implementar:

- COGS completo;
- margen avanzado;
- utilidad por producto;
- compras ERP;
- proveedores ERP completo;
- predicciones;
- IA;
- recomendaciones inteligentes complejas;
- Teams;
- colaboradores;
- roles;
- Billing;
- offline financiero completo;
- sincronización offline;
- resolución de conflictos offline;
- PT-BR completo;
- funcionalidades empresariales avanzadas;
- features por competir en cantidad con Treinta u otras aplicaciones.

La misión es cerrar el producto existente, no inflarlo.

---

# 67. NO REABRIR UX/UI SIN MOTIVO

No rehacer:

- design system;
- navegación;
- layout;
- Resumen;
- cards;
- FAB;

solamente por preferencia estética.

Sí corregir:

- bugs;
- inconsistencias;
- problemas de comprensión;
- accesibilidad;
- responsive;
- overflow;
- errores de estado;
- inconsistencias con los requisitos ya definidos.

---

# 68. PRINCIPIO DE “NO DEJAR CABOS SUELTOS”

Si durante la auditoría encuentras algo relacionado con:

- seguridad;
- integridad financiera;
- tenant isolation;
- concurrencia;
- datos;
- producción;
- beta;
- funcionalidad recientemente implementada;

no lo escondas porque no aparezca explícitamente en esta lista.

Clasifícalo.

Si es necesario para beta:

**corrígelo.**

Si no es necesario para beta:

**documenta por qué queda fuera.**

---

# 69. MATRIZ FINAL DE HALLAZGOS

Al terminar debes producir una matriz con:

| ID  | Hallazgo | Severidad | Estado | Evidencia | Corrección | Test | Fuera de beta |
| --- | -------- | --------- | ------ | --------- | ---------- | ---- | ------------- |

Severidades:

- P0 — bloquea beta;
- P1 — debe corregirse antes de beta;
- P2 — importante pero puede quedar post-beta;
- P3 — mejora futura.

NO utilizar “P2” para esconder problemas que realmente puedan comprometer beta.

---

# 70. CRITERIOS DE CIERRE

La ronda NO puede declararse cerrada simplemente porque:

- compila;
- los tests unitarios pasan;
- el build pasa.

Debe cumplirse:

### Código

- TypeScript OK;
- lint OK;
- format OK;
- build OK.

### Tests

- unitarios OK;
- integración OK;
- E2E crítico OK;
- regresión financiera OK;
- aislamiento OK.

### Producto

- POS OK;
- inventario OK;
- receipts OK;
- fórmulas OK;
- combos OK;
- clientes OK;
- Resumen OK;
- navegación OK.

### Finanzas

- atomicidad OK;
- concurrencia OK;
- idempotencia OK;
- multimoneda OK;
- reversas OK;
- semántica OK.

### Producción

- índices OK;
- backup/restore OK;
- monitoring OK;
- variables OK;
- deploy verificable;
- smoke test OK.

### UX

- responsive OK;
- accesibilidad OK;
- estados de error OK;
- offline notice OK;
- no overflow crítico.

### Documentación

- Definition of Beta actualizada;
- pendientes clasificados;
- documentación histórica reconciliada;
- alcance post-beta documentado.

### Legal

- todos los datos legales reales completados;
- revisión jurídica pendiente/completada según estado real.

---

# 71. REGLA SOBRE LEGAL

Si todo el software está listo pero los requisitos legales reales todavía no están completados:

NO declares:

> “TwinCap está listo para lanzamiento beta público/comercial”.

Declara:

> “TwinCap está técnicamente listo / Release Candidate, pendiente del gate legal.”

La diferencia es importante.

---

# 72. RELEASE CANDIDATE

Una vez corregidos todos los problemas técnicos:

Preparar un estado de Release Candidate.

La secuencia debe ser:

1. working tree limpio;
2. tests completos;
3. build;
4. CI;
5. commit exacto;
6. deploy;
7. verificación de producción;
8. smoke test;
9. backup;
10. índices;
11. monitoring;
12. documentación;
13. legal;
14. autorización final para beta.

No considerar como Release Candidate un estado que no tenga trazabilidad del commit desplegado.

---

# 73. REPORTE FINAL OBLIGATORIO

Al finalizar debes entregar:

## A. Resumen ejecutivo

Responder:

- ¿Qué tan cerca está TwinCap de beta?
- ¿Qué estaba pendiente?
- ¿Qué corregiste?
- ¿Qué queda?
- ¿Qué bloquea beta?

## B. Hallazgos

Lista completa clasificada por P0/P1/P2/P3.

## C. Cambios realizados

Archivos y comportamiento modificado.

## D. Tests

Indicar exactamente:

- ejecutados;
- resultados;
- cantidad;
- duración si está disponible.

NO inventar.

## E. E2E

Indicar cuáles flujos nuevos tienen cobertura real.

## F. Producción

Indicar:

- qué verificaste;
- qué no pudiste verificar;
- qué depende de GitHub/Vercel/Atlas externo.

## G. Documentación

Indicar qué documentos fueron actualizados.

## H. Pendientes post-beta

Lista explícita:

- COGS;
- margen;
- business analytics;
- offline financiero;
- PT-BR;
- Teams;
- Billing;
- IA/predicciones;
- etc.

## I. Beta Gate

Terminar con:

### BLOQUEADORES

### REQUISITOS PRE-BETA

### POST-BETA

### ESTADO FINAL

El estado final debe ser uno de:

- `NO LISTO — P0/P1 pendientes`
- `TECHNICALLY READY — pendiente gate legal/operacional`
- `RELEASE CANDIDATE`
- `BETA READY`

No uses `BETA READY` si existe un requisito técnico P0/P1 pendiente.

---

# 74. REGLA FINAL Y MÁS IMPORTANTE

No quiero una ronda superficial.

No quiero que simplemente ejecutes:

```text
pnpm test
pnpm build
```

y declares éxito.

TwinCap está entrando en una etapa donde el objetivo cambia:

**ya no se trata de agregar cosas; se trata de demostrar que lo construido puede sostener usuarios reales.**

Por tanto, prioriza:

**integridad > seguridad > aislamiento > coherencia financiera > confiabilidad > pruebas > producción > UX > nuevas funcionalidades.**

Y dentro de UX:

**claridad > confianza > facilidad de uso > recurrencia > estética.**

El producto debe permitir que un usuario real:

- entienda dónde está su dinero;
- registre ingresos y gastos;
- transfiera dinero;
- maneje distintas monedas;
- venda;
- gestione clientes;
- maneje inventario;
- reciba inventario;
- venda productos preparados;
- venda combos;
- revierta operaciones;
- consulte su Resumen;
- entienda si está mejorando o empeorando;
- y pueda confiar en que los datos representan lo que realmente ocurrió.

**No sacrifiques la integridad del sistema para hacer que una funcionalidad “se vea funcionando”.**

**No ocultes hallazgos.**

**No inventes resultados de pruebas.**

**No marques como terminado algo que no haya sido verificado.**

**No dejes pendientes técnicos importantes para “otra ronda” si son necesarios para beta.**

**No agregues feature creep.**

La meta de esta ronda es dejar TwinCap en un estado defendible como producto beta real, no simplemente como proyecto que compila.
