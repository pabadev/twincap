# twincap — RONDA 2
## Auditoría, corrección, UX/UI y evolución funcional

## 1. CONTEXTO

Estamos realizando una **segunda ronda de auditoría y mejora** sobre twincap (antes gloalmoney.

twincap ya es un prototipo SaaS funcional de finanzas personales y pequeños negocios. Las mejoras de una ronda anterior ya fueron implementadas parcialmente y la aplicación actualmente parece funcionar correctamente en sus flujos principales.

Esta nueva ronda parte de **pruebas reales realizadas sobre la aplicación**, por lo que los problemas descritos a continuación deben considerarse hallazgos reales, no hipótesis.

El objetivo de esta ronda es:

1. Corregir los problemas funcionales encontrados.
2. Corregir problemas de responsive.
3. Mejorar la consistencia de la UI.
4. Mejorar la experiencia de formularios.
5. Mejorar el sistema de feedback al usuario.
6. Resolver correctamente el flujo financiero de compras a crédito.
7. Consolidar un sistema visual coherente.
8. Revisar la arquitectura antes de introducir nuevas entidades financieras.
9. Detectar problemas adicionales.
10. Documentar todo el trabajo en `docs/AUDIT-AND-PLAN.md`.

---

# 2. REGLA PRINCIPAL: NO EMPEZAR PROGRAMANDO

Esta interacción comienza con una **AUDITORÍA**, no con implementación.

El flujo obligatorio es:

**LEER CONTEXTO → AUDITAR → ANALIZAR → IDENTIFICAR DEPENDENCIAS → PLANIFICAR → DOCUMENTAR → PRESENTAR PLAN → ESPERAR APROBACIÓN → IMPLEMENTAR FASE → PROBAR → DOCUMENTAR → DETENERSE**

No implementes las mejoras en esta primera etapa.

No modifiques código hasta que el usuario apruebe la primera fase.

---

# 3. FUENTES DE VERDAD DEL PROYECTO

Antes de realizar cualquier análisis debes leer:

1. `AGENTS.md`
2. `README.md`
3. `docs/AUDIT-AND-PLAN.md`, si existe.
4. El contexto disponible mediante Engram.
5. Las estructuras reales del código.

Estas fuentes tienen prioridad sobre suposiciones genéricas.

No reemplaces las reglas del proyecto por tus propias preferencias.

---

# 4. REGLAS PERMANENTES DEL PROYECTO

Estas reglas son INQUEBRANTABLES.

## Stack

- Next.js 16.3.1
- React 19
- TypeScript 5 strict
- Tailwind CSS 4
- MongoDB Atlas
- Mongoose 8
- Jose
- bcryptjs
- Zod 4
- Vitest
- pnpm 11
- Lucide React

No cambiar el stack.

No migrar a otro framework.

No sustituir Mongoose.

No sustituir Jose.

No sustituir Tailwind.

No sustituir Vitest.

No introducir otra librería de componentes UI.

---

# 5. GESTOR DE PAQUETES

El proyecto utiliza:

**pnpm**

Está prohibido utilizar:

- npm
- yarn

Para instalar paquetes:

`pnpm add`

Para ejecutar scripts:

`pnpm <script>`

No modificar el package manager.

---

# 6. ARQUITECTURA

twincap utiliza una arquitectura tipo Clean/Hexagonal.

Debe respetarse:

```text
src/
├── core/
│   ├── domain/
│   └── application/
├── infrastructure/
├── components/
├── i18n/
└── app/
```

Reglas:

### `core/domain`

Solo:

- entidades
- value objects
- errores de dominio
- interfaces de dominio

No importar infraestructura.

### `core/application`

Contiene use cases.

Depende de interfaces/ports.

No depender directamente de implementaciones concretas de infraestructura.

### `infrastructure`

Implementa:

- repositories
- modelos Mongoose
- autenticación
- configuración
- adaptadores

### `components`

Solo presentación.

No colocar lógica de negocio ni llamadas directas a repositories.

### `app`

Conecta:

- rutas
- pages
- layouts
- server actions
- UI

No romper esta separación para resolver rápidamente un problema.

---

# 7. REGLA DE BASE DE DATOS

Todo server action o route handler que utilice Mongoose debe:

1. ejecutar `await connectDb()`
2. crear repositories después de conectar
3. no instanciar repositories a nivel de módulo

No crear soluciones que violen `AGENTS.md`.

---

# 8. AUTENTICACIÓN Y MULTI-TENANCY

Cada usuario administra exclusivamente sus propios datos.

No existen actualmente:

- equipos
- colaboradores
- subusuarios
- permisos internos

Toda operación sobre datos debe verificar autorización en backend.

Nunca confiar exclusivamente en filtros del frontend.

No permitir acceso cruzado entre usuarios.

---

# 9. I18N

twincap utiliza i18n custom.

Los mensajes están en:

```text
messages/es.json
messages/en.json
```

Todo texto visible nuevo debe existir en ambos idiomas.

Nunca introducir textos visibles hardcodeados dentro de componentes.

Revisar especialmente este problema porque ya se encontraron textos como:

- `Tipo`
- `Currency`
- `Logout`
- otros textos que permanecen en inglés independientemente del idioma.

---

# 10. ICONOGRAFÍA

El proyecto utiliza:

**Lucide React**

Existe un wrapper en:

```text
src/components/ui/icon.tsx
```

Reutilizarlo.

No instalar otra biblioteca de iconos.

No crear SVG manuales cuando Lucide ya proporcione el icono adecuado.

---

# 11. TESTING

El proyecto utiliza:

```bash
pnpm test
```

Cada fase que modifique comportamiento funcional debe incluir o actualizar pruebas apropiadas.

No ocultar ni eliminar tests fallidos.

Al finalizar cada fase ejecutar, cuando corresponda:

```bash
pnpm test
pnpm lint
pnpm build
```

---

# 12. DOCUMENTACIÓN DE CONTINUIDAD

Debe existir:

```text
docs/AUDIT-AND-PLAN.md
```

Si existe:

- leerlo
- conservar su información válida
- actualizarlo

Si no existe:

- crearlo.

Este archivo será el documento de continuidad del proyecto.

Debe registrar:

- auditorías
- fases
- decisiones
- hallazgos
- estado
- cambios
- pruebas
- pendientes
- decisiones de arquitectura

Después de una compactación, nueva sesión o interrupción del trabajo, este archivo debe permitir que otro agente continúe correctamente. Sulectura es oligatoria.

---

# 13. HALLAZGOS DE ESTA RONDA

## H1 — MENÚ HAMBURGUESA

En pantallas pequeñas el menú hamburguesa no funciona.

Debe:

- abrir/cerrar correctamente el sidebar o navegación móvil.
- funcionar con teclado cuando corresponda.
- cerrar cuando corresponda al seleccionar una ruta.
- no producir overflow.
- respetar la sesión.
- mantener una experiencia consistente con desktop.

Auditar primero:

- layout principal
- sidebar
- estado del menú
- navegación
- responsive breakpoints
- posibles problemas Server/Client Component.

---

# 14. H2 — TABLAS MÁS ESTRECHAS QUE SU CONTENEDOR

Algunas tablas son visualmente más angostas que su contenedor.

Auditar todas las tablas.

No corregir solamente la tabla donde se detectó inicialmente.

Crear un comportamiento consistente para:

- width
- min-width
- columnas
- padding
- responsive
- encabezados
- acciones

Revisar:

- Movimientos
- Clientes
- Transferencias
- Créditos
- Ventas
- Catálogo
- cualquier otra tabla.

---

# 15. H3 — NAVEGACIÓN A INICIO

Al hacer clic en inicio (`/`), aparentemente se recarga toda la página o no existe feedback de navegación/loading/skeleton.

Analizar si:

- se está provocando una navegación completa.
- se está usando correctamente el App Router.
- existe loading UI.
- existe `loading.tsx`.
- existe un problema de Server Component/Client Component.
- existe una redirección innecesaria.

Objetivo:

La navegación debe sentirse como una transición fluida de una aplicación moderna.

No introducir una solución artificial solamente para ocultar una recarga real.

---

# 16. H4 — ACCIONES DE TABLAS

Los botones de acción como:

- editar
- eliminar
- cerrar
- ver
- etc.

deben utilizar **solo iconos** cuando el significado sea suficientemente claro.

No:

`Editar`

sino icono de edición.

No:

`Eliminar`

sino icono de papelera.

Cada icono debe tener:

- tooltip accesible cuando sea necesario
- `aria-label`
- estado hover
- estado focus
- estado disabled cuando corresponda

El hover debe utilizar un fondo circular o forma visual equivalente.

El color debe corresponder semánticamente a la acción.

Ejemplo:

- editar → color neutro/primario
- eliminar → rojo
- confirmar → verde
- advertencia → amarillo/ámbar
- cerrar → neutro

No exagerar el color.

Auditar TODOS los módulos, no solo los mencionados.

---

# 17. H5 — INTERNACIONALIZACIÓN DE "TIPO"

La columna `Tipo` de Movimientos aparece siempre en inglés.

Debe respetar el idioma activo:

ES:

- Ingreso
- Gasto

EN:

- Income
- Expense

No traducir mediante lógica hardcodeada dentro de la tabla.

Utilizar el sistema i18n existente.

Auditar otros campos similares para detectar el mismo problema.

---

# 18. H6 — AGREGAR MOVIMIENTO CON FILTRO "TODAS LAS CUENTAS"

Actualmente, cuando el filtro de Movimientos está en:

**Todas las cuentas**

y se pulsa:

**Agregar movimiento**

aparece un mensaje indicando que debe seleccionarse una cuenta.

Esto es incorrecto.

El filtro de la tabla y la cuenta del nuevo movimiento son conceptos diferentes.

## Comportamiento correcto

Sin importar qué filtro esté seleccionado:

```text
Todas las cuentas
Cuenta A
Cuenta B
Cuenta C
...
```

el botón:

**Agregar movimiento**

debe abrir siempre el formulario.

Dentro del formulario debe solicitarse la cuenta.

La cuenta es un dato obligatorio del nuevo movimiento.

No utilizar el filtro actual como requisito para abrir el formulario.

Esto debe funcionar independientemente de si el usuario está visualizando:

- Todas las cuentas
- Cuenta A
- Cuenta B

Si el filtro corresponde a una cuenta concreta, se puede evaluar si esa cuenta debe aparecer preseleccionada por conveniencia UX, pero el comportamiento debe analizarse antes de implementarlo.

---

# 19. H7 — FORMULARIOS DEMASIADO LARGOS

Los formularios largos necesitan una revisión global.

Problema observado especialmente en:

**Nuevo Movimiento**

Debe:

- ocupar menos espacio vertical.
- utilizar tipografía ligeramente más compacta.
- utilizar inputs más delgados.
- utilizar dos columnas en desktop cuando sea apropiado.
- utilizar una columna en móvil.
- agrupar campos de manera lógica.

Preferencia de organización:

### Grupo 1 — Selección

Primero:

- cuenta
- tipo
- categoría
- fecha
- opciones seleccionables

### Grupo 2 — Información introducida

Después:

- monto
- descripción
- notas
- texto libre

Pero no aplicar esta estructura ciegamente.

Debe evaluarse según la lógica del formulario.

---

# 20. H8 — ACCESO GLOBAL A INGRESOS Y GASTOS

Esta es una mejora prioritaria de UX.

Los ingresos y gastos son una función central de twincap.

Debe existir una acción accesible **desde cualquier vista autenticada** para:

- agregar ingreso
- agregar gasto

Puede ser:

- botón flotante
- botón persistente
- acción rápida
- otro patrón adecuado

Debe analizarse cuál ofrece mejor UX sin cubrir contenido.

Debe funcionar desde:

- Dashboard
- Movimientos
- Cuentas
- Transferencias
- Créditos
- POS
- Catálogo
- Clientes
- cualquier módulo autenticado

Preferentemente debe reutilizar el mismo formulario de movimientos en lugar de duplicar lógica.

La acción debe permitir iniciar directamente:

**Nuevo ingreso**

o

**Nuevo gasto**

La solución debe respetar:

- cuenta
- categoría
- fecha
- moneda
- validaciones
- i18n
- reglas de dominio

---

# 21. H9 — CRÉDITOS RECIBIDOS Y OTORGADOS

Actualmente las pruebas indican que:

- no permiten editar créditos correctamente.
- no permiten registrar abonos correctamente.

Esto contradice el estado documentado del proyecto, donde los use cases ya contemplan lifecycle y abonos.

Por tanto:

### NO asumir que falta la funcionalidad en backend.

Primero auditar:

- entidades
- use cases
- repositories
- server actions
- componentes
- modales
- formularios
- relaciones con movimientos
- cálculos de saldo.

Determinar si el problema es:

- backend
- frontend
- conexión UI → use case
- validación
- permisos
- estado
- modal
- i18n
- errores silenciosos

Corregir la causa real.

---

# 22. H10 — COMPRAS A CRÉDITO / OBLIGACIONES POR PAGAR

Este es el requisito funcional más importante de esta ronda y requiere **análisis de dominio antes de programar**.

Caso real:

El usuario compra un producto a crédito, por ejemplo un perfume.

No recibió dinero.

Tiene una obligación de pago.

Puede existir:

- valor total
- pago inicial
- saldo pendiente
- abonos posteriores
- fecha de compra
- fecha de vencimiento opcional
- descripción/proveedor

Actualmente no existe una manera adecuada de registrar este escenario.

## NO implementar automáticamente "Crédito Recibido"

Primero analizar conceptualmente la diferencia entre:

### Crédito recibido

El usuario recibe dinero/prestación financiera y queda obligado a devolverlo.

### Compra a crédito / cuenta por pagar

El usuario adquiere un bien o servicio y queda con una obligación frente al proveedor/vendedor.

Son conceptos diferentes.

El agente debe determinar cuál es el modelo de dominio más coherente con twincap.

Debe analizar al menos estas alternativas:

### Alternativa A

Crear una entidad:

**Cuenta por pagar / Payable**

### Alternativa B

Crear una entidad:

**Compra a crédito**

que genere una obligación asociada.

### Alternativa C

Extender el modelo de créditos recibidos.

### Alternativa D

Otra solución arquitectónicamente más adecuada.

No elegir únicamente por facilidad de implementación.

Evaluar:

- semántica financiera
- futuras compras
- proveedores
- pagos iniciales
- abonos
- saldo
- reportes
- dashboard
- movimientos
- cuentas
- futuras funcionalidades
- posibilidad futura de módulo Compras
- compatibilidad con Clean/Hexagonal Architecture.

IMPORTANTE:

Actualmente NO existe módulo de Compras.

No implementar un módulo completo de Compras como parte de esta fase.

La solución debe dejar una base razonable para que posteriormente pueda existir.

---

# 23. PAGO INICIAL EN OBLIGACIONES

La solución de compra a crédito debe contemplar:

```text
Valor total
Pago inicial
Saldo pendiente
Abonos posteriores
```

El pago inicial puede ser:

- 0
- mayor que 0
- pero nunca superior al valor total.

Debe recalcularse:

```text
saldo = total - pagoInicial - suma(abonos)
```

La lógica exacta debe adaptarse al modelo de dominio existente.

Nunca confiar únicamente en el frontend.

---

# 24. H11 — SIDEBAR

El menú lateral debe ocupar exactamente la altura disponible de la ventana.

Debe:

- calcular correctamente el viewport.
- permanecer fijo/sticky según la arquitectura actual.
- no desplazarse con el contenido principal.
- mantener visibles:
  - usuario/email
  - selector de idioma
  - botón Salir
- funcionar en diferentes alturas de pantalla.
- funcionar en móvil cuando corresponda.

Evitar alturas mágicas como:

`height: 100vh`

si estas producen problemas con headers, safe areas o layouts.

Analizar la estructura real del layout y utilizar una solución robusta.

---

# 25. H12 — BOTÓN DE IDIOMA Y SALIR

Los controles inferiores del sidebar deben tener dimensiones consistentes.

No permitir que el texto modifique accidentalmente la altura.

Cambiar:

**Cerrar sesión**

por:

**Salir**

Agregar icono apropiado.

El botón debe:

- tener icono
- mantener altura constante
- respetar ES/EN
- tener estados hover/focus
- utilizar tooltip si el sidebar está colapsado.

---

# 26. H13 — ALTURA CONSISTENTE DE INPUTS

Todos los controles de formularios deben tener una altura visual coherente.

Incluye:

- input
- select
- date
- number
- textarea cuando corresponda
- botones de formulario

Los select actualmente son más delgados que los inputs.

La preferencia visual es:

**controles compactos/delgados.**

Por lo tanto:

- reducir ligeramente tipografía si es necesario.
- unificar padding.
- unificar line-height.
- unificar border.
- unificar radius.

Idealmente esto debe resolverse en los componentes UI reutilizables:

```text
src/components/ui/input.tsx
src/components/ui/select.tsx
...
```

No aplicar decenas de correcciones individuales.

---

# 27. H14 — VENTAS POS A CRÉDITO

Una venta POS a crédito debe cumplir:

### Cliente

`Cliente general` NO es válido para una venta a crédito.

Debe seleccionarse un cliente real.

### Pago inicial

Debe poder registrarse:

- 0
- o un monto inicial positivo.

### Crédito

La venta debe reflejarse correctamente en:

**Créditos Otorgados**

Debe permitir:

- visualizar
- registrar abonos
- editar
- calcular saldo

Debe existir coherencia entre:

```text
Venta POS
↓
Cliente
↓
Pago inicial
↓
Crédito otorgado
↓
Abonos
↓
Saldo
```

No duplicar movimientos ni contabilizar dos veces el dinero.

Auditar cuidadosamente el flujo financiero existente antes de modificarlo.

---

# 28. H15 — TRANSFERENCIAS

La tabla de transferencias muestra dos veces el valor transferido.

Debe mostrarse:

**una sola vez**

El valor debe:

- utilizar color neutro.
- tener el mismo tamaño tipográfico que el resto de tablas.
- tener ancho de columna razonable.
- no generar columnas innecesariamente anchas.

Redistribuir las columnas para aprovechar correctamente el contenedor.

---

# 29. H16 — CURRENCY EN AGREGAR CUENTA

En el formulario Agregar Cuenta:

`Currency`

permanece en inglés cuando la aplicación está en español.

Debe localizarse correctamente.

Auditar otros campos similares.

---

# 30. H17 — DETALLE DE VENTA

La vista detallada de una venta actualmente no muestra información suficientemente relevante.

Auditar qué información existe realmente en la entidad Sale.

La vista de detalle debe mostrar, como mínimo cuando los datos estén disponibles:

- número/identificador de venta
- fecha
- cliente
- estado
- productos
- cantidades
- precios
- subtotal
- total
- pago inicial
- saldo pendiente
- método de pago si existe
- información del crédito si corresponde

No inventar datos que el dominio no tenga.

Si falta información fundamental en la entidad, indicarlo primero.

La vista debe funcionar para:

- venta de contado
- venta a crédito

---

# 31. H18 — ALERTS

Eliminar progresivamente los `alert()` nativos del navegador.

Sustituirlos por:

- Modal de confirmación para acciones destructivas.
- Toast para feedback de operaciones.

Ejemplo:

### Eliminar venta

Antes:

`alert()`

Después:

```text
Modal
¿Deseas eliminar esta venta?

Cancelar
Eliminar
```

Después de eliminar correctamente:

```text
Toast:
Venta eliminada correctamente.
```

También revisar:

- eliminar catálogo
- eliminar movimientos
- eliminar clientes
- eliminar cuentas
- eliminar créditos
- otras acciones destructivas.

No limitarse a los dos ejemplos mencionados.

---

# 32. SISTEMA DE TOAST

Auditar si ya existe un componente de toast.

Si existe:

- reutilizarlo
- extenderlo si es necesario.

Si no existe:

- diseñar un sistema ligero y coherente con la arquitectura.
- no instalar una librería adicional sin justificarlo.

Debe contemplar:

- éxito
- error
- advertencia
- información
- duración
- cierre manual
- accesibilidad

---

# 33. SISTEMA DE CONFIRMACIÓN

Los modales de confirmación deben ser consistentes.

Deben contemplar:

- título
- descripción
- cancelar
- confirmar
- estado loading
- ESC cuando sea apropiado
- focus management
- feedback posterior

No duplicar implementaciones por módulo.

---

# 34. H19 — COLOR Y PERSONALIDAD VISUAL

La aplicación actualmente se percibe demasiado sobria.

Debe incorporar un poco más de color.

Pero:

> NO convertir twincap en una interfaz saturada.

El color debe utilizarse principalmente para:

- estados
- acciones
- categorías
- métricas
- ingresos
- gastos
- créditos
- alertas
- navegación
- elementos destacados

Mantener una base neutra.

Utilizar el sistema de diseño existente y evitar colores arbitrarios por pantalla.

---

# 35. H20 — CURSOR POINTER

Este requisito ya había sido solicitado anteriormente y aparentemente todavía existen elementos que no lo cumplen.

Auditar TODOS los elementos interactivos.

Incluye:

- botones
- enlaces
- icon buttons
- tabs
- selects custom
- acciones de tabla
- menú
- selector idioma
- sidebar
- cards clicables
- botones flotantes

La solución debe ser preferentemente centralizada en los componentes UI.

No limitarse a agregar `cursor-pointer` manualmente en cada pantalla.

---

# 36. H21 — PERFIL DE USUARIO

Actualmente no es obligatorio implementar este módulo.

Sin embargo, debe registrarse como:

**Mejora futura / Roadmap**

El futuro módulo podría incluir:

- foto
- nombre
- datos personales
- email
- preferencias
- idioma
- eliminación de cuenta
- cambio de contraseña

No implementar en esta ronda salvo que el análisis encuentre una dependencia directa.

---

# 37. AUDITORÍA ADICIONAL OBLIGATORIA

Además de los problemas anteriores, realizar una revisión transversal de:

### UX

- estados vacíos
- loading
- errores
- confirmaciones
- feedback
- navegación
- accesibilidad

### Responsive

Probar conceptualmente al menos:

- 375px
- 768px
- 1280px

### i18n

Buscar textos visibles hardcodeados.

### UI

Buscar:

- botones inconsistentes
- alturas diferentes
- iconos diferentes
- tamaños de texto inconsistentes
- spacing inconsistente
- colores arbitrarios

### Accesibilidad

Revisar:

- labels
- aria-label
- keyboard navigation
- focus
- contraste
- modales
- tooltips
- botones icon-only

### Arquitectura

Buscar:

- lógica de negocio dentro de componentes
- duplicación
- imports incorrectos entre capas
- repositories instanciados incorrectamente
- llamadas a DB sin `connectDb()`

### Seguridad

Buscar:

- acceso cruzado entre tenants
- endpoints sin autorización
- IDs manipulables
- operaciones sensibles protegidas únicamente en frontend

---

# 38. NO CREAR UNA SOLUCIÓN DIFERENTE PARA CADA PROBLEMA

Este principio es obligatorio.

Si diez pantallas tienen botones de eliminar inconsistentes:

NO crear diez soluciones.

Crear/mejorar:

```text
ActionIconButton
```

o el componente equivalente que ya exista.

Si diez formularios tienen inputs con alturas diferentes:

NO corregirlos uno por uno.

Corregir:

```text
Input
Select
DateInput
...
```

Si diez tablas tienen problemas:

NO copiar estilos.

Crear un patrón común.

La meta es que una corrección estructural mejore múltiples módulos.

---

# 39. PRINCIPIO DE COMPONENTIZACIÓN

Antes de crear un componente:

1. Buscar si ya existe.
2. Determinar si puede reutilizarse.
3. Extenderlo si es apropiado.
4. Crear uno nuevo únicamente si tiene sentido.

Los componentes genéricos deben ir en:

```text
src/components/ui/
```

Los específicos:

```text
src/components/[feature]/
```

---

# 40. PROPUESTA DE FASES

Durante la auditoría debes proponer el orden definitivo.

Sin embargo, como punto de partida, considero razonable evaluar una estructura similar a:

### FASE 0
Auditoría completa + documentación.

### FASE 1
Fundaciones UI/UX:
- botones
- icon buttons
- inputs
- selects
- tamaños
- cursor
- colores
- feedback
- modales
- toast
- i18n

### FASE 2
Layout y responsive:
- hamburguesa
- sidebar
- viewport
- tablas
- navegación/loading

### FASE 3
Formularios:
- compactación
- dos columnas
- nuevo movimiento
- acción global de ingreso/gasto

### FASE 4
Movimientos:
- filtro Todas las cuentas
- creación independiente del filtro
- traducciones
- acciones

### FASE 5
Créditos:
- edición
- abonos
- correcciones de flujo
- pruebas

### FASE 6
POS:
- cliente obligatorio en crédito
- pago inicial
- integración con créditos otorgados
- detalle de venta

### FASE 7
Obligaciones / compras a crédito:
- análisis de dominio
- modelo
- pagos iniciales
- abonos
- saldos
- UI

### FASE 8
Transferencias, cuentas y otros módulos:
- tablas
- traducciones
- acciones
- consistencia

### FASE 9
Auditoría transversal:
- responsive
- i18n
- accesibilidad
- seguridad
- arquitectura
- UX

### FASE 10
Documentación y estabilización:
- tests
- lint
- build
- documentación
- actualización de roadmap

El agente debe modificar este orden si la auditoría demuestra que otro orden es técnicamente superior.

---

# 41. ESPECIAL ATENCIÓN A LA FASE DE OBLIGACIONES

Antes de implementar la funcionalidad de compras a crédito debes presentar una mini propuesta de dominio.

Debe responder:

1. ¿Qué entidad representa una obligación por compra?
2. ¿Es diferente de CreditReceived?
3. ¿Cómo se relaciona con una cuenta?
4. ¿Cómo se registra el pago inicial?
5. ¿Cómo se registran abonos?
6. ¿Cómo se calcula saldo?
7. ¿Cómo afecta los movimientos?
8. ¿Cómo afecta los balances?
9. ¿Cómo se relacionará posteriormente con proveedores?
10. ¿Cómo podría evolucionar hacia un futuro módulo Compras?

No implementar hasta que el usuario apruebe la decisión de dominio.

---

# 42. CRITERIOS DE ACEPTACIÓN

Una fase no se considera terminada simplemente porque compile.

Debe:

- funcionar.
- no romper funcionalidades anteriores.
- respetar arquitectura.
- respetar i18n.
- respetar multi-tenancy.
- funcionar en móvil.
- funcionar en desktop.
- manejar loading.
- manejar error.
- manejar estado vacío cuando corresponda.
- tener feedback al usuario.
- tener tests cuando exista lógica funcional nueva.

---

# 43. PROTOCOLO DE IMPLEMENTACIÓN

Para cada fase aprobada:

## Antes

Explicar brevemente:

- qué se modificará
- archivos probables
- riesgos
- pruebas

## Durante

Implementar únicamente la fase aprobada.

No introducir funcionalidades de otras fases.

Si aparece una dependencia crítica:

DETENERSE y explicarla.

## Después

Ejecutar:

```bash
pnpm test
pnpm lint
pnpm build
```

cuando corresponda.

Informar:

### Cambios realizados

### Archivos modificados

### Tests

### Resultado

### Problemas encontrados

### Pendientes

### Nuevos hallazgos

Después:

**DETENERSE Y ESPERAR APROBACIÓN.**

---

# 44. REGLA SOBRE CAMBIOS DE ALCANCE

Si durante una fase descubres que una implementación requiere modificar algo fuera de su alcance:

NO lo hagas automáticamente.

Explica:

- por qué es necesario
- qué archivos afecta
- qué riesgo tiene
- qué alternativa existe

Solicita aprobación.

---

# 45. REGLA SOBRE DEPENDENCIAS

No instalar nuevas dependencias salvo que sea realmente necesario.

Preferencia:

1. código existente
2. componentes existentes
3. APIs nativas
4. capacidades de Next.js/React
5. capacidades de Tailwind
6. dependencias ya instaladas
7. nueva dependencia solo como último recurso

Si propones una nueva dependencia:

- explica por qué
- qué problema resuelve
- por qué no puede resolverse con lo existente
- qué impacto tiene

Máximo una dependencia nueva por fase salvo justificación excepcional.

---

# 46. DOCUMENTACIÓN OBLIGATORIA

Actualizar:

```text
docs/AUDIT-AND-PLAN.md
```

El documento debe contener el estado de esta ronda.

Si existe información de rondas anteriores, NO borrarla indiscriminadamente.

Agregar una nueva sección:

```text
# Ronda 2 — Auditoría y mejoras
```

Registrar:

- fecha
- hallazgos
- prioridades
- decisiones
- fases
- estado
- cambios
- pruebas
- pendientes

El documento debe permitir continuar el trabajo después de una interrupción.

---

# 47. RESULTADO ESPERADO AHORA

En esta primera interacción de esta ronda:

## NO escribas código.

Entrega:

### 1. Resumen ejecutivo

Estado actual de twincap.

### 2. Auditoría técnica

Qué encontraste en el código.

### 3. Matriz de hallazgos

Para cada H:

- estado
- causa probable
- impacto
- prioridad
- complejidad
- dependencias
- fase sugerida

### 4. Problemas adicionales

Hallazgos que no estaban en esta lista.

### 5. Propuesta de arquitectura para obligaciones/compras a crédito

Comparar alternativas y recomendar una.

### 6. Propuesta de evolución visual

Explicar cómo aumentar ligeramente el color sin perder el carácter financiero/profesional.

### 7. Propuesta de componentes reutilizables

Identificar qué componentes deberían crearse o mejorarse.

### 8. Plan definitivo por fases

Ordenado por:

- dependencia
- riesgo
- impacto
- prioridad

### 9. Criterios de aceptación por fase

### 10. Cambios que NO deben hacerse

Documentar explícitamente aquello que no debe tocarse.

### 11. Preguntas

Solo hacer preguntas si realmente existe una decisión que no pueda resolverse inspeccionando el código.

---

# 48. CONDICIÓN DE INICIO

Solo después de que el usuario revise y apruebe el plan:

> comenzar la implementación de la Fase 1.

No implementar nada antes.

---

# 49. PRINCIPIO FINAL

twincap ya funciona.

No queremos "reescribir twincap".

Queremos:

**mejorarla sin romperla.**

Cada cambio debe responder a una pregunta:

> ¿Esto hace que twincap sea más correcta, más consistente, más usable, más mantenible o más preparada para crecer?

Si la respuesta es no, probablemente el cambio no pertenece a esta ronda.