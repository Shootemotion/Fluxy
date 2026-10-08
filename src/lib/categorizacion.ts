/**
 * Inferencia de categoría a partir de la descripción de un movimiento
 * importado de un resumen bancario o de tarjeta.
 *
 * Vive fuera del componente de importación para poder probarse y editarse solo.
 *
 * Tres cosas hacían fallar a la versión anterior sobre resúmenes reales:
 *
 *  1. La regla de "Tarjetas" incluía el patrón \d{2}/\d{2}, que matchea el
 *     "C.16/18" de cualquier compra en cuotas. Toda compra financiada
 *     terminaba en "Tarjetas", que además no es un rubro de gasto sino el
 *     medio de pago. Acá las cuotas se detectan aparte, en el importador.
 *  2. Buscaba subcadenas sueltas: "mercado" matcheaba MERCADOLIBRE y mandaba
 *     un e-commerce a Alimentación. Ahora se matchea con límites de palabra.
 *  3. No sabía de pasarelas de pago. La mitad de los consumos llegan como
 *     "MERPAGO*<comercio>" o "PAYU*AR*<comercio>", así que el nombre real
 *     quedaba escondido detrás del prefijo.
 *
 * Los nombres de categoría de REGLAS tienen que existir en la tabla
 * `categorias`. Si alguno no existe, el importador cae en "Otros"/"Varios" y
 * el movimiento aparece en /app/pulir — degrada, no rompe.
 */

export const CATEGORIA_FALLBACK = "Otros";

/** Pasarelas que anteponen su nombre al del comercio real. */
const PASARELAS = [
  "MERPAGO", "MERCADOPAGO", "MERCPAGO", "MP",
  "PAYU*AR", "PAYU",
  "DLOCAL", "DLO",
  "CP", "RAPIPAGO", "PAGOFACIL", "EBANX", "PAGO360",
];

/** Pasarelas que en Argentina son casi siempre compras de retail. */
const PASARELAS_RETAIL = new Set(["MERPAGO", "MERCADOPAGO", "MERCPAGO", "MP"]);

export interface ComercioNormalizado {
  /** Descripción en mayúsculas, sin acentos, sin códigos ni pasarela. */
  limpio: string;
  /** Pasarela detectada, si la descripción venía prefijada. */
  pasarela: string | null;
}

/**
 * Deja la descripción en una forma comparable: mayúsculas, sin acentos, sin
 * el prefijo de la pasarela y sin los códigos de autorización o de cliente que
 * el banco pega al final ("787017820USD", "000000004336614", "in1TJe09C").
 */
