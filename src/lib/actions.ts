"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/supabase/types";

type Tables = Database['public']['Tables'];

/**
 * AUTH & PROFILE
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  });

  if (error) throw error;
  return data.url;
}

/**
 * ACCOUNTS
 */
export async function getAccounts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: accounts } = await supabase
    .from("cuentas")
    .select("*")
    .eq("usuario_id", user.id)
    .order("orden", { ascending: true });

  return accounts || [];
}

export async function createAccount(account: Omit<Tables['cuentas']['Insert'], 'usuario_id'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Only include cbu/alias if they have a value — avoids PGRST204 if migration not yet run
  const payload: Record<string, unknown> = {
    nombre:        account.nombre,
    tipo:          account.tipo,
    moneda:        account.moneda,
    saldo_inicial: account.saldo_inicial,
    color:         account.color,
    icono:         account.icono,
    activa:        account.activa,
    orden:         account.orden,
    usuario_id:    user.id,
  };
  if (account.cbu)   payload.cbu   = account.cbu;
  if (account.alias) payload.alias = account.alias;

  const { data, error } = await supabase
    .from("cuentas")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/cuentas");
  return data;
}

export async function updateAccount(id: string, updates: Partial<Omit<Tables['cuentas']['Update'], 'usuario_id'>>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Strip null cbu/alias — columns may not exist if migration hasn't run
  const safe: Record<string, unknown> = { ...updates };
  if (!safe.cbu)   delete safe.cbu;
  if (!safe.alias) delete safe.alias;

  const { data, error } = await supabase
    .from("cuentas")
    .update(safe)
    .eq("id", id)
    .eq("usuario_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/cuentas");
  return data;
}

/**
 * CATEGORIES
 */
export async function getCategories(tipo?: 'ingreso' | 'gasto' | 'transferencia' | 'objetivo') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("categorias")
    .select("*")
    .or(`usuario_id.eq.${user.id},es_sistema.eq.true`)
    .eq("activa", true);

  if (tipo) {
    query = query.eq("tipo", tipo);
  }

  const { data: categories } = await query.order("orden", { ascending: true });
  return categories || [];
}

/**
 * MOVEMENTS
 */
export async function getMovements(limit = 100) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Try with joins first; fall back to plain select if FK relationships aren't cached
  const { data: movements, error } = await supabase
    .from("movimientos")
    .select("*, categorias (nombre, icono, color)")
    .eq("usuario_id", user.id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getMovements join failed, retrying without join:", error.message);
    const { data: fallback, error: e2 } = await supabase
      .from("movimientos")
      .select("*")
      .eq("usuario_id", user.id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (e2) console.error("getMovements fallback error:", e2.message);
    return fallback || [];
  }

  return movements || [];
}

export async function createMovement(movement: Omit<Tables['movimientos']['Insert'], 'usuario_id'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Use a transaction-like approach or trigger for balance updates
  // For MVP, we insert the movement. The SQL schema should handle triggers if we wanted auto-balance.
  // We'll manage it via a separate update if necessary, or just rely on calculating sums.
  
  const { data, error } = await supabase
    .from("movimientos")
    .insert({ ...movement, usuario_id: user.id })
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/app/movimientos");
  revalidatePath("/app/dashboard");
  return data;
}

export async function updateMovement(id: string, updates: Partial<Tables['movimientos']['Update']>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("movimientos")
    .update(updates)
    .eq("id", id)
    .eq("usuario_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/movimientos");
  revalidatePath("/app/dashboard");
  return data;
}

export async function deleteMovement(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch before deleting so we can reverse side effects
  const { data: mov } = await supabase
    .from("movimientos")
    .select("tipo, monto, objetivo_id")
    .eq("id", id)
    .eq("usuario_id", user.id)
    .single();

  const { error } = await supabase
    .from("movimientos")
    .delete()
    .eq("id", id)
    .eq("usuario_id", user.id);

  if (error) throw error;

  // If it was an aporte to a goal, subtract from goal's saldo_actual
  if (mov?.tipo === "aporte_objetivo" && mov.objetivo_id) {
    const { data: goal } = await supabase
      .from("objetivos")
      .select("saldo_actual")
      .eq("id", mov.objetivo_id)
      .single();
    if (goal) {
      await supabase
        .from("objetivos")
        .update({ saldo_actual: Math.max(0, Number(goal.saldo_actual) - Number(mov.monto)) })
        .eq("id", mov.objetivo_id);
    }
  }

  revalidatePath("/app/movimientos");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/objetivos");
}

