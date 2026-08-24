# TWINCAP — RONDA 3
## Auditoría integral, corrección de inconsistencias, evolución funcional y preparación para crecimiento comercial

Actúa como **ingeniero de software senior, arquitecto de aplicaciones financieras, auditor de código y especialista en UX/UI para SaaS**, trabajando directamente sobre el repositorio de TwinCap mediante OpenCode.

Tu objetivo NO es simplemente implementar una lista de cambios. Tu objetivo es **auditar primero el estado real del proyecto, identificar causas raíz, analizar dependencias, detectar contradicciones o riesgos y posteriormente proponer un plan de implementación por fases**, respetando estrictamente la arquitectura y las reglas permanentes del proyecto.

TwinCap ya ha pasado por dos rondas importantes de auditoría y mejora. **No es un proyecto nuevo y NO debe reescribirse.** La prioridad es conservar lo que funciona, corregir estructuralmente lo que está mal y evolucionar el producto de manera coherente.

---

# 1. CONTEXTO DEL PRODUCTO

TwinCap es una plataforma SaaS que integra en un mismo producto:

- Finanzas personales.
- Finanzas de pequeños negocios.
- Cuentas de dinero.
- Movimientos.
- Transferencias entre cuentas propias.
- Categorías.
- Créditos recibidos.
- Créditos otorgados.
- Ventas/POS.
- Clientes.
- Catálogo.
- Cuentas por pagar (`Payable`).
- Dashboard financiero.
- PWA.
- Internacionalización español/inglés.

El objetivo de producto es que una persona pueda administrar **sus finanzas personales y las de su negocio dentro de una misma plataforma**, manteniendo separación conceptual entre ambos ámbitos y obteniendo una visión financiera consolidada cuando corresponda.

IMPORTANTE:

"Personal" y "Negocio" NO deben interpretarse automáticamente como multiusuario, equipos o colaboradores.

El modelo actual de tenancy sigue siendo:

> Cada usuario administra exclusivamente sus propios datos.

No introducir equipos, colaboradores, roles ni permisos internos salvo que una futura auditoría demuestre que son indispensables, y en ese caso DETENERSE y presentar la propuesta antes de modificar el dominio.

---

# 2. PRIMERAS ACCIONES OBLIGATORIAS

ANTES DE MODIFICAR CUALQUIER ARCHIVO:

1. Leer completamente `AGENTS.md`.
2. Leer completamente `docs/AUDIT-AND-PLAN.md`.
3. Revisar el estado actual del repositorio y el historial reciente de Git.
4. Identificar exactamente qué quedó implementado al cierre de la Ronda 2.
5. Revisar si existe algún documento específico de Ronda 3 en el repositorio.
6. Buscar en Engram el contexto relacionado con:
   - `TwinCap ronda 2`
   - `TwinCap fase`
   - `TwinCap Ronda 3`
   - decisiones pendientes de Ronda 2.
7. Inspeccionar la implementación real del código antes de asumir que alguno de los problemas descritos abajo sigue existiendo.
8. No implementar todavía.

La documentación indica que la Ronda 2 terminó correctamente y que el siguiente paso requiere una nueva ronda. La Ronda 2 dejó, entre otros elementos, `Payable`, mejoras de PWA, el nuevo branding de TwinCap y algunos elementos expresamente registrados como posibles asuntos para la siguiente ronda.

---

# 3. REGLA FUNDAMENTAL DE ESTA RONDA

## AUDITAR ANTES DE IMPLEMENTAR

La primera respuesta/trabajo de esta ronda debe ser exclusivamente de:

> INSPECCIÓN → AUDITORÍA → ANÁLISIS → DEPENDENCIAS → PRIORIZACIÓN → PLAN

NO escribir código durante esta etapa.

NO hacer pequeños fixes "aprovechando que ya estamos ahí".

NO modificar archivos para probar una hipótesis.

NO implementar funcionalidades de la lista antes de presentar el plan.

Si encuentras un problema adicional durante la auditoría:

- documentarlo;
- explicar su causa;
- explicar su impacto;
- indicar si pertenece a Ronda 3;
- indicar su prioridad;
- indicar dependencias;
- no corregirlo todavía.

---

# 4. OBJETIVO GENERAL DE LA RONDA 3

La Ronda 3 debe perseguir cinco objetivos:

### A. Corrección financiera

Asegurar que los cálculos financieros de TwinCap representen correctamente la realidad económica.

Especial atención a:

- fechas;
- ingresos;
- gastos;
- transferencias internas;
- créditos;
- ventas;
- abonos;
- cuentas por pagar;
- balances;
- activos;
- pasivos;
- agregaciones del dashboard.

### B. UX/UI y consistencia

Eliminar inconsistencias visibles y mejorar la experiencia tanto en móvil como desktop.

