"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/actions";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "Email o contraseña incorrectos"
        : error.message);
      setLoading(false);
    } else {
      router.push("/app/dashboard");
      router.refresh();
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    setError("");
    // For demo, we'll sign up/in with demo credentials
    const { error } = await supabase.auth.signInWithPassword({
      email: "demo@fluxy.app",
      password: "demo123456",
    });
    if (error) {
      // Try to sign up
      const { error: signUpError } = await supabase.auth.signUp({
        email: "demo@fluxy.app",
        password: "demo123456",
        options: { data: { nombre: "Usuario Demo" } }
      });
      if (signUpError) setError("Error al acceder al modo demo");
      else router.push("/app/dashboard");
    } else {
      router.push("/app/dashboard");
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0F0F1A 0%, #1A0F2E 50%, #0F1A2E 100%)" }}>
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ background: "#6C63FF" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl" style={{ background: "#22D3EE" }} />
      </div>

      <div className="w-full max-w-md animate-slide-up relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "linear-gradient(135deg, #6C63FF, #22D3EE)" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 22L16 8L26 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 18H22" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
              <circle cx="16" cy="26" r="2" fill="white" opacity="0.8"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold gradient-text">Fluxy</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Gestión financiera personal</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold mb-1" style={{ color: "rgba(255,255,255,0.9)" }}>Bienvenido de vuelta</h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>Ingresá a tu cuenta para continuar</p>

          {error && (
            <div className="alert-card danger mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.65)" }}>Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.65)" }}>Contraseña</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full justify-center py-3 rounded-xl text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                  Ingresando...
                </span>
              ) : "Ingresar"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>o</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          <button
            type="button"
            onClick={async () => {
              const url = await signInWithGoogle();
              if (url) window.location.href = url;
            }}
            className="btn-secondary w-full justify-center py-3 rounded-xl text-base mb-3"
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" className="mr-2">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>

          <button
            type="button"
            onClick={handleDemoLogin}
            className="btn-secondary w-full justify-center py-3 rounded-xl text-base"
            disabled={loading}
          >
            🚀 Probar con cuenta demo
          </button>

          <p className="text-center text-sm mt-6" style={{ color: "rgba(255,255,255,0.4)" }}>
            ¿No tenés cuenta?{" "}
            <Link href="/auth/register" className="font-medium hover:underline" style={{ color: "#6C63FF" }}>
              Registrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
