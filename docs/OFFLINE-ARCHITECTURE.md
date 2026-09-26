# Arquitectura offline de TwinCap

Estado: **arquitectura diseñada; indicador de conectividad implementado; capacidades financieras offline fuera de alcance**
Alcance de esta ronda: indicador de conectividad y fallback público seguro.
Última revisión: 2026-09-25.

## Principios

1. La conectividad del navegador no confirma que la API o MongoDB estén disponibles. `navigator.onLine` solo alimenta una señal de interfaz; un fallo de una acción se informa según su resultado y no cambia datos locales.
2. No se persiste HTML, respuestas, formularios ni snapshots de rutas autenticadas. En particular, no se cachean páginas de `(main)`, Server Actions, `/api`, datos de workspace, tokens ni páginas de autenticación.
3. La beta no admite crear, editar, borrar ni contabilizar operaciones financieras sin conexión. No habrá cola de movimientos ni escritura optimista offline.
4. Cache Storage contiene solo recursos estáticos versionados y páginas públicas expresamente permitidas. El service worker actual respeta esta frontera: rutas financieras se atienden por red y no se guardan.
5. El servidor y MongoDB siguen siendo la fuente de verdad para toda información financiera.

## Estado implementado hoy

`public/sw.js` usa una caché versionada para recursos estáticos y una lista explícita de páginas públicas. Las navegaciones usan red primero y permiten fallback al shell público; recursos `/_next/static/` usan caché mientras se actualizan. Excluye peticiones no-GET, `/api/` y Server Actions. En desarrollo, `ServiceWorkerRegistration` desregistra workers y borra caches para evitar servir bundles obsoletos. Esto NO implementa lectura financiera desde cache ni sincronización.

`ConnectivityNotice` se monta dentro del layout autenticado, escucha los eventos del navegador y presenta estados offline/recuperado con `role="status"` y mensajes es/en. El navegador solo comunica conectividad local; no se interpreta como confirmación de disponibilidad del servidor. No se cachean ni encolan operaciones.

## Fase segura de conectividad

- Un proveedor cliente único escucha `online`/`offline` y toma el estado inicial de `navigator.onLine` después del montaje para evitar discrepancias SSR/hidratación.
- El estado visible es una banda compacta y accesible en las superficies autenticadas. Debe indicar “Sin conexión”; al recuperar red, puede mostrar temporalmente “Conexión restaurada”. No atribuye al servidor una disponibilidad que el navegador no puede verificar.
- Mientras está offline, las acciones financieras quedan disponibles solo como interfaz normal; si el usuario intenta guardar, el error de red debe ser claro, preservando el formulario para reintentar. No afirmar que la operación quedó pendiente ni duplicar el submit.
- Skeletons y empty states describen carga/vacío del servidor, nunca datos cacheados como si fueran actuales.
- No se agrega una página offline autenticada cacheada. El fallback actual es exclusivamente el shell público.

## Cache y lectura

| Dato                                                                                        | Cache offline | Política                                                                   |
| ------------------------------------------------------------------------------------------- | ------------: | -------------------------------------------------------------------------- |
| Iconos, manifest y assets estáticos con hash                                                |            Sí | Cache versionada; se purga la versión anterior al activar el worker nuevo. |
| Landing y páginas públicas permitidas                                                       |            Sí | Red primero; cache solo tras respuesta pública exitosa.                    |
| Login, registro, verificación y recuperación                                                |            No | Pueden contener tokens o datos de cuenta.                                  |
| HTML, props RSC, dashboard, cuentas, movimientos, ventas, clientes y catálogos autenticados |            No | Riesgo de exposición en dispositivo compartido y datos obsoletos.          |
| POST, Server Actions y API                                                                  |            No | Siempre requieren red y validación/autorización del servidor.              |

Si en el futuro se propone lectura financiera offline, requiere una decisión separada de producto y seguridad: cifrado local con llave no derivable del workspace, retención y borrado al cerrar sesión/cambiar de usuario, mitigación de XSS, límites de dispositivos compartidos, frescura visible y prueba de aislamiento. El almacenamiento web del navegador no es una frontera de seguridad suficiente por sí sola.

## Sincronización futura (no implementada)

No crear cola hasta especificar y aprobar el modelo completo. Cuando se diseñe, cada comando deberá conservar identidad estable, workspace y actor autorizados en servidor, clave de idempotencia, payload versionado, fecha de creación y política de retención. El servidor volverá a validar permisos, límites, invariantes y conflictos; jamás confiará en el workspace del cliente.

Estados conceptuales reservados:

| Estado         | Significado futuro                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PENDING_SYNC` | Comando local validado por UX, todavía no aceptado por servidor.                                                          |
| `SYNCING`      | Envío en curso; no equivale a contabilizado.                                                                              |
| `SYNCED`       | Servidor confirmó resultado y devolvió identidad/versión canónica.                                                        |
| `SYNC_ERROR`   | Error reintentable o permanente que necesita explicación/acción.                                                          |
| `CONFLICT`     | La versión o estado remoto ya no permite aplicar la intención local. Requiere resolución explícita; no “last write wins”. |

Estos nombres no deben aparecer como estados de movimientos reales mientras no exista cola aprobada. Las operaciones financieras actuales no tendrán estos estados ni persistirán comandos locales.

## Reintentos y conflictos futuros

Solo errores transitorios explícitamente clasificados podrían reintentarse, con backoff acotado y la misma clave de idempotencia. Validación, autorización y conflictos no se reintentan automáticamente. Un timeout ambiguo se resuelve consultando el resultado por idempotency key antes de reenviar; nunca se genera una clave nueva para la misma intención. Las transferencias, pagos, ventas, créditos y correcciones de saldo necesitan reglas específicas por caso antes de entrar a una cola.

## Requisitos para reabrir el alcance

Antes de sincronización financiera: threat model; decisión de almacenamiento/cifrado; ciclo de sesión/logout; esquema y versionado de comandos; política por operación; idempotencia y recuperación de timeout; resolución de conflictos; observabilidad sin PII; retención/borrado; accesibilidad y comprensión del estado; matriz de pruebas de aislamiento y concurrencia. Hasta entonces: conectividad visible y fallback público solamente.