### C. Dashboard financiero más potente

Convertir el dashboard actual en una herramienta realmente útil para interpretar las finanzas personales y del negocio.

### D. Evolución funcional

Analizar qué módulos/features tienen verdadero sentido en el estado actual del producto, evitando agregar funcionalidades simplemente porque "podrían ser útiles".

### E. Preparación comercial

Analizar qué funcionalidades aumentan el valor percibido de TwinCap como producto SaaS y cuáles deberían permanecer en roadmap.

---

# 5. HALLAZGOS Y REQUERIMIENTOS A AUDITAR

Los siguientes puntos provienen de pruebas y observaciones realizadas sobre la aplicación. NO asumir que todos siguen presentes. Verificar cada uno en el código y en runtime cuando sea posible.

---

## 5.1 BUG DE FECHAS EN MOVIMIENTOS

Actualmente los movimientos aparentemente:

- se registran con la fecha actual;
- pero posteriormente se guardan o muestran con la fecha del día anterior.

Investigar profundamente.

No asumir inicialmente que es un problema del formulario.

Auditar:

- `Date`;
- `new Date()`;
- conversión ISO;
- `toISOString()`;
- almacenamiento MongoDB;
- serialización;
- `toJSON()`;
- mappers;
- Server Actions;
- Server Components;
- Client Components;
- timezone;
- parsing de `YYYY-MM-DD`;
- inputs HTML `type="date"`;
- formato mostrado al usuario;
- timezone del navegador;
- timezone del servidor;
- timezone de Colombia;
- posibles conversiones UTC/local.

Determinar:

1. dónde se produce exactamente el desplazamiento;
2. si afecta solamente movimientos;
3. si afecta ventas;
4. créditos;
5. abonos;
6. transferencias;
7. cuentas por pagar;
8. filtros por fecha;
9. dashboard;
10. cualquier otra entidad con fecha.

NO corregir aplicando simplemente `+1 día` o `-1 día`.

La solución debe ser conceptualmente correcta y coherente con el significado de las fechas financieras de TwinCap.

Crear tests para evitar regresiones.

---

# 5.2 LOGO Y BRANDING

Auditar la implementación actual del branding después de los cambios realizados al cierre de Ronda 2.

### Móvil

Actualmente el logo puede quedar oculto detrás del botón cerrar del menú móvil.

Evaluar:

- centrar correctamente el logo;
- jerarquía visual;
- relación entre botón cerrar y logo;
- safe areas;
- tamaños;
- comportamiento en 375px.

Evaluar también si arquitectónicamente es mejor:

A. mantener el logo dentro del drawer;

B. moverlo a un header móvil independiente.

Elegir basándose en la arquitectura existente y UX real, no por preferencia arbitraria.

### Desktop

Evaluar aumentar ligeramente el tamaño del logo y agregar debajo del wordmark un slogan de marca.

Propuesta inicial:

> "Tu negocio y tú, una sola plataforma"

Pero NO asumir que debe utilizarse exactamente ese texto.

Proponer el mejor slogan breve, profesional y coherente con TwinCap.

Debe funcionar correctamente en español e inglés mediante i18n.

---

# 5.3 TRANSFERENCIAS INTERNAS Y CONTABILIDAD DEL DASHBOARD

Este punto es FINANCIERAMENTE CRÍTICO.

Una transferencia entre cuentas propias NO es un ingreso ni un gasto económico.

Ejemplo:

- Salario recibido en BBVA: $2.000.000
- Transferencia BBVA → Nequi: $500.000

Los ingresos reales son:

> $2.000.000

NO:

> $2.500.000

La transferencia de $500.000 solamente cambia dónde está el dinero.

Auditar el dominio y todos los cálculos para determinar cómo se representan las transferencias.

Debe evitarse que las transferencias internas:

- inflen ingresos;
- inflen gastos;
- distorsionen gráficos;
- distorsionen tarjetas resumen;
- distorsionen estadísticas;
- distorsionen métricas mensuales;
- aparezcan como income/expense cuando conceptualmente son movimientos internos.

No limitar la investigación al Dashboard.

Auditar:

- Movement;
- Transfer;
- balances de cuentas;
- dashboard;
- agregaciones;
- filtros;
- gráficos;
- estadísticas;
- activos;
- pasivos;
- cualquier cálculo derivado.

IMPORTANTE:

Una transferencia sí debe afectar el saldo de las cuentas origen/destino.

Lo que NO debe hacer es afectar el resultado económico de ingresos/gastos.

Crear tests de dominio para este comportamiento.

---

# 5.4 TABLA RESUMIDA DE VENTAS

Actualmente la vista no detallada de ventas aparentemente no muestra el nombre del artículo hasta abrir el detalle.

