-- Private bucket for the raw statement files uploaded by the importer.
-- Moved out of the repo root; policies made idempotent so it can be re-run.
--
-- The bucket is private, so the app reads files back with createSignedUrl()
-- (see uploadImportFile in src/lib/actions.ts), never getPublicUrl().

INSERT INTO storage.buckets (id, name, public)
VALUES ('importaciones', 'importaciones', false)
ON CONFLICT (id) DO NOTHING;

-- Users may only write inside a folder named after their own user id.
DROP POLICY IF EXISTS "Usuarios pueden subir archivos de importacion" ON storage.objects;
CREATE POLICY "Usuarios pueden subir archivos de importacion"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'importaciones' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

DROP POLICY IF EXISTS "Usuarios pueden leer sus propios archivos" ON storage.objects;
CREATE POLICY "Usuarios pueden leer sus propios archivos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'importaciones' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

DROP POLICY IF EXISTS "Usuarios pueden borrar sus propios archivos" ON storage.objects;
CREATE POLICY "Usuarios pueden borrar sus propios archivos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'importaciones' AND
  auth.uid()::text = (string_to_array(name, '/'))[1]
);
