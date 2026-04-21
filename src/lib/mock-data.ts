// Mock data for demo mode - used when no Supabase data is available
import { formatDate } from "@/lib/utils";

export const MOCK_CUENTAS = [
  { id: "1", nombre: "Banco Nación", tipo: "banco", moneda: "ARS", saldo_inicial: 500000, color: "#6C63FF", icono: "🏦", activa: true, orden: 1 },
  { id: "2", nombre: "Efectivo", tipo: "efectivo", moneda: "ARS", saldo_inicial: 80000, color: "#10B981", icono: "💵", activa: true, orden: 2 },
  { id: "3", nombre: "Mercado Pago", tipo: "billetera", moneda: "ARS", saldo_inicial: 150000, color: "#22D3EE", icono: "📱", activa: true, orden: 3 },
  { id: "4", nombre: "IOL Broker", tipo: "broker", moneda: "ARS", saldo_inicial: 2000000, color: "#F59E0B", icono: "📊", activa: true, orden: 4 },
  { id: "5", nombre: "Dólares", tipo: "efectivo", moneda: "USD", saldo_inicial: 3500, color: "#84CC16", icono: "🇺🇸", activa: true, orden: 5 },
];

export const MOCK_CATEGORIAS = [
  { id: "i1", nombre: "Sueldo", tipo: "ingreso", color: "#10B981", icono: "💼" },
  { id: "i2", nombre: "Freelance", tipo: "ingreso", color: "#22D3EE", icono: "💻" },
  { id: "i3", nombre: "Inversiones", tipo: "ingreso", color: "#6C63FF", icono: "📈" },
  { id: "i4", nombre: "Otros ingresos", tipo: "ingreso", color: "#84CC16", icono: "💰" },
  { id: "g1", nombre: "Vivienda", tipo: "gasto", color: "#EF4444", icono: "🏠" },
  { id: "g2", nombre: "Alimentación", tipo: "gasto", color: "#F97316", icono: "🍔" },
  { id: "g3", nombre: "Transporte", tipo: "gasto", color: "#F59E0B", icono: "🚗" },
  { id: "g4", nombre: "Salud", tipo: "gasto", color: "#EC4899", icono: "🏥" },
  { id: "g5", nombre: "Entretenimiento", tipo: "gasto", color: "#7C3AED", icono: "🎮" },
  { id: "g6", nombre: "Ropa", tipo: "gasto", color: "#14B8A6", icono: "👕" },
  { id: "g7", nombre: "Educación", tipo: "gasto", color: "#2563EB", icono: "📚" },
  { id: "g8", nombre: "Servicios", tipo: "gasto", color: "#6B7280", icono: "💡" },
];

export const MOCK_OBJETIVOS = [
  {
    id: "o1", nombre: "Fondo de Emergencia", descripcion: "6 meses de gastos", monto_objetivo: 3000000,
    saldo_actual: 1800000, saldo_inicial: 500000, fecha_meta: "2026-12-31",
    prioridad: "alta", color: "#EF4444", icono: "🛡️", aporte_mensual_sugerido: 200000, activo: true,
  },
  {
    id: "o2", nombre: "Vacaciones Europa", descripcion: "Viaje para julio 2027", monto_objetivo: 5000000,
    saldo_actual: 890000, saldo_inicial: 0, fecha_meta: "2027-06-30",
    prioridad: "media", color: "#22D3EE", icono: "✈️", aporte_mensual_sugerido: 350000, activo: true,
  },
  {
    id: "o3", nombre: "Auto Nuevo", descripcion: "Toyota Corolla o similar", monto_objetivo: 25000000,
    saldo_actual: 3200000, saldo_inicial: 1000000, fecha_meta: "2028-01-01",
    prioridad: "baja", color: "#F59E0B", icono: "🚗", aporte_mensual_sugerido: 800000, activo: true,
  },
  {
    id: "o4", nombre: "Casa Inicial", descripcion: "Ahorro para entrada", monto_objetivo: 80000000,
    saldo_actual: 12000000, saldo_inicial: 5000000, fecha_meta: "2030-01-01",
    prioridad: "alta", color: "#6C63FF", icono: "🏠", aporte_mensual_sugerido: 1500000, activo: true,
  },
];