/**
 * GOALS
 */
export async function getGoals() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: goals } = await supabase
    .from("objetivos")
    .select("*")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: true });

  return goals || [];
}

export async function createGoal(goal: Omit<Tables['objetivos']['Insert'], 'usuario_id'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("objetivos")
    .insert({ ...goal, usuario_id: user.id })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/objetivos");
  revalidatePath("/app/dashboard");
  return data;
}

export async function updateGoal(id: string, updates: Partial<Omit<Tables['objetivos']['Update'], 'usuario_id'>>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("objetivos")
    .update(updates)
    .eq("id", id)
    .eq("usuario_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/objetivos");
  revalidatePath("/app/dashboard");
  return data;
}

/**
 * PORTFOLIO / VALUATIONS
 */
export async function createValuation(valuation: Omit<Tables['valuaciones']['Insert'], 'usuario_id'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("valuaciones")
    .insert({ ...valuation, usuario_id: user.id })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/cartera");
  return data;
}


/**
 * MONTHLY STATS (for charts)
 */
export async function getMonthlyStats(months = 6) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data: movements } = await supabase
    .from("movimientos")
    .select("tipo, monto, fecha")
    .eq("usuario_id", user.id)
    .gte("fecha", startDate.toISOString().split("T")[0])
    .in("tipo", ["ingreso", "gasto"]);

  // Build ordered month buckets (includes 1 month ahead for future-dated movements)
  const monthMap: Record<string, { mes: string; ingresos: number; gastos: number }> = {};
  for (let i = months - 1; i >= -1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = {
      mes: d.toLocaleDateString("es-AR", { month: "short" }),
      ingresos: 0,
      gastos: 0,
    };
  }

  for (const m of movements || []) {
    const key = m.fecha.substring(0, 7);
    if (monthMap[key]) {
      if (m.tipo === "ingreso") monthMap[key].ingresos += Number(m.monto);
      if (m.tipo === "gasto")   monthMap[key].gastos   += Number(m.monto);
    }
  }

  return Object.entries(monthMap).map(([key, m]) => ({
    ...m,
    yearMonth: key,
    ahorro: m.ingresos - m.gastos,
  }));
}

/**
 * CATEGORIES (CRUD)
 */
export async function createCategory(cat: Omit<Tables['categorias']['Insert'], 'usuario_id' | 'es_sistema'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("categorias")
    .insert({ ...cat, usuario_id: user.id, es_sistema: false })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/categorias");
  return data;
}

export async function updateCategory(id: string, updates: Partial<Omit<Tables['categorias']['Update'], 'usuario_id' | 'es_sistema'>>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("categorias")
    .update(updates)
    .eq("id", id)
    .eq("usuario_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/categorias");
  return data;
}

/**
 * RECURRENTES (recurring expenses/income)
 */
export async function getRecurrentes() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("recurrentes")
    .select("*")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: true });

  if (error) { console.error("getRecurrentes error:", error.message); return []; }
  return data || [];
}

export async function createRecurrente(rec: Omit<Tables['recurrentes']['Insert'], 'usuario_id'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("recurrentes")
    .insert({ ...rec, usuario_id: user.id })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/recurrentes");
  revalidatePath("/app/dashboard");
  return data;
}

export async function updateRecurrente(id: string, updates: Partial<Omit<Tables['recurrentes']['Update'], 'usuario_id'>>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("recurrentes")
    .update(updates)
    .eq("id", id)
    .eq("usuario_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/recurrentes");
  revalidatePath("/app/dashboard");
  return data;
}

/**
 * DASHBOARD STATS
 */
