# TwinCap
## Auditoría post-Ronda 15 y plan de cierre R15.1

**Estado evaluado:** repositorio post-R15  
**Objetivo:** cerrar la integridad funcional, financiera y de concurrencia antes de iniciar la ronda UX/UI.

---

# 1. Resumen ejecutivo

La Ronda 15 representa un progreso técnico real y significativo en TwinCap.

La arquitectura transaccional, los mecanismos CAS (`__v`) para deudas, la protección de transferencias concurrentes, el rollback mediante MongoDB Transactions y las pruebas de concurrencia constituyen una base sólida para una aplicación financiera multiusuario.

La auditoría post-R15 no justifica una nueva ronda arquitectónica ni una reescritura de los mecanismos implementados.

Sin embargo, todavía existen algunos puntos que deben cerrarse antes de declarar la **integridad financiera suficientemente estable para entrar en UX/UI**.

Los hallazgos principales son:

1. `updateTransfer` conserva un patrón `Promise.all()` sobre operaciones que utilizan la misma sesión MongoDB, mientras R15 ya demostró que ese patrón puede provocar `NoSuchTransaction`.
2. La defensa contra movimientos huérfanos no cubre completamente todos los `link.kind` actuales.
3. Existe una ventana conceptual entre eliminación de agregados y creación concurrente de movimientos vinculados.
4. La reconciliación legacy basada en `accountId + fecha + amount` puede producir falsos positivos si no se restringe adecuadamente.
5. La política de saldos negativos debe formalizarse como regla de producto: TwinCap registra la operación aunque produzca saldo negativo; advierte, pero no bloquea.
6. El modelo de transferencias multidivisa debe cambiar para que el usuario introduzca los dos importes reales —origen y destino— y TwinCap derive la tasa efectiva.
7. La idempotencia y algunas tolerancias legacy requieren un último endurecimiento, aunque no constituyen bloqueadores de UX/UI por sí solas.

Con las decisiones funcionales tomadas durante esta revisión, recomiendo una **R15.1 acotada**, no una nueva ronda general.

El objetivo de R15.1 debe ser:

> **cerrar las invariantes financieras y de concurrencia restantes sin introducir complejidad innecesaria ni bloquear la intención legítima del usuario.**

---

# 2. Principio rector de TwinCap

A partir de esta auditoría queda definida una distinción fundamental:

## Integridad ≠ restricción

TwinCap debe garantizar que:

- los movimientos sean atómicos;
- los saldos sean reproducibles;
- las transferencias sean consistentes;
- las relaciones entre agregados y movimientos sean coherentes;
- las operaciones concurrentes no corrompan el estado;
- los importes monetarios sean matemáticamente consistentes;
- cada operación pertenezca al tenant correcto;
- las operaciones repetidas accidentalmente no dupliquen efectos.

Pero TwinCap **no debe asumir el papel de banco ni decidir que una operación real del usuario es inválida solamente porque produzca un saldo negativo**.

Por tanto:

> **TwinCap registra la realidad financiera declarada por el usuario.**

La aplicación puede advertir, analizar y recomendar.

No debe impedir automáticamente una operación solamente porque el saldo registrado resulte insuficiente.

Esta decisión es además coherente con la visión estratégica de TwinCap como una capa de **inteligencia financiera accionable**, no como un simple formulario de restricciones.

---

# 3. Clasificación global de hallazgos

| Prioridad | Hallazgo | Estado |
|---|---|---|
| P0 | Corrupción financiera generalizada | 🟢 No encontrada |
| P0 | Violación general de aislamiento multi-tenant | 🟢 No encontrada |
| P0 | Fallo estructural del sistema transaccional | 🟢 No encontrado |
| P1 | `updateTransfer` + `Promise.all` con sesión Mongo | 🔴 Corregir |
| P1 | Cobertura incompleta de movimientos vinculados | 🔴 Corregir |
| P1 | Carrera creación/eliminación de movimientos vinculados | 🔴 Corregir/replantear |
| P1 | Modelo multidivisa | 🔴 Redefinir |
| P1/P2 | Reconciliación legacy por valor | 🟠 Endurecer |
| P2 | Idempotency key opcional desde backend | 🟡 Endurecer |
| P2 | Agregado actualizado cuando falta movimiento hijo | 🟡 Endurecer |
| P2 | Manejo posterior al commit/idempotencia | 🟡 Revisar |
| P3 | Mejoras de observabilidad/documentación | 🟢 Documentar |