export function normalizarComercio(desc: string): ComercioNormalizado {
  let s = (desc || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

  let pasarela: string | null = null;
  // Puede haber más de un prefijo encadenado: "PAYU*AR*UBER".
  let siguioPelando = true;
  while (siguioPelando) {
    siguioPelando = false;
    for (const p of PASARELAS) {
      const prefijo = p + "*";
      if (s.startsWith(prefijo)) {
        pasarela = pasarela ?? p;
        s = s.slice(prefijo.length).trim();
        siguioPelando = true;
        break;
      }
    }
  }

  // Saca los tokens que son códigos: puro dígito largo, o mezcla larga de
  // letras y números. "USD" suelto es la columna de moneda, no el comercio.
  //
  // Solo cuenta como código si es alfanumérico PURO: "PRIME*YC8" lleva un
  // separador y forma parte del nombre del comercio, mientras que
  // "YcTRb5nzc" es un código de autorización.
  const tokens = s.split(/\s+/).filter(Boolean);
  const utiles = tokens.filter(tok => {
    if (tok === "USD") return false;
    if (!/^[A-Z0-9]+$/.test(tok)) return true;
    if (/^\d{4,}$/.test(tok)) return false;
    if (tok.length >= 6 && /\d/.test(tok) && /[A-Z]/.test(tok)) return false;
    return true;
  });

  // Si limpiar deja la descripción vacía es porque el "código" era en realidad
  // el nombre del comercio ("MERPAGO*13PRODUCTOS"): mejor conservarlo entero.
  s = (utiles.length ? utiles : tokens).join(" ").replace(/[,\s]+$/, "").trim();

  return { limpio: s, pasarela };
}

interface Regla {
  categoria: string;
  patron: RegExp;
}

/**
 * Reglas en orden: gana la primera que matchea, así que lo específico va
 * antes que lo genérico.
 *
 * Casos de orden que importan:
 *  - Salud antes que Transporte, porque "OBRA SOCIAL YPF" no es una carga de
 *    nafta aunque diga YPF.
 *  - Ocio antes que Suscripciones, porque "GOOGLE *YouTubeP" es streaming y
 *    "GOOGLE *Google One" es almacenamiento.
 */
export const REGLAS: Regla[] = [
  {
    categoria: "Salud",
    patron: /\b(OBRA SOCIAL|FARMACIA|FARMACITY|SWISS MEDICAL|OSDE|GALENO|MEDIFE|SANCOR SALUD|SANATORIO|HOSPITAL|CLINICA|LABORATORIO|OPTICA|ODONTO|DENTAL|KINESIO|PSICO|MEDIC)/,
  },
  {
    categoria: "Impuestos y Seguros",
    // MUNICIP lleva \b al final a propósito: "ESTACIONAMIENTO MUNICIPAL" es
    // transporte, no un impuesto, y la tasa municipal llega como "MUNICIP ...".
    patron: /\b(MUNICIP\b|MUNICIPALIDAD|TASA MUNICIPAL|RENTAS|AFIP|ARCA|ARBA|IMPUESTO|SELLOS|PERCEPCION|PATENTE|ABL\b|SANCOR COOP|SANCOR SEG|LA SEGUNDA|SEGURO|SEGUROS|ZURICH|ALLIANZ|MAPFRE|FEDERACION PATRONAL|RIVADAVIA SEG|IVA RG|DB\.RG)/,
  },
  {
    categoria: "Ocio",
    patron: /\b(NETFLIX|SPOTIFY|DISNEY|HBO|HBOMAX|PRIMEVIDEO|PRIME VIDEO|AMAZON PRIME|AMAZON MUSIC|YOUTUBE|PLAYSTATION|XBOX|NINTENDO|STEAM|RIOT GAMES|EPIC GAMES|TWITCH|CRUNCHYROLL|DEEZER|PARAMOUNT|APPLE TV|CINEMARK|HOYTS|\bCINE\b|TEATRO)/,
  },
  {
    categoria: "Suscripciones",
    patron: /\b(OPENAI|CHATGPT|ANTHROPIC|CLAUDE|CANVA|MICROSOFT|OFFICE 365|ADOBE|GOOGLE|GITHUB|NOTION|DROPBOX|ICLOUD|LINKEDIN|INTCH|FIGMA|VERCEL|ZOOM|SLACK|EVERNOTE)/,
  },
  {
    categoria: "Vivienda",
    patron: /\b(CAMUZZI|EDENOR|EDESUR|METROGAS|NATURGY|LITORAL GAS|AYSA|\bABSA\b|COOPERATIVA|SOCIEDAD COOPERA|CLARO|PERSONAL FLOW|MOVISTAR|TELECOM|FIBERTEL|TELECENTRO|DIRECTV|STARLINK|ALQUILER|EXPENSAS?|\bLUZ\b|\bGAS\b|\bAGUA\b|INTERNET)/,
  },
  {
    categoria: "Transporte",
    patron: /\b(UBER|CABIFY|DIDI|REMIS|\bTAXI\b|\bYPF\b|APPYPF|SHELL|AXION|PUMA ENERGY|\bGNC\b|COMBUST|NAFTA|ESTACIONAMIENTO|PEAJE|\bAUSA\b|\bSUBE\b|PARKING|COCHERA)/,
  },
  {
    categoria: "Viajes",
    patron: /\b(AEROLINEAS|LATAM|FLYBONDI|JETSMART|AIRLINES|DESPEGAR|BOOKING|AIRBNB|EXPEDIA|TURISMO|\bHOTEL\b|HOSTEL)/,
  },
  {
    categoria: "Educación",
    patron: /\b(UNIVERSIDAD|\bUNIV\b|FACULTAD|COLEGIO|INSTITUTO|ESCUELA|UDEMY|PLATZI|COURSERA|DUOLINGO)/,
  },
  {
    categoria: "Alimentación",
    patron: /\b(LA ANONIMA|CHANGOMAS|CARREFOUR|COTO\b|JUMBO|DISCO\b|VEA\b|WALMART|MAKRO|MAXICONSUMO|SUPER|MINIMERCADO|AUTOSERVICIO|DESPENSA|ALMACEN|VERDULERIA|CARNICERIA|PANADERIA|PANIFICADORA|FIAMBRER|ROTISER|PARRILLA|KIOSCO|GRIDO|HAVANNA|STARBUCKS|MCDONALD|BURGER|RAPPI|PEDIDOSYA|RESTAURANT|PIZZ|CAFE\b|HELADER)/,
  },
  {
    categoria: "Hogar",
    patron: /\b(HIPERTEHUELCHE|\bEASY\b|SODIMAC|CORRALON|FERRETERIA|PINTURERIA|NEOMAT|BLAISTEN|MATERIALES|SANITARIOS|MUEBLES)/,
  },
  {
    categoria: "Compras",
    patron: /\b(MERCADOLIBRE|\bMELI\b|BIDCOM|COMPRAGAMER|FRAVEGA|GARBARINO|MUSIMUNDO|\bSHEIN\b|TEMU|ALIEXPRESS|AMAZON|\bNIKE|ADIDAS|PUMA STORE|DEXTER|\bJOMA\b|SPORTSCAM|PARFUMERIE|PERFUMER|E-COMMERCE|ECOMMERCE|TIENDA|\bSTORE\b|OUTLET)/,
  },
  {
    categoria: "Sueldo",
    patron: /\b(SUELDO|HABERES|HONORARIOS|AGUINALDO|REMUNERACION|ACREDITACION HABERES)/,
  },
];

/**
 * Devuelve el NOMBRE de la categoría inferida. No resuelve el id: de eso se
 * encarga quien la llama, que es el que conoce las categorías del usuario.
 */
export function inferirCategoria(desc: string): string {
  const { limpio, pasarela } = normalizarComercio(desc);
  if (!limpio) return CATEGORIA_FALLBACK;

  for (const regla of REGLAS) {
    if (regla.patron.test(limpio)) return regla.categoria;
  }

  // Un pago por MercadoPago que no matcheó nada es, casi siempre, una compra.
  // Vale para los comercios chicos que llegan como "MERPAGO*<nombre propio>".
  if (pasarela && PASARELAS_RETAIL.has(pasarela)) return "Compras";

  return CATEGORIA_FALLBACK;
}

/**
 * Clave con la que se recuerda una corrección del usuario.
 *
 * Tiene que agrupar las variantes del mismo comercio sin fusionar comercios
 * distintos. Se usan los dos primeros tokens del nombre ya normalizado, que en
 * los resúmenes reales es el punto justo:
 *
 *   "LA ANONIMA SUC023" · "LA ANONIMA SUC 218"  → "LA ANONIMA"     (agrupa)
 *   "LA SEGUNDA CIA0102495-..."                 → "LA SEGUNDA"     (no se mezcla)
 *   "MUNICIP COMOD RI 097" · "MUNICIP COMOD RI" → "MUNICIP COMOD"  (agrupa)
 *   "GOOGLE *YOUTUBEP" · "GOOGLE *GOOGLE O"     → distintas         (no se mezcla)
 *
 * Con un solo token el comercio ya es la clave ("MERCADOLIBRE", "NETFLIX.COM").
 */
export function clavePatron(desc: string): string {
  const { limpio } = normalizarComercio(desc);
  if (!limpio) return "";

  const tokens = limpio.split(/\s+/).filter(Boolean);
  const dos = tokens.slice(0, 2).join(" ");

  // Si dos tokens quedan demasiado cortos para identificar algo ("LA SA"),
  // se usa la descripción entera antes que arriesgar una clave ambigua.
  return (dos.length >= 6 ? dos : limpio).slice(0, 80);
}

/** Minúsculas sin acentos, para comparar nombres de categoría. */
export function sinAcentos(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Compara nombres de categoría ignorando mayúsculas y acentos. */
export function mismoNombre(a: string, b: string): boolean {
  return sinAcentos(a) === sinAcentos(b);
}