export async function getDashboardStats() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  // Current month income/expenses
  const { data: movements } = await supabase
    .from("movimientos")
    .select("tipo, monto, fecha")
    .eq("usuario_id", user.id)
    .gte("fecha", firstDay);

  const ingresos = movements?.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0) || 0;
  const gastos = movements?.filter(m => m.tipo === 'gasto').reduce((s, m) => s + Number(m.monto), 0) || 0;
  const ahorro = ingresos - gastos;
  
  // Account balances (Total ARS equivalent)
  const { data: accounts } = await supabase
    .from("cuentas")
    .select("moneda, saldo_inicial")
    .eq("usuario_id", user.id);

  // Note: For real app, we'd fetch exchange rate here
  const totalBalance = accounts?.reduce((s, a) => s + Number(a.saldo_inicial), 0) || 0;

  return {
    ingresos,
    gastos,
    ahorro,
    tasaAhorro: ingresos > 0 ? (ahorro / ingresos) * 100 : 0,
    totalBalance
  };
}

/**
 * CONFIGURATION / PROFILE
 */
export async function updateProfile(updates: {
  nombre?: string;
  configuracion?: Record<string, unknown>;
  moneda_principal?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;

  if (updates.nombre) {
    await supabase.auth.updateUser({ data: { nombre: updates.nombre } });
  }

  revalidatePath("/app/configuracion");
  return data;
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getMovementsForExport() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("movimientos")
    .select("fecha, tipo, monto, moneda, descripcion, categorias(nombre)")
    .eq("usuario_id", user.id)
    .order("fecha", { ascending: false });

  return data || [];
}

/**
 * ALERT RULES
 */
export async function getAlertRules() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("alert_rules")
    .select("*, cuentas(nombre), categorias(nombre), objetivos(nombre)")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: true });

  return data || [];
}

export async function createAlertRule(rule: {
  nombre: string;
  tipo: string;
  operador: string;
  valor: number;
  cuenta_id?: string | null;
  categoria_id?: string | null;
  objetivo_id?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("alert_rules")
    .insert({ ...rule, usuario_id: user.id, activa: true })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/alertas");
  return data;
}

export async function updateAlertRule(id: string, updates: { nombre?: string; activa?: boolean; valor?: number; operador?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("alert_rules")
    .update(updates)
    .eq("id", id)
    .eq("usuario_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/alertas");
  return data;
}

export async function deleteAlertRule(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("alert_rules")
    .delete()
    .eq("id", id)
    .eq("usuario_id", user.id);

  if (error) throw error;
  revalidatePath("/app/alertas");
}

/**
 * ALERTAS (notifications)
 */
export async function getAlertas() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("alertas")
    .select("*, alert_rules(nombre)")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return data || [];
}

export async function marcarAlertaLeida(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase.from("alertas").update({ leida: true }).eq("id", id).eq("usuario_id", user.id);
  revalidatePath("/app/alertas");
}

export async function marcarTodasLeidas() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase.from("alertas").update({ leida: true }).eq("usuario_id", user.id).eq("leida", false);
  revalidatePath("/app/alertas");
}