---

# 4. Hallazgos P0

## P0.1 — No se identifica actualmente un bloqueador P0

La R15 corrigió problemas que anteriormente podían comprometer la consistencia bajo concurrencia.

Se encuentran correctamente encaminados:

- MongoDB Transactions;
- `UnitOfWork`;
- rollback;
- CAS mediante `__v`;
- concurrencia de abonos;
- concurrencia de transferencias sobre la misma cuenta origen;
- actualización de inventario;
- operaciones de venta;
- onboarding transaccional.

La evidencia de las pruebas de R15 reporta resultados completos para la suite existente.

### Conclusión

**No recomiendo abrir ningún trabajo P0 adicional antes de UX/UI.**

---

# 5. Hallazgo P1 — `updateTransfer` conserva el antipatrón descubierto en R15

## Problema

`createTransfer` fue correctamente corregido para evitar operaciones concurrentes sobre la misma `ClientSession`.

Sin embargo, `updateTransfer` mantiene el patrón equivalente:

```text
Promise.all([
    accountRepo.findById(..., tx),
    accountRepo.findById(..., tx)
])
```

Esto es problemático porque ambas operaciones comparten una misma sesión/transacción MongoDB.

R15 ya demostró que este patrón puede provocar:

```text
NoSuchTransaction
TransientTransactionError
```

y retries innecesarios.

## Acción R15.1

Reemplazar las lecturas paralelas dentro de una misma sesión transaccional por lecturas secuenciales:

```text
find source
      ↓
find destination
      ↓
validaciones
      ↓
actualizaciones
      ↓
commit
```

No se debe usar `Promise.all()` sobre operaciones MongoDB que compartan la misma sesión transaccional salvo que se haya demostrado explícitamente que el driver y el patrón utilizado lo soportan de manera segura.

## Criterio de cierre

Debe existir un test real con MongoDB:

- `updateTransfer` dentro de transaction;
- source y destination distintos;
- múltiples ejecuciones;
- cero `NoSuchTransaction`;
- rollback correcto ante error.

**Prioridad: P1 — obligatoria.**

---

# 6. Hallazgo P1 — movimientos vinculados incompletamente protegidos

La capa de protección/reconciliación de movimientos contempla varios tipos:

- `opening`
- `transfer`
- `creditReceivedPrincipal`
- `creditReceivedAbono`
- `creditGrantedPrincipal`
- `creditGrantedAbono`
- `salePayment`
- `payableInitialPayment`
- `payableAbono`

Pero existen tipos adicionales relacionados con créditos otorgados:

- `creditGrantedAbonoInterest`
- `creditGrantedWriteOff`

Estos deben formar parte explícita de la misma clasificación de movimientos vinculados.

## Riesgo

Un movimiento vinculado a un crédito puede quedar fuera de:

- filtros de movimientos vivos;
- reconciliación;
- detección de huérfanos;
- mecanismos de limpieza.

Esto es especialmente relevante para `creditGrantedAbonoInterest`, porque representa un efecto financiero real.

## Acción R15.1

Crear una fuente única de verdad para los tipos de vínculo.

Idealmente:

```text
MovementLinkKind
```

debe ser reutilizado por:

- creación de movimientos;
- eliminación;
- `filter-live-linked-movements`;
- reconciliación;
- tests.

No mantener listas independientes que puedan divergir.

## Criterio de cierre

Cada `link.kind` existente debe estar clasificado en una única matriz:

```text
kind
→ agregado propietario
→ condición de vida
→ estrategia de eliminación
→ estrategia de reconciliación
```

Y debe existir al menos un test de huérfano por familia relevante.

**Prioridad: P1.**

---

# 7. Hallazgo P1 — carrera entre eliminación y creación de movimientos

Existe una vulnerabilidad conceptual en operaciones del tipo:

```text
eliminar agregado
    ↓
buscar/eliminar movimientos hijos
    ↓
eliminar agregado
```

frente a:

```text
crear movimiento hijo
    ↓
actualizar agregado
```

concurrentemente.

## Ejemplo

Una operación intenta eliminar un crédito mientras otra registra simultáneamente un abono.

Si la eliminación obtiene un conjunto de movimientos antes de que el segundo proceso cree el nuevo movimiento, puede producirse una situación donde:

```text
CreditGranted = eliminado

Movement vinculado = permanece
```

