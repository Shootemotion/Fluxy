# Fluxy — Estado del proyecto

Gestión de finanzas personales. Este documento describe cómo está armado el
proyecto hoy, no la historia de cómo se llegó acá.

## Stack

- **Next.js 14** (App Router), **TypeScript** en modo `strict`, **React 18**.
- **Tailwind CSS v4**, configurado desde CSS (`@import "tailwindcss"` + `@theme`
  en `src/app/globals.css`). **No hay `tailwind.config.ts`**: v4 no lo carga sin
  una directiva `@config`, y no la usamos.
- **Supabase**: Postgres + Auth + Storage.
- **Recharts** para gráficos, **sonner** para toasts, **papaparse** y **xlsx**
  (carga diferida) para el importador.
- Los componentes son propios: **no se usa shadcn/ui ni Radix**. Los íconos son
  SVG inline.

## Arquitectura

- `src/app/app/*/page.tsx` — Server Components: resuelven auth y traen datos.
- `src/components/*/[Seccion]Client.tsx` — Client Components: toda la interacción.
- `src/lib/actions.ts` — Server Actions. **Todas** verifican el usuario y filtran
  por `usuario_id`; RLS en Postgres es la segunda barrera, no la única.
- `src/lib/balances.ts` — cálculo de saldos de cuenta (ver abajo).
- `src/middleware.ts` — protege `/app`. Las rutas `/api` se protegen por separado
  con `requireUser()` de `src/lib/api-auth.ts`.

### Saldos de cuenta

`cuentas.saldo_inicial` es el saldo de apertura y **nunca cambia**. El saldo
actual se deriva de los movimientos en `computeAccountBalances()`.

El signo sale del **`tipo` del movimiento**, no de qué columna de cuenta está
llena: los formularios guardan la cuenta elegida en `cuenta_origen_id` para todos
los tipos, y sólo completan `cuenta_destino_id` en transferencias.

Para mostrar un saldo usá `getAccountsWithBalances()`. `getAccounts()` es la
consulta liviana, sólo para los selectores de cuenta.

### Categorización de importaciones

`src/lib/categorizacion.ts` infiere el rubro de un consumo a partir de su
descripción. Está fuera del componente de importación para poder medirlo.

Tres cosas que hay que saber antes de tocarlo:

- **Las reglas están ordenadas y gana la primera que matchea.** El orden no es
  decorativo: Salud va antes que Transporte porque "OBRA SOCIAL YPF" no es una
  carga de nafta, y Ocio antes que Suscripciones porque `GOOGLE *YouTubeP` es
  streaming y `GOOGLE *Google One` es almacenamiento.
- **Primero se pela la pasarela de pago.** La mitad de los consumos llegan como
  `MERPAGO*<comercio>` o `PAYU*AR*<comercio>`; sin pelar el prefijo el nombre
  real queda escondido. Un pago por MercadoPago que no matchea ninguna regla
  cae en "Compras", que en Argentina acierta casi siempre.
- **Se matchea con límites de palabra, no con subcadenas.** La versión anterior
  usaba `includes("mercado")` y mandaba MercadoLibre a Alimentación.

Cuando no infiere nada devuelve `CATEGORIA_FALLBACK` y el importador deja el
movimiento **sin categoría**, en vez de empujarlo a "Otros". Es deliberado: sin
categoría aparece después en `/app/pulir`; en "Otros" quedaría escondido.

Los nombres de categoría de `REGLAS` tienen que existir en la tabla
`categorias`. Si falta alguno, el importador ofrece crearla en el preview.

#### Aprendizaje de correcciones

El diccionario no puede conocer los comercios de cada barrio, así que los
aprende. Cada corrección del usuario — en `/app/pulir`, al cambiar la categoría
de una fila del preview, o al crear una categoría desde ahí — guarda el par
comercio → categoría en `reglas_categorizacion`, y la próxima importación lo
aplica sola. **Lo aprendido tiene prioridad sobre el diccionario**: si el
usuario ya dijo dónde va un comercio, ninguna heurística lo contradice.

