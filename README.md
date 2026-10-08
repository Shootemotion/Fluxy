# Fluxy

Gestión de finanzas personales. Next.js 14 (App Router) + Supabase + Tailwind v4.

Para cómo está armado por dentro, ver [resumen_proyecto_fluxy.md](resumen_proyecto_fluxy.md).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar con las credenciales de Supabase
npm run dev
```

Variables necesarias en `.env.local`:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública |
| `NEXT_PUBLIC_SITE_URL` | Redirección del OAuth de Google |
| `SUPABASE_SERVICE_ROLE_KEY` | Sólo para `/app/admin`. **Nunca exponerla al cliente** |

## Base de datos

Las migraciones de `supabase/migrations/` se corren en orden desde el SQL Editor
de Supabase. Son idempotentes, así que se pueden aplicar sobre una base que ya
tiene datos.

En una base existente, empezá por `20260918_core_schema.sql`: reconstruye el
esquema núcleo que originalmente se había creado a mano. Si tira un error de
columna, la base tiene razón y el archivo está desactualizado — corregí el
archivo.

## Comandos

```bash
npm run dev      # desarrollo
npm run build    # build de producción (corre lint y typecheck)
npm run lint     # ESLint
npx tsc --noEmit # sólo typecheck
```