## Acción R15.1

No solucionar esto simplemente añadiendo más filtros.

Debe definirse una estrategia de consistencia.

La opción recomendada es:

### Para datos modernos

Las operaciones que crean movimientos vinculados y modifican su agregado deben estar dentro de la misma transacción.

### Para eliminaciones

La eliminación del agregado y la eliminación de sus movimientos deben formar parte de la misma unidad transaccional.

### Para datos legacy

Mantener reconciliación defensiva.

## Criterio de cierre

Probar concurrencia:

```text
deleteCreditGranted × addAbono
deleteCreditReceived × addAbono
deletePayable × addAbono
```

Resultado esperado:

- no corrupción;
- no movimientos huérfanos;
- no agregados parcialmente actualizados;
- rollback completo cuando corresponda.

**Prioridad: P1.**

---

# 8. Hallazgo P1/P2 — reconciliación legacy por valor

Existe un mecanismo para localizar movimientos históricos cuando el `refId` no coincide exactamente, utilizando información como:

```text
accountId
date
amount
```

Esto es útil para compatibilidad con datos legacy.

Pero existe un riesgo de falso positivo.

## Ejemplo

Dos movimientos distintos podrían compartir:

```text
misma cuenta
misma fecha
mismo importe
```

y uno podría ser confundido con el otro.

## Regla recomendada

El fallback legacy:

1. debe utilizarse únicamente cuando exista evidencia clara de que el registro pertenece al esquema legacy;
2. debe exigir una coincidencia inequívoca;
3. si existen múltiples candidatos, no debe reconciliar automáticamente;
4. debe marcar el caso como ambiguo para revisión/reconciliación posterior.

Nunca debe convertir una coincidencia aproximada en una certeza financiera.

**Prioridad: P1/P2.**

---

# 9. Hallazgo P1 — transferencias multidivisa

Este punto queda redefinido por la decisión funcional tomada.

El modelo anterior no debe obligar al usuario a introducir una tasa de cambio.

## Regla definitiva

El usuario introduce:

```text
Monto de origen
+
Monto de destino
```

TwinCap calcula:

```text
Tasa efectiva
```

## Ejemplo

Usuario registra:

```text
Nequi
190.000 COP

IQ Option
50 USD
```

TwinCap calcula:

```text
3.800 COP/USD
```

Y muestra:

> 1 USD = 3.800 COP  
> Costo efectivo de adquisición: 3.800 COP/USD.

## Modelo conceptual

```text
sourceAccount
sourceCurrency
sourceAmount

destinationAccount
destinationCurrency
destinationAmount

        ↓

effectiveExchangeRate
```

La tasa es un dato derivado.

Los dos importes introducidos por el usuario representan la realidad financiera primaria.

## Ventaja

El usuario no necesita conocer ni calcular el tipo de cambio.

TwinCap transforma:

> "Pagué 190.000 y recibí 50 dólares"

en:

> "Cada dólar me costó efectivamente 3.800 pesos."

Esto encaja directamente con la visión de TwinCap.

## Regla matemática

Para monedas diferentes debe existir una función determinista que derive la tasa a partir de los importes monetarios almacenados en unidades menores.

No se deben utilizar `float` para representar dinero.

## Criterio de cierre

Debe existir una única función de dominio responsable de:

- validar importes;
- calcular tasa efectiva;
- manejar exponentes de moneda;
- mantener precisión;
- evitar divisiones inválidas;
- producir un resultado reproducible.

Debe utilizarse tanto al:

- crear transferencia;
- editar transferencia;
- mostrar información derivada.

**Prioridad: P1.**

---

# 10. Comisiones y costos de conversión

R15.1 no necesariamente necesita implementar un sistema completo de comisiones.

Pero el modelo de transferencia debe **no impedirlo en el futuro**.

Ejemplo:

```text
Usuario recibe:
50 USD

Sale de su cuenta:
195.000 COP

Costo real:
190.000 COP
Comisión:
5.000 COP
```

No se debe diseñar ahora una estructura que obligue a tratar esos 195.000 COP como si fueran exclusivamente el precio de los 50 USD.

## Recomendación

Dejar preparada la semántica para incorporar posteriormente:

```text
conversion amount
+
fees
+
effective cost
```

sin alterar el concepto fundamental de transferencia.

Esto puede quedar como P2/P3 si actualmente no existe soporte de comisiones.

---

