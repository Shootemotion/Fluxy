"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  updateProfile, updatePassword, getMovementsForExport, signInWithGoogle,
} from "@/lib/actions";
import Link from "next/link";

interface ConfiguracionClientProps {
  user: any;
  profile: any;
}

function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{title}</h2>
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, desc, children, danger }: { label: string; desc?: string; children?: React.ReactNode; danger?: boolean }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: danger ? "#EF4444" : "rgba(255,255,255,0.85)" }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

export default function ConfiguracionClient({ user, profile }: ConfiguracionClientProps) {
  const router = useRouter();
  const supabase = createClient();

  // Nombre
  const [editingNombre, setEditingNombre] = useState(false);
  const [nombre, setNombre] = useState(profile?.nombre || user?.user_metadata?.nombre || "");
  const [nombreLoading, setNombreLoading] = useState(false);
  const [nombreError, setNombreError] = useState("");

  // Password
  const [showPwd, setShowPwd]       = useState(false);
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError]     = useState("");
  const [pwdOk, setPwdOk]           = useState(false);

  // Apariencia
  const [tema, setTema]     = useState<"dark" | "light">((profile?.configuracion?.tema as "dark" | "light") ?? "dark");
  const [idioma, setIdioma] = useState<string>(profile?.configuracion?.idioma as string ?? "es");
  const [monedaPpal, setMonedaPpal] = useState<string>(profile?.moneda_principal ?? "ARS");
  const [aparienciaLoading, setAparienciaLoading] = useState(false);

  useEffect(() => {
    if (tema === "light") document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
  }, [tema]);

  async function handleSaveApariencia(newTema?: "dark" | "light", newIdioma?: string, newMoneda?: string) {
    const t = newTema   ?? tema;
    const i = newIdioma ?? idioma;
    const m = newMoneda ?? monedaPpal;
    if (newTema)   setTema(t);
    if (newIdioma) setIdioma(i);
    if (newMoneda) setMonedaPpal(m);
    setAparienciaLoading(true);
    try {
      const config = { ...(profile?.configuracion || {}), tema: t, idioma: i };
      await updateProfile({ configuracion: config, moneda_principal: m });
    } finally {
      setAparienciaLoading(false);
    }
  }

  // Tipo de cambio
  const currentTc = profile?.configuracion?.tipo_cambio_usd ?? "";
  const [editingTc, setEditingTc] = useState(false);
  const [tc, setTc]               = useState(String(currentTc));
  const [tcLoading, setTcLoading] = useState(false);
  const [tcError, setTcError]     = useState("");

  // Export
  const [exportLoading, setExportLoading] = useState(false);

  // Sign out confirm
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const hasGoogle = user?.identities?.some((id: any) => id.provider === "google");
  const hasEmail  = user?.identities?.some((id: any) => id.provider === "email");

  async function handleSaveNombre() {
    if (!nombre.trim()) return;
    setNombreLoading(true); setNombreError("");
    try {
      await updateProfile({ nombre: nombre.trim() });
      setEditingNombre(false);
    } catch (err: any) {
      setNombreError(err.message);
    } finally {
      setNombreLoading(false);
    }
  }

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdError("Las contraseñas no coinciden"); return; }
    if (newPwd.length < 6)    { setPwdError("Mínimo 6 caracteres"); return; }
    setPwdLoading(true); setPwdError("");
    try {
      await updatePassword(newPwd);
      setPwdOk(true); setNewPwd(""); setConfirmPwd("");
      setTimeout(() => { setPwdOk(false); setShowPwd(false); }, 2500);
    } catch (err: any) {
      setPwdError(err.message);
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleConnectGoogle() {
    try {
      const url = await signInWithGoogle();
      if (url) window.location.href = url;
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function handleSaveTc() {
    const val = parseFloat(tc);
    if (!val || val <= 0) { setTcError("Ingresá un valor válido"); return; }
    setTcLoading(true); setTcError("");
    try {
      const config = { ...(profile?.configuracion || {}), tipo_cambio_usd: val };
      await updateProfile({ configuracion: config });
      setEditingTc(false);
    } catch (err: any) {
      setTcError(err.message);
    } finally {
      setTcLoading(false);
    }
  }

  async function handleExport() {
    setExportLoading(true);
    try {
      const data = await getMovementsForExport();
      const headers = ["Fecha", "Tipo", "Monto", "Moneda", "Descripcion", "Categoria"];
      const rows = data.map((m: any) => [
        m.fecha, m.tipo, m.monto, m.moneda,
        `"${(m.descripcion || "").replace(/"/g, '""')}"`,
        `"${((m.categorias as any)?.nombre || "").replace(/"/g, '""')}"`,
      ]);
      const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `fluxy-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error al exportar: " + err.message);
    } finally {
      setExportLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const initials = (profile?.nombre || user?.user_metadata?.nombre || user?.email || "?")
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.95)" }}>Configuración</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>Personalizá Fluxy a tu gusto</p>
      </div>

      {/* ── PERFIL ── */}
      <SectionCard icon="👤" title="Perfil">
        {/* Avatar + info */}
        <div className="px-5 py-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6C63FF, #22D3EE)", color: "white" }}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold" style={{ color: "rgba(255,255,255,0.90)" }}>
              {profile?.nombre || user?.user_metadata?.nombre || "Sin nombre"}
            </p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.40)" }}>{user?.email}</p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {hasEmail  && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(108,99,255,0.20)", color: "#A5A0FF" }}>Email</span>}
              {hasGoogle && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(66,133,244,0.20)", color: "#60A5FA" }}>Google</span>}
            </div>
          </div>
        </div>

        {/* Editar nombre */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {!editingNombre ? (
            <Row label="Nombre" desc={profile?.nombre || "Sin nombre"}>
              <button onClick={() => setEditingNombre(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                Editar
              </button>
            </Row>
          ) : (
            <div className="px-5 py-4 space-y-3">
              <label className="block text-xs font-semibold uppercase" style={{ color: "rgba(255,255,255,0.40)" }}>Nombre</label>
              <input className="input-field" type="text" value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveNombre()}
                autoFocus />
              {nombreError && <p className="text-xs" style={{ color: "#EF4444" }}>{nombreError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setEditingNombre(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
                <button onClick={handleSaveNombre} className="btn-primary text-sm flex-1" disabled={nombreLoading}>
                  {nombreLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Email (solo lectura) */}
        <Row label="Email" desc={user?.email}>
          <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.30)" }}>
            Solo lectura
          </span>
        </Row>
      </SectionCard>

      {/* ── SEGURIDAD ── */}
      <SectionCard icon="🔐" title="Seguridad">
        <div>
          {!showPwd ? (
            <Row label="Contraseña" desc="Cambiá tu contraseña de acceso">
              <button onClick={() => setShowPwd(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                Cambiar
              </button>
            </Row>
          ) : (
            <div className="px-5 py-4">
              {pwdOk ? (
                <div className="rounded-xl p-3 text-center" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <p className="text-sm font-semibold text-emerald-400">✓ Contraseña actualizada</p>
                </div>
              ) : (
                <form onSubmit={handleChangePwd} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Nueva contraseña</label>
                    <input className="input-field" type="password" placeholder="Mínimo 6 caracteres"
                      value={newPwd} onChange={e => setNewPwd(e.target.value)} minLength={6} required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.40)" }}>Confirmar contraseña</label>
                    <input className="input-field" type="password" placeholder="Repetí la contraseña"
                      value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
                  </div>
                  {pwdError && <p className="text-xs" style={{ color: "#EF4444" }}>{pwdError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowPwd(false); setPwdError(""); }} className="btn-secondary text-sm flex-1">Cancelar</button>
                    <button type="submit" className="btn-primary text-sm flex-1" disabled={pwdLoading}>
                      {pwdLoading ? "Guardando..." : "Actualizar"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Google */}
        <Row
          label="Google"
          desc={hasGoogle ? "Cuenta de Google vinculada" : "Vinculá tu cuenta de Google para acceder más fácil"}
        >
          {hasGoogle ? (
            <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#10B981" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Conectado
            </span>
          ) : (
            <button onClick={handleConnectGoogle}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(66,133,244,0.15)", color: "#60A5FA" }}>
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Conectar Google
            </button>
          )}
        </Row>
      </SectionCard>

      {/* ── APARIENCIA ── */}
      <SectionCard icon="🎨" title="Apariencia e idioma">
        {/* Tema */}
        <Row label="Tema" desc={tema === "dark" ? "Modo oscuro" : "Modo claro"}>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {(["dark", "light"] as const).map(t => (
              <button key={t} onClick={() => handleSaveApariencia(t)}
                disabled={aparienciaLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={tema === t
                  ? { background: "rgba(108,99,255,0.30)", color: "#A5A0FF" }
                  : { color: "rgba(255,255,255,0.40)" }}>
                {t === "dark" ? "🌙 Oscuro" : "☀️ Claro"}
              </button>
            ))}
          </div>
        </Row>

        {/* Idioma */}
        <Row label="Idioma" desc={idioma === "es" ? "Español" : "English"}>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {[{ value: "es", label: "🇦🇷 ES" }, { value: "en", label: "🇺🇸 EN" }].map(l => (
              <button key={l.value} onClick={() => handleSaveApariencia(undefined, l.value)}
                disabled={aparienciaLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={idioma === l.value
                  ? { background: "rgba(108,99,255,0.30)", color: "#A5A0FF" }
                  : { color: "rgba(255,255,255,0.40)" }}>
                {l.label}
              </button>
            ))}
          </div>
        </Row>

        {/* Moneda principal */}
        <Row label="Moneda principal" desc="Moneda por defecto para movimientos y reportes">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {["ARS", "USD", "EUR"].map(m => (
              <button key={m} onClick={() => handleSaveApariencia(undefined, undefined, m)}
                disabled={aparienciaLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all"
                style={monedaPpal === m
                  ? { background: "rgba(108,99,255,0.30)", color: "#A5A0FF" }
                  : { color: "rgba(255,255,255,0.40)" }}>
                {m}
              </button>
            ))}
          </div>
        </Row>
      </SectionCard>

      {/* ── MONEDAS ── */}
      <SectionCard icon="💱" title="Monedas y tipo de cambio">
        <div>
          {!editingTc ? (
            <Row
              label="Tipo de cambio ARS/USD"
              desc={currentTc ? `1 USD = $ ${Number(currentTc).toLocaleString("es-AR")} ARS` : "Sin configurar"}
            >
              <button onClick={() => setEditingTc(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                {currentTc ? "Actualizar" : "Configurar"}
              </button>
            </Row>
          ) : (
            <div className="px-5 py-4 space-y-3">
              <label className="block text-xs font-semibold uppercase" style={{ color: "rgba(255,255,255,0.40)" }}>
                Valor del dólar (ARS por 1 USD)
              </label>
              <input className="input-field font-mono" type="number" placeholder="Ej: 1200"
                value={tc} onChange={e => setTc(e.target.value)} onFocus={e => e.target.select()} autoFocus />
              {tcError && <p className="text-xs" style={{ color: "#EF4444" }}>{tcError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setEditingTc(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
                <button onClick={handleSaveTc} className="btn-primary text-sm flex-1" disabled={tcLoading}>
                  {tcLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>
        <Row label="Moneda principal" desc="Pesos Argentinos (ARS)">
          <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.50)" }}>ARS</span>
        </Row>
      </SectionCard>

      {/* ── ACCESOS DIRECTOS ── */}
      <SectionCard icon="⚡" title="Accesos directos">
        <Link href="/app/categorias"
          className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
          <div>
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>Gestionar categorías</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Crear, editar y organizar categorías</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "rgba(255,255,255,0.20)" }}><path d="M9 18l6-6-6-6"/></svg>
        </Link>
        <Link href="/app/recurrentes"
          className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
          style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>Gastos e ingresos periódicos</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Administrar pagos recurrentes</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "rgba(255,255,255,0.20)" }}><path d="M9 18l6-6-6-6"/></svg>
        </Link>
      </SectionCard>

      {/* ── DATOS ── */}
      <SectionCard icon="💾" title="Datos y privacidad">
        <Row label="Exportar mis movimientos" desc="Descargá tu historial completo en formato CSV">
          <button onClick={handleExport} disabled={exportLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
            {exportLoading ? "Generando..." : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Descargar CSV
              </>
            )}
          </button>
        </Row>
      </SectionCard>

      {/* ── SESIÓN ── */}
      <SectionCard icon="🚪" title="Sesión">
        {!confirmSignOut ? (
          <Row label="Cerrar sesión" desc="Salir de tu cuenta en este dispositivo" danger>
            <button onClick={() => setConfirmSignOut(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}>
              Salir
            </button>
          </Row>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>¿Seguro que querés cerrar sesión?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSignOut(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
              <button onClick={handleSignOut}
                className="text-sm font-semibold flex-1 py-2 rounded-xl"
                style={{ background: "rgba(239,68,68,0.20)", color: "#EF4444" }}>
                Sí, cerrar sesión
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <p className="text-center text-xs mt-8" style={{ color: "rgba(255,255,255,0.20)" }}>
        Fluxy v1.0 · Hecho con 💜 en Argentina
      </p>
    </div>
  );
}
