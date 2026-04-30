-- Script para ejecutar en el SQL Editor de Supabase
-- Crea un bucket para guardar los archivos de importación
--------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('importaciones', 'importaciones', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de seguridad para permitir a los usuarios subir archivos a su propia carpeta
CREATE POLICY "Usuarios pueden subir archivos de importacion"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'importaciones' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Políticas para leer sus propios archivos
CREATE POLICY "Usuarios pueden leer sus propios archivos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'importaciones' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);