# 11. Política definitiva de fondos insuficientes

Este punto queda establecido como regla funcional.

## TwinCap NO debe bloquear una operación simplemente porque el saldo sea insuficiente.

Ejemplo:

```text
Saldo:
100.000 COP

Gasto:
150.000 COP
```

Debe poder registrarse:

```text
Nuevo saldo:
-50.000 COP
```

## ¿Por qué?

Porque TwinCap registra la realidad financiera del usuario.

Un saldo negativo puede representar:

- sobregiro;
- tarjeta;
- dinero prestado;
- operación aún no conciliada;
- saldo incompleto;
- gasto que realmente ocurrió;
- cualquier otra situación financiera real.

TwinCap no debe asumir que:

```text
saldo registrado < operación
```

significa:

```text
operación imposible.
```

## Comportamiento recomendado

Antes de registrar:

> ⚠️ El saldo registrado de esta cuenta no cubre esta operación. Si continúas, el saldo quedará en -$50.000.

Opciones:

**Registrar de todas formas**

**Cancelar**

La advertencia es una función de información, no una barrera.

---

# 12. Concurrencia y fondos insuficientes

Esta decisión elimina una complejidad innecesaria.

No necesitamos coordinar todas las operaciones financieras con el único objetivo de impedir saldos negativos.

El objetivo de concurrencia debe ser:

> **registrar correctamente las operaciones concurrentes.**

No:

> **impedir estados negativos.**

Por tanto, un saldo negativo resultante de operaciones legítimas no es corrupción.

### Ejemplo

```text
Cuenta = 100.000

Gasto A = 80.000
Gasto B = 80.000
```

Resultado:

```text
-60.000
```

Eso puede ser perfectamente válido si ambas operaciones fueron confirmadas.

La integridad consiste en que TwinCap no pierda, duplique ni invente ninguna de ellas.

---

# 13. Transferencias y fondos insuficientes

Para transferencias se mantiene la misma filosofía.

Si:

```text
Cuenta origen:
100.000 COP

Transferencia:
150.000 COP
```

TwinCap puede advertir:

> ⚠️ La cuenta origen quedará en -$50.000 COP.

Pero no debe impedir necesariamente la operación.

Esto significa que el mecanismo CAS de cuentas no debe interpretarse automáticamente como:

> "bloqueador universal de saldo negativo".

Su función principal es evitar que dos operaciones concurrentes sobrescriban incorrectamente el estado de la cuenta.

---

# 14. Hallazgo P2 — idempotencia opcional

El backend actualmente permite que algunas operaciones sean ejecutadas sin `idempotencyKey`.

Para una aplicación financiera, la dirección futura recomendada es:

```text
operaciones mutantes críticas
        ↓
idempotencyKey obligatorio
```

especialmente:

- transferencias;
- movimientos;
- ventas;
- pagos;
- créditos;
- operaciones equivalentes.

## Objetivo

Un retry de red no debe convertir:

```text
1 operación
```

en:

```text
2 operaciones.
```

### Prioridad

P2.

No constituye motivo para retrasar significativamente UX/UI si las rutas actuales ya están protegidas correctamente en los flujos normales.

---

# 15. Hallazgo P2 — agregado actualizado sin movimiento hijo

En algunas operaciones de edición, el sistema tolera que el movimiento principal no exista y continúa actualizando el agregado.

Esto probablemente nació como compatibilidad con datos legacy.

Sin embargo, para datos modernos la relación debería ser estricta.

## Regla recomendada

Para registros modernos:

```text
Agregado financiero
+
movimiento requerido
```

deben considerarse una sola unidad.

Si falta el movimiento:

```text
Conflict / IntegrityError
→ rollback
```

No:

```text
actualizar agregado
→ ignorar ausencia
```

## Legacy

Los registros legacy pueden seguir utilizando rutas de reparación/reconciliación.

**Prioridad: P2.**

---

# 16. Hallazgo P2 — idempotencia posterior al commit

Debe revisarse cuidadosamente el ciclo:

```text
claim idempotency
       ↓
transaction
       ↓
commit
       ↓
post-processing
```

Una operación financiera que ya hizo commit no debe ser considerada fallida simplemente porque falle una actividad posterior no financiera.

Especialmente:

- `revalidatePath`;
- analytics;
- telemetría;
- efectos secundarios de UI.

La regla debe ser:

> **una vez confirmado el commit financiero, ningún fallo accesorio debe provocar que el retry pueda repetir el efecto financiero.**

**Prioridad: P2.**

---

# 17. Hallazgos P3 / menores

Estos puntos no deberían bloquear UX/UI:

### P3.1 — documentación de invariantes

Cada agregado financiero debería documentar:

- qué representa;
- qué movimientos puede producir;
- qué movimiento es obligatorio;
- qué operaciones son transaccionales;
- qué ocurre al eliminarlo;
- qué pasa con datos legacy.

### P3.2 — observabilidad

Los eventos de integridad deberían poder distinguir:

```text
legacy repaired
legacy ambiguous
orphan detected
CAS conflict
transaction retry
idempotency replay
negative balance warning
```

Esto será especialmente útil durante beta.

### P3.3 — métricas

Posteriormente sería útil medir:

- operaciones rechazadas por errores técnicos;
- conflictos CAS;
- retries de transaction;
- movimientos huérfanos detectados;
- saldos negativos;
- transferencias multidivisa;
- tasas efectivas.

Esto conecta directamente con la futura capa de inteligencia financiera.

---

# 18. R15.1 — plan técnico propuesto

La R15.1 debe ser una ronda de cierre, no una nueva ronda de arquitectura.

## Fase 1 — Transaction Safety

### Objetivo

Eliminar cualquier uso inseguro de operaciones paralelas dentro de una misma sesión MongoDB.

### Tareas

- revisar `updateTransfer`;
- buscar otros `Promise.all()` dentro de transacciones;
- separar operaciones paralelas de operaciones que comparten `ClientSession`;
- añadir tests reales.

### Criterio de cierre

No existen operaciones concurrentes inseguras sobre una misma sesión transaccional.

---

# 19. Fase 2 — Movement Integrity

### Objetivo

Convertir la relación:

```text
Agregado ↔ Movimiento
```

en una relación explícita y verificable.

### Tareas

Crear/centralizar:

```text
MovementLinkKind
```

Cubrir todos los tipos actuales.

Especialmente:

```text
creditGrantedAbonoInterest
creditGrantedWriteOff
```

Actualizar:

- filtros;
- reconciliador;
- eliminaciones;
- tests;
- utilidades.

### Criterio de cierre

Todos los tipos de movimiento tienen:

```text
owner
lifecycle
cleanup strategy
reconciliation strategy
```

claramente definidos.

---

# 20. Fase 3 — Concurrencia de eliminación

### Objetivo

Cerrar carreras entre:

```text
delete aggregate
```

y:

```text
create/update linked movement
```

### Tareas

Probar:

```text
deleteCreditReceived × addAbono
deleteCreditGranted × addAbono
deletePayable × addAbono
deleteAccount × createMovement
deleteSale × sale/payment
```

### Criterio de cierre

Ninguna combinación concurrente puede terminar con:

```text
aggregate inexistente
+
movement huérfano moderno
```

ni con un agregado parcialmente modificado.

---

# 21. Fase 4 — Transferencias multidivisa

### Objetivo

Adoptar definitivamente el modelo:

```text
importe origen
+
importe destino
→
tasa efectiva calculada
```

### Tareas

Modificar:

- contrato de dominio;
- use case;
- validaciones;
- persistencia;
- create;
- update;
- UI futura;
- tests.

### Reglas

1. Usuario introduce monto origen.
2. Usuario introduce monto destino.
3. TwinCap calcula tasa efectiva.
4. La tasa se guarda como dato derivado.
5. El cálculo usa precisión monetaria segura.
6. No se utiliza `float` para dinero.
7. La tasa debe poder reproducirse desde los importes almacenados.
8. En monedas iguales, la tasa efectiva es 1.
9. Una tasa no puede calcularse si el monto destino es inválido/cero.
10. Editar una transferencia debe recalcular la tasa.

---

# 22. Fase 5 — Reglas de saldo negativo

### Objetivo

Formalizar la decisión de producto.

### Regla

```text
Saldo insuficiente ≠ operación inválida
```

### Comportamiento

```text
saldo suficiente
→ registrar

saldo insuficiente
→ advertir
→ usuario decide
→ registrar si confirma
```

### Nunca

```text
saldo insuficiente
→ rechazo automático
```

salvo que en el futuro aparezca una regla específica de negocio que lo justifique.

---

# 23. Fase 6 — Hardening

### Tareas

