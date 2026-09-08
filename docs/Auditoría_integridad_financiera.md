Sí. Lo convertiría en una **mini-ronda técnica específica**, no en una ronda general de refactor. La prioridad debe ser cerrar primero la integridad financiera y luego endurecer concurrencia.

# Plan técnico — Atomicidad y Concurrencia Financiera

## Objetivo de cierre

Al finalizar este plan, debe poder garantizarse:

> **Una operación financiera que conceptualmente representa una sola acción no puede quedar parcialmente aplicada, duplicarse por concurrencia ni producir saldos/deudas/inventario inconsistentes aunque falle una escritura o lleguen solicitudes simultáneas.**

La estrategia debe reutilizar la infraestructura que ya existe en R14:

```text
Server Action
    ↓
Application Use Case
    ↓
UnitOfWork
    ↓
MongoTransaction
    ↓
Repositories
```

**No recomiendo reescribir la arquitectura.**

---

# Fase 1 — Inventario completo de operaciones multi-documento

### Objetivo

Antes de modificar código, identificar **todas** las operaciones que modifican dos o más documentos relacionados.

### Operaciones a auditar

| Operación                      | Documentos implicados                   | Riesgo              |
| ------------------------------ | --------------------------------------- | ------------------- |
| Crear transferencia            | Transfer + 2 Movements                  | 🟢 Ya transaccional |
| Crear venta contado            | Sale + Movement + stock                 | 🟢 Ya transaccional |
| Crear venta crédito            | Sale + Movement + CreditGranted + stock | 🟢 Ya transaccional |
| Crear crédito recibido         | CreditReceived + Movement               | 🔴                  |
| Crear crédito otorgado         | CreditGranted + Movement                | 🔴                  |
| Crear payable                  | Payable + Movement                      | 🔴                  |
| Crear cuenta con saldo inicial | Account + Movement                      | 🟠                  |
| Abono crédito recibido         | Abono + Movement + estado crédito       | 🔴                  |
| Abono crédito otorgado         | Abono + Movement + estado crédito       | 🔴                  |
| Abono payable                  | Abono + Movement + estado payable       | 🔴                  |
| Abono venta a crédito          | Abono + Movement + estado venta/crédito | 🔴                  |
| Write-off                      | Movement + CreditGranted state          | 🔴                  |
| Editar transferencia           | Transfer + 2 Movements                  | 🔴                  |
| Editar abono                   | Abono + Movement + aggregate state      | 🔴                  |
| Eliminar venta                 | Sale + stock + Movement + Credit        | 🔴/🟠               |
| Registro/onboarding            | User + Workspace + Membership + seed    | 🟠                  |

### Criterio de cierre

Debe existir una matriz documentada donde **cada operación multi-documento tenga una decisión explícita**:

* transacción;
* operación atómica de Mongo;
* compensación;
* o justificación documentada de por qué no la necesita.

**No debe quedar ninguna operación multi-documento "sin decidir".**

---

# Fase 2 — Transaccionalizar créditos y payables

Esta sería la primera implementación real.

## 2.1 Crear crédito recibido

Actualmente:

```text
create CreditReceived
        ↓
create Movement
```

Debe pasar a:

```text
UnitOfWork
 ├─ create CreditReceived
 └─ create Movement
COMMIT
```

Si falla cualquiera:

```text
ROLLBACK
```

### Riesgo eliminado

Crédito existente sin movimiento.

### Criterio de cierre

Pruebas:

1. éxito → ambos documentos existen;
2. fallo del movimiento → ninguno existe;
3. fallo del crédito → ninguno existe;
4. retry → no duplica;
5. rollback real contra `MongoMemoryReplSet`.

---

## 2.2 Crear crédito otorgado

Misma estrategia:

```text
Transaction
 ├─ CreditGranted
 └─ Movement
```

### Criterio de cierre

Mismos cinco escenarios anteriores.

---

## 2.3 Crear payable

```text
Transaction
 ├─ Payable
 └─ Movement
```

Especial atención al caso:

> payable creado + pago inicial.

Todo debe quedar dentro de **una única transacción**.

---

# Fase 3 — Transaccionalizar abonos

Esta es, para mí, la **fase más importante de todo el plan**.

Un abono no es simplemente:

```text
crear abono
```

Conceptualmente es:

```text
registrar pago
+
crear movimiento
+
actualizar saldo/deuda
+
actualizar estado
```

Por tanto debe ser una unidad indivisible.

---

## 3.1 CreditReceived.addAbono

Debe convertirse en:

```text
transaction
 ├─ validar deuda
 ├─ registrar abono
 ├─ actualizar deuda
 └─ crear movement
commit
```

No debe existir un estado intermedio visible.

### Criterio de cierre

Si falla cualquiera de las operaciones:

```text
abono = NO
movement = NO
deuda = estado anterior
```

---

# 4. Protección contra doble abono concurrente

Este es el segundo gran objetivo.

Supongamos:

```text
Deuda = $100.000
```

Llegan simultáneamente:

```text
A → $70.000
B → $70.000
```

El sistema debe garantizar que **no puedan aprobarse ambos**.

No confiaría únicamente en:

```text
leer pending
if amount <= pending
```

porque eso tiene race condition.

---

## Estrategia recomendada

Dentro de la transacción:

```text
leer aggregate
↓
calcular nuevo saldo
↓
actualizar usando condición/versionado
```

Idealmente utilizar:

### Optimistic concurrency

Agregar/usar un:

```text
version
```

o condición equivalente.

Ejemplo conceptual:

```text
UPDATE credit
WHERE _id = X
AND version = 12
```

Si otro request ya modificó el crédito:

```text
modifiedCount = 0
```

→ abortar transacción.

---

## Resultado

Dos solicitudes simultáneas:

```text
A → version 12 → OK → version 13
B → version 12 → FAIL
```

El segundo request debe recibir un error recuperable tipo:

> "La deuda fue modificada por otra operación. Actualiza la información e inténtalo nuevamente."

### Criterio de cierre

Prueba concurrente real:

```text
100 solicitudes simultáneas
```

sobre una deuda con saldo limitado.

Debe cumplirse:

```text
saldo >= 0
total_abonos <= deuda_original + intereses válidos
```

y:

```text
exactamente las operaciones permitidas
```

son aceptadas.

---

# 5. Aplicar la misma protección a los cuatro tipos de deuda

No resolver solamente `CreditReceived`.

Debe existir un mecanismo reutilizable para:

### A

```text
CreditReceived
```

### B

```text
CreditGranted
```

### C

```text
Payable
```

### D

```text
Sale / SaleCredit
```

La implementación puede compartir infraestructura, pero **cada agregado debe conservar su semántica financiera propia**.

---

# 6. Write-off

Actualmente:

```text
create expense movement
        ↓
mark credit written-off
```

Debe ser:

```text
Transaction
 ├─ create write-off movement
 └─ mark credit written-off
COMMIT
```

Y debe ser imposible:

```text
movement exists
+
credit still active
```

por un fallo intermedio.

### Criterio de cierre

Probar:

* éxito;
* fallo antes del movimiento;
* fallo al actualizar crédito;
* retry;
* concurrencia write-off + abono.

Especialmente:

```text
Abono
   VS
Write-off
```

simultáneos.

Solo una operación debe ganar de acuerdo con la versión/estado del agregado.

---

# 7. Editar transferencia

Esta merece su propia corrección.

Actualmente conceptualmente:

```text
Transfer
Movement A
Movement B
```

deben actualizarse juntos.

Convertir:

```text
updateTransfer()
```

en:

```text
UnitOfWork
 ├─ update Transfer
 ├─ update Movement expense
 └─ update Movement income
COMMIT
```

### Criterio de cierre

Nunca puede existir:

```text
Transfer amount = $500
Movement A = $500
Movement B = $400
```

ni después de un error.

---

# 8. Editar abonos

Mismo principio.

```text
update Abono
update Movement
update aggregate
```

debe ser una unidad.

Además:

### No permitir edición que viole el saldo

Ejemplo:

```text
deuda = 100.000
abono existente = 40.000
```

No debe ser posible editarlo a:

```text
120.000
```

si no existe saldo suficiente.

Y esa validación debe ocurrir **dentro de la operación protegida por concurrencia**, no solamente antes.

---

# 9. Delete Sale + inventario

Aquí propondría una solución ligeramente distinta.

La operación debe ser:

```text
Transaction
 ├─ restore stock
 ├─ delete related movement
 ├─ delete related credit
 └─ delete sale
COMMIT
```

Pero además necesitamos protegernos contra:

```text
deleteSale()
```

ejecutándose dos veces.

La operación debe ser idempotente.

Por ejemplo:

```text
sale exists
    ↓
restore stock once
    ↓
delete sale
```

El segundo request debe detectar que la venta ya no existe y **no restaurar stock nuevamente**.

### Criterio de cierre

Prueba:

```text
delete sale
delete sale simultáneamente
```

Resultado:

```text
stock restaurado exactamente 1 vez
```

---

# 10. Transferencias y saldo insuficiente concurrente

Este es el caso más delicado de concurrencia fuera de créditos.

Ejemplo:

```text
Saldo = 100.000

Transfer A = 80.000
Transfer B = 80.000
```

No basta con:

```text
balance >= amount
```

porque ambas solicitudes pueden observar $100.000.

---

## Solución recomendada

Aquí tenemos dos caminos.

### Opción A — Optimistic concurrency

Versionar la cuenta:

```text
Account.version
```

y hacer:

```text
read account
↓
validate balance
↓
conditional update version
```

Si la segunda operación pierde:

```text
modifiedCount = 0
```

→ rollback.

### Opción B — Balance materializado

No recomiendo introducir esto ahora.

Sería una evolución arquitectónica mayor.

### Mi recomendación

**Opción A.**

Mantiene la arquitectura actual.

---

# 11. Crear cuenta con saldo inicial

Esta operación también debe entrar en el modelo transaccional.

Actualmente:

```text
Account
+
Opening Movement
```

debe convertirse en:

```text
Transaction
 ├─ Account
 └─ Opening Movement
```

El beneficio es que podemos eliminar la lógica compensatoria:

```text
si falla movement
→ intentar borrar account
```

y reemplazarla por rollback real.

---

# 12. Registro/onboarding

Lo dejaría para el final.

No es un riesgo financiero inmediato.

Pero idealmente:

```text
Transaction
 ├─ User
 ├─ Workspace
 ├─ Membership
 ├─ default account
 └─ default categories
```

Esto simplifica enormemente la consistencia del onboarding.

### Criterio de cierre

Un registro fallido deja:

```text
0 usuarios parciales
0 workspaces huérfanos
0 memberships huérfanas
0 cuentas seed huérfanas
```

---

# 13. Matriz final de prioridad

| Prioridad | Trabajo                                     | Riesgo                           |
| --------- | ------------------------------------------- | -------------------------------- |
| 🔴 P0     | Abonos transaccionales                      | Datos financieros inconsistentes |
| 🔴 P0     | Concurrencia de abonos                      | Sobregiro/deuda incorrecta       |
| 🔴 P0     | Write-off transaccional                     | Ledger ≠ deuda                   |
| 🔴 P0     | Edición de abonos                           | Saldos incorrectos               |
| 🔴 P0     | Crear créditos transaccional                | Crédito sin ledger               |
| 🔴 P0     | Crear payable transaccional                 | Deuda sin ledger                 |
| 🔴 P0     | Venta a crédito — revisar todos los caminos | Inconsistencia financiera        |
| 🟠 P1     | Transferencia concurrente                   | Saldo negativo                   |
| 🟠 P1     | UpdateTransfer transaccional                | Ledger desincronizado            |
| 🟠 P1     | DeleteSale idempotente                      | Stock duplicado                  |
| 🟠 P1     | Cuenta + opening movement                   | Cuenta parcialmente creada       |
| 🟠 P1     | Registro transaccional                      | Workspace parcial                |
| 🟡 P2     | Tests de caos/fallos                        | Hardening                        |
| 🟡 P2     | Optimización posterior                      | Escalabilidad                    |

