# Preparación de internacionalización para PT-BR

Estado: **preparado en diseño; PT-BR no habilitado**
Última revisión: 2026-09-25.

## Decisión de separación

- **Locale** determina idioma, formatos de fecha/número y reglas de pluralización. Locale es `es` o `en` hoy; `pt-BR` se incorporará solo cuando exista catálogo completo suficiente y selector/persistencia definidos.
- **Moneda** es un código ISO independiente guardado en cuentas y operaciones. Cambiar el idioma nunca convierte saldos ni cambia `defaultCurrency`.
- **Formato** se deriva en render de `Intl.NumberFormat` y `Intl.DateTimeFormat`, con la moneda/exponente del dato y locale de presentación. Fechas civiles financieras continúan fijadas explícitamente a UTC según la regla del dominio.
- **Traducción** reside en namespaces de `messages/<locale>.json`; no se infiere idioma desde moneda, país, zona horaria o navegador después de que existe una preferencia guardada.
- **Pluralización** debe usar `Intl.PluralRules(locale)` o un helper común con variantes explícitas. Evitar interpolación manual singular/plural con condicionales dispersos.

## Estado de código comprobado

`src/i18n/types.ts` define `Locale = "es" | "en"`, `LOCALES` y `DEFAULT_LOCALE`. `getLocale`/`getT` leen `NEXT_LOCALE`; el proveedor cliente recibe locale y mensajes. Los formateadores de `src/lib/format.ts` ya aceptan locale como argumento, separan exponente por código de moneda y fijan `timeZone: "UTC"` en fechas civiles. Los mensajes español/inglés comparten namespaces y parity tests.

## Cambio mínimo futuro para habilitar pt-BR

1. Añadir `"pt-BR"` a `Locale`/`LOCALES` y `messages/pt-BR.json`; mantener `es` como fallback predeterminado salvo decisión explícita del producto.
2. Actualizar parity/usage tests para incluir cada locale habilitado y detectar claves ausentes, vacías o extras.
3. Definir metadata por locale (nombre visible, etiqueta nativa y locale Intl canónico) en un punto único; no construir códigos con concatenación ni asumir que el locale equivale a país.
4. Confirmar lectura, escritura, expiración y validación allowlist de `NEXT_LOCALE` y el selector. Datos desconocidos deben volver a `DEFAULT_LOCALE`, nunca importarse dinámicamente desde una entrada arbitraria.
5. Mantener currency como dato explícito separado. Validar con COP, BRL y USD; probar fecha civil, signo negativo, grandes cantidades, exponentes 0/2/3 y monedas en distintas posiciones según locale.
6. Incorporar plural categories propias de portugués y revisar tono, terminología financiera y accesibilidad con revisión humana nativa. No traducir automáticamente nombres de categorías personalizadas.

## Evitar

- Cambiar moneda al cambiar idioma o inferirla de `pt-BR`.
- Persistir strings traducidos como identificadores de dominio o notas automáticas.
- Suponer que todos los locales tienen solo singular/plural simple.
- Formatear fecha financiera como instante local o aplicar offsets para corregir diferencias.
- Habilitar `pt-BR` antes de que los mensajes de sus namespaces estén completos y los parity tests lo exijan.

## Cobertura previa al lanzamiento

Probar SSR/hidratación con locale persistido, cookie inválida, mensajes completos, navegación y exportación. Comparar salida `Intl` del runtime soportado y comprobar que la presentación jamás altera el valor minor-unit o la moneda persistida. Incluir pruebas de plural para conteo cero, uno, dos y valores grandes conforme a las reglas de `Intl.PluralRules("pt-BR")`.