La clave del comercio la calcula `clavePatron()`: los dos primeros tokens del
nombre ya normalizado. Es el punto justo entre agrupar variantes del mismo
comercio y no fusionar comercios distintos —
`LA ANONIMA SUC023`/`SUC022`/`SUC 218` comparten clave, `LA SEGUNDA` no. Como
la normalización pela la pasarela, corregir un `MERPAGO*GRIDO` también resuelve
un `GRIDO` cobrado directo.

Guardar es best-effort y no bloquea: si falla, el movimiento ya quedó
categorizado igual y no tiene sentido cortarle la acción al usuario. La lista de
lo aprendido, con un botón para olvidar cada regla, está en el primer paso de
`/app/importar`.

### Temas

`globals.css` define tokens (`--fg-*`, `--bg-*`, `--bd-*`) para modo oscuro y
claro. **Los componentes usan los tokens, no colores hardcodeados** — un
`rgba(255,255,255,…)` literal rompe el modo claro.

Recharts es la excepción: escribe los colores en atributos SVG, donde `var()` no
resuelve confiablemente. Para eso está `useChartTokens()` en
`src/lib/chart-theme.ts`, que lee el valor computado del token.

## Base de datos

Todo el esquema vive en `supabase/migrations/`. Las migraciones son idempotentes
(`IF NOT EXISTS` / `DROP POLICY IF EXISTS`), así que se pueden correr sobre una
base existente sin romper nada.

`20260918_core_schema.sql` contiene las tablas núcleo (`profiles`, `cuentas`,
`categorias`, `movimientos`, `objetivos`, `valuaciones`, `tipos_cambio`) y fue
**reconstruido** a partir del código: se creó en su momento a mano en el panel de
Supabase. Si algo no coincide con producción, gana producción — hay que corregir
el archivo, no la base.

`20260420_instrumentos_valuaciones.sql` describe una versión vieja de
`valuaciones` que no es la que está en producción. Se conserva sólo por historia.

Nota sobre `valuaciones`: es un log de snapshots, **sin** flag `es_ultima`. El
valor actual de un activo es la fila más reciente por `instrumento_nombre`
(`getLatestValuations()`).

## Secciones

| Ruta | Qué hace |
|---|---|
| `/app/dashboard` | Ingresos/gastos del mes, patrimonio neto, proyección a 24 meses, widget USD |
| `/app/movimientos` | Listado con filtros, edición inline y paginación contra el servidor |
| `/app/cuentas` | Cuentas con saldo real |
| `/app/categorias` | Categorías propias + del sistema (baja lógica vía `activa`) |
| `/app/objetivos` | Metas de ahorro, aportes atómicos vía RPC |
| `/app/cartera` | Inversiones, plazos fijos, pasivos, amortización UVA |
| `/app/recurrentes` | Gastos/ingresos periódicos y cuotas |
| `/app/importar` | Importador de resúmenes **CSV/XLSX** con mapeo flexible de columnas |
| `/app/pulir` | Triage de movimientos sin categorizar |
| `/app/reportes` | Análisis histórico y composición de cartera |
| `/app/alertas` | Reglas y alertas generadas |
| `/app/ia` | Carga por lenguaje natural — **parser por reglas/regex, no un LLM** |

## Pendientes conocidos

- El importador **no lee PDF**; sólo CSV y XLSX. Los resúmenes de Santander
  vienen en dos formatos distintos (el viejo de ancho fijo hasta junio/26 y el
  nuevo tabular desde julio/26), y algunos llegan envueltos en un SOAP
  multipart con extensión .pdf.
- `/app/ia` es heurístico. Conectar un modelo real sigue pendiente.
- `CarteraClient.tsx` (~1.700 líneas) y `actions.ts` (~1.500) piden partirse.
- No hay tests automatizados. Lo único medido es la categorización, contra los
  resúmenes reales de DOCS/ (que no está versionado).