---

# 14. Suite de pruebas que debería cerrar la ronda

No me conformaría con aumentar simplemente el número de tests.

Necesitamos una **suite de integridad**.

## A. Rollback

Para cada operación:

```text
SUCCESS
FAIL_STEP_1
FAIL_STEP_2
FAIL_STEP_3
```

y comprobar:

```text
DB final == DB inicial
```

cuando la transacción falla.

---

## B. Concurrencia

Ejecutar simultáneamente:

```text
10
50
100
```

operaciones.

Especialmente:

* abonos;
* transferencias;
* write-off;
* delete sale.

---

## C. Invariantes financieros

Después de cada prueba:

### No sobrepago

```text
paidPrincipal <= originalPrincipal
```

### No saldo imposible

```text
pending >= 0
```

### Transferencia

```text
source movement + destination movement = 0
```

considerando correctamente FX.

### Venta

```text
sale total
=
movements + credit state
```

según la semántica correspondiente.

### Inventario

```text
stock final
=
stock inicial
- ventas efectivas
+ eliminaciones efectivas
```

---

# 15. Criterio de cierre de toda la mini-ronda

Yo no marcaría esta ronda como terminada simplemente porque:

```text
1074 → 1200 tests
```

El criterio debe ser mucho más fuerte.

### Debe cumplirse:

**1. Cada operación multi-documento está catalogada.**

**2. Todas las operaciones financieras críticas tienen atomicidad real.**

**3. No existen escrituras compensatorias donde pueda utilizarse transacción.**

**4. Los agregados sensibles tienen protección contra concurrencia.**

**5. Los retries no duplican operaciones.**

**6. Las operaciones concurrentes no pueden superar saldos/deudas/inventario.**

**7. Existen pruebas reales contra MongoDB replica set.**

**8. Los tests de rollback verifican el estado final completo.**

**9. `pnpm test`, typecheck, lint, build y E2E pasan.**

**10. CI reproduce los mismos checks.**

**11. No queda ningún `TODO` relacionado con atomicidad/concurrencia financiera.**

---

# 16. Y una recomendación importante para Gentle-AI

Yo **no le pediría simplemente**:

> "Haz todas las operaciones transaccionales."

Eso puede producir una implementación demasiado agresiva.

Le daría una misión mucho más controlada:

> **Auditar → clasificar → proponer → esperar aprobación → implementar por fases → probar fallos y concurrencia → documentar → detenerse.**

Y dividiría la ejecución así:

```text
R14.1
Inventario + UnitOfWork audit
        ↓
R14.2
Créditos + Payables
        ↓
R14.3
Abonos + concurrencia
        ↓
R14.4
Write-off + edición
        ↓
R14.5
Transfer concurrency + Sale delete
        ↓
R14.6
Onboarding atomicidad
        ↓
R14.7
Chaos / concurrency regression suite
        ↓
R14.8
Final verification
```

**No mezclaría todavía UX/UI con esto.**

Primero cerramos esta deuda de integridad. Después sí podemos hacer la ronda UX/UI con una base mucho más sólida.

Y hay una ventaja importante: **R14 ya construyó la infraestructura transaccional necesaria**. Esta no debería convertirse en una re-arquitectura de TwinCap, sino en una extensión disciplinada de lo que ya se implementó.