Auditar.

La fila resumida debe mostrar, cuando los datos estén disponibles:

- fecha;
- nombre del primer artículo;
- total de la venta.

Si existen múltiples artículos, utilizar una presentación compacta que comunique claramente que existen más productos.

No inventar nombres.

Si el artículo fue eliminado del catálogo, utilizar el comportamiento de fallback ya establecido por el dominio/i18n.

---

# 5.5 LOGIN — VISIBILIDAD DE CONTRASEÑA

Agregar/validar botón de tipo ojo para:

- mostrar contraseña;
- ocultar contraseña.

Debe utilizar el sistema de iconos existente.

Debe tener:

- `aria-label`;
- tooltip cuando corresponda;
- accesibilidad;
- comportamiento correcto en móvil;
- i18n.

Auditar también registro y cualquier otro formulario de contraseña para evitar implementaciones inconsistentes.

---

# 5.6 AUTOCOMPLETADO DE CONTRASEÑA DEL NAVEGADOR

Actualmente el navegador aparentemente sugiere contraseña en Login.

Comportamiento esperado:

### Login

Debe identificarse semánticamente como formulario de autenticación existente.

No debe inducir al navegador a tratarlo como creación de contraseña.

### Registro

Debe permitir el comportamiento apropiado de creación/autocompletado de contraseña.

Auditar atributos:

- `autocomplete`;
- `name`;
- `type`;
- estructura del formulario;
- confirmación de contraseña.

No luchar contra el navegador mediante hacks.

Utilizar los valores semánticos estándar apropiados.

---

# 5.7 NOTAS AUTOMÁTICAS EN INGLÉS

Auditar todos los textos generados automáticamente por el dominio.

Actualmente aparecen ejemplos como:

- `Sale payment`
- `Credit granted to`
- `Transfer`
- `Abono for credit granted to`

Todos deben mostrarse correctamente según el idioma seleccionado.

IMPORTANTE:

No resolver esto con reemplazos en componentes.

Determinar dónde se generan las notas y si:

1. son texto persistido;
2. son texto derivado;
3. son textos históricos;
4. deben traducirse al momento de mostrar;
5. necesitan una representación estructurada para no persistir lenguaje humano.

Preferir una solución de dominio que no acople datos persistidos al idioma del usuario.

Si cambiar el modelo de datos fuera necesario, analizar migración y compatibilidad antes de implementar.

---

# 5.8 DOBLE "COP COP"

Auditar formato monetario en:

- Transferencias;
- Créditos recibidos;
- Créditos otorgados;
- Catálogo;
- Ventas;
- cualquier otra tabla.

Corregir el problema estructuralmente.

No aplicar reemplazos de strings específicos por pantalla.

Debe existir una única estrategia coherente de presentación monetaria.

---

# 5.9 BOTÓN "AGREGAR ABONO"

El botón "Agregar abono" de ventas debe tener el mismo tratamiento visual que el botón equivalente de créditos.

Auditar ambos componentes.

Preferir reutilización o variante compartida en lugar de duplicar clases.

---

# 5.10 LABEL "TYPE" EN CATEGORÍAS

El formulario de agregar categoría todavía puede mostrar `type` en inglés.

Auditar:

- español;
- inglés;
- claves i18n;
- cualquier otro literal visible del mismo formulario.

No limitarse a cambiar una palabra: hacer un barrido de ese módulo.

---

# 5.11 MÓDULO COMPRAS — ANALIZAR, NO IMPLEMENTAR AUTOMÁTICAMENTE

El usuario propone crear un módulo de Compras.

Sin embargo, Ronda 2 estableció deliberadamente:

- `Payable` como entidad separada;
- diferencia conceptual entre crédito recibido y obligación por compra;
- base para una futura evolución hacia Compras;
- NO crear todavía el módulo completo de Compras.

Por lo tanto:

## NO crear automáticamente el módulo Compras.

Primero realizar un análisis de viabilidad.

Determinar:

- qué problema resolvería;
- qué funcionalidades tendría;
- relación con catálogo;
- relación con proveedores;
- relación con cuentas por pagar;
- relación con inventario;
- relación con movimientos;
- relación con gastos;
- compras de contado;
- compras a crédito;
- pagos parciales;
- vencimientos;
- impacto en dashboard;
- impacto en reportes;
- complejidad del dominio;
- valor comercial;
- dependencia de futuras funcionalidades.

Comparar al menos:

A. No implementar todavía.

B. Implementar únicamente una versión mínima de compras.

C. Evolucionar `Payable` hacia un módulo de Compras posteriormente.

D. Otra alternativa arquitectónicamente superior.

Presentar recomendación.

Si la recomendación implica implementar algo en Ronda 3, debe quedar explícitamente separado en el plan y requerirá aprobación.