- revisar obligatoriedad de idempotency key;
- revisar post-commit;
- endurecer agregados sin movimientos;
- revisar reconciliación legacy;
- diferenciar datos modernos de datos legacy;
- completar tests.

### Criterio

Las tolerancias legacy no deben convertirse en comportamiento normal para datos nuevos.

---

# 24. Matriz de pruebas R15.1

La suite no debe crecer indiscriminadamente.

Debe concentrarse en invariantes.

## Transferencias

```text
transfer × transfer
updateTransfer × updateTransfer
transfer × updateTransfer
transfer multidivisa
transfer misma moneda
```

## Saldos negativos

```text
gasto > saldo
transferencia > saldo
múltiples gastos concurrentes
múltiples operaciones que producen saldo negativo
```

Resultado esperado:

> las operaciones se registran correctamente.

## Eliminaciones

```text
delete × add
delete × update
delete × delete
```

## Créditos

```text
abono
abono concurrente
interés
write-off
eliminación
```

## Legacy

```text
refId exacto
refId incorrecto
fallback único
fallback ambiguo
movimiento realmente huérfano
```

## Idempotencia

```text
same key × retry
same key concurrente
different key
commit + post-processing failure
```

---

# 25. Invariantes que deben quedar documentadas

Después de R15.1 TwinCap debería poder declarar formalmente:

## I1 — Atomicidad

Una operación financiera confirmada produce todos sus efectos o ninguno.

## I2 — Concurrencia

Dos operaciones concurrentes no pueden sobrescribir silenciosamente el estado financiero de la otra.

## I3 — CAS

Las entidades versionadas que requieren exclusión optimista deben utilizar `__v`.

## I4 — Movimientos

Un movimiento moderno vinculado no puede existir sin su agregado propietario.

## I5 — Saldos

Un saldo negativo es un estado financiero válido y no constituye por sí mismo corrupción.

## I6 — Fondos insuficientes

La falta de saldo genera advertencia, no bloqueo automático.

## I7 — Transferencia multidivisa

Los importes de origen y destino son datos primarios; la tasa efectiva es derivada.

## I8 — Precisión

Los valores monetarios se almacenan y calculan sin errores propios de `floating point`.

## I9 — Idempotencia

Un retry de una operación crítica no debe duplicar su efecto financiero.

## I10 — Tenant isolation

Ninguna operación puede modificar datos pertenecientes a otro tenant.

## I11 — Legacy

Los mecanismos de compatibilidad no deben introducir falsos vínculos ni ocultar inconsistencias ambiguas.

## I12 — Auditabilidad

Una operación financiera debe poder explicarse posteriormente a partir de sus datos persistidos.

---

# 26. Reglas de dominio que UX/UI debe recibir

La ronda UX/UI no debe redefinir estas reglas.

Debe diseñarse alrededor de ellas.

## Regla UX-01

Nunca presentar:

> "No puedes hacer esta operación porque no tienes saldo."

como comportamiento predeterminado.

Debe utilizarse:

> "Tu saldo registrado no cubre esta operación."

y permitir continuar.

---

## Regla UX-02

Cuando una operación produzca saldo negativo, mostrar claramente el resultado.

Ejemplo:

```text
Saldo actual     $100.000
Operación        -$150.000
────────────────────────
Nuevo saldo      -$50.000
```

La interfaz debe hacer visible la consecuencia.

---

## Regla UX-03

En transferencias multidivisa, no pedir la tasa al usuario.

Mostrar:

```text
De:
Nequi — COP

Monto:
190.000 COP

A:
IQ Option — USD

Recibes:
50 USD
```

Después:

```text
Tasa efectiva
1 USD = 3.800 COP
```

---

## Regla UX-04

La tasa efectiva debe expresarse de forma comprensible.

No solamente:

```text
exchangeRate: 3800
```

sino:

> **Cada USD te costó $3.800 COP.**

Esto convierte un dato técnico en información financiera útil.

---

## Regla UX-05

La UI debe diferenciar:

- importe;
- saldo;
- advertencia;
- error técnico;
- error de validación;
- conflicto de concurrencia.

Un saldo negativo no es un error técnico.

---

# 27. Base para la futura inteligencia financiera

Estas decisiones preparan una ventaja estratégica para TwinCap.

Si el sistema conserva:

```text
importe origen
importe destino
tasa efectiva
fecha
cuenta origen
cuenta destino
```

posteriormente podrá responder:

> "La última vez adquiriste USD a $3.800."

> "Este mes tu costo promedio de adquisición fue $3.850/USD."

> "Pagaste un 3,2 % más por USD que tu promedio histórico."

Y con los saldos:

> "Esta cuenta terminó negativa 3 veces durante el último mes."

> "Tus gastos están generando déficits recurrentes."

Esto es precisamente el tipo de evolución que diferencia a TwinCap de una aplicación que simplemente almacena movimientos.

---

# 28. Qué NO debe hacerse en R15.1

Para mantener el alcance controlado:

### No

- reescribir la arquitectura hexagonal;
- reemplazar MongoDB Transactions;
- rehacer todos los use cases;
- introducir event sourcing;
- introducir CQRS;
- bloquear saldos negativos;
- obligar al usuario a introducir tasas de cambio;
- construir todavía el sistema completo de inteligencia financiera;
- rediseñar la UI;
- hacer una nueva auditoría general de todo el backend sin motivo.

R15.1 debe ser quirúrgica.

---

# 29. Criterio definitivo de salida de R15.1

TwinCap estará listo para UX/UI cuando se cumpla:

### Backend

- [ ] `updateTransfer` sin uso inseguro de `Promise.all()` sobre la misma sesión.
- [ ] Todos los `link.kind` están centralizados.
- [ ] No existen tipos de movimientos vinculados sin estrategia de lifecycle.
- [ ] Carreras delete/create probadas.
- [ ] Reconciliación legacy endurecida.
- [ ] Transferencias multidivisa utilizan origen + destino.
- [ ] Tasa efectiva derivada determinísticamente.
- [ ] Precisión monetaria garantizada.
- [ ] Saldos negativos permitidos.
- [ ] Fondos insuficientes no bloquean automáticamente.
- [ ] Advertencia funcional disponible.
- [ ] Idempotencia verificada.
- [ ] Post-commit seguro.
- [ ] Agregados modernos no pueden quedar silenciosamente sin movimientos obligatorios.

### Tests

- [ ] Suite existente verde.
- [ ] Concurrencia real verde.
- [ ] Tests multidivisa verdes.
- [ ] Tests de saldo negativo verdes.
- [ ] Tests de eliminación concurrente verdes.
- [ ] Tests de reconciliación legacy verdes.
- [ ] Tests de idempotencia verdes.

---

# 30. Veredicto final

## R15

**🟢 APROBADA**

La ronda consiguió mejoras reales en las áreas que pretendía resolver.

No hay fundamento para reabrir toda la arquitectura.

## R15.1

**🔴 NECESARIA, pero acotada.**

Debe cerrar:

1. seguridad transaccional de `updateTransfer`;
2. integridad completa de movimientos vinculados;
3. concurrencia eliminación/creación;
4. nuevo modelo de transferencias multidivisa;
5. política explícita de saldos negativos;
6. endurecimiento legacy/idempotencia.

## Después de R15.1

El estado recomendado será:

```text
R14
  ↓
R15
  ↓
R15.1
  ↓
AUDITORÍA FINAL DE INTEGRIDAD
  ↓
🟢 INTEGRIDAD CERRADA
  ↓
UX/UI
  ↓
BETA
```

La UX/UI debe partir de un dominio ya estabilizado, no modificarlo.

---

# 31. Principio estratégico final

La decisión más importante de esta auditoría no es técnica.

Es conceptual:

> **TwinCap no debe decirle al usuario cómo debería ser su situación financiera. Debe registrar fielmente cómo es, explicársela y ayudarlo a tomar mejores decisiones.**

Por eso:

**Saldo negativo → se registra.**

**Fondos insuficientes → se advierte.**

**Transferencia multidivisa → el usuario indica cuánto salió y cuánto recibió.**

**Tasa → TwinCap la calcula.**

**Integridad → TwinCap garantiza que todo quede coherente.**

**Inteligencia → TwinCap interpreta posteriormente esos datos.**

Ese conjunto de reglas proporciona una base mucho más limpia para entrar a UX/UI y, sobre todo, evita que la interfaz termine intentando compensar inconsistencias o ambigüedades del dominio.

**Mi recomendación final es ejecutar R15.1 con este alcance y no iniciar todavía la ronda UX/UI. Una vez pasada la auditoría de cierre de R15.1, sí considero razonable congelar las reglas financieras y comenzar la ronda UX/UI.**