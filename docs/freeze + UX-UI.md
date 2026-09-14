Sí. Y después de lo que acabamos de cerrar, creo que **la transición a UX/UI debe hacerse de una manera muy distinta a las rondas anteriores**.

No deberíamos decirle a Gentle-AI simplemente: *“ahora mejora el diseño”*. Eso sería desperdiciar todo el aprendizaje de R15.

Primero hay que **congelar explícitamente el dominio financiero como contrato**, y luego iniciar UX/UI desde una pregunta mucho más ambiciosa:

> **¿Cómo hacemos que una persona pueda entrar a TwinCap, mirar “Resumen” durante 10 segundos y entender con claridad dónde está financieramente, qué está pasando y si hay algo que debería atender?**

Eso debe convertirse en el centro de la nueva etapa.

Además, hice una pequeña investigación actual sobre competidores y usuarios. En Treinta aparecen simultáneamente elogios por su facilidad de uso y críticas por regresiones después de actualizaciones, pérdida de información/funciones visibles, problemas de rendimiento y cambios que dificultan tareas básicas. ([App Store][1]) También aparecen usuarios valorando especialmente que una aplicación sea sencilla y que permita entender rápidamente ventas, gastos y balance. ([MWM][2])

En herramientas como Wave se repite algo parecido: los usuarios valoran muchísimo una interfaz limpia, sencilla y con una visión general clara del flujo de caja, mientras que la terminología confusa o una navegación poco intuitiva deterioran la experiencia. ([G2][3])

**Ese es exactamente el terreno donde quiero que ataquemos.**

No copiar funcionalidades.

**Copiar las lecciones.**

---

# PROMPT MAESTRO — FREEZE FINANCIERO + INICIO DE UX/UI DE TWINCAP

Puedes entregárselo prácticamente tal cual a Gentle-AI.