---

# 5.12 MOVIMIENTOS: FILTROS PERSONAL / NEGOCIO

Analizar cómo está representada actualmente la distinción entre:

- Personal
- Negocio

No asumir que debe agregarse simplemente un booleano.

Determinar cuál entidad debería ser la fuente de verdad:

- cuenta;
- categoría;
- movimiento;
- otra entidad;
- combinación de entidades.

La solución debe permitir que un usuario pueda consultar:

> Todo lo relacionado con mis finanzas personales.

o:

> Todo lo relacionado con mi negocio.

sin duplicar información ni romper el modelo actual.

Después evaluar filtros secundarios:

- categoría;
- cuenta;
- fecha;
- tipo;
- otros filtros pertinentes.

---

# 5.13 DASHBOARD — EVOLUCIÓN MAYOR

El Dashboard debe evolucionar de un resumen básico a una herramienta financiera mucho más útil.

Antes de implementar, auditar el dashboard actual y determinar qué datos ya están disponibles y cuáles requieren nuevos use cases/queries.

## Filtros

Debe estudiarse un sistema de filtros combinables y anidados.

Ejemplo:

> Ámbito: Negocio  
> → Categoría: Ventas  
> → Cuenta: BBVA  
> → Año: 2026  
> → Mes: Agosto

Otro ejemplo:

> Ámbito: Personal  
> → Categoría: Alimentación  
> → Cuenta: Nequi  
> → rango: 01/06/2026–24/08/2026

Los filtros deben poder combinarse sin crear una explosión de estados independientes.

Evaluar una estructura de filtros centralizada.

Filtros potenciales:

- Personal / Negocio / Todo;
- cuentas;
- categorías;
- tipos de movimiento;
- meses;
- años;
- rango de fechas;
- posiblemente clientes/proveedores cuando tenga sentido.

Los filtros deben ser composables.

NO crear una solución diferente para cada tarjeta/gráfico.

---

# 5.14 DASHBOARD — EVOLUCIÓN MENSUAL

Crear o proponer un gráfico que permita visualizar por año:

- ingresos;
- gastos;
- evolución mensual.

Debe poder filtrarse por:

- Todo;
- Personal;
- Negocio;
- categorías;
- cuentas;
- rango temporal cuando tenga sentido.

El gráfico debe representar correctamente magnitudes diferentes.

Problema actual:

Un ingreso de $9.000.000 y un gasto de $6.000.000 aparecen visualmente con barras prácticamente iguales en móvil.

Investigar por qué ocurre.

No solucionar únicamente cambiando el CSS.

Determinar si el problema está en:

- escalado;
- dimensiones del contenedor;
- librería/implementación del gráfico;
- normalización;
- datos;
- formato;
- responsive.

La representación debe conservar la proporción real de los valores.

Evaluar si un gráfico de líneas es mejor que barras para evolución temporal.

Si existe una solución visual superior, justificarla.

---

# 5.15 DASHBOARD — ACTIVOS Y PASIVOS

Agregar/proponer una sección financiera:

## Activos

Agrupar:

- cuentas de dinero;
- créditos por cobrar;
- otros activos que realmente existan en el dominio.

## Pasivos

Agrupar:

- cuentas por pagar;
- créditos recibidos;
- otras obligaciones que realmente existan.

NO inventar activos o pasivos que el dominio todavía no soporte.

Determinar correctamente si los valores deben representar:

- saldo actual;
- valor nominal;
- pendiente;
- disponibilidad;
- otra métrica.

Debe existir una definición financiera explícita.

---

# 5.16 INVALIDACIÓN / REFRESH DE CATEGORÍAS

Actualmente:

1. se crea una categoría;
2. aparece solamente después de refrescar;
3. si se elimina una categoría, puede seguir apareciendo en formularios hasta refrescar.

Auditar el patrón de:

- Server Actions;
- caché;
- router refresh;
- estado local;
- Server Components;
- props;
- listas derivadas;
- formularios modales;
- posibles caches de datos.

No resolver simplemente haciendo `window.location.reload()`.

La UI debe actualizarse correctamente después de:

- crear categoría;
- eliminar categoría;
- crear cuenta;
- eliminar cuenta;
- cualquier entidad utilizada inmediatamente por otro formulario.

Auditar "similares" para detectar el mismo patrón en otras entidades.

---

# 5.17 PERFIL DE USUARIO

En Ronda 2 el perfil quedó registrado como roadmap.

En Ronda 3 debe analizarse su implementación.

Un módulo típico de perfil podría incluir:

- nombre;
- foto;
- email;
- datos básicos;
- preferencias;
- idioma;
- cambio de contraseña;
- eliminación de cuenta.

No asumir que todo debe implementarse.

Analizar primero qué es realmente necesario para el producto actual.

## Foto de perfil

Evaluar alternativas:

A. Cloudinary.

B. almacenamiento propio.

C. servicio externo compatible con la arquitectura.

D. otra solución.

El usuario tiene experiencia previa con Cloudinary, pero esto NO significa que deba instalarse automáticamente.

Evaluar:

- costo;
- complejidad;
- seguridad;
- tamaño de archivos;
- transformación;
- eliminación;
- privacidad;
- URL;
- dependencia externa;
- mantenimiento.

Si requiere nueva dependencia o servicio externo, presentarlo como decisión.

## Dashboard

Cuando exista:

- nombre;
- foto;

mostrar la foto junto al nombre en:

> "Bienvenido de nuevo"

o la variante equivalente en inglés.

---

# 5.18 LANDING — BOTÓN REGISTRARSE

Auditar el CTA "Registrarse".

Actualmente el botón aparentemente tiene:

- fondo blanco;
- texto blanco.

Corregir de forma coherente con el design system de TwinCap.

No crear un estilo aislado.

---

# 5.19 ESPAÑOL NEUTRAL

La Home actualmente utiliza un español con acento/regionalismo cordobés.

TwinCap debe evolucionar hacia español neutral.

Preferencia inicial:

- `es-CO`;
- `es-MX`;
- o un español neutral equivalente.

No usar expresiones regionales innecesarias.

El criterio debe aplicarse a:

- Landing;
- Dashboard;
- navegación;
- formularios;
- errores;
- toasts;
- empty states;
- modales;
- textos automáticos;
- mensajes;
- cualquier texto visible.

No modificar solamente la landing.

Mantener paridad ES/EN.

---

# 5.20 PWA — RUTA INICIAL SIN SESIÓN

Actualmente la PWA instalada inicia en Login cuando no existe una sesión.

Analizar si esto es:

A. correcto;
B. conveniente;
C. perjudicial para conversión;
D. correcto para una PWA autenticada pero mejorable;
E. dependiente de la estrategia de producto.

Considerar:

- experiencia de usuario;
- conversión;
- landing;
- instalación;
- sesión persistente;
- seguridad;
- comportamiento esperado de una app instalada;
- usuarios nuevos vs usuarios recurrentes.

NO cambiarlo automáticamente.

Presentar recomendación y, si corresponde, implementarlo como fase independiente.

---

# 5.21 TEMA CLARO / OSCURO

Auditar la implementación real del sistema de temas.

Actualmente aparentemente solo funciona correctamente el tema oscuro.

Determinar:

- si existe soporte para light;
- si existe dark;
- si depende de `prefers-color-scheme`;
- si existe selector;
- si los tokens funcionan;
- si hay clases hardcodeadas;
- si hay componentes que ignoran el tema;
- si hay colores ilegibles en light;
- si el gráfico funciona correctamente en ambos;
- si PWA/manifest tienen implicaciones.

No asumir que basta con agregar un botón.

Primero determinar la arquitectura de temas que ya existe.

Objetivo:

> Light y Dark deben ser modos completos y consistentes.

Verificar al menos:

- login;
- registro;
- landing;
- dashboard;
- tablas;
- formularios;
- modales;
- toast;
- gráficos;
- badges;
- navegación;
- PWA.

---

# 5.22 SIDEBAR DEMASIADO LARGO

El menú lateral continúa creciendo.

Analizar si conviene agrupar opciones en submenús.

Ejemplo conceptual:

### Finanzas
- Movimientos
- Transferencias
- Cuentas

### Crédito
- Créditos recibidos
- Créditos otorgados
- Cuentas por pagar

### Negocio
- Ventas
- Clientes
- Catálogo
- Futuras compras

NO asumir esta estructura como definitiva.

Diseñar una arquitectura de navegación coherente con la evolución del producto.

Debe analizarse especialmente:

## Desktop

- submenús expandibles/colapsables;
- estado activo;
- persistencia;
- accesibilidad;
- altura.

## Mobile

El drawer debe seguir siendo cómodo.

Evitar:

- navegación excesivamente profunda;
- submenús difíciles de cerrar;
- scroll incómodo;
- pérdida de contexto;
- problemas de teclado;
- problemas con Escape;
- overlays.

---

# 5.23 FILTROS EN TODAS LAS TABLAS

Evaluar qué módulos realmente necesitan filtro:

- Movimientos;
- Ventas;
- Créditos otorgados;
- Créditos recibidos;
- Cuentas por pagar;
- Transferencias;
- Clientes;
- Catálogo;
- Cuentas;
- Categorías.

NO imponer el filtro Personal/Negocio a todas las tablas por uniformidad visual.

Para cada tabla determinar:

1. ¿Tiene sentido?
2. ¿Qué dimensión representa?
3. ¿Qué información debería filtrar?
4. ¿El filtro aporta valor real?
5. ¿Qué filtros secundarios serían útiles?

Presentar una matriz de decisión.

---

# 5.24 ICONOS PWA

La decisión de marca registrada al cierre de Ronda 2 indica que los iconos PWA deben regenerarse usando como base el isotipo oficial transparente:

`isotipo_twincap_ok.png`

Analizar y posteriormente implementar, si corresponde:

- icon-192;
- icon-512;
- maskable;
- apple-touch-icon;
- variantes necesarias.

Requisito de diseño:

> utilizar el isotipo oficial como fuente;
> fondo oscuro sólido para garantizar contraste con el isotipo cuando corresponda;
> respetar safe area de maskable;
> evitar recortes;
> mantener coherencia visual entre Android, iOS y navegador.

No utilizar nuevamente la versión antigua "GM".

---

# 5.25 FEATURES ADICIONALES Y PROYECCIÓN COMERCIAL

Además de los requisitos explícitos anteriores, realizar una auditoría de producto.

Preguntarse:

> "Si TwinCap fuera a convertirse en un SaaS comercial real, ¿qué funcionalidades faltan para que el producto sea considerablemente más valioso?"

Analizar, SIN IMPLEMENTAR AUTOMÁTICAMENTE:

- reportes;
- exportación;
- presupuestos;
- metas;
- alertas;
- flujo de caja;
- cuentas por cobrar;
- cuentas por pagar;
- proveedores;
- inventario;
- compras;
- conciliación;
- recurrencias;
- indicadores financieros;
- análisis del negocio;
- comparación mensual/anual;
- recomendaciones;
- inteligencia de negocios;
- futuras capacidades de IA;
- onboarding;
- monetización;
- planes;
- límites;
- features premium.

Priorizar por:

- valor para el usuario;
- dificultad;
- dependencia;
- impacto comercial;
- riesgo;
- coherencia con el producto actual.

NO convertir esta auditoría en una lista interminable de features.

---

# 5.26 BLOG INTERNO

Registrar explícitamente como roadmap:

> Futuro blog interno sobre finanzas personales y de pequeños negocios.

Objetivo potencial:

- educación financiera;
- SEO;
- adquisición orgánica;
- posicionamiento de marca;
- contenido contextual dentro de TwinCap;
- autoridad temática.

No implementar el blog salvo que la auditoría demuestre que debe entrar en Ronda 3.

Debe quedar documentado como iniciativa futura.

---

# 6. AUDITORÍA TRANSVERSAL OBLIGATORIA

Además de los puntos anteriores, revisar:

## Arquitectura

- Clean/Hexagonal;
- dependencias entre capas;
- lógica financiera fuera de componentes;
- repositories;
- use cases;
- ports;
- mappers;
- Server Actions;
- `connectDb()`;
- serialización;
- `toJSON()`.

## Seguridad

- tenant isolation;
- autorización backend;
- IDs manipulables;
- acceso cruzado;
- operaciones sensibles;
- acciones server-side.

## i18n

- es/en;
- textos hardcodeados;
- claves huérfanas;
- claves faltantes;
- español regional;
- mensajes generados automáticamente.

## Responsive

Probar conceptualmente:

- 375px;
- 768px;
- 1280px.

No utilizar `overflow-x: auto` como única estrategia.

## Accesibilidad

Revisar:

- labels;
- aria-label;
- aria-expanded;
- aria-controls;
- aria-current;
- teclado;
- focus;
- Escape;
- contraste;
- tooltips;
- botones icon-only.

## Testing

Revisar cobertura de:

- dominio;
- use cases;
- cálculos;
- filtros;
- fechas;
- transferencias;
- dashboard.

---

# 7. PRINCIPIOS FINANCIEROS QUE DEBEN GUIAR LA RONDA

Estos principios son especialmente importantes:

### 7.1 Transferencia interna ≠ ingreso

Mover dinero entre cuentas propias no genera ingresos ni gastos.

### 7.2 Venta ≠ cobro necesariamente

Una venta a crédito puede generar una cuenta por cobrar sin que todo el dinero haya entrado.

### 7.3 Crédito recibido ≠ compra a crédito

Un crédito recibido representa dinero/prestación financiera recibida.

Una compra a crédito representa una obligación por un bien o servicio.

### 7.4 Cuenta por pagar ≠ gasto duplicado

El total de una obligación no debe volver a contabilizarse como gasto cuando posteriormente se registra el pago.

### 7.5 Saldo de cuenta ≠ resultado económico

El movimiento de dinero y el resultado financiero no son siempre la misma cosa.

### 7.6 Dashboard debe derivar de conceptos financieros correctos

No construir métricas únicamente sumando movimientos sin entender su `kind`, naturaleza y relación con otras entidades.

