# TwinCap — rediseño de la home pública

> Estado: **rediseñada e implementada localmente; compilación y revisión visual responsive completadas** (2026-10-09)  
> Ruta: `/`  
> Continuidad general: `docs/AUDIT-AND-PLAN.md`  
> Repo: rama `master`; cambios locales sin commit al momento de documentar.

## Objetivo

Expresar con claridad la propuesta de TwinCap: llevar las finanzas personales y las de un pequeño negocio en una sola aplicación, manteniendo los movimientos separados y dando seguimiento a ventas, cobros, existencias y resultados registrados. El tono debe sentirse claro, profesional y cotidiano; evitar jerga contable, frases genéricas de SaaS y promesas que excedan el producto.

## Dirección implementada

- **Hero:** “Tu vida y tu negocio, en la misma app. Con las cuentas claras.” El encabezado se acompaña de una descripción concreta y dos acciones: crear una cuenta y ver cómo funciona.
- **Demostración visual:** muestra un resumen de negocio explícitamente ilustrativo, con ventas, saldo pendiente por cobrar y un resultado marcado como incompleto por costos de inventario faltantes. No promete una rentabilidad definitiva ni oculta la información faltante.
- **Capacidades:** tres bloques centrados en finanzas personales, ventas y cobros conectados, y productos/existencias/costos. Se eliminaron las seis tarjetas de igual peso y la numeración artificial “FUNCIÓN”.
- **Recorrido:** explica en tres pasos cómo TwinCap acompaña una venta: registrarla, anotar cobros posteriores y revisar el resultado según la información registrada.
- **Precisión:** las respuestas frecuentes aclaran que TwinCap no reemplaza la contabilidad, que el resultado queda incompleto cuando falta un costo y que cada cuenta mantiene su moneda sin conversión entre saldos.
- **Jerarquía visual:** paleta más contenida basada en los colores de marca, menos etiquetas en mayúsculas, menos ornamentación y una composición de producto principal en el hero. La cabecera usa un acceso corto en móvil para que conviva con el botón de registro.
- Copy alineado en español e inglés; metadata de ambas versiones actualizada.

## Archivos principales

- `src/components/landing/hero.tsx`
- `src/components/landing/features.tsx`
- `src/components/landing/benefits.tsx`
- `src/components/landing/faq.tsx`
- `messages/es.json`, `messages/en.json`

## Verificación

- TypeScript `tsc --noEmit`: **EXIT 0**.
- ESLint scoped de la home y sus componentes: **0 errores / 0 warnings**.
- Prettier check de los archivos tocados: **PASS**.
- `pnpm build`: **EXIT 0**.
- Revisión visual de la página con Chromium a **375, 768 y 1280 px**: completada; `document.documentElement.scrollWidth` coincidió con el viewport en los tres anchos (sin desbordamiento horizontal).
- La revisión usó una réplica Mongo local temporal; no accedió a Atlas ni cambió la configuración del proxy. Se inspeccionaron las capturas de los tres breakpoints y se retiraron del workspace para no ensuciar el repositorio.
- No se ejecutaron suites de prueba en esta tarea.

## Criterio de comunicación financiera

La home presenta el resultado del negocio como una lectura de ventas menos costos de inventario conocidos y gastos ingresados. Los costos faltantes se señalan; los pagos posteriores reducen el saldo por cobrar y no vuelven a contar una venta. Los valores de la tarjeta son ejemplos identificados como tales.
