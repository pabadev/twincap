Analizando el formulario de **"Crear venta"**, hay varios puntos clave que se pueden mejorar en cuanto a jerarquía visual, flujo de trabajo y usabilidad en escritorio.

### 1\. Jerarquía de Acciones y Botones

- **Acciones Secundarias vs. Primarias:** Los enlaces `Crear artículo` y `+ Agregar artículo` están juntos y con el mismo color/estilo azul. Esto confunde cuál es la acción principal del bloque.

- *Solución:* Deja `+ Agregar artículo` como un botón secundario claro (ej. con borde o fondo neutro) y mueve `Crear artículo` a una opción dentro del propio desplegable o como un enlace más discreto.

- **Cierre del Modal:** Abajo tienes el botón `Crear venta` (Primario) y `Cancelar` (Secundario), pero en la esquina superior derecha también hay una `X`. Asegúrate de que `Cancelar` y la `X` ejecuten exactamente la misma acción o elimina la `X` para reducir redundancia.

### 2\. Tabla de Artículos (Estructura y Repetición)

- **Repetición de Labels:** Repetir los encabezados de columna (`Artículo`, `Cant.`, `Precio unitario`) arriba de cada fila individual genera un ruido visual innecesario.

- **Formato de Números y Alineación:**

- Los precios en las cajas (`30000`, `60000`, `40000`) no tienen separadores de miles (`30.000 COP`), a diferencia del total abajo (`130.000 COP`). La consistencia numérica es crucial en finanzas.

- Los valores numéricos (cantidad, precio) deben alinearse a la derecha para facilitar la lectura rápida.

- **Subtotal por Línea:** Falta una columna de "Subtotal" por cada artículo (Cantidad × Precio). En pantallas desktop hay espacio suficiente para incluirla.

- **Icono de Eliminar:** La caneca de basura en color rojo resaltado atrae demasiado la atención. Puede mantenerse neutra/gris y cambiar a rojo únicamente cuando el usuario pasa el cursor por encima (*hover*).

### 3\. Distribución del Formulario y Flujo Visual

- **Columna Derecha Cortada / Scroll:** La fecha en la columna derecha se ve ligeramente recortada en la parte inferior (`23/09/2026`), lo que indica que el modal depende de un scroll interno o le falta espacio vertical.

- **Agrupación Lógica:**

- La sección izquierda es puramente del **Detalle de la Venta** (Productos/Servicios).

- La sección derecha combina **Pago**, **Cliente** y **Fechas**. Mover el **Total** de la venta a una posición prominente al final de la lista de artículos o justo sobre el botón principal mejoraría el flujo de confirmación antes de guardar.

### 4\. Contraste y Accesibilidad (UI)

- **Modo Oscuro:** Los campos de texto tienen un fondo muy similar al fondo del modal. Aumentar ligeramente el contraste de los inputs (o darles un borde delgado en estado de reposo) ayudará a delimitar claramente las zonas interactivos.

- **Mensajes Informativos:** El texto secundario *"Selecciona un cliente real para vender a crédito"* está muy tenue. Si es una validación o regla de negocio importante, dale un tono con mejor legibilidad o muéstralo como una advertencia cuando el modo de pago sea "A crédito".

### Propuesta de Disposición Recomendada (Wireframe Lógico)

Plaintext

```
+-----------------------------------------------------------------------------------+
| Crear venta                                                                     X |
+-----------------------------------------------------------------------------------+
| ARTÍCULOS                                                                         |
| Artículo                           | Cant. | Precio Unit. | Subtotal   |          |
| [ Seleccionar artículo...      v ] | [ 1 ] | $ 30.000     | $ 30.000   |   [🗑]   |
| [ Seleccionar artículo...      v ] | [ 1 ] | $ 60.000     | $ 60.000   |   [🗑]   |
| [ Seleccionar artículo...      v ] | [ 1 ] | $ 40.000     | $ 40.000   |   [🗑]   |
|                                                                                   |
| + Agregar artículo    | + Crear nuevo artículo                                   |
+-----------------------------------------------------------------------------------+
| DATOS DE PAGO Y CLIENTE                                                           |
| Modo de pago           | Cuenta                 | Cliente                         |
| [ A crédito        v ] | [ BBVA             v ] | [ Cliente general           v ] |
|                                                 | + Crear cliente                 |
|                                                                                   |
| Pago inicial (COP)     | Fecha                                                    |
| [ 0                ]   | [ 23/09/2026       📅 ]                                  |
+-----------------------------------------------------------------------------------+
|                                                 TOTAL: $ 130.000 COP              |
|                                         [ Cancelar ]  [ guardar / Crear venta ]   |
+-----------------------------------------------------------------------------------+
```

