/**
 * Account balance calculation.
 *
 * Kept in its own module (no "use server") so the accounts page, the dashboard,
 * the reports and the alert engine all derive "saldo" the exact same way.
 *
 * Movements do NOT use cuenta_origen_id / cuenta_destino_id as debit/credit:
 * every form stores the selected account in cuenta_origen_id regardless of the
 * movement type, and only fills cuenta_destino_id for transfers. So the sign
 * comes from `tipo`, not from which column is populated.
 */

export interface BalanceMovement {
  tipo: string;
  monto: number | string;
  moneda?: string | null;
  tipo_cambio?: number | null;
  cuenta_origen_id: string | null;
  cuenta_destino_id: string | null;
}

export interface BalanceAccount {
  id: string;
  moneda: string;
  saldo_inicial: number | string;
}

/** Converts an amount into the account's currency, when they differ. */
function toAccountCurrency(
  monto: number,
  movMoneda: string | null | undefined,
  accountMoneda: string,
  tipoCambio: number | null | undefined,
  tcUsd: number | null
): number {
  const from = (movMoneda || accountMoneda).toUpperCase();
  const to = accountMoneda.toUpperCase();
  if (from === to) return monto;

  const rate = tipoCambio || tcUsd;
  if (!rate) return monto; // no rate available — better to count it than to drop it

  if (from === "USD" && to === "ARS") return monto * rate;
  if (from === "ARS" && to === "USD") return monto / rate;
  return monto;
}

/**
 * Returns the accounts with a computed `saldo` = saldo_inicial ± movements.
 * `tcUsd` is only used for movements booked in a currency other than the
 * account's own and without their own tipo_cambio.
 */
export function computeAccountBalances<T extends BalanceAccount>(
  accounts: T[],
  movements: BalanceMovement[],
  tcUsd: number | null = null
): (T & { saldo: number })[] {
  const monedaById = new Map(accounts.map(a => [a.id, a.moneda]));
  const delta = new Map<string, number>();

  const apply = (cuentaId: string | null, sign: 1 | -1, m: BalanceMovement) => {
    if (!cuentaId) return;
    const accountMoneda = monedaById.get(cuentaId);
    if (!accountMoneda) return; // movement points at a deleted account
    const monto = Number(m.monto) || 0;
    const converted = toAccountCurrency(monto, m.moneda, accountMoneda, m.tipo_cambio, tcUsd);
    delta.set(cuentaId, (delta.get(cuentaId) ?? 0) + sign * converted);
  };

  for (const m of movements) {
    const origen = m.cuenta_origen_id;
    const destino = m.cuenta_destino_id;

    switch (m.tipo) {
      case "ingreso":
      case "retiro_objetivo":
      case "venta_activo":
        apply(destino ?? origen, 1, m);
        break;

      case "gasto":
      case "aporte_objetivo":
      case "compra_activo":
        apply(origen ?? destino, -1, m);
        break;

      case "transferencia":
        apply(origen, -1, m);
        apply(destino, 1, m);
        break;

      // ajuste_valuacion only revalues assets — it never moves cash.
      default:
        break;
    }
  }

  return accounts.map(a => ({
    ...a,
    saldo: Number(a.saldo_inicial) + (delta.get(a.id) ?? 0),
  }));
}

/** Sums a list of balanced accounts into ARS, converting USD at `tcUsd`. */
export function sumAccountsInArs(
  accounts: { moneda: string; saldo: number }[],
  tcUsd: number
): number {
  return accounts.reduce(
    (sum, a) => sum + (a.moneda === "USD" ? a.saldo * tcUsd : a.saldo),
    0
  );
}