export async function evaluateAlertRules() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: rules } = await supabase
    .from("alert_rules")
    .select("*")
    .eq("usuario_id", user.id)
    .eq("activa", true);

  if (!rules?.length) return 0;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: movements } = await supabase
    .from("movimientos")
    .select("tipo, monto, categoria_id, cuenta_origen_id, cuenta_destino_id, fecha")
    .eq("usuario_id", user.id)
    .gte("fecha", firstOfMonth);

  const { data: accounts } = await supabase
    .from("cuentas")
    .select("id, saldo_inicial")
    .eq("usuario_id", user.id);

  const { data: goals } = await supabase
    .from("objetivos")
    .select("id, saldo_actual, meta")
    .eq("usuario_id", user.id);

  const { data: recentAlertas } = await supabase
    .from("alertas")
    .select("rule_id")
    .eq("usuario_id", user.id)
    .gte("created_at", yesterday);

  const recentRuleIds = new Set((recentAlertas || []).map((a: any) => a.rule_id));

  const toInsert: any[] = [];

  for (const rule of rules) {
    if (recentRuleIds.has(rule.id)) continue;

    let currentValue = 0;

    if (rule.tipo === "gasto_total") {
      currentValue = (movements || [])
        .filter(m => m.tipo === "gasto")
        .reduce((s, m) => s + Number(m.monto), 0);
    } else if (rule.tipo === "ingreso_total") {
      currentValue = (movements || [])
        .filter(m => m.tipo === "ingreso")
        .reduce((s, m) => s + Number(m.monto), 0);
    } else if (rule.tipo === "gasto_categoria" && rule.categoria_id) {
      currentValue = (movements || [])
        .filter(m => m.tipo === "gasto" && m.categoria_id === rule.categoria_id)
        .reduce((s, m) => s + Number(m.monto), 0);
    } else if (rule.tipo === "saldo_cuenta" && rule.cuenta_id) {
      const account = (accounts || []).find(a => a.id === rule.cuenta_id);
      if (account) {
        const ingresos = (movements || [])
          .filter(m => (m.tipo === "ingreso" || m.tipo === "transferencia") && m.cuenta_destino_id === rule.cuenta_id)
          .reduce((s, m) => s + Number(m.monto), 0);
        const gastos = (movements || [])
          .filter(m => (m.tipo === "gasto" || m.tipo === "transferencia") && m.cuenta_origen_id === rule.cuenta_id)
          .reduce((s, m) => s + Number(m.monto), 0);
        currentValue = Number(account.saldo_inicial) + ingresos - gastos;
      }
    } else if (rule.tipo === "objetivo_progreso" && rule.objetivo_id) {
      const goal = (goals || []).find(g => g.id === rule.objetivo_id);
      if (goal && Number(goal.meta) > 0) {
        currentValue = (Number(goal.saldo_actual) / Number(goal.meta)) * 100;
      }
    }

    const threshold = Number(rule.valor);
    let triggered = false;
    if (rule.operador === "<")  triggered = currentValue < threshold;
    if (rule.operador === ">")  triggered = currentValue > threshold;
    if (rule.operador === "<=") triggered = currentValue <= threshold;
    if (rule.operador === ">=") triggered = currentValue >= threshold;

    if (triggered) {
      const tipoAlerta =
        rule.operador === "<" || rule.operador === "<=" ? "warning" :
        rule.tipo === "objetivo_progreso" ? "success" : "info";

      const label =
        rule.tipo === "gasto_total"      ? `Gastos del mes superaron $${threshold.toLocaleString("es-AR")}` :
        rule.tipo === "ingreso_total"     ? `Ingresos del mes superaron $${threshold.toLocaleString("es-AR")}` :
        rule.tipo === "gasto_categoria"   ? `Gasto en categoría superó $${threshold.toLocaleString("es-AR")}` :
        rule.tipo === "saldo_cuenta"      ? `Saldo de cuenta por debajo de $${threshold.toLocaleString("es-AR")}` :
        rule.tipo === "objetivo_progreso" ? `Objetivo alcanzó el ${threshold}% de progreso` :
        rule.nombre;

      toInsert.push({
        usuario_id: user.id,
        rule_id: rule.id,
        tipo: tipoAlerta,
        mensaje: `${rule.nombre}: ${label}. Valor actual: ${rule.tipo === "objetivo_progreso" ? currentValue.toFixed(1) + "%" : "$" + currentValue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
        leida: false,
      });
    }
  }

  if (toInsert.length > 0) {
    await supabase.from("alertas").insert(toInsert);
    revalidatePath("/app/alertas");
  }

  return toInsert.length;
}

/**
 * POSICIONES (market positions)
 */
export async function getPosiciones() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("posiciones")
    .select("*")
    .eq("usuario_id", user.id)
    .eq("activa", true)
    .order("created_at", { ascending: true });

  return data || [];
}

export async function createPosicion(pos: {
  ticker: string;
  nombre?: string;
  cantidad: number;
  precio_compra?: number;
  moneda: string;
  broker?: string;
  notas?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("posiciones")
    .insert({ ...pos, usuario_id: user.id, activa: true })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/cartera");
  return data;
}

export async function updatePosicion(id: string, updates: {
  ticker?: string;
  nombre?: string;
  cantidad?: number;
  precio_compra?: number;
  moneda?: string;
  broker?: string;
  notas?: string;
  activa?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("posiciones")
    .update(updates)
    .eq("id", id)
    .eq("usuario_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/cartera");
  return data;
}

export async function deletePosicion(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("posiciones")
    .delete()
    .eq("id", id)
    .eq("usuario_id", user.id);

  if (error) throw error;
  revalidatePath("/app/cartera");
}

/**
 * PASIVOS (debts / loans)
 */
export async function getPasivos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("pasivos")
    .select("*")
    .eq("usuario_id", user.id)
    .eq("activo", true)
    .order("created_at", { ascending: true });

  return data || [];
}

export async function createPasivo(pasivo: {
  nombre: string;
  tipo: string;
  sistema_amortizacion?: string;
  monto_original: number;
  saldo_pendiente: number;
  moneda: string;
  tasa_interes?: number;
  cuota_mensual?: number;
  cuota_uva?: number;
  capital_uva?: number;
  n_cuotas?: number;
  fecha_inicio?: string;
  fecha_vencimiento?: string;
  notas?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("pasivos")
    .insert({ ...pasivo, usuario_id: user.id, activo: true })
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/cartera");
  return data;
}

export async function updatePasivo(id: string, updates: {
  nombre?: string;
  tipo?: string;
  sistema_amortizacion?: string;
  monto_original?: number;
  saldo_pendiente?: number;
  cuota_mensual?: number;
  cuota_uva?: number;
  capital_uva?: number;
  n_cuotas?: number;
  tasa_interes?: number;
  fecha_inicio?: string;
  fecha_vencimiento?: string;
  notas?: string;
  activo?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("pasivos")
    .update(updates)
    .eq("id", id)
    .eq("usuario_id", user.id)
    .select()
    .single();

  if (error) throw error;
  revalidatePath("/app/cartera");
  return data;
}

export async function deletePasivo(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("pasivos")
    .delete()
    .eq("id", id)
    .eq("usuario_id", user.id);

  if (error) throw error;
  revalidatePath("/app/cartera");
}

// ─── UVA amortization helper ─────────────────────────────────────────────────
// Standard French amortization: calculates capital + interest for cuota N
function calcCuotaUVADesglose(
  capitalUva: number, cuotaUvaFija: number, tnaPct: number, cuotaNum: number
) {
  const tasaMensual = tnaPct / 12 / 100;
  let saldo = capitalUva;
  for (let i = 1; i < cuotaNum; i++) {
    const interes = saldo * tasaMensual;
    saldo = Math.max(0, saldo - (cuotaUvaFija - interes));
  }
  const interesUva = tasaMensual > 0 ? saldo * tasaMensual : 0;
  const capitalUvaCalc = Math.max(0, cuotaUvaFija - interesUva);
  return { capitalUva: capitalUvaCalc, interesUva };
}

export async function registrarPagoPasivo(
  pasivoId: string,
  montoArs: number,
  fecha: string,
  cuentaId: string | null,
  descripcion: string,
  categoriaId: string | null,
  uvaValor?: number | null,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: pasivo } = await supabase
    .from("pasivos")
    .select("monto_original, capital_uva, sistema_amortizacion, cuota_uva, tasa_interes")
    .eq("id", pasivoId).eq("usuario_id", user.id).single();
  if (!pasivo) throw new Error("Pasivo no encontrado");

  const isUva = pasivo.sistema_amortizacion === "uva"
    && pasivo.capital_uva && pasivo.cuota_uva && uvaValor && uvaValor > 0;

  const { count: cuotasYaPagadas } = await supabase
    .from("pagos_pasivos")
    .select("id", { count: "exact", head: true })
    .eq("pasivo_id", pasivoId);

  const cuotaNum = (cuotasYaPagadas ?? 0) + 1;
  let capitalUvaPagado: number | null = null;
  let interesUvaPagado: number | null = null;
  let uvaEquivalente: number | null = null;

  if (isUva && pasivo.capital_uva && pasivo.cuota_uva && uvaValor) {
    const desglose = calcCuotaUVADesglose(
      Number(pasivo.capital_uva), Number(pasivo.cuota_uva),
      Number(pasivo.tasa_interes || 0), cuotaNum
    );
    capitalUvaPagado = desglose.capitalUva;
    interesUvaPagado = desglose.interesUva;
    uvaEquivalente = Number(pasivo.cuota_uva);
  }

  const { error: pagoError } = await supabase.from("pagos_pasivos").insert({
    pasivo_id: pasivoId, usuario_id: user.id, fecha,
    monto_ars: montoArs, uva_valor: uvaValor ?? null,
    uva_equivalente: uvaEquivalente,
    capital_uva_pagado: capitalUvaPagado,
    interes_uva_pagado: interesUvaPagado,
    cuota_numero: cuotaNum,
    descripcion, cuenta_id: cuentaId, categoria_id: categoriaId,
  });
  if (pagoError) throw pagoError;

  await supabase.from("movimientos").insert({
    usuario_id: user.id, tipo: "gasto", monto: montoArs, moneda: "ARS",
    fecha, descripcion, cuenta_origen_id: cuentaId, categoria_id: categoriaId,
  });

  const { data: todosLosPagos } = await supabase
    .from("pagos_pasivos").select("monto_ars, capital_uva_pagado").eq("pasivo_id", pasivoId);

  let nuevoSaldo: number;
  if (isUva && pasivo.capital_uva && uvaValor) {
    const totalCapUvas = (todosLosPagos || []).reduce((s: number, p: any) => s + (Number(p.capital_uva_pagado) || 0), 0);
    nuevoSaldo = Math.max(0, Number(pasivo.capital_uva) - totalCapUvas) * uvaValor;
  } else {
    const totalPagado = (todosLosPagos || []).reduce((s: number, p: any) => s + Number(p.monto_ars), 0);
    nuevoSaldo = Math.max(0, Number(pasivo.monto_original) - totalPagado);
  }

  await supabase.from("pasivos").update({ saldo_pendiente: nuevoSaldo }).eq("id", pasivoId);
  revalidatePath("/app/cartera"); revalidatePath("/app/movimientos"); revalidatePath("/app/dashboard");
}

export async function getPagosPasivo(pasivoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("pagos_pasivos")
    .select("*, cuentas(nombre), categorias(nombre)")
    .eq("pasivo_id", pasivoId).eq("usuario_id", user.id)
    .order("cuota_numero", { ascending: true });
  return data || [];
}

export async function deletePagoPasivo(pagoId: string, pasivoId: string, uvaValorActual?: number | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase.from("pagos_pasivos").delete()
    .eq("id", pagoId).eq("usuario_id", user.id);
  if (error) throw error;

  const { data: pasivo } = await supabase.from("pasivos")
    .select("monto_original, capital_uva, sistema_amortizacion")
    .eq("id", pasivoId).eq("usuario_id", user.id).single();

  if (pasivo) {
    const { data: pagos } = await supabase.from("pagos_pasivos")
      .select("monto_ars, capital_uva_pagado").eq("pasivo_id", pasivoId);
    let nuevoSaldo: number;
    if (pasivo.sistema_amortizacion === "uva" && pasivo.capital_uva && uvaValorActual && uvaValorActual > 0) {
      const totalCap = (pagos || []).reduce((s: number, p: any) => s + (Number(p.capital_uva_pagado) || 0), 0);
      nuevoSaldo = Math.max(0, Number(pasivo.capital_uva) - totalCap) * uvaValorActual;
    } else {
      const totalPag = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto_ars), 0);
      nuevoSaldo = Math.max(0, Number(pasivo.monto_original) - totalPag);
    }
    await supabase.from("pasivos").update({ saldo_pendiente: nuevoSaldo }).eq("id", pasivoId);
  }
  revalidatePath("/app/cartera");
}

// ─── Plazos Fijos ─────────────────────────────────────────────────────────────

export async function getPlazos() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("plazos_fijos").select("*")
    .eq("usuario_id", user.id).order("fecha_vencimiento", { ascending: true });
  return data || [];
}

export async function createPlazoFijo(payload: {
  entidad: string; monto_inicial: number; tasa_tna: number; plazo_dias: number;
  fecha_inicio: string; fecha_vencimiento: string; moneda: string;
  renovacion_automatica: boolean; notas?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data, error } = await supabase.from("plazos_fijos")
    .insert({ ...payload, usuario_id: user.id }).select().single();
  if (error) throw error;
  revalidatePath("/app/cartera");
  return data;
}

export async function updatePlazoFijo(id: string, payload: Record<string, any>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data, error } = await supabase.from("plazos_fijos")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id).eq("usuario_id", user.id).select().single();
  if (error) throw error;
  revalidatePath("/app/cartera");
  return data;
}

export async function deletePlazoFijo(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { error } = await supabase.from("plazos_fijos").delete()
    .eq("id", id).eq("usuario_id", user.id);
  if (error) throw error;
  revalidatePath("/app/cartera");
}

