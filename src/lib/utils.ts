import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function formatCurrency(
  amount: number,
  currency: string = "ARS",
  compact: boolean = false
): string {
  if (compact && Math.abs(amount) >= 1000000) {
    return `${currency === "ARS" ? "$" : "U$S"}${(amount / 1000000).toFixed(1)}M`;
  }
  if (compact && Math.abs(amount) >= 1000) {
    return `${currency === "ARS" ? "$" : "U$S"}${(amount / 1000).toFixed(1)}K`;
  }

  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "ARS",
      minimumFractionDigits: currency === "USD" ? 2 : 0,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    }).format(amount);
  } catch {
    const symbol = currency === "USD" ? "U$S" : "$";
    return `${symbol} ${amount.toLocaleString("es-AR")}`;
  }
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatDate(date: string | Date, formatStr: string = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, formatStr, { locale: es });
}

export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

export function formatMonthYear(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMMM yyyy", { locale: es });
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getVariationClass(value: number): string {
  if (value > 0) return "text-success-DEFAULT";
  if (value < 0) return "text-danger-DEFAULT";
  return "text-text-secondary";
}

export function getProgressColor(percentage: number): string {
  if (percentage >= 80) return "#10B981"; // success
  if (percentage >= 50) return "#F59E0B"; // warning
  return "#EF4444"; // danger
}

export function getProgressStatus(percentage: number): "on-track" | "slow" | "behind" {
  if (percentage >= 80) return "on-track";
  if (percentage >= 50) return "slow";
  return "behind";
}

export function calculateSavingsRate(income: number, expenses: number): number {
  if (income === 0) return 0;
  return ((income - expenses) / income) * 100;
}

export function calculateMonthsToGoal(
  current: number,
  target: number,
  monthlyContribution: number
): number | null {
  if (monthlyContribution <= 0) return null;
  const remaining = target - current;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / monthlyContribution);
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

export function getCurrentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function getQuarterRange(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const start = new Date(year, startMonth - 1, 1);
  const end = new Date(year, endMonth, 0);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

export const MOVEMENT_TYPES = [
  { value: "ingreso", label: "Ingreso", color: "#10B981", icon: "TrendingUp" },
  { value: "gasto", label: "Gasto", color: "#EF4444", icon: "TrendingDown" },
  { value: "transferencia", label: "Transferencia", color: "#6C63FF", icon: "ArrowLeftRight" },
  { value: "aporte_objetivo", label: "Aporte a Objetivo", color: "#22D3EE", icon: "Target" },
  { value: "retiro_objetivo", label: "Retiro de Objetivo", color: "#F59E0B", icon: "Archive" },
  { value: "compra_activo", label: "Compra de Activo", color: "#7C3AED", icon: "ShoppingCart" },
  { value: "venta_activo", label: "Venta de Activo", color: "#2563EB", icon: "DollarSign" },
  { value: "ajuste_valuacion", label: "Ajuste de Valuación", color: "#6B7280", icon: "BarChart2" },
] as const;

export const ACCOUNT_TYPES = [
  { value: "efectivo", label: "Efectivo", icon: "Banknote" },
  { value: "banco", label: "Banco", icon: "Building2" },
  { value: "billetera", label: "Billetera Virtual", icon: "Wallet" },
  { value: "broker", label: "Broker", icon: "TrendingUp" },
  { value: "caja_ahorro", label: "Caja de Ahorro", icon: "PiggyBank" },
  { value: "inversiones", label: "Inversiones", icon: "BarChart2" },
  { value: "otro", label: "Otro", icon: "CreditCard" },
] as const;

export const INSTRUMENT_TYPES = [
  { value: "fci_mm", label: "FCI Money Market", color: "#6C63FF" },
  { value: "caucion", label: "Cauciones", color: "#22D3EE" },
  { value: "letra", label: "Letras", color: "#10B981" },
  { value: "plazo_fijo", label: "Plazo Fijo", color: "#F59E0B" },
  { value: "bono", label: "Bonos", color: "#7C3AED" },
  { value: "on", label: "Obligaciones Negociables", color: "#2563EB" },
  { value: "etf", label: "ETFs", color: "#EC4899" },
  { value: "cedear", label: "CEDEARs", color: "#14B8A6" },
  { value: "accion", label: "Acciones", color: "#F97316" },
  { value: "usd_efectivo", label: "USD Efectivo", color: "#84CC16" },
  { value: "ars_efectivo", label: "ARS Efectivo", color: "#6B7280" },
  { value: "otro", label: "Otro", color: "#94A3B8" },
] as const;
