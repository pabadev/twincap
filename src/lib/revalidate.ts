import { revalidatePath } from 'next/cache';

/**
 * R5-B: centralized movement invalidation.
 *
 * Rule (F6, reforzada y centralizada): toda server action que MUTA movimientos
 * (abonos, principal, deudas de créditos, payables, ventas, transferencias)
 * DEBE revalidar el feed de movimientos, los saldos de cuentas y el dashboard,
 * o esas superficies muestran datos viejos hasta un reload manual. Este es el
 * único lugar que define el set completo para que ninguna ruta vuelva a olvidarse.
 *
 * Llamar con la ruta propia del módulo (p. ej. '/credits/granted',
 * '/pos/sales', '/payables', '/transfers', '/credits/received').
 */
export function revalidateMovementData(moduleRoute: string): void {
  revalidatePath(moduleRoute);
  revalidatePath('/accounts');
  revalidatePath('/dashboard');
  revalidatePath('/movements');
}
