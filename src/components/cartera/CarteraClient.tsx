"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatCurrency } from "@/lib/utils";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  createValuation, createPosicion, updatePosicion, deletePosicion,
  createPasivo, updatePasivo, deletePasivo, registrarPagoPasivo,
  getPagosPasivo, deletePagoPasivo,
  createRecurrente,
} from "@/lib/actions";

interface CarteraClientProps {
  initialValuations: any[];
  initialPosiciones: any[];
  initialPasivos: any[];
  accounts: any[];
  categories: any[];
}

const COLORES = ["#6C63FF","#22D3EE","#10B981","#F59E0B","#EF4444","#7C3AED","#EC4899","#14B8A6","#F97316","#84CC16","#6B7280"];
const TC_REF = 1295;

interface Quote { ticker: string; shortName: string; price: number|null; change: number|null; changePercent: number|null; currency: string; marketState: string; dayHigh: number|null; dayLow: number|null; }
interface TickerSuggestion { ticker: string; shortName: string; exchange: string; type: string; }

/* ── Ticker autocomplete input ─────────────────────────────────────────────── */
function TickerSearchInput({ value, onChange, onSelect }: {
  value: string; onChange: (v: string) => void; onSelect: (ticker: string, name: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const debRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  function handleInput(v: string) {
    onChange(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (!v) { setSuggestions([]); setOpen(false); return; }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/tickers?q=${encodeURIComponent(v)}`);
        const data: TickerSuggestion[] = await res.json();
        setSuggestions(data); setOpen(data.length > 0);
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    }, 280);
  }

  const TYPE: Record<string, string> = { EQUITY: "Acción", ETF: "ETF", CRYPTOCURRENCY: "Cripto", CURRENCY: "FX" };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input className="input-field font-mono uppercase pr-8" placeholder="Ej: AAPL.BA, GGAL.BA, BTC-USD"
          value={value} onChange={e => handleInput(e.target.value.toUpperCase())}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off" required autoFocus />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.30)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
          </span>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl"
          style={{ background: "#1E1E2E", border: "1px solid rgba(255,255,255,0.10)" }}>
          {suggestions.map(s => (
            <button key={s.ticker} type="button" onMouseDown={() => { onSelect(s.ticker, s.shortName); setOpen(false); setSuggestions([]); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
              <span className="w-14 text-xs font-mono font-bold flex-shrink-0" style={{ color: "#A5A0FF" }}>{s.ticker}</span>
              <span className="flex-1 text-sm truncate" style={{ color: "rgba(255,255,255,0.80)" }}>{s.shortName}</span>
              <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.30)" }}>
                {TYPE[s.type] ?? s.type}{s.exchange ? ` · ${s.exchange}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
type Tab = "resumen" | "inversiones" | "activos" | "pasivos";

export default function CarteraClient({ initialValuations, initialPosiciones, initialPasivos, accounts, categories }: CarteraClientProps) {
  const [tab, setTab] = useState<Tab>("resumen");

  /* ── Valuaciones ── */
  const [valuations, setValuations]     = useState(initialValuations);
  const [showValModal, setShowValModal] = useState(false);
  const [valLoading, setValLoading]     = useState(false);
  const [instrNombre, setInstrNombre]   = useState("");
  const [valMonto, setValMonto]         = useState("");
  const [valMoneda, setValMoneda]       = useState("ARS");
  const [valFecha, setValFecha]         = useState(new Date().toISOString().split("T")[0]);
  const sugerencias = Array.from(new Set(initialValuations.map((v: any) => v.instrumento_nombre)));

  function resetValForm() { setInstrNombre(""); setValMonto(""); setValMoneda("ARS"); setValFecha(new Date().toISOString().split("T")[0]); }

  async function handleSaveVal(e: React.FormEvent) {
    e.preventDefault();
    if (!instrNombre.trim() || !valMonto) return;
    setValLoading(true);
    try {
      const nv = await createValuation({ instrumento_nombre: instrNombre.trim(), monto: parseFloat(valMonto), moneda: valMoneda, fecha: valFecha, tipo_cambio: null });
      setValuations(prev => [nv, ...prev]);
      setShowValModal(false); resetValForm();
    } catch (err: any) { alert("Error: " + err.message); }
    finally { setValLoading(false); }
  }

  /* ── Posiciones ── */
  const [posiciones, setPosiciones]     = useState(initialPosiciones);
  const [quotes, setQuotes]             = useState<Record<string, Quote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError]   = useState("");
  const [showPosModal, setShowPosModal] = useState(false);
  const [editingPos, setEditingPos]     = useState<any>(null);
  const [posLoading, setPosLoading]     = useState(false);
  const [posError, setPosError]         = useState("");
  const [posTicker, setPosTicker]       = useState("");
  const [posNombre, setPosNombre]       = useState("");
  const [posCantidad, setPosCantidad]   = useState("");
  const [posPrecio, setPosPrecio]       = useState("");
  const [posMoneda, setPosMoneda]       = useState("USD");
  const [posBroker, setPosBroker]       = useState("");

  function resetPosForm() { setPosTicker(""); setPosNombre(""); setPosCantidad(""); setPosPrecio(""); setPosMoneda("USD"); setPosBroker(""); setPosError(""); setEditingPos(null); }
  function openEditPos(pos: any) { setEditingPos(pos); setPosTicker(pos.ticker); setPosNombre(pos.nombre||""); setPosCantidad(String(pos.cantidad)); setPosPrecio(pos.precio_compra?String(pos.precio_compra):""); setPosMoneda(pos.moneda); setPosBroker(pos.broker||""); setShowPosModal(true); }

  const fetchQuotes = useCallback(async () => {
    if (!posiciones.length) return;
    setQuotesLoading(true); setQuotesError("");
    try {
      const tickers = posiciones.map((p: any) => p.ticker).join(",");
      const res = await fetch(`/api/quotes?tickers=${encodeURIComponent(tickers)}`);
      if (!res.ok) throw new Error("Error al obtener cotizaciones");
      const data: Quote[] = await res.json();
      const map: Record<string, Quote> = {};
      data.forEach(q => { map[q.ticker] = q; });
      setQuotes(map);
    } catch (err: any) { setQuotesError(err.message); }
    finally { setQuotesLoading(false); }
  }, [posiciones]);

  useEffect(() => { if (posiciones.length > 0) fetchQuotes(); }, [fetchQuotes]);

  async function handleSavePos(e: React.FormEvent) {
    e.preventDefault();
    if (!posTicker.trim() || !posCantidad) return;
    setPosLoading(true); setPosError("");
    try {
      const payload = { ticker: posTicker.trim().toUpperCase(), nombre: posNombre.trim()||undefined, cantidad: parseFloat(posCantidad), precio_compra: posPrecio?parseFloat(posPrecio):undefined, moneda: posMoneda, broker: posBroker.trim()||undefined };
      if (editingPos) {
        const upd = await updatePosicion(editingPos.id, payload);
        setPosiciones(prev => prev.map(p => p.id === editingPos.id ? upd : p));
      } else {
        const crd = await createPosicion(payload);
        setPosiciones(prev => [...prev, crd]);
      }
      setShowPosModal(false); resetPosForm();
    } catch (err: any) { setPosError(err.message); }
    finally { setPosLoading(false); }
  }

  async function handleDeletePos(id: string) {
    if (!confirm("¿Eliminar esta posición?")) return;
    await deletePosicion(id);
    setPosiciones(prev => prev.filter(p => p.id !== id));
  }

  /* ── UVA value ── */
  const [uvaValor, setUvaValor]   = useState<number | null>(null);
  const [uvaFecha, setUvaFecha]   = useState("");
  const [uvaLoading, setUvaLoading] = useState(false);
  const [uvaError, setUvaError]     = useState("");
  const [uvaManual, setUvaManual]   = useState("");

  // Effective UVA value: fetched or manual entry
  const uvaEfectivo = uvaValor ?? (uvaManual ? parseFloat(uvaManual) : null);

  async function fetchUva() {
    setUvaLoading(true); setUvaError("");
    try {
      const res = await fetch("/api/uva");
      const data = await res.json();
      if (data.valor && data.valor > 100) {
        setUvaValor(data.valor); setUvaFecha(data.fecha); setUvaManual("");
      } else {
        setUvaError(data.error || "No se pudo obtener el valor del UVA.");
      }
    } catch (err: any) { setUvaError(err.message || "Error de conexión"); }
    finally { setUvaLoading(false); }
  }

  /* ── Pasivos ── */
  const [pasivos, setPasivos]           = useState(initialPasivos);
  const [showPasivoModal, setShowPasivoModal] = useState(false);
  const [editingPasivo, setEditingPasivo]     = useState<any>(null);
  const [pasivoLoading, setPasivoLoading]     = useState(false);
  const [pasivoError, setPasivoError]         = useState("");
  const [pNombre, setPNombre]     = useState("");
  const [pTipo, setPTipo]         = useState("prestamo");
  const [pSistema, setPSistema]   = useState("frances");
  const [pMontoOrig, setPMontoOrig] = useState("");
  const [pSaldo, setPSaldo]       = useState("");
  const [pMoneda, setPMoneda]     = useState("ARS");
  const [pTasa, setPTasa]         = useState("");
  const [pCuota, setPCuota]           = useState("");
  const [pCapitalUva, setPCapitalUva] = useState("");
  const [pNCuotas, setPNCuotas]       = useState("");
  const [pFechaI, setPFechaI]         = useState("");
  const [pFechaV, setPFechaV]         = useState("");

  /* ── Pago modal ── */
  const [showPagoModal, setShowPagoModal]       = useState(false);
  const [pagoTargetPasivo, setPagoTargetPasivo] = useState<any>(null);
  const [pagoMonto, setPagoMonto]               = useState("");
  const [pagoFecha, setPagoFecha]               = useState(new Date().toISOString().split("T")[0]);
  const [pagoCuentaId, setPagoCuentaId]         = useState("");
  const [pagoDesc, setPagoDesc]                 = useState("");
  const [pagoCatId, setPagoCatId]               = useState("");
  const [pagoLoading, setPagoLoading]           = useState(false);
  const [pagoError, setPagoError]               = useState("");

  /* ── Payment history per pasivo ── */
  const [expandedPasivoId, setExpandedPasivoId]     = useState<string | null>(null);
  const [pasivoHistory, setPasivoHistory]           = useState<Record<string, any[]>>({});
  const [historyLoading, setHistoryLoading]         = useState(false);
  const [projPage, setProjPage]                     = useState<Record<string, number>>({});
  const CER_MENSUAL_DEFAULT = 0.03; // 3% monthly inflation assumption

  function resetPasivoForm() {
    setPNombre(""); setPTipo("prestamo"); setPSistema("frances"); setPMontoOrig(""); setPSaldo("");
    setPMoneda("ARS"); setPTasa(""); setPCuota(""); setPCapitalUva(""); setPNCuotas("");
    setPFechaI(""); setPFechaV(""); setPasivoError(""); setEditingPasivo(null);
  }
  function openEditPasivo(p: any) {
    setEditingPasivo(p); setPNombre(p.nombre); setPTipo(p.tipo); setPSistema(p.sistema_amortizacion || "frances");
    setPMontoOrig(String(p.monto_original)); setPSaldo(String(p.saldo_pendiente));
    setPMoneda(p.moneda); setPTasa(p.tasa_interes ? String(p.tasa_interes) : "");
    setPCuota(p.cuota_mensual ? String(p.cuota_mensual) : "");
    setPCapitalUva(p.capital_uva ? String(p.capital_uva) : "");
    setPNCuotas(p.n_cuotas ? String(p.n_cuotas) : "");
    setPFechaI(p.fecha_inicio || ""); setPFechaV(p.fecha_vencimiento || "");
    setShowPasivoModal(true);
    if (p.sistema_amortizacion === "uva" && !uvaEfectivo) fetchUva();
  }

  // UVA loan calculations (French amortization)
  const uvaMonthlyRate   = pTasa ? parseFloat(pTasa) / 12 / 100 : 0;
  const uvaNInt          = pNCuotas ? parseInt(pNCuotas) : 0;
  const uvaCapitalFloat  = pCapitalUva ? parseFloat(pCapitalUva) : 0;
  const cuotaUvaCalc     = (uvaCapitalFloat > 0 && uvaNInt > 0)
    ? (uvaMonthlyRate > 0
      ? (uvaCapitalFloat * uvaMonthlyRate) / (1 - Math.pow(1 + uvaMonthlyRate, -uvaNInt))
      : uvaCapitalFloat / uvaNInt)
    : null;
  const cuotaARSCalc  = cuotaUvaCalc && uvaEfectivo ? cuotaUvaCalc * uvaEfectivo : null;
  const montoARSCalc  = uvaCapitalFloat > 0 && uvaEfectivo ? uvaCapitalFloat * uvaEfectivo : null;

  function calcFechaVenc(fechaInicio: string, nCuotas: number): string {
    const d = new Date(fechaInicio + "T12:00:00");
    d.setMonth(d.getMonth() + nCuotas - 1);
    return d.toISOString().split("T")[0];
  }

  async function handleSavePasivo(e: React.FormEvent) {
    e.preventDefault();
    const isUva = pSistema === "uva";
    const montoFinal = isUva
      ? (montoARSCalc || uvaCapitalFloat || parseFloat(pMontoOrig || "0"))
      : parseFloat(pMontoOrig);
    const saldoFinal = isUva && !editingPasivo
      ? montoFinal
      : parseFloat(pSaldo || String(montoFinal));
    if (!pNombre.trim() || !montoFinal) return;
    setPasivoLoading(true); setPasivoError("");
    try {
      const payload = {
        nombre: pNombre.trim(), tipo: pTipo, sistema_amortizacion: pSistema,
        monto_original: montoFinal,
        saldo_pendiente: saldoFinal,
        moneda: pMoneda, tasa_interes: pTasa ? parseFloat(pTasa) : undefined,
        cuota_mensual: isUva && cuotaARSCalc ? cuotaARSCalc : (pCuota ? parseFloat(pCuota) : undefined),
        cuota_uva: isUva && cuotaUvaCalc ? cuotaUvaCalc : undefined,
        capital_uva: isUva && uvaCapitalFloat > 0 ? uvaCapitalFloat : undefined,
        n_cuotas: isUva && uvaNInt > 0 ? uvaNInt : undefined,
        fecha_inicio: pFechaI || undefined,
        fecha_vencimiento: isUva && pFechaI && uvaNInt > 0 ? calcFechaVenc(pFechaI, uvaNInt) : (pFechaV || undefined),
      };
      if (editingPasivo) {
        const upd = await updatePasivo(editingPasivo.id, payload);
        setPasivos(prev => prev.map(p => p.id === editingPasivo.id ? upd : p));
      } else {
        const crd = await createPasivo(payload);
        setPasivos(prev => [...prev, crd]);

        // Auto-create a monthly recurring expense for the loan installment
        const cuotaFinal = payload.cuota_mensual;
        if (cuotaFinal && cuotaFinal > 0) {
          const diaDelMes = pFechaI
            ? Math.min(new Date(pFechaI + "T12:00:00").getDate(), 28)
            : 1;
          await createRecurrente({
            nombre: `Cuota: ${pNombre.trim()}`,
            monto: Math.round(cuotaFinal),
            moneda: pMoneda,
            tipo: "gasto",
            dia_del_mes: diaDelMes,
            fecha_inicio: pFechaI || new Date().toISOString().split("T")[0],
            fecha_fin: payload.fecha_vencimiento || null,
            categoria_id: null,
            cuenta_id: null,
            tasa_interes: null,
            activo: true,
          }).catch(() => { /* non-blocking: recurrente creation is best-effort */ });
        }
      }
      setShowPasivoModal(false); resetPasivoForm();
    } catch (err: any) { setPasivoError(err.message); }
    finally { setPasivoLoading(false); }
  }

  async function handleDeletePasivo(id: string) {
    if (!confirm("¿Eliminar este pasivo?")) return;
    await deletePasivo(id);
    setPasivos(prev => prev.filter(p => p.id !== id));
  }

  function openPagoModal(p: any) {
    setPagoTargetPasivo(p);
    const cuotaBase = p.sistema_amortizacion === "uva" && p.cuota_uva && uvaEfectivo
      ? p.cuota_uva * uvaEfectivo : p.cuota_mensual;
    setPagoMonto(cuotaBase ? String(Math.round(cuotaBase)) : "");
    setPagoFecha(new Date().toISOString().split("T")[0]);
    setPagoCuentaId(accounts[0]?.id || "");
    setPagoDesc(`Cuota ${p.nombre}`);
    setPagoCatId("");
    setPagoError("");
    setShowPagoModal(true);
    if (p.sistema_amortizacion === "uva" && !uvaEfectivo) fetchUva();
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!pagoMonto || !pagoCuentaId) return;
    setPagoLoading(true); setPagoError("");
    const montoNum = parseFloat(pagoMonto);
    try {
      await registrarPagoPasivo(
        pagoTargetPasivo.id, montoNum, pagoFecha,
        pagoCuentaId || null, pagoDesc || "", pagoCatId || null,
        uvaEfectivo ?? undefined,
      );
      // Recalculate displayed balance
      let newSaldo: number;
      if (pagoTargetPasivo.sistema_amortizacion === "uva" && pagoTargetPasivo.capital_uva && uvaEfectivo) {
        const uvaEquiv = montoNum / uvaEfectivo;
        const prevUdasPagadas = pasivoHistory[pagoTargetPasivo.id]
          ?.reduce((s: number, p: any) => s + (Number(p.uva_equivalente) || 0), 0) || 0;
        const saldoUdas = Math.max(0, Number(pagoTargetPasivo.capital_uva) - prevUdasPagadas - uvaEquiv);
        newSaldo = saldoUdas * uvaEfectivo;
      } else {
        newSaldo = Math.max(0, Number(pagoTargetPasivo.saldo_pendiente) - montoNum);
      }
      setPasivos(prev => prev.map(p => p.id === pagoTargetPasivo.id ? { ...p, saldo_pendiente: newSaldo } : p));
      // Refresh history if visible
      if (expandedPasivoId === pagoTargetPasivo.id) {
        const hist = await getPagosPasivo(pagoTargetPasivo.id);
        setPasivoHistory(prev => ({ ...prev, [pagoTargetPasivo.id]: hist }));
      }
      setShowPagoModal(false);
    } catch (err: any) { setPagoError(err.message); }
    finally { setPagoLoading(false); }
  }

  async function togglePasivoHistory(pasivoId: string) {
    if (expandedPasivoId === pasivoId) { setExpandedPasivoId(null); return; }
    setExpandedPasivoId(pasivoId);
    if (!pasivoHistory[pasivoId]) {
      setHistoryLoading(true);
      try {
        const hist = await getPagosPasivo(pasivoId);
        setPasivoHistory(prev => ({ ...prev, [pasivoId]: hist }));
      } finally { setHistoryLoading(false); }
    }
  }

  async function handleDeletePago(pagoId: string, pasivoId: string) {
    if (!confirm("\u00BFEliminar este pago? El saldo pendiente se recalculará.")) return;
    try {
      await deletePagoPasivo(pagoId, pasivoId, uvaEfectivo ?? undefined);
      const hist = await getPagosPasivo(pasivoId);
      setPasivoHistory(prev => ({ ...prev, [pasivoId]: hist }));
      // Reload pasivo list to get new saldo_pendiente
      const updatedPasivos = await import("@/lib/actions").then(m => m.getPasivos ? m.getPasivos() : null);
      if (updatedPasivos) setPasivos(updatedPasivos);
    } catch (err: any) { alert("Error: " + err.message); }
  }

  // Generate installment projection for a UVA loan
  function calcProyeccion(p: any, uvaActual: number, cerMensual: number, page: number) {
    if (!p.capital_uva || !p.cuota_uva || !p.fecha_inicio) return [];
    const cuotaUva = Number(p.cuota_uva);
    const totalUvasPagadas = (pasivoHistory[p.id] || [])
      .reduce((s: number, pg: any) => s + (Number(pg.uva_equivalente) || 0), 0);
    const cuotasPagadas = Math.round(totalUvasPagadas / cuotaUva);
    const start = cuotasPagadas + page * 10;
    const result = [];
    let uvaProyectado = uvaActual;
    for (let i = 0; i < start; i++) uvaProyectado *= (1 + cerMensual);
    const fechaBase = new Date(p.fecha_inicio + "T12:00:00");
    fechaBase.setMonth(fechaBase.getMonth() + start);
    for (let i = 0; i < 10; i++) {
      const nCuota = start + i + 1;
      if (nCuota > Number(p.n_cuotas)) break;
      const fecha = new Date(fechaBase);
      fecha.setMonth(fecha.getMonth() + i);
      const mesMostrar = fecha.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
      result.push({
        nCuota, mesMostrar,
        uvaVal: uvaProyectado,
        cuotaArs: Math.round(cuotaUva * uvaProyectado),
      });
      uvaProyectado *= (1 + cerMensual);
    }
    return result;
  }

  /* ── Cálculos patrimonio ── */
  const latestByInstr = valuations.reduce((acc: any, curr: any) => { if (!acc[curr.instrumento_nombre]) acc[curr.instrumento_nombre] = curr; return acc; }, {});
  const dataSeries = Object.values(latestByInstr).map((v: any, i: number) => ({ name: v.instrumento_nombre, value: Number(v.monto), moneda: v.moneda, color: COLORES[i % COLORES.length] }));
  const totalActivosFisicos = dataSeries.reduce((s, i: any) => i.moneda === "USD" ? s + i.value * TC_REF : s + i.value, 0);

  const totalPosUSD = posiciones.reduce((sum: number, pos: any) => {
    const q = quotes[pos.ticker];
    if (!q?.price) return sum;
    const val = Number(pos.cantidad) * q.price;
    return pos.moneda === "USD" ? sum + val : sum + val / TC_REF;
  }, 0);
  const totalInversionesARS = totalPosUSD * TC_REF;

  const totalPasivosARS = pasivos.reduce((s: number, p: any) => p.moneda === "USD" ? s + Number(p.saldo_pendiente) * TC_REF : s + Number(p.saldo_pendiente), 0);
  const totalActivosARS = totalActivosFisicos + totalInversionesARS;
  const patrimonioNeto  = totalActivosARS - totalPasivosARS;

  const TIPO_PASIVO_LABELS: Record<string, string> = { prestamo: "Préstamo", hipoteca: "Hipoteca", tarjeta: "Tarjeta", leasing: "Leasing", otro: "Otro" };

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Patrimonio</h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>Activos, inversiones y pasivos</p>
        </div>
        {tab === "activos"    && <button onClick={() => setShowValModal(true)}                            className="btn-primary text-sm">+ Activo físico</button>}
        {tab === "inversiones"&& <button onClick={() => { resetPosForm(); setShowPosModal(true); }}       className="btn-primary text-sm">+ Posición</button>}
        {tab === "pasivos"    && <button onClick={() => { resetPasivoForm(); setShowPasivoModal(true); }} className="btn-primary text-sm">+ Pasivo</button>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(["resumen","inversiones","activos","pasivos"] as Tab[]).map(t => {
          const labels: Record<Tab, string> = { resumen: "📊 Resumen", inversiones: "📈 Inversiones", activos: "🏠 Activos", pasivos: "📉 Pasivos" };
          return (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap"
              style={tab === t ? { background: "rgba(108,99,255,0.25)", color: "#A5A0FF" } : { color: "rgba(255,255,255,0.40)" }}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* ══ TAB: Resumen ══ */}
      {tab === "resumen" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Patrimonio neto", val: patrimonioNeto, color: patrimonioNeto >= 0 ? "#10B981" : "#EF4444", accent: "#10B981" },
              { label: "Total activos",   val: totalActivosARS, color: "rgba(255,255,255,0.90)", accent: "#6C63FF" },
              { label: "Total pasivos",   val: totalPasivosARS, color: "#EF4444", accent: "#EF4444" },
              { label: "TC referencia",   val: TC_REF, color: "rgba(255,255,255,0.90)", accent: "#F59E0B", isTc: true },
            ].map(k => (
              <div key={k.label} className="kpi-card" style={{ "--accent": k.accent } as React.CSSProperties}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.38)" }}>{k.label}</p>
                <p className="text-lg font-bold font-mono" style={{ color: k.color }}>
                  {(k as any).isTc ? `$ ${k.val.toLocaleString()}` : `$ ${Math.abs(k.val).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
                </p>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          {(totalActivosFisicos > 0 || totalInversionesARS > 0 || totalPasivosARS > 0) ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Chart */}
              <div className="glass-card p-6">
                <h2 className="text-base font-semibold mb-4" style={{ color: "rgba(255,255,255,0.9)" }}>Composición patrimonial</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={[
                      ...(totalActivosFisicos > 0 ? [{ name: "Activos físicos", value: totalActivosFisicos, color: "#10B981" }] : []),
                      ...(totalInversionesARS > 0 ? [{ name: "Inversiones", value: totalInversionesARS, color: "#6C63FF" }] : []),
                      ...(totalPasivosARS > 0 ? [{ name: "Pasivos", value: totalPasivosARS, color: "#EF4444" }] : []),
                    ]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {[totalActivosFisicos, totalInversionesARS, totalPasivosARS].filter(v => v > 0).map((_, i) => (
                        <Cell key={i} fill={["#10B981","#6C63FF","#EF4444"][i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "rgba(20,20,38,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 12 }}
                      formatter={(v: any) => [`$ ${Number(v).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`, ""]} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Summary rows */}
              <div className="glass-card overflow-hidden">
                <div className="p-5 pb-3">
                  <h2 className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>Detalle</h2>
                </div>
                {[
                  { label: "Activos físicos", sublabel: `${dataSeries.length} instrumento${dataSeries.length !== 1 ? "s" : ""}`, value: totalActivosFisicos, color: "#10B981" },
                  { label: "Inversiones", sublabel: `${posiciones.length} posición${posiciones.length !== 1 ? "es" : ""}`, value: totalInversionesARS, color: "#6C63FF" },
                  { label: "Total activos", sublabel: "", value: totalActivosARS, color: "#22D3EE", bold: true },
                  { label: "Total pasivos", sublabel: `${pasivos.length} deuda${pasivos.length !== 1 ? "s" : ""}`, value: -totalPasivosARS, color: "#EF4444" },
                  { label: "Patrimonio neto", sublabel: "", value: patrimonioNeto, color: patrimonioNeto >= 0 ? "#10B981" : "#EF4444", bold: true },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                    <div>
                      <p className={`text-sm ${row.bold ? "font-bold" : "font-medium"}`} style={{ color: row.bold ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.70)" }}>{row.label}</p>
                      {row.sublabel && <p className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>{row.sublabel}</p>}
                    </div>
                    <span className={`font-mono font-bold ${row.bold ? "text-base" : "text-sm"}`} style={{ color: row.color }}>
                      {row.value >= 0 ? "" : "-"}$ {Math.abs(row.value).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card p-16 text-center">
              <p className="text-5xl mb-4">🏦</p>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>Empezá a registrar tu patrimonio</h3>
              <p className="text-sm max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.40)" }}>
                Cargá tus activos físicos (casa, auto), inversiones (acciones, CEDEARs) y pasivos (préstamos) para ver tu balance real.
              </p>
              <div className="flex gap-3 justify-center mt-6 flex-wrap">
                <button onClick={() => setTab("activos")} className="btn-secondary text-sm">🏠 Activos</button>
                <button onClick={() => setTab("inversiones")} className="btn-secondary text-sm">📈 Inversiones</button>
                <button onClick={() => setTab("pasivos")} className="btn-secondary text-sm">📉 Pasivos</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: Inversiones ══ */}
      {tab === "inversiones" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {quotesLoading ? "Actualizando..." : quotesError ? <span style={{ color: "#EF4444" }}>{quotesError}</span> : Object.keys(quotes).length > 0 ? "Cotizaciones vía Yahoo Finance (hasta 15 min demora)" : ""}
            </p>
            {posiciones.length > 0 && (
              <button onClick={fetchQuotes} disabled={quotesLoading}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={quotesLoading ? "animate-spin" : ""}>
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Actualizar
              </button>
            )}
          </div>

          {posiciones.length === 0 ? (
            <div className="glass-card p-14 text-center">
              <p className="text-5xl mb-4">📈</p>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>Sin posiciones</h3>
              <p className="text-sm max-w-sm mx-auto mb-4" style={{ color: "rgba(255,255,255,0.40)" }}>
                Agregá tus acciones, CEDEARs o criptomonedas con su ticker de Yahoo Finance.
              </p>
              <p className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.28)" }}>
                Ej: <code>AAPL</code> · <code>AAPL.BA</code> · <code>GGAL.BA</code> · <code>BTC-USD</code> · <code>YPF</code>
              </p>
              <button onClick={() => { resetPosForm(); setShowPosModal(true); }} className="btn-primary mx-auto">Agregar primera posición</button>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="data-table w-full">
                <thead>
                  <tr><th>Ticker</th><th style={{ textAlign: "right" }}>Precio</th><th style={{ textAlign: "right" }}>Var.</th><th style={{ textAlign: "right" }}>Cantidad</th><th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>P&L</th><th /></tr>
                </thead>
                <tbody>
                  {posiciones.map((pos: any, i: number) => {
                    const q = quotes[pos.ticker];
                    const valorActual  = q?.price != null ? Number(pos.cantidad) * q.price : null;
                    const costoTotal   = pos.precio_compra ? Number(pos.cantidad) * Number(pos.precio_compra) : null;
                    const pnl          = valorActual != null && costoTotal != null ? valorActual - costoTotal : null;
                    const pnlPct       = pnl != null && costoTotal ? (pnl / costoTotal) * 100 : null;
                    const isPos        = (pnl ?? 0) >= 0;
                    return (
                      <tr key={pos.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: COLORES[i % COLORES.length] + "33", color: COLORES[i % COLORES.length] }}>
                              {pos.ticker.slice(0, 2)}
                            </span>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>{pos.ticker}</p>
                              {(pos.nombre || pos.broker) && <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{[pos.nombre, pos.broker].filter(Boolean).join(" · ")}</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {q?.price != null
                            ? <span className="font-mono text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{q.currency === "ARS" ? "$" : "U$S"} {q.price.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
                            : <span style={{ color: "rgba(255,255,255,0.25)" }}>{quotesLoading ? "…" : "—"}</span>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {q?.changePercent != null
                            ? <span className="text-xs font-bold" style={{ color: q.changePercent >= 0 ? "#10B981" : "#EF4444" }}>{q.changePercent >= 0 ? "▲" : "▼"} {Math.abs(q.changePercent).toFixed(2)}%</span>
                            : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>{Number(pos.cantidad).toLocaleString("es-AR", { maximumFractionDigits: 4 })}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {valorActual != null
                            ? <span className="font-mono text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{pos.moneda === "ARS" ? "$" : "U$S"} {valorActual.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                            : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {pnl != null ? (
                            <div>
                              <p className="font-mono text-xs font-bold" style={{ color: isPos ? "#10B981" : "#EF4444" }}>{isPos ? "+" : ""}{pnl.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
                              {pnlPct != null && <p className="text-[10px]" style={{ color: isPos ? "#10B981" : "#EF4444" }}>{isPos ? "+" : ""}{pnlPct.toFixed(1)}%</p>}
                            </div>
                          ) : <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEditPos(pos)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(255,255,255,0.30)" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => handleDeletePos(pos.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(239,68,68,0.5)" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-5 py-2 text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>Tickers con .BA = mercado argentino (BCBA)</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: Activos físicos ══ */}
      {tab === "activos" && (
        dataSeries.length === 0 ? (
          <div className="glass-card p-14 text-center">
            <p className="text-5xl mb-4">🏠</p>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>Sin activos registrados</h3>
            <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: "rgba(255,255,255,0.40)" }}>
              Registrá el valor de tus activos físicos: inmuebles, automóviles, FCI, efectivo no bancarizado, etc.
            </p>
            <button onClick={() => setShowValModal(true)} className="btn-primary mx-auto">Registrar activo</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h2 className="text-base font-semibold mb-4" style={{ color: "rgba(255,255,255,0.9)" }}>Distribución</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={dataSeries} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {dataSeries.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "rgba(20,20,38,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 12 }}
                    formatter={(v: any, name: any, props: any) => [props.payload.moneda === "USD" ? `U$S ${Number(v).toLocaleString()}` : formatCurrency(v, "ARS", true), name]} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="p-5 pb-3"><h2 className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>Últimas valuaciones</h2></div>
              <table className="data-table">
                <thead><tr><th>Activo</th><th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>%</th></tr></thead>
                <tbody>
                  {dataSeries.map((v: any, i: number) => {
                    const pct = totalActivosFisicos > 0 ? ((v.moneda === "USD" ? v.value * TC_REF : v.value) / totalActivosFisicos) * 100 : 0;
                    return (
                      <tr key={i}>
                        <td><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.color }} /><span className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)", maxWidth: 140 }}>{v.name}</span></div></td>
                        <td style={{ textAlign: "right", color: "rgba(255,255,255,0.85)" }} className="font-mono text-sm font-semibold">{v.moneda === "USD" ? `U$S ${Number(v.value).toLocaleString()}` : formatCurrency(v.value, "ARS", true)}</td>
                        <td style={{ textAlign: "right" }}><span className="text-xs font-bold" style={{ color: v.color }}>{pct.toFixed(1)}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ══ TAB: Pasivos ══ */}
      {tab === "pasivos" && (
        pasivos.length === 0 ? (
          <div className="glass-card p-14 text-center">
            <p className="text-5xl mb-4">✅</p>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>Sin pasivos registrados</h3>
            <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: "rgba(255,255,255,0.40)" }}>
              Registrá tus deudas, préstamos, hipotecas o saldos de tarjeta para calcular tu patrimonio neto real.
            </p>
            <button onClick={() => { resetPasivoForm(); setShowPasivoModal(true); }} className="btn-primary mx-auto">Registrar deuda</button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            {pasivos.map((p: any) => {
              const pct = Number(p.monto_original) > 0
                ? ((Number(p.monto_original) - Number(p.saldo_pendiente)) / Number(p.monto_original)) * 100
                : 0;
              const isExpanded = expandedPasivoId === p.id;
              const isUva = p.sistema_amortizacion === "uva";
              const history = pasivoHistory[p.id] || [];
              const pageNum = projPage[p.id] || 0;
              const proyeccion = isUva && uvaEfectivo
                ? calcProyeccion(p, uvaEfectivo, CER_MENSUAL_DEFAULT, pageNum)
                : [];
              const totalUdas = p.capital_uva || 0;
              const udasPagadas = history.reduce((s: number, pg: any) => s + (Number(pg.uva_equivalente) || 0), 0);
              const saldoUdas = Math.max(0, Number(totalUdas) - udasPagadas);

              return (
                <div key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {/* Main row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Expand button */}
                    <button onClick={() => togglePasivoHistory(p.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 transition-all"
                      style={{ background: isExpanded ? "rgba(108,99,255,0.20)" : "rgba(255,255,255,0.05)", color: isExpanded ? "#A5A0FF" : "rgba(255,255,255,0.35)" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        {isExpanded ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                      </svg>
                    </button>

                    {/* Name & info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>{p.nombre}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>{TIPO_PASIVO_LABELS[p.tipo] ?? p.tipo}</span>
                        {isUva && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(108,99,255,0.15)", color: "#A5A0FF" }}>UVA</span>}
                      </div>
                      {p.fecha_vencimiento && <p className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>Vence: {p.fecha_vencimiento}</p>}
                    </div>

                    {/* UVA saldo or ARS saldo */}
                    <div className="text-right flex-shrink-0">
                      {isUva && p.capital_uva ? (
                        <>
                          <p className="font-mono text-sm font-bold" style={{ color: "#EF4444" }}>
                            {uvaEfectivo
                              ? `$ ${(saldoUdas * uvaEfectivo).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                              : `${saldoUdas.toLocaleString("es-AR", { maximumFractionDigits: 1 })} UVAs`
                            }
                          </p>
                          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {saldoUdas.toLocaleString("es-AR", { maximumFractionDigits: 1 })} UVAs de {Number(totalUdas).toLocaleString("es-AR", { maximumFractionDigits: 1 })}
                          </p>
                        </>
                      ) : (
                        <p className="font-mono text-sm font-bold" style={{ color: "#EF4444" }}>
                          {p.moneda === "USD" ? "U$S" : "$"} {Number(p.saldo_pendiente).toLocaleString("es-AR")}
                        </p>
                      )}
                      {/* Progress */}
                      <div className="flex items-center gap-1.5 mt-1 justify-end">
                        <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: "#10B981" }} />
                        </div>
                        <span className="text-[10px] font-bold" style={{ color: "#10B981" }}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { openPagoModal(p); if (isUva && !uvaEfectivo) fetchUva(); }}
                        className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg"
                        style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Pago
                      </button>
                      <button onClick={() => openEditPasivo(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(255,255,255,0.30)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleDeletePasivo(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(239,68,68,0.5)" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded: History + Projection */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4" style={{ background: "rgba(0,0,0,0.15)" }}>

                      {/* Payment History */}
                      <div>
                        <p className="text-xs font-semibold uppercase mb-2" style={{ color: "rgba(255,255,255,0.40)" }}>Historial de pagos</p>
                        {historyLoading ? (
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>Cargando...</p>
                        ) : history.length === 0 ? (
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Sin pagos registrados aún.</p>
                        ) : (
                          <div className="space-y-1">
                            {history.map((pg: any) => (
                              <div key={pg.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                                style={{ background: "rgba(255,255,255,0.04)" }}>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                                    {pg.fecha} · $ {Number(pg.monto_ars).toLocaleString("es-AR")}
                                  </p>
                                  {pg.uva_equivalente && (
                                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                                      {Number(pg.uva_equivalente).toLocaleString("es-AR", { maximumFractionDigits: 2 })} UVAs
                                      {pg.uva_valor ? ` · 1 UVA = $${Number(pg.uva_valor).toLocaleString("es-AR", { maximumFractionDigits: 2 })}` : ""}
                                    </p>
                                  )}
                                  {pg.descripcion && <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.25)" }}>{pg.descripcion}</p>}
                                </div>
                                <button onClick={() => handleDeletePago(pg.id, p.id)}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 hover:bg-red-500/10"
                                  style={{ color: "rgba(239,68,68,0.5)" }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Installment Projection (UVA only) */}
                      {isUva && p.capital_uva && p.cuota_uva && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold uppercase" style={{ color: "rgba(255,255,255,0.40)" }}>
                              Proyección de cuotas
                              <span className="ml-1 font-normal normal-case" style={{ color: "rgba(255,255,255,0.25)" }}>
                                (CER {(CER_MENSUAL_DEFAULT * 100).toFixed(0)}%/mes estimado)
                              </span>
                            </p>
                            {!uvaEfectivo && (
                              <button onClick={fetchUva} className="text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(108,99,255,0.20)", color: "#A5A0FF" }}>
                                Traer UVA
                              </button>
                            )}
                          </div>
                          {uvaEfectivo ? (
                            <>
                              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                                      <th className="px-3 py-1.5 text-left" style={{ color: "rgba(255,255,255,0.35)" }}>N°</th>
                                      <th className="px-3 py-1.5 text-left" style={{ color: "rgba(255,255,255,0.35)" }}>Mes</th>
                                      <th className="px-3 py-1.5 text-right" style={{ color: "rgba(255,255,255,0.35)" }}>UVA est.</th>
                                      <th className="px-3 py-1.5 text-right" style={{ color: "rgba(255,255,255,0.35)" }}>Cuota ARS</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {proyeccion.map((c) => (
                                      <tr key={c.nCuota} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                        <td className="px-3 py-1.5 font-mono" style={{ color: "rgba(255,255,255,0.40)" }}>{c.nCuota}</td>
                                        <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.60)" }}>{c.mesMostrar}</td>
                                        <td className="px-3 py-1.5 text-right font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>${c.uvaVal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: "#A5A0FF" }}>${c.cuotaArs.toLocaleString("es-AR")}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <button
                                  onClick={() => setProjPage(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}
                                  disabled={(projPage[p.id] || 0) === 0}
                                  className="text-[10px] px-2 py-1 rounded-lg disabled:opacity-30"
                                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)" }}>
                                  ← Anteriores
                                </button>
                                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                                  Cuotas {(projPage[p.id] || 0) * 10 + 1}–{Math.min(Number(p.n_cuotas), (projPage[p.id] || 0) * 10 + 10)} de {p.n_cuotas}
                                </span>
                                <button
                                  onClick={() => setProjPage(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                                  disabled={((projPage[p.id] || 0) + 1) * 10 >= Number(p.n_cuotas)}
                                  className="text-[10px] px-2 py-1 rounded-lg disabled:opacity-30"
                                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)" }}>
                                  Ver próximas 10 →
                                </button>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Necesitás el valor UVA actual para proyectar las cuotas.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.50)" }}>Total deuda pendiente</p>
              <p className="font-mono font-bold" style={{ color: "#EF4444" }}>$ {totalPasivosARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        )
      )}

      {/* ══ MODAL: Activo físico ══ */}
      {showValModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Nuevo activo físico</h2>
                <button onClick={() => { setShowValModal(false); resetValForm(); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <form onSubmit={handleSaveVal} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Nombre del activo</label>
                  <input type="text" list="sugs" className="input-field" placeholder="Ej: Casa Palermo, Auto 2021, FCI Pionero"
                    value={instrNombre} onChange={e => setInstrNombre(e.target.value)} required autoComplete="off" autoFocus />
                  <datalist id="sugs">{sugerencias.map((s: string) => <option key={s} value={s} />)}</datalist>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Valor</label>
                    <input type="number" className="input-field font-mono" placeholder="0" value={valMonto} onChange={e => setValMonto(e.target.value)} onFocus={e => e.target.select()} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Moneda</label>
                    <select className="input-field" value={valMoneda} onChange={e => setValMoneda(e.target.value)}>
                      <option value="ARS">$ ARS</option><option value="USD">U$S USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Fecha de valuación</label>
                  <input type="date" className="input-field" value={valFecha} onChange={e => setValFecha(e.target.value)} required />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowValModal(false); resetValForm(); }} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={valLoading}>{valLoading ? "Guardando..." : "Guardar"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Posición ══ */}
      {showPosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{editingPos ? "Editar posición" : "Nueva posición"}</h2>
                <button onClick={() => { setShowPosModal(false); resetPosForm(); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <form onSubmit={handleSavePos} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Ticker *</label>
                    <TickerSearchInput value={posTicker} onChange={setPosTicker} onSelect={(t, n) => { setPosTicker(t); if (!posNombre) setPosNombre(n); }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Cantidad *</label>
                    <input type="number" className="input-field font-mono" placeholder="0" min="0" step="any" value={posCantidad} onChange={e => setPosCantidad(e.target.value)} onFocus={e => e.target.select()} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Nombre (opcional)</label>
                  <input className="input-field" placeholder="Ej: Apple Inc." value={posNombre} onChange={e => setPosNombre(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Precio compra</label>
                    <input type="number" className="input-field font-mono" placeholder="0" min="0" step="any" value={posPrecio} onChange={e => setPosPrecio(e.target.value)} onFocus={e => e.target.select()} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Moneda</label>
                    <select className="input-field" value={posMoneda} onChange={e => setPosMoneda(e.target.value)}>
                      <option value="USD">USD</option><option value="ARS">ARS</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Broker (opcional)</label>
                  <input className="input-field" placeholder="Ej: IOL, Bull Market, Balanz..." value={posBroker} onChange={e => setPosBroker(e.target.value)} />
                </div>
                {posError && <p className="text-xs" style={{ color: "#EF4444" }}>{posError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowPosModal(false); resetPosForm(); }} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={posLoading}>{posLoading ? "Guardando..." : editingPos ? "Actualizar" : "Agregar"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Registrar pago ══ */}
      {showPagoModal && pagoTargetPasivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md">
            <div className="p-6">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>Registrar pago</h2>
                  <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{pagoTargetPasivo.nombre}</p>
                </div>
                <button onClick={() => setShowPagoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Saldo info */}
              <div className="rounded-xl p-3 my-4 flex items-center justify-between" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Saldo pendiente actual</span>
                <span className="font-mono font-bold text-sm" style={{ color: "#EF4444" }}>
                  {pagoTargetPasivo.moneda === "USD" ? "U$S" : "$"} {Number(pagoTargetPasivo.saldo_pendiente).toLocaleString("es-AR")}
                </span>
              </div>

              {/* UVA payment breakdown */}
              {pagoTargetPasivo.sistema_amortizacion === "uva" && (
                <div className="rounded-xl p-3 mb-2 space-y-1.5" style={{ background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.20)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase" style={{ color: "#A5A0FF" }}>Crédito UVA</span>
                    {uvaEfectivo
                      ? <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>1 UVA = ${uvaEfectivo.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
                      : <button type="button" onClick={fetchUva} className="text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(108,99,255,0.25)", color: "#A5A0FF" }}>Traer UVA</button>
                    }
                  </div>
                  {uvaEfectivo && pagoTargetPasivo.cuota_uva && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                      Cuota sugerida: <strong style={{ color: "#A5A0FF" }}>$ {Math.round(pagoTargetPasivo.cuota_uva * uvaEfectivo).toLocaleString("es-AR")}</strong>
                      <span style={{ color: "rgba(255,255,255,0.35)" }}> ({Number(pagoTargetPasivo.cuota_uva).toLocaleString("es-AR", { maximumFractionDigits: 2 })} UVAs)</span>
                    </p>
                  )}
                  {pagoMonto && uvaEfectivo && parseFloat(pagoMonto) > 0 && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                      Este pago representa: <strong style={{ color: "#22D3EE" }}>{(parseFloat(pagoMonto) / uvaEfectivo).toLocaleString("es-AR", { maximumFractionDigits: 2 })} UVAs</strong>
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleRegistrarPago} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Monto pagado en ARS *</label>
                    <input type="number" className="input-field font-mono" placeholder="0" min="0" step="any"
                      value={pagoMonto} onChange={e => setPagoMonto(e.target.value)} onFocus={e => e.target.select()} required autoFocus />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Fecha</label>
                    <input type="date" className="input-field" value={pagoFecha} onChange={e => setPagoFecha(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Cuenta débito *</label>
                  <select className="input-field" value={pagoCuentaId} onChange={e => setPagoCuentaId(e.target.value)} required>
                    <option value="">Seleccionar cuenta…</option>
                    {accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Categoría (opcional)</label>
                  <select className="input-field" value={pagoCatId} onChange={e => setPagoCatId(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Descripción</label>
                  <input className="input-field" placeholder="Ej: Cuota enero" value={pagoDesc} onChange={e => setPagoDesc(e.target.value)} />
                </div>
                {pagoError && <p className="text-xs" style={{ color: "#EF4444" }}>{pagoError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPagoModal(false)} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={pagoLoading}>
                    {pagoLoading ? "Registrando…" : "Registrar pago"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Pasivo ══ */}
      {showPasivoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{editingPasivo ? "Editar deuda" : "Nueva deuda / pasivo"}</h2>
                <button onClick={() => { setShowPasivoModal(false); resetPasivoForm(); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <form onSubmit={handleSavePasivo} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Nombre *</label>
                  <input className="input-field" placeholder="Ej: Préstamo personal Banco Nación" value={pNombre} onChange={e => setPNombre(e.target.value)} required autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Tipo</label>
                    <select className="input-field" value={pTipo} onChange={e => setPTipo(e.target.value)}>
                      <option value="prestamo">Préstamo</option>
                      <option value="hipoteca">Hipoteca</option>
                      <option value="tarjeta">Tarjeta de crédito</option>
                      <option value="leasing">Leasing</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Moneda</label>
                    <select className="input-field" value={pMoneda} onChange={e => setPMoneda(e.target.value)}>
                      <option value="ARS">$ ARS</option><option value="USD">U$S USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Sistema de amortización</label>
                  <select className="input-field" value={pSistema} onChange={e => { setPSistema(e.target.value); if (e.target.value === "uva" && !uvaEfectivo) fetchUva(); }}>
                    <option value="frances">Francés (cuota fija)</option>
                    <option value="aleman">Alemán (amortización fija)</option>
                    <option value="uva">UVA (ajustado por inflación)</option>
                    <option value="bullet">Bullet (pago al vencimiento)</option>
                    <option value="variable">Variable</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                {/* ── UVA panel (visible only when sistema = uva) ── */}
                {pSistema === "uva" ? (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(108,99,255,0.08)", border: "1px solid rgba(108,99,255,0.20)" }}>

                    {/* UVA value row */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs font-semibold uppercase" style={{ color: "#A5A0FF" }}>Simulación UVA</p>
                      {uvaLoading ? (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>Consultando BCRA…</span>
                      ) : uvaEfectivo ? (
                        <span className="flex items-center gap-2 text-xs font-mono" style={{ color: "rgba(255,255,255,0.60)" }}>
                          1 UVA = $ {uvaEfectivo.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                          {uvaFecha ? ` · ${uvaFecha}` : ""}
                          <button type="button" onClick={fetchUva} className="underline text-[10px]" style={{ color: "#A5A0FF" }}>actualizar</button>
                        </span>
                      ) : (
                        <button type="button" onClick={fetchUva} className="text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{ background: "rgba(108,99,255,0.25)", color: "#A5A0FF" }}>
                          Traer valor UVA
                        </button>
                      )}
                    </div>

                    {/* Error + manual fallback */}
                    {uvaError && !uvaEfectivo && (
                      <div className="space-y-2">
                        <p className="text-xs" style={{ color: "#EF4444" }}>{uvaError}</p>
                        <div>
                          <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "rgba(255,255,255,0.40)" }}>Ingresar valor UVA manualmente</label>
                          <input type="number" className="input-field font-mono" placeholder="ej: 1650.00" min="100" step="0.01"
                            value={uvaManual} onChange={e => setUvaManual(e.target.value)} onFocus={e => e.target.select()} />
                        </div>
                      </div>
                    )}

                    {/* Capital + cuotas + TNA */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "rgba(255,255,255,0.40)" }}>Capital en UVAs *</label>
                        <input type="number" className="input-field font-mono" placeholder="ej: 50000" min="0" step="any"
                          value={pCapitalUva} onChange={e => setPCapitalUva(e.target.value)} onFocus={e => e.target.select()} required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "rgba(255,255,255,0.40)" }}>Cant. cuotas *</label>
                        <input type="number" className="input-field font-mono" placeholder="ej: 240" min="1" step="1"
                          value={pNCuotas} onChange={e => setPNCuotas(e.target.value)} onFocus={e => e.target.select()} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "rgba(255,255,255,0.40)" }}>TNA (%)</label>
                        <input type="number" className="input-field font-mono" placeholder="0" min="0" step="0.01"
                          value={pTasa} onChange={e => setPTasa(e.target.value)} onFocus={e => e.target.select()} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "rgba(255,255,255,0.40)" }}>Fecha primer cuota</label>
                        <input type="date" className="input-field" value={pFechaI} onChange={e => setPFechaI(e.target.value)} />
                      </div>
                    </div>

                    {/* Simulation results */}
                    {(cuotaUvaCalc || montoARSCalc) && (
                      <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(108,99,255,0.14)" }}>
                        {cuotaUvaCalc && (
                          <div className="flex justify-between text-xs">
                            <span style={{ color: "rgba(255,255,255,0.45)" }}>Cuota en UVAs</span>
                            <span className="font-mono font-bold" style={{ color: "#A5A0FF" }}>{cuotaUvaCalc.toLocaleString("es-AR", { maximumFractionDigits: 2 })} UVAs</span>
                          </div>
                        )}
                        {cuotaARSCalc && (
                          <div className="flex justify-between text-xs">
                            <span style={{ color: "rgba(255,255,255,0.45)" }}>Cuota ARS estimada hoy</span>
                            <span className="font-mono font-bold" style={{ color: "#A5A0FF" }}>$ {Math.round(cuotaARSCalc).toLocaleString("es-AR")}</span>
                          </div>
                        )}
                        {montoARSCalc && (
                          <div className="flex justify-between text-xs">
                            <span style={{ color: "rgba(255,255,255,0.45)" }}>Capital ARS hoy</span>
                            <span className="font-mono" style={{ color: "rgba(255,255,255,0.65)" }}>$ {Math.round(montoARSCalc).toLocaleString("es-AR")}</span>
                          </div>
                        )}
                        {pFechaI && uvaNInt > 0 && (
                          <div className="flex justify-between text-xs">
                            <span style={{ color: "rgba(255,255,255,0.45)" }}>Vencimiento estimado</span>
                            <span className="font-mono font-semibold" style={{ color: "#10B981" }}>{calcFechaVenc(pFechaI, uvaNInt)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Saldo pendiente (edit mode only: how much is still owed) */}
                    {editingPasivo && (
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "rgba(255,255,255,0.40)" }}>Saldo pendiente actual</label>
                        <input type="number" className="input-field font-mono" placeholder="0" min="0" step="any"
                          value={pSaldo} onChange={e => setPSaldo(e.target.value)} onFocus={e => e.target.select()} />
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Non-UVA fields ── */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Monto original *</label>
                        <input type="number" className="input-field font-mono" placeholder="0" min="0" step="any"
                          value={pMontoOrig} onChange={e => setPMontoOrig(e.target.value)} onFocus={e => e.target.select()} required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Saldo pendiente *</label>
                        <input type="number" className="input-field font-mono" placeholder="0" min="0" step="any"
                          value={pSaldo} onChange={e => setPSaldo(e.target.value)} onFocus={e => e.target.select()} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Cuota mensual</label>
                        <input type="number" className="input-field font-mono" placeholder="0" min="0" step="any"
                          value={pCuota} onChange={e => setPCuota(e.target.value)} onFocus={e => e.target.select()} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Tasa TNA (%)</label>
                        <input type="number" className="input-field font-mono" placeholder="0" min="0" step="0.01"
                          value={pTasa} onChange={e => setPTasa(e.target.value)} onFocus={e => e.target.select()} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Fecha inicio</label>
                        <input type="date" className="input-field" value={pFechaI} onChange={e => setPFechaI(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Fecha vencimiento</label>
                        <input type="date" className="input-field" value={pFechaV} onChange={e => setPFechaV(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}
                {pasivoError && <p className="text-xs" style={{ color: "#EF4444" }}>{pasivoError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowPasivoModal(false); resetPasivoForm(); }} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={pasivoLoading}>{pasivoLoading ? "Guardando..." : editingPasivo ? "Actualizar" : "Registrar"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
