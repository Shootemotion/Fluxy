-- ============================================================================
-- Reglas de categorización aprendidas de las correcciones del usuario.
--
-- El diccionario de src/lib/categorizacion.ts conoce cadenas y rubros
-- genéricos, pero no puede conocer los comercios de cada barrio. Cada vez que
-- el usuario corrige una categoría (en /app/pulir o en el preview de
-- importación) se guarda acá el par comercio → categoría, y la próxima
-- importación lo aplica sola.
--
-- Estas reglas tienen prioridad sobre el diccionario: si el usuario ya dijo
-- dónde va un comercio, esa respuesta gana.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reglas_categorizacion (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Clave normalizada del comercio, tal como la produce clavePatron().
  -- Ver el comentario de esa función: son los dos primeros tokens del nombre
  -- ya limpio de pasarelas y códigos de autorización.
  patron        TEXT NOT NULL,

  categoria_id  UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,

  -- Cuántas veces se confirmó. Sirve para mostrar las más usadas y para
  -- distinguir una corrección puntual de un hábito.
  aciertos      INTEGER NOT NULL DEFAULT 1,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un comercio, una categoría por usuario: corregir de nuevo pisa la anterior.
  UNIQUE (usuario_id, patron)
);

ALTER TABLE public.reglas_categorizacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios gestionan sus reglas" ON public.reglas_categorizacion;
CREATE POLICY "usuarios gestionan sus reglas"
  ON public.reglas_categorizacion FOR ALL
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reglas_categorizacion_usuario
  ON public.reglas_categorizacion (usuario_id, patron);

-- Guarda o refuerza una regla en una sola sentencia.
--
-- Si el comercio ya tenía la misma categoría, suma un acierto. Si tenía otra,
-- la reemplaza y reinicia el contador: el usuario cambió de opinión y la
-- cuenta vieja ya no describe nada.
CREATE OR REPLACE FUNCTION public.aprender_categoria(p_patron TEXT, p_categoria_id UUID)
RETURNS public.reglas_categorizacion
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  resultado public.reglas_categorizacion;
BEGIN
  IF p_patron IS NULL OR btrim(p_patron) = '' THEN
    RAISE EXCEPTION 'Patrón vacío';
  END IF;

  INSERT INTO public.reglas_categorizacion (usuario_id, patron, categoria_id)
  VALUES (auth.uid(), p_patron, p_categoria_id)
  ON CONFLICT (usuario_id, patron) DO UPDATE
    SET categoria_id = EXCLUDED.categoria_id,
        aciertos = CASE
          WHEN public.reglas_categorizacion.categoria_id = EXCLUDED.categoria_id
          THEN public.reglas_categorizacion.aciertos + 1
          ELSE 1
        END,
        updated_at = now()
  RETURNING * INTO resultado;

  RETURN resultado;
END;
$function$;