export const MOCK_MOVIMIENTOS = [
  // Abril 2026
  { id: "m1", fecha: "2026-04-10", tipo: "ingreso", categoria: "Sueldo", monto: 1800000, moneda: "ARS", descripcion: "Sueldo abril", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m2", fecha: "2026-04-10", tipo: "ingreso", categoria: "Freelance", monto: 450000, moneda: "ARS", descripcion: "Proyecto web cliente", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m3", fecha: "2026-04-05", tipo: "gasto", categoria: "Vivienda", monto: 380000, moneda: "ARS", descripcion: "Alquiler", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m4", fecha: "2026-04-06", tipo: "gasto", categoria: "Vivienda", monto: 85000, moneda: "ARS", descripcion: "Expensas", cuenta_origen: "Banco Nación", metodo_carga: "ia" },
  { id: "m5", fecha: "2026-04-08", tipo: "gasto", categoria: "Alimentación", monto: 95000, moneda: "ARS", descripcion: "Super Coto", cuenta_origen: "Efectivo", metodo_carga: "manual" },
  { id: "m6", fecha: "2026-04-09", tipo: "aporte_objetivo", categoria: "Objetivos", monto: 200000, moneda: "ARS", descripcion: "Aporte fondo emergencia", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m7", fecha: "2026-04-11", tipo: "gasto", categoria: "Transporte", monto: 45000, moneda: "ARS", descripcion: "Nafta", cuenta_origen: "Efectivo", metodo_carga: "manual" },
  { id: "m8", fecha: "2026-04-12", tipo: "gasto", categoria: "Entretenimiento", monto: 28000, moneda: "ARS", descripcion: "Netflix + Spotify", cuenta_origen: "Mercado Pago", metodo_carga: "manual" },
  { id: "m9", fecha: "2026-04-13", tipo: "gasto", categoria: "Salud", monto: 35000, moneda: "ARS", descripcion: "Consulta médico", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m10", fecha: "2026-04-13", tipo: "aporte_objetivo", categoria: "Objetivos", monto: 350000, moneda: "ARS", descripcion: "Aporte vacaciones", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  // Marzo 2026
  { id: "m11", fecha: "2026-03-10", tipo: "ingreso", categoria: "Sueldo", monto: 1600000, moneda: "ARS", descripcion: "Sueldo marzo", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m12", fecha: "2026-03-10", tipo: "ingreso", categoria: "Freelance", monto: 280000, moneda: "ARS", descripcion: "Consultoría", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m13", fecha: "2026-03-05", tipo: "gasto", categoria: "Vivienda", monto: 380000, moneda: "ARS", descripcion: "Alquiler", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m14", fecha: "2026-03-06", tipo: "gasto", categoria: "Vivienda", monto: 82000, moneda: "ARS", descripcion: "Expensas", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m15", fecha: "2026-03-08", tipo: "gasto", categoria: "Alimentación", monto: 110000, moneda: "ARS", descripcion: "Super", cuenta_origen: "Efectivo", metodo_carga: "manual" },
  { id: "m16", fecha: "2026-03-15", tipo: "gasto", categoria: "Transporte", monto: 42000, moneda: "ARS", descripcion: "Combustible", cuenta_origen: "Efectivo", metodo_carga: "manual" },
  { id: "m17", fecha: "2026-03-20", tipo: "gasto", categoria: "Ropa", monto: 95000, moneda: "ARS", descripcion: "Zapatillas", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m18", fecha: "2026-03-25", tipo: "gasto", categoria: "Entretenimiento", monto: 65000, moneda: "ARS", descripcion: "Salida restaurante", cuenta_origen: "Efectivo", metodo_carga: "manual" },
  // Febrero 2026
  { id: "m19", fecha: "2026-02-10", tipo: "ingreso", categoria: "Sueldo", monto: 1600000, moneda: "ARS", descripcion: "Sueldo febrero", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m20", fecha: "2026-02-05", tipo: "gasto", categoria: "Vivienda", monto: 360000, moneda: "ARS", descripcion: "Alquiler", cuenta_origen: "Banco Nación", metodo_carga: "manual" },
  { id: "m21", fecha: "2026-02-08", tipo: "gasto", categoria: "Alimentación", monto: 102000, moneda: "ARS", descripcion: "Super", cuenta_origen: "Efectivo", metodo_carga: "manual" },
  { id: "m22", fecha: "2026-02-14", tipo: "gasto", categoria: "Entretenimiento", monto: 45000, moneda: "ARS", descripcion: "Cena día enamorados", cuenta_origen: "Efectivo", metodo_carga: "manual" },
];

// Monthly aggregated mock data for charts
export const MOCK_MONTHLY_DATA = [
  { mes: "Oct 25", ingresos: 1400000, gastos: 980000, ahorro: 420000 },
  { mes: "Nov 25", ingresos: 1500000, gastos: 1100000, ahorro: 400000 },
  { mes: "Dic 25", ingresos: 1800000, gastos: 1400000, ahorro: 400000 },
  { mes: "Ene 26", ingresos: 1600000, gastos: 1050000, ahorro: 550000 },
  { mes: "Feb 26", ingresos: 1600000, gastos: 1020000, ahorro: 580000 },
  { mes: "Mar 26", ingresos: 1880000, gastos: 1090000, ahorro: 790000 },
  { mes: "Abr 26", ingresos: 2250000, gastos: 1018000, ahorro: 1232000 },
];

export const MOCK_CARTERA = [
  { instrumento: "FCI Money Market", tipo: "fci_mm", monto: 1500000, moneda: "ARS", color: "#6C63FF", porcentaje: 28 },
  { instrumento: "Plazo Fijo", tipo: "plazo_fijo", monto: 1200000, moneda: "ARS", color: "#10B981", porcentaje: 22 },
  { instrumento: "CEDEARs", tipo: "cedear", monto: 800000, moneda: "ARS", color: "#F59E0B", porcentaje: 15 },
  { instrumento: "Bonos (AY24)", tipo: "bono", monto: 600000, moneda: "ARS", color: "#22D3EE", porcentaje: 11 },
  { instrumento: "USD Efectivo", tipo: "usd_efectivo", monto: 3500, moneda: "USD", color: "#84CC16", porcentaje: 18 },
  { instrumento: "ARS Efectivo", tipo: "ars_efectivo", monto: 330000, moneda: "ARS", color: "#6B7280", porcentaje: 6 },
];

export const MOCK_ALERTAS = [
  { id: "a1", tipo: "warning", mensaje: "El gasto en Alimentación subió un 15% vs el mes anterior", leida: false },
  { id: "a2", tipo: "success", mensaje: "¡Llegaste al 60% del Fondo de Emergencia! Vas muy bien 🎉", leida: false },
  { id: "a3", tipo: "info", mensaje: "Recordá registrar los gastos del fin de semana", leida: false },
  { id: "a4", tipo: "danger", mensaje: "La tasa de ahorro de este mes es del 45% — muy buena 🚀", leida: true },
];

// Compute KPI metrics from mock data
export function getMockCurrentMonthKPIs() {
  const currentMonth = MOCK_MONTHLY_DATA[MOCK_MONTHLY_DATA.length - 1];
  const previousMonth = MOCK_MONTHLY_DATA[MOCK_MONTHLY_DATA.length - 2];

  const tasaAhorro = ((currentMonth.ahorro / currentMonth.ingresos) * 100);
  const tasaGasto = ((currentMonth.gastos / currentMonth.ingresos) * 100);

  const varIngresos = ((currentMonth.ingresos - previousMonth.ingresos) / previousMonth.ingresos) * 100;
  const varGastos = ((currentMonth.gastos - previousMonth.gastos) / previousMonth.gastos) * 100;
  const varAhorro = ((currentMonth.ahorro - previousMonth.ahorro) / previousMonth.ahorro) * 100;

  const balanceAnual = MOCK_MONTHLY_DATA.reduce((acc, m) => acc + m.ahorro, 0);

  return {
    ingresos: currentMonth.ingresos,
    gastos: currentMonth.gastos,
    ahorro: currentMonth.ahorro,
    tasaAhorro,
    tasaGasto,
    varIngresos,
    varGastos,
    varAhorro,
    balanceAnual,
  };
}