---

# 8. PRINCIPIOS DE IMPLEMENTACIÓN

Siempre preferir:

1. código existente;
2. componentes existentes;
3. arquitectura actual;
4. capacidades nativas;
5. capacidades de Next.js/React;
6. Tailwind;
7. dependencias ya instaladas;
8. nueva dependencia únicamente cuando sea realmente necesaria.

Máximo una nueva dependencia por fase salvo justificación excepcional.

Antes de crear un componente:

1. buscar si ya existe;
2. determinar si puede reutilizarse;
3. extenderlo si corresponde;
4. crear uno nuevo únicamente si tiene sentido.

Una solución estructural debe resolver múltiples casos.

NO crear:

> 10 parches para 10 pantallas.

Crear:

> 1 patrón compartido que corrija los 10 casos.

---

# 9. REGLAS DE FECHAS

Las fechas financieras son especialmente sensibles.

No utilizar soluciones como:

```text
date + 1 day
date - 1 day
```

sin comprender previamente el origen del problema.

Distinguir explícitamente entre:

- instante temporal;
- fecha calendario;
- fecha de transacción;
- fecha de creación del documento;
- timestamp;
- timezone.

Una fecha como "24 de agosto de 2026" puede ser una fecha de negocio y no un instante que deba convertirse libremente entre zonas horarias.

La solución debe ser coherente con el significado de cada campo.

---

# 10. REGLAS DE i18n

Todo texto visible nuevo:

- debe estar en español;
- debe estar en inglés;
- debe seguir el sistema i18n existente.

NO hardcodear strings en componentes.

Todo texto automático debe revisarse especialmente.

El español de TwinCap debe ser neutral.

---

# 11. REGLAS DE BASE DE DATOS

Toda Server Action o Route Handler que toque Mongoose:

```text
await connectDb()
```

ANTES de utilizar repositories.

Los repositories deben crearse después de conectar.

Nunca crear repositories a nivel de módulo.

---

# 12. TESTING

Cada fase funcional debe incluir o actualizar tests.