```text
# TWINCAP — FREEZE FORMAL DEL DOMINIO FINANCIERO + INICIO DE ETAPA UX/UI

## 0. NATURALEZA DE ESTA ORDEN

ESTA NO ES UNA SUGERENCIA.

ESTE DOCUMENTO DEFINE EL CIERRE FORMAL DEL DOMINIO FINANCIERO DE TWINCAP Y EL INICIO DE LA NUEVA ETAPA UX/UI.

Debes cumplir todas las instrucciones de este documento.

NO debes interpretar las instrucciones como recomendaciones opcionales.

NO debes implementar solamente una parte y declarar la tarea terminada.

NO debes abrir una nueva ronda financiera innecesaria.

NO debes modificar reglas financieras por razones puramente visuales, de conveniencia de UI o de preferencia personal.

TwinCap ha llegado al punto en el que el dominio financiero debe convertirse en una BASE ESTABLE sobre la cual construir la experiencia del producto.

La prioridad ahora cambia:

ANTES:
    integridad financiera
    atomicidad
    concurrencia
    consistencia
    idempotencia
    integridad referencial
    robustez del dominio

AHORA:
    comprensión
    claridad
    facilidad de uso
    confianza
    velocidad de interacción
    experiencia móvil y desktop
    recurrencia
    percepción de valor
    inteligencia financiera accionable

El dominio financiero queda CONGELADO.

==================================================
1. CONTEXTO Y ESTADO OFICIAL
==================================================

La ronda R15.3.2 fue la ronda final de robustecimiento financiero.

R15.3.2:

- fue implementada;
- fue cerrada;
- fue committeada;
- fue desplegada;
- cuenta con sus commits correspondientes;
- los índices de producción fueron aplicados/verificados;
- la verificación de índices terminó en CONTRACT OK 5/5;
- el árbol quedó limpio;
- la documentación fue actualizada;
- el estado post-R15.3.2 está registrado en docs/AUDIT-AND-PLAN.md.

La auditoría final confirmó que NO existe actualmente un P0/P1 financiero conocido que justifique otra ronda financiera antes de UX/UI.

POR LO TANTO:

==================================================
🔒 FREEZE FORMAL DEL DOMINIO FINANCIERO
==================================================

A partir de esta etapa:

EL DOMINIO FINANCIERO DE TWINCAP ESTÁ FROZEN.

Esto significa:

- no rediseñar las reglas financieras;
- no cambiar arbitrariamente la fuente de verdad;
- no cambiar el modelo monetario;
- no introducir floats;
- no reintroducir aggregateBalance;
- no modificar la semántica de saldos negativos;
- no modificar las reglas de transferencias;
- no modificar las reglas de multimoneda;
- no modificar las garantías de atomicidad;
- no modificar las garantías de concurrencia;
- no eliminar CAS;
- no eliminar idempotencia;
- no eliminar mecanismos de serialización;
- no introducir fallbacks financieros peligrosos;
- no cambiar la semántica de movimientos;
- no cambiar la integridad referencial;
- no alterar las garantías de multi-tenancy;
- no alterar la lógica financiera para simplificar componentes visuales.

UX/UI DEBE ADAPTARSE AL DOMINIO.

EL DOMINIO NO DEBE ADAPTARSE A UX/UI.

==================================================
2. REGLA DE EXCEPCIÓN AL FREEZE
==================================================

El freeze NO significa que sea imposible corregir un defecto financiero real.

Si durante UX/UI aparece evidencia de un defecto financiero real:

NO lo corrijas silenciosamente.

DEBES:

1. detener la modificación;
2. documentar el hallazgo;
3. indicar exactamente qué regla del dominio afecta;
4. explicar por qué constituye un defecto real;
5. determinar impacto;
6. proponer la corrección mínima necesaria;
7. solicitar aprobación antes de modificar el dominio congelado.

No se permite romper el freeze por:

- preferencias estéticas;
- comodidad del frontend;
- simplificación de componentes;
- reducción de código;
- cambios de nombres;
- preferencias personales del agente;
- similitud con un competidor;
- "me parece más intuitivo";
- deseos de implementar una funcionalidad nueva.

==================================================
3. LECTURA OBLIGATORIA
==================================================

ANTES DE HACER CUALQUIER CAMBIO:

DEBES leer:

1. AGENTS.md
2. PROJECT-RULES.md
3. docs/AUDIT-AND-PLAN.md
4. documentación correspondiente a R15.3.2
5. documentación/matriz de R15.3.2
6. arquitectura relevante del dominio financiero
7. reglas UX/UI existentes
8. cualquier documento maestro actualizado posteriormente.

PROJECT-RULES.md es una FUENTE MAESTRA.

Si durante esta etapa se genera una nueva regla permanente:

DEBE incorporarse a PROJECT-RULES.md.

No crear reglas permanentes únicamente en mensajes temporales.

==================================================
4. PRIMER OBJETIVO — DOCUMENTAR EL FREEZE
==================================================

Antes de iniciar cambios visuales, debes dejar documentado formalmente que:

R15.3.2 representa el cierre del dominio financiero previo a UX/UI.

Crear o actualizar un documento de estado de freeze, preferiblemente:

docs/FINANCIAL-DOMAIN-FREEZE.md

Debe contener como mínimo:

- fecha del freeze;
- versión/ronda que lo origina;
- alcance congelado;
- reglas financieras congeladas;
- operaciones cubiertas;
- garantías de atomicidad;
- garantías de concurrencia;
- CAS;
- idempotencia;
- multimoneda;
- saldos negativos;
- integridad referencial;
- fuente de verdad de saldos;
- opening balances;
- multi-tenancy;
- reconciliación;
- índices de producción relevantes;
- CONTRACT OK 5/5;
- relación entre dominio financiero y UX/UI;
- procedimiento excepcional para reabrir el freeze.

Debe quedar claramente escrito:

"El dominio financiero está congelado. UX/UI puede modificar la forma en que las reglas se presentan, pero no las reglas mismas."

==================================================
5. SEGUNDO OBJETIVO — NO EMPEZAR CODIFICANDO UX/UI
==================================================

NO comiences inmediatamente cambiando colores, botones, tablas o componentes.

Primero debes realizar una AUDITORÍA UX/UI DEL PRODUCTO ACTUAL.

La primera fase de UX/UI será de comprensión.

Debes estudiar:

- navegación actual;
- arquitectura de información;
- nombres de módulos;
- jerarquía visual;
- flujos principales;
- formularios;
- tablas;
- cards existentes;
- responsive;
- mobile;
- desktop;
- estados vacíos;
- errores;
- warnings;
- loading;
- confirmaciones;
- feedback de acciones;
- onboarding;
- dashboard actual;
- Resumen;
- Movimientos;
- Cuentas;
- POS;
- Clientes;
- Productos;
- Créditos;
- Abonos;
- reportes;
- configuración.

NO debes asumir que la arquitectura actual es correcta solamente porque funciona.

Pero tampoco debes rediseñar por gusto.

Cada cambio debe responder a una necesidad concreta del usuario.

==================================================
6. INVESTIGACIÓN COMPETITIVA — APRENDER, NO COPIAR
==================================================

Debes estudiar aplicaciones similares.

Como mínimo:

- Treinta;
- Wave;
- otras aplicaciones de gestión financiera para pequeños negocios;
- cuando sea útil, herramientas de POS/finanzas con buena experiencia móvil.

También debes revisar:

- reseñas de App Store;
- reseñas de Google Play;
- comentarios públicos;
- YouTube cuando sea accesible;
- discusiones de usuarios;
- quejas recurrentes;
- elogios recurrentes;
- problemas después de actualizaciones;
- problemas de navegación;
- problemas de comprensión;
- problemas de confianza;
- problemas de rendimiento;
- problemas de soporte;
- funciones que usuarios dicen necesitar;
- cosas que los usuarios dicen que son confusas.

IMPORTANTE:

NO COPIAR FUNCIONALIDADES PORQUE UN COMPETIDOR LAS TENGA.

NO COPIAR DISEÑOS.

NO COPIAR TEXTOS.

NO COPIAR LA IDENTIDAD VISUAL.

NO HACER "TWINCAP PERO IGUAL A TREINTA".

La investigación debe responder:

¿Qué experiencias funcionan?

¿Qué experiencias frustran?

¿Qué errores cometen los competidores?

¿Qué cosas generan confianza?

¿Qué cosas destruyen confianza?

¿Qué información los usuarios necesitan encontrar inmediatamente?

¿Qué acciones deberían requerir menos pasos?

¿Qué conceptos necesitan explicación?

¿Qué información debería estar siempre visible?

¿Qué información debería mostrarse solo cuando sea relevante?

¿Qué patrones producen uso recurrente?

¿Qué cosas hacen que un usuario recomiende una aplicación?

==================================================
7. PRINCIPIO ESTRATÉGICO DE TWINCAP
==================================================

TwinCap NO debe competir únicamente por cantidad de funcionalidades.

La dirección estratégica es:

INTELIGENCIA FINANCIERA ACCIONABLE.

La evolución deseada es:

REGISTRAR
    ↓
ENTENDER
    ↓
DETECTAR
    ↓
DECIDIR
    ↓
ACTUAR

El usuario no debería tener que interpretar manualmente veinte números para descubrir qué está pasando.

TwinCap debe progresivamente ayudarle a responder:

- ¿Cuánto dinero tengo?
- ¿Dónde está?
- ¿Cuánto entró?
- ¿Cuánto salió?
- ¿Estoy ganando o perdiendo?
- ¿Qué cuentas están comprometidas?
- ¿Tengo deudas pendientes?
- ¿Estoy gastando más de lo habitual?
- ¿Qué cambió?
- ¿Hay algo que debería revisar?
- ¿Cuál es mi situación real?

La UX/UI debe preparar el terreno para esa evolución.

NO implementar todavía inteligencia artificial compleja simplemente por tener IA.

Primero construir una excelente arquitectura de información.

==================================================
8. PRINCIPIO CENTRAL DEL NUEVO "RESUMEN"
==================================================

El actual "Dashboard" debe tratarse conceptualmente como:

# RESUMEN

El nombre visible para el usuario debe priorizar "Resumen" si resulta más claro.

"Dashboard" puede mantenerse únicamente como término técnico interno si fuera necesario.

OBJETIVO DEL RESUMEN:

Cuando el usuario entre, debe poder entender su situación financiera rápidamente.

No debe ser simplemente una colección de gráficos bonitos.

Debe responder:

"¿Dónde estoy financieramente?"

El usuario debería poder obtener una comprensión inicial en aproximadamente 5–10 segundos.

El Resumen debe priorizar:

1. situación financiera actual;
2. liquidez;
3. ingresos;
4. gastos;
5. resultado;
6. obligaciones relevantes;
7. señales importantes;
8. evolución;
9. acciones recomendadas cuando corresponda.

==================================================
9. DISEÑO DEL RESUMEN — PRINCIPIO DE JERARQUÍA
==================================================

No mostrar todos los datos con la misma importancia.

Establecer jerarquía:

NIVEL 1:
¿Qué tan bien o mal estoy?

NIVEL 2:
¿Por qué?

NIVEL 3:
¿Qué cambió?

NIVEL 4:
¿Qué debería revisar?

NIVEL 5:
Detalle.

El usuario no debería necesitar estudiar el dashboard.

El dashboard debe contar una historia financiera.

==================================================
10. CARDS FINANCIERAS
==================================================

Las cards NO deben convertirse en decoración.

Cada card debe responder una pregunta.

Ejemplos conceptuales:

"Disponible"

"Ingresos"

"Gastos"

"Resultado"

"Por cobrar"

"Por pagar"

"Variación"

"Alertas"

Pero NO implementar todas automáticamente.

Determinar qué métricas son realmente prioritarias según la información disponible.

Cada card debe tener:

- título claro;
- valor principal;
- periodo cuando corresponda;
- contexto;
- comparación cuando tenga sentido;
- indicador visual comprensible;
- posibilidad de profundizar;
- estado vacío cuando no haya datos;
- comportamiento responsive;
- accesibilidad.

Evitar:

- exceso de colores;
- exceso de iconos;
- exceso de gráficos;
- números sin contexto;
- porcentajes sin explicación;
- terminología contable innecesaria;
- cards que no permitan tomar ninguna decisión.

==================================================
11. CARDS EN DESKTOP Y MOBILE
==================================================

NO asumir que:

desktop = tabla
mobile = cards.

Analizar cada caso.

Las cards pueden ser una mejora también en PC.

Objetivo:

DESKTOP:
- aprovechar espacio;
- mostrar información jerarquizada;
- permitir comparación;
- mantener densidad razonable;
- facilitar escaneo.

MOBILE:
- reducir carga cognitiva;
- priorizar información;
- facilitar interacción táctil;
- evitar tablas horizontales;
- evitar columnas ilegibles;
- mostrar acciones claras;
- permitir lectura rápida.

Para movimientos, estudiar si una card/resumen de movimiento es mejor que una tabla tradicional.

NO convertir todo indiscriminadamente a cards.

Usar:

- cards;
- listas;
- tablas;
- grids;
- agrupaciones;
- filtros;

según la naturaleza de la información.

La regla es:

"El componente debe adaptarse a la tarea del usuario."

No:

"Todo debe ser card."

==================================================
12. MOVIMIENTOS
==================================================

Movimientos es una de las áreas más frecuentes.

Debe optimizarse para:

- velocidad;
- claridad;
- confianza;
- búsqueda;
- edición;
- lectura;
- identificación de cuenta;
- moneda;
- tipo;
- fecha;
- monto;
- estado.

El usuario debe poder identificar rápidamente:

QUÉ pasó
CUÁNDO pasó
DÓNDE pasó
CUÁNTO fue
EN QUÉ MONEDA
QUÉ EFECTO TUVO

Evitar tablas excesivamente densas.

Analizar:

- vista de lista;
- cards;
- agrupación por fecha;
- filtros;
- búsqueda;
- acciones rápidas;
- detalle expandido.

==================================================
13. FORMULARIOS
==================================================

Toda pantalla de creación/edición debe preguntarse:

¿El usuario entiende inmediatamente qué debe hacer?

¿Los campos están en el orden natural de la tarea?

¿Los valores predeterminados ayudan?

¿Los nombres son humanos?

¿Los errores aparecen junto al campo?

¿Se evita pedir información innecesaria?

¿La moneda está clara?

¿La cuenta está clara?

¿El resultado de la operación es comprensible antes de guardar?

¿Después de guardar el usuario sabe qué ocurrió?

Priorizar:

- progressive disclosure;
- defaults seguros;
- autocompletado;
- búsqueda;
- debounce donde corresponda;
- selección clara;
- feedback inmediato;
- prevención de errores;
- posibilidad de cancelar sin perder información.

==================================================
14. CONFIANZA
==================================================

LA CONFIANZA ES UN OBJETIVO DE PRODUCTO.

TwinCap maneja información financiera.

Por tanto, cada interacción debe comunicar:

"Entiendo qué ocurrió."

"Mis datos no desaparecieron."

"El sistema no cambió algo sin explicármelo."

"Mi saldo tiene sentido."

"Si algo salió mal, sé qué pasó."

"Si mi saldo es negativo, TwinCap me lo muestra claramente."

"Si hay una transferencia entre monedas, entiendo ambas cantidades."

"Si algo está pendiente, sé por qué."

"Si una operación falla, no queda parcialmente registrada."

UX/UI debe hacer visible la robustez que ya existe en el dominio.

No inventar garantías.

No utilizar mensajes genéricos como:

"Algo salió mal."

cuando sea posible explicar de manera útil:

"No pudimos completar la operación. Tus datos no fueron modificados."

==================================================
15. ERRORES Y ESTADOS
==================================================

Diseñar explícitamente:

- loading;
- empty;
- success;
- warning;
- error;
- partial state;
- offline/network failure;
- permission failure;
- conflict;
- stale data;
- no results;
- first-use.

No dejar estados implícitos.

Cada estado debe responder:

¿Qué ocurrió?

¿Los datos están seguros?

¿Qué puede hacer el usuario?

==================================================
16. SALDOS NEGATIVOS
==================================================

Los saldos negativos NO deben esconderse.

NO bloquear automáticamente la operación.

NO maquillar el saldo.

NO utilizar colores como único mecanismo de comunicación.

Debe quedar claro:

saldo negativo = realidad financiera registrada.

Pero también:

saldo negativo ≠ sistema roto.

Diseñar una comunicación visual clara, profesional y no alarmista.

==================================================
17. MULTIMONEDA
==================================================

La UX debe respetar completamente el modelo financiero congelado.

En operaciones entre monedas:

mostrar claramente:

ORIGEN
- cuenta
- moneda
- monto

DESTINO
- cuenta
- moneda
- monto

Y cuando corresponda:

- tasa implícita;
- contexto;
- relación entre ambos importes.

Nunca ocultar una conversión financiera importante.

Nunca asumir una moneda silenciosamente.

==================================================
18. ACCESIBILIDAD
==================================================

Toda UX/UI debe considerar:

- contraste;
- tamaño de texto;
- focus;
- navegación por teclado;
- labels;
- aria cuando corresponda;
- estados no dependientes exclusivamente del color;
- targets táctiles adecuados;
- lectura clara;
- mensajes de error accesibles;
- responsive.

No aceptar "se ve bonito" como criterio suficiente.

==================================================
19. RESPONSIVE
==================================================

Diseñar MOBILE-FIRST, pero NO MOBILE-ONLY.

Los usuarios pueden utilizar TwinCap:

- teléfono;
- tablet;
- laptop;
- desktop.

Cada breakpoint debe tener una experiencia deliberada.

No simplemente:

"desktop reducido hasta caber en móvil."

Y tampoco:

"mobile estirado hasta desktop."

==================================================
20. DISEÑO VISUAL
==================================================

Antes de modificar masivamente componentes:

definir o consolidar un DESIGN SYSTEM.

Debe contemplar:

- colores;
- tipografía;
- escalas;
- spacing;
- radios;
- sombras;
- borders;
- botones;
- inputs;
- selects;
- cards;
- tablas;
- badges;
- alerts;
- modals;
- dropdowns;
- tooltips;
- iconografía;
- estados;
- charts.

Debe ser consistente.

No introducir estilos diferentes por pantalla.

No utilizar colores arbitrariamente.

No llenar todo de sombras, gradients o efectos.

TwinCap debe transmitir:

- confianza;
- claridad;
- modernidad;
- profesionalismo;
- simplicidad;
- control financiero.

==================================================
21. ICONOGRAFÍA
==================================================

Utilizar iconos consistentes.

No usar iconos simplemente porque "se ven bonitos".

Cada icono debe tener significado.

Nunca depender exclusivamente de un icono para comunicar una acción crítica.

==================================================
22. MICROCOPY
==================================================

El lenguaje de TwinCap debe ser:

- claro;
- humano;
- corto;
- profesional;
- directo;
- comprensible para una persona sin conocimientos contables.

Evitar jerga innecesaria.

Evitar frases ambiguas.

Evitar mensajes robóticos.

Evitar:

"Entidad procesada satisfactoriamente."

Preferir:

"Movimiento guardado."

Pero sin sacrificar precisión.

==================================================
23. USO RECURRENTE
==================================================

UX/UI debe diseñarse pensando no solamente en:

"¿Cómo hago que el usuario complete esta acción?"

sino también:

"¿Por qué debería volver mañana?"

La recurrencia debe surgir de utilidad real.

No implementar gamificación artificial.

No usar notificaciones molestas.

No crear dependencia artificial.

Crear valor mediante:

- claridad;
- seguimiento;
- evolución;
- alertas relevantes;
- historial;
- información útil;
- reducción de trabajo;
- sensación de control.

El usuario debe sentir:

"Vale la pena entrar a TwinCap porque sé mejor cómo está mi negocio."

==================================================
24. RECOMENDACIÓN ORGÁNICA
==================================================

La recomendación debe surgir de:

"Esto me facilita realmente el negocio."

No de:

"Me dieron un premio por invitar a alguien."

Priorizar experiencias memorables:

- facilidad;
- velocidad;
- claridad;
- confianza;
- utilidad.

Una excelente experiencia de Resumen puede convertirse en uno de los principales motores orgánicos:

"Abro TwinCap y en segundos sé cómo estoy."

Ese debe ser uno de los objetivos.

==================================================
25. INTELIGENCIA FINANCIERA ACCIONABLE
==================================================

No implementar una "IA" por marketing.

Preparar la arquitectura UX para una evolución futura.

Ejemplos futuros:

"Este mes tus gastos aumentaron 18%."

"Tu saldo disponible disminuyó durante tres semanas consecutivas."

"Tienes $X pendientes por cobrar."

"Tu mayor categoría de gasto fue X."

"Este comportamiento es diferente al promedio reciente."

"Revisa esta cuenta."

"Podrías tener un problema de liquidez próximamente."

Pero:

NO inventar conclusiones.

NO mostrar recomendaciones sin datos suficientes.

NO presentar predicciones como hechos.

NO convertir el Resumen en una pared de alertas.

La inteligencia debe aparecer solamente cuando realmente agregue valor.

==================================================
26. INFORMACIÓN Y JERARQUÍA
==================================================

Aplicar progressive disclosure.

Primero:
lo esencial.

Después:
contexto.

Después:
detalle.

Después:
configuración avanzada.

No obligar al usuario a leer toda la contabilidad para saber cuánto tiene.

==================================================
27. AUDITORÍA DE NAVEGACIÓN
==================================================

Revisar toda la navegación.

Preguntar para cada módulo:

- ¿el nombre es comprensible?
- ¿está en el lugar correcto?
- ¿el usuario sabe qué encontrará allí?
- ¿hay duplicación?
- ¿hay opciones que deberían agruparse?
- ¿hay funciones demasiado escondidas?
- ¿hay funciones importantes enterradas?
- ¿la navegación cambia de forma inesperada?
- ¿mobile y desktop mantienen el mismo modelo mental?

==================================================
28. ONBOARDING
==================================================

No asumir que el usuario entiende TwinCap.

Diseñar un onboarding progresivo.

NO hacer un tutorial largo obligatorio.

Debe explicar:

- qué es TwinCap;
- qué significa una cuenta;
- cómo registrar la primera operación;
- qué muestra Resumen;
- cómo interpretar el saldo;
- dónde encontrar movimientos;
- cómo empezar rápidamente.

El onboarding debe llevar al usuario hacia el primer "momento de valor".

==================================================
29. PRIMER MOMENTO DE VALOR
==================================================

Definir explícitamente cuál es el "aha moment".

Idealmente:

El usuario registra información real y luego observa que TwinCap transforma esos datos en una visión clara de su situación.

El flujo debe minimizar el tiempo entre:

"Estoy configurando TwinCap"

y

"Ahora entiendo mi negocio."

==================================================
30. NO FEATURE BLOAT
==================================================

Esta regla es crítica.

NO agregar funcionalidades solamente porque:

- Treinta las tiene;
- otra app las tiene;
- un usuario de otra app las pidió;
- "sería chévere";
- "queda profesional";
- el componente existe;
- el agente puede implementarlo rápidamente.

Cada funcionalidad nueva debe justificar:

1. problema;
2. usuario afectado;
3. frecuencia;
4. valor;
5. complejidad;
6. impacto en UX;
7. impacto en dominio;
8. impacto futuro.

Si una funcionalidad no tiene suficiente valor:

NO implementarla.

==================================================
31. ARQUITECTURA DE COMPONENTES
==================================================

Antes de duplicar componentes:

buscar reutilización.

Crear componentes consistentes para:

- MetricCard;
- SummaryCard;
- MovementCard;
- DataTable;
- EmptyState;
- ErrorState;
- LoadingState;
- ConfirmDialog;
- Alert;
- FormField;
- CurrencyInput;
- MoneyDisplay;
- AccountSelector;
- ClientSelector;
- ProductSelector;
- DateSelector;
- FilterBar;
- etc.

No crear componentes genéricos inútiles.

No abstraer prematuramente.

La abstracción debe surgir de patrones reales.

==================================================
32. DATOS FINANCIEROS Y PRESENTACIÓN
==================================================

La UI debe utilizar las funciones/datos existentes del dominio.

NO recalcular saldos financieramente en frontend.

NO duplicar reglas financieras en componentes.

NO crear una segunda fuente de verdad.

Frontend presenta.

Backend/domain calcula y garantiza.

==================================================
33. ANALYTICS Y APRENDIZAJE
==================================================

Preparar instrumentación para entender UX real.

Cuando corresponda registrar eventos no sensibles como:

- pantalla visitada;
- acción iniciada;
- acción completada;
- abandono de formulario;
- filtro utilizado;
- búsqueda;
- interacción con Resumen;
- uso de acciones rápidas;
- errores de UX.

NO registrar información financiera sensible innecesaria.

NO registrar montos financieros como analytics salvo justificación explícita y segura.

El objetivo es aprender:

¿qué utilizan?

¿dónde abandonan?

¿qué confunde?

¿qué genera recurrencia?

¿qué pantallas aportan valor?

==================================================
34. CRITERIOS DE CALIDAD UX
==================================================

Una pantalla NO está terminada solamente porque:

- compila;
- se ve moderna;
- es responsive;
- no tiene errores de consola.

Debe evaluarse:

CLARIDAD
FACILIDAD
VELOCIDAD
CONFIANZA
ACCESIBILIDAD
CONSISTENCIA
RESPONSIVIDAD
RECUPERACIÓN DE ERRORES
JERARQUÍA
VALOR

==================================================
35. PROCESO OBLIGATORIO DE LA ETAPA UX/UI
==================================================

FASE UX-0
FREEZE Y DOCUMENTACIÓN

FASE UX-1
AUDITORÍA UX/UI DEL ESTADO ACTUAL

FASE UX-2
INVESTIGACIÓN COMPETITIVA Y DE USUARIOS

FASE UX-3
ARQUITECTURA DE INFORMACIÓN

FASE UX-4
DESIGN SYSTEM

FASE UX-5
REDISEÑO DEL RESUMEN

FASE UX-6
REDISEÑO DE FLUJOS CORE

FASE UX-7
RESPONSIVE MOBILE + DESKTOP

FASE UX-8
MICROCOPY + ESTADOS + ERRORES

FASE UX-9
ACCESIBILIDAD

FASE UX-10
IMPLEMENTACIÓN

FASE UX-11
VALIDACIÓN

FASE UX-12
POLISH FINAL

No saltar directamente a UX-10.

==================================================
36. FASE UX-1 — AUDITORÍA ACTUAL
==================================================

Generar:

docs/UX-UI-AUDIT.md

Debe contener:

- problemas encontrados;
- severidad;
- evidencia;
- pantalla;
- usuario afectado;
- recomendación;
- dependencia;
- impacto.

Clasificar:

P0
P1
P2
P3

Pero no utilizar P0/P1 indiscriminadamente.

==================================================
37. FASE UX-2 — BENCHMARK
==================================================

Generar:

docs/UX-COMPETITIVE-RESEARCH.md

Incluir:

- Treinta;
- Wave;
- competidores adicionales relevantes;
- reseñas;
- patrones positivos;
- patrones negativos;
- oportunidades;
- cosas que NO debemos copiar.

Debe existir una sección:

"Lecciones para TwinCap"

y otra:

"Errores que TwinCap debe evitar".

==================================================
38. FASE UX-3 — ARQUITECTURA
==================================================

Definir:

- navegación principal;
- navegación secundaria;
- jerarquía;
- nombres;
- rutas;
- relación entre módulos;
- acciones principales;
- acciones secundarias.

Especial atención a:

RESUMEN
MOVIMIENTOS
CUENTAS
VENTAS/POS
CLIENTES
PRODUCTOS
CRÉDITOS/ABONOS
REPORTES
CONFIGURACIÓN

No asumir que todos necesitan igual protagonismo.

==================================================
39. FASE UX-4 — DESIGN SYSTEM
==================================================

Definir primero los fundamentos.

Después componentes.

Después patrones.

Después páginas.

NO hacer página por página sin sistema.

==================================================
40. FASE UX-5 — RESUMEN
==================================================

El Resumen será la primera gran pieza de producto.

Debe responder:

"¿Dónde estoy financieramente?"

Diseñar primero:

- estructura;
- jerarquía;
- cards;
- métricas;
- contexto;
- periodos;
- alertas;
- evolución;
- acciones rápidas;
- estados vacíos.

Antes de implementarlo:

documentar la arquitectura propuesta.

==================================================
41. RESUMEN — REGLA DE ORO
==================================================

Si el usuario mira Resumen durante 10 segundos:

DEBE poder responder aproximadamente:

1. ¿Cuánto tengo?
2. ¿Qué está pasando?
3. ¿Estoy mejor o peor?
4. ¿Dónde está el problema, si existe?
5. ¿Qué debería revisar?

Si el diseño no permite eso:

NO está terminado.

==================================================
42. DESKTOP
==================================================

No convertir desktop en una tabla gigante.

Evaluar:

- cards;
- grids;
- paneles;
- listas;
- tablas donde aporten densidad;
- espacios;
- jerarquía.

Desktop debe aprovechar el espacio para aumentar comprensión, no simplemente mostrar más elementos.

==================================================
43. MOBILE
==================================================

Mobile debe ser una experiencia de primera clase.

Evitar:

- tablas ilegibles;
- scroll horizontal innecesario;
- botones diminutos;
- formularios largos;
- modales excesivos;
- información secundaria antes de lo esencial.

Usar cards/listas cuando mejoren comprensión.

==================================================
44. PERFORMANCE
==================================================

UX/UI NO debe degradar performance.

Revisar:

- imágenes;
- iconos;
- bundles;
- charts;
- renders;
- consultas;
- loading;
- lazy loading;
- componentes pesados.

No sacrificar velocidad por decoración.

==================================================
45. SEGURIDAD
==================================================

No exponer información financiera de otros tenants.

No introducir datos sensibles en:

- URLs;
- analytics;
- logs innecesarios;
- mensajes de error;
- localStorage inseguro.

No cambiar autorización backend para solucionar un problema visual.

==================================================
46. TESTING
==================================================

Cada cambio significativo debe validar:

- TypeScript;
- lint;
- tests;
- build;
- responsive;
- accesibilidad cuando corresponda.

Los flujos financieros deben continuar pasando sus pruebas.

UX/UI NO puede romper el dominio congelado.

==================================================
47. REGRESIÓN FINANCIERA
==================================================

Después de cada conjunto significativo de cambios:

verificar que siguen funcionando:

- crear movimiento;
- editar movimiento;
- eliminar movimiento;
- transferencias;
- multimoneda;
- saldo negativo;
- créditos;
- abonos;
- POS;
- opening balances;
- operaciones multi-cuenta;
- idempotencia;
- aislamiento tenant.

No porque el dominio esté abierto.

Sino porque UX/UI no puede romperlo.

==================================================
48. CRITERIO DE CIERRE DE CADA FASE
==================================================

NINGUNA FASE se considera terminada porque "el agente terminó".

Cada fase necesita:

- entregables;
- evidencia;
- validación;
- documentación;
- criterios de aceptación.

==================================================
49. REGLA DE NO REGRESIÓN
==================================================

No sacrificar:

- integridad financiera;
- seguridad;
- accesibilidad;
- performance;
- claridad;

para conseguir:

- estética;
- menos código;
- menos componentes;
- mayor similitud con competidores.

==================================================
50. OBJETIVO FINAL
==================================================

TwinCap debe convertirse progresivamente en una aplicación donde:

REGISTRAR ES FÁCIL.

ENTENDER ES INMEDIATO.

CONFIAR ES NATURAL.

VOLVER ES ÚTIL.

RECOMENDARLA ES FÁCIL.

El usuario debe sentir:

"Por fin sé dónde está mi negocio."

Y no:

"Esta aplicación tiene muchas funciones."

La cantidad de funcionalidades NO es el objetivo.

El objetivo es:

# CLARIDAD FINANCIERA ACCIONABLE.

==================================================
51. ENTREGABLES OBLIGATORIOS INICIALES
==================================================

ANTES DE IMPLEMENTAR GRANDES CAMBIOS VISUALES debes producir:

1. docs/FINANCIAL-DOMAIN-FREEZE.md

2. docs/UX-UI-AUDIT.md

3. docs/UX-COMPETITIVE-RESEARCH.md

4. docs/UX-INFORMATION-ARCHITECTURE.md

5. docs/UX-DESIGN-SYSTEM.md

6. docs/UX-ROADMAP.md

7. actualización de PROJECT-RULES.md con las nuevas reglas permanentes.

==================================================
52. UX-ROADMAP
==================================================

El roadmap debe priorizar:

P0:
problemas que impiden usar/comprender el producto.

P1:
problemas que deterioran significativamente confianza, claridad o conversión.

P2:
mejoras importantes.

P3:
polish.

No convertir todo en P0.

==================================================
53. ORDEN DE IMPLEMENTACIÓN
==================================================

PRIORIDAD:

1. navegación;
2. arquitectura;
3. Resumen;
4. flujos core;
5. formularios;
6. movimientos;
7. cuentas;
8. POS;
9. clientes/productos;
10. créditos/abonos;
11. reportes;
12. configuración;
13. polish.

El orden puede cambiar si la auditoría demuestra una dependencia diferente.

==================================================
54. REGLA FINAL SOBRE EL DOMINIO FINANCIERO
==================================================

ESTA ES UNA REGLA PERMANENTE:

"Desde R15.3.2, el dominio financiero de TwinCap se considera congelado. Las futuras etapas de UX/UI, crecimiento y producto deben consumir sus contratos y reglas existentes. Cualquier reapertura del dominio financiero requiere evidencia de un defecto real y aprobación explícita."

==================================================
55. PRIMERA ACCIÓN
==================================================

NO empieces cambiando código visual.

Primero:

1. lee toda la documentación obligatoria;
2. verifica el estado actual;
3. documenta el freeze;
4. audita la UX/UI actual;
5. investiga competidores y comentarios de usuarios;
6. identifica patrones;
7. define arquitectura;
8. define design system;
9. diseña conceptualmente el nuevo Resumen;
10. presenta los hallazgos y el roadmap;
11. solo después comienza la implementación.

El objetivo no es simplemente "hacer TwinCap más bonito".

El objetivo es construir una UX/UI capaz de soportar el crecimiento del producto durante años.

==================================================
56. CONDICIÓN DE ÉXITO
==================================================

Al terminar esta etapa inicial debe poder decirse:

"TwinCap tiene un dominio financiero congelado y estable, una arquitectura de información coherente, un sistema visual consistente y una experiencia diseñada alrededor de la comprensión financiera del usuario."

Y especialmente:

"Al abrir Resumen, el usuario sabe dónde está financieramente."

NO declarar terminada la etapa simplemente porque:

- todas las páginas fueron rediseñadas;
- se cambiaron colores;
- se agregaron cards;
- se instalaron nuevos iconos.

La etapa estará bien encaminada cuando:

CLARIDAD > CANTIDAD
CONFIANZA > EFECTOS
UTILIDAD > DECORACIÓN
COMPRENSIÓN > DENSIDAD
CONSISTENCIA > IMPROVISACIÓN
EXPERIENCIA > FEATURE COUNT

FIN DE LA ORDEN.
```

## Por qué estructuraría así la nueva etapa

Hay una decisión que considero especialmente importante: **no empezaría por Movimientos ni por el menú. Empezaría por Resumen.**

Porque Resumen obliga a contestar la pregunta fundamental:

> **¿Qué información considera TwinCap realmente importante para que una persona entienda su situación financiera?**

Una vez respondamos eso, podemos hacer que el resto de la aplicación alimente esa visión.

Y ahí veo una oportunidad fuerte para TwinCap.

### No quiero un dashboard lleno de KPIs

Quiero algo más parecido a un **centro de comprensión financiera**.