Después de cada fase ejecutar:

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec tsc --noEmit
```

No ocultar tests.

No eliminar tests para conseguir verde.

Si un test falla:

1. diagnosticar;
2. determinar si el test está equivocado o el código;
3. corregir la causa;
4. volver a ejecutar.

---

# 13. GIT

Usar commits convencionales:

```text
feat:
fix:
refactor:
chore:
test:
docs:
```

Un commit por unidad lógica de trabajo.

NO habilitar nuevamente el hook GGA deshabilitado.

NO commitear:

- secrets;
- credenciales;
- datos sensibles.

---

# 14. PROTOCOLO DE AUDITORÍA DE RONDA 3

La primera etapa debe producir un documento/informe estructurado con:

## 14.1 Resumen ejecutivo

Estado real de TwinCap después de Ronda 2.

## 14.2 Estado técnico

Arquitectura, dominio, UI, PWA, i18n, testing, seguridad y performance.

## 14.3 Matriz de hallazgos

Para cada hallazgo:

| ID | Hallazgo | Estado real | Causa raíz | Impacto | Prioridad | Complejidad | Dependencias | Fase |
|---|---|---|---|---|---|---|---|---|

Usar prioridades:

- P0 — crítico;
- P1 — alto;
- P2 — medio;
- P3 — bajo.

## 14.4 Hallazgos adicionales

Todo problema encontrado durante la inspección que no esté en esta especificación.

## 14.5 Decisiones de dominio

Especialmente:

- transferencias;
- clasificación Personal/Negocio;
- dashboard;
- activos/pasivos;
- fechas;
- compras;
- cuentas por pagar.

## 14.6 Matriz de filtros

Indicar qué tablas deben tener:

- Personal/Negocio;
- categoría;
- cuenta;
- fecha;
- otros filtros.

Y cuáles NO necesitan determinados filtros.

## 14.7 Análisis del módulo Compras

Comparar alternativas y recomendar.

NO implementar todavía salvo aprobación posterior.

## 14.8 Análisis del perfil

Qué debe entrar en Ronda 3 y qué debe permanecer en roadmap.

## 14.9 Análisis comercial

Features potenciales priorizadas por valor/esfuerzo.

## 14.10 Plan definitivo

Proponer fases ordenadas por:

1. dependencias;
2. riesgo;
3. impacto financiero;
4. impacto UX;
5. complejidad;
6. valor comercial.

---

# 15. PROPUESTA INICIAL DE AGRUPACIÓN DE FASES

NO tomar esta estructura como definitiva.

La auditoría puede cambiarla.

Una posible estructura sería:

### Fase 0
Auditoría completa y plan definitivo.

### Fase 1
Correcciones financieras fundamentales:

- fechas;
- transferencias internas;
- cálculos;
- invariantes;
- tests.

### Fase 2
Filtros y arquitectura de clasificación Personal/Negocio.

### Fase 3
Dashboard financiero avanzado:

- filtros;
- categorías;
- cuentas;
- fechas;
- gráficos;
- evolución mensual;
- activos;
- pasivos.

### Fase 4
Consistencia de tablas, formatos monetarios, ventas y textos automáticos.

### Fase 5
Categorías y actualización/invalidation de datos sin reload.

### Fase 6
UX de autenticación, contraseña y navegación.

### Fase 7
Tema claro/oscuro y sistema visual.

### Fase 8
Perfil de usuario.

### Fase 9
Sidebar y navegación escalable.

### Fase 10
PWA, iconografía y branding final.

### Fase 11
Evaluación/implementación de funcionalidades de negocio seleccionadas.

### Fase 12
Auditoría comercial, roadmap, blog y estabilización final.

Esta estructura es SOLO una hipótesis inicial. La auditoría debe determinar el orden real.

---

# 16. CRITERIOS DE ACEPTACIÓN GENERALES

Una fase NO está terminada solamente porque compile.

Debe:

- funcionar;
- no romper funcionalidades existentes;
- respetar la arquitectura;
- respetar i18n;
- respetar multi-tenancy;
- respetar el dominio financiero;
- funcionar en móvil;
- funcionar en desktop;
- manejar loading;
- manejar errores;
- manejar estados vacíos cuando corresponda;
- tener feedback;
- incluir tests cuando corresponda;
- pasar las verificaciones técnicas.

---

# 17. REGLA DE DETENCIÓN

Al terminar la auditoría:

**DETENTE.**

No implementes nada.

Presenta el informe y el plan.

Espera aprobación explícita del usuario.

Después de que el usuario apruebe una fase:

1. explicar brevemente qué se hará;
2. indicar archivos probables;
3. indicar riesgos;
4. implementar ÚNICAMENTE esa fase;
5. ejecutar pruebas;
6. documentar cambios;
7. documentar problemas;
8. documentar nuevos hallazgos;
9. hacer commit si corresponde;
10. DETENERSE y esperar aprobación para la siguiente fase.

Si aparece una dependencia que obliga a salir del alcance de la fase:

**DETENTE.**

Explica:

- por qué es necesaria;
- qué archivos afecta;
- qué riesgo introduce;
- alternativas;
- recomendación.

No implementes la dependencia sin aprobación.

---

# 18. COSAS QUE NO DEBES HACER

NO:

- reescribir TwinCap;
- migrar de Next.js;
- cambiar React;
- cambiar MongoDB;
- cambiar Mongoose;
- cambiar pnpm;
- introducir otra librería de UI;
- introducir otra librería de iconos;
- romper Clean/Hexagonal;
- duplicar lógica financiera;
- confiar solamente en validaciones frontend;
- hardcodear textos;
- solucionar fechas con offsets arbitrarios;
- contar transferencias internas como ingresos/gastos;
- crear automáticamente el módulo Compras;
- crear multiusuario;
- introducir colaboradores;
- crear funcionalidades por pantalla que deberían ser componentes compartidos;
- utilizar `window.location.reload()` como solución general;
- eliminar tests para hacer pasar CI;
- habilitar el hook GGA;
- implementar funcionalidades futuras simplemente porque parecen interesantes.

---

# 19. RESULTADO ESPERADO DE LA PRIMERA INTERACCIÓN

La primera interacción de esta Ronda 3 debe responder:

> ¿Cuál es el estado real de TwinCap después de la Ronda 2 y cuál es el plan técnicamente correcto para llevarla al siguiente nivel?

Debe incluir:

1. Resumen ejecutivo.
2. Auditoría técnica.
3. Matriz completa de hallazgos.
4. Causas raíz verificadas.
5. Hallazgos nuevos.
6. Riesgos financieros.
7. Riesgos arquitectónicos.
8. Análisis Personal/Negocio.
9. Arquitectura propuesta para filtros.
10. Propuesta de Dashboard.
11. Análisis de Compras.
12. Propuesta de Perfil.
13. Propuesta de temas claro/oscuro.
14. Propuesta de navegación.
15. Auditoría PWA/branding.
16. Análisis de features comerciales.
17. Roadmap del blog.
18. Plan definitivo por fases.
19. Criterios de aceptación por fase.
20. Decisiones que requieren aprobación del usuario.
21. Cambios que NO deben hacerse.

**NO escribir código en esta primera interacción.**

**NO modificar el repositorio en esta primera interacción.**

La calidad de esta ronda dependerá más de la calidad de la auditoría y de las decisiones de arquitectura que de la cantidad de código producido.