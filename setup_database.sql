-- ============================================================
-- SAMURAI & BOWIE CRM — Setup de base de datos Supabase
-- Correr en: Supabase Dashboard → SQL Editor → New query
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================

-- 1. Vendedores
CREATE TABLE IF NOT EXISTS vendedores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- 2. Clientes (cargados desde Excel)
CREATE TABLE IF NOT EXISTS clientes (
    id uuid PRIMARY KEY,
    nombre text NOT NULL,
    cuit text DEFAULT '',
    telefono text DEFAULT '',
    telefono2 text DEFAULT '',
    email text DEFAULT '',
    ciudad text DEFAULT '',
    provincia text DEFAULT '',
    direccion text DEFAULT '',
    rubro text DEFAULT '',
    vendedor_sugerido text DEFAULT '',
    tipo text NOT NULL DEFAULT 'Credifin',
    created_at timestamptz DEFAULT now()
);

-- 2b. Migración: eliminar CHECK de tipo para permitir nombres de provincias como listas
DO $$
BEGIN
    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_tipo_check;
    -- No recreamos el CHECK: provincias y listas nuevas usan tipo libre
END $$;

-- 3. Asignaciones (cliente → vendedor, con estado y notas)
-- Nota: la fecha de contacto se guarda codificada dentro del campo 'notas'
-- como JSON: {"_fc":"ISO-date","_n":"texto visible"} — sin necesidad de columna extra.
CREATE TABLE IF NOT EXISTS asignaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    vendedor_nombre text NOT NULL,
    estado text NOT NULL DEFAULT 'Sin contactar'
        CHECK (estado IN (
            'Sin contactar',
            'Contactado',
            'En negociación',
            'Dudas',
            'Interesado',
            'Cerrado',
            'No interesado'
        )),
    notas text DEFAULT '',
    fecha_asignacion timestamptz DEFAULT now(),
    UNIQUE(cliente_id)
);

-- 4. Usuarios del CRM (login multi-empleado con roles)
CREATE TABLE IF NOT EXISTS usuarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    nombre text NOT NULL,
    rol text NOT NULL DEFAULT 'user' CHECK (rol IN ('admin', 'user')),
    created_at timestamptz DEFAULT now()
);

-- 5. Row Level Security
ALTER TABLE vendedores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios     ENABLE ROW LEVEL SECURITY;

-- 6. Políticas permisivas (el CRM maneja su propio login a nivel app)
DROP POLICY IF EXISTS "crm_vendedores_all"   ON vendedores;
DROP POLICY IF EXISTS "crm_clientes_all"     ON clientes;
DROP POLICY IF EXISTS "crm_asignaciones_all" ON asignaciones;
DROP POLICY IF EXISTS "crm_usuarios_all"     ON usuarios;

CREATE POLICY "crm_vendedores_all"   ON vendedores   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_clientes_all"     ON clientes     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_asignaciones_all" ON asignaciones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "crm_usuarios_all"     ON usuarios     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. Realtime: habilitar publicación para sync multi-usuario en tiempo real
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vendedores;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE asignaciones;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Usuarios iniciales (contraseña inicial para todos: samurai2026)
-- Hash: PBKDF2(password, salt=username, 10000 iter, SHA-256, 256 bits)
INSERT INTO usuarios (username, password_hash, nombre, rol) VALUES
    ('ezequiel', '797d6acdd86809cfe43bfc47ba682d170bdc0afc3a69a695fd9e535c121beabe', 'Ezequiel', 'admin'),
    ('enzo',     'a01cd8003d71375ea01a02c0ff4cce930f2b3fdbf736097ec7c7951d9196c06a', 'Enzo',     'admin'),
    ('sabrina',  'ad5dc9fe41a328d0cff383401dcdc452201957c5de8c8ac9d1d24068da25a681', 'Sabrina',  'user'),
    ('pablo',    'b97e03dec9c715f17c0aa31a1aec3f80ebd6dd975bd50407fcd73d78662c7baf', 'Pablo',    'user')
ON CONFLICT (username) DO NOTHING;

-- Verificación
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('vendedores','clientes','asignaciones','usuarios')
ORDER BY table_name;

SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('vendedores','clientes','asignaciones','usuarios')
ORDER BY tablename;

SELECT pg_get_constraintdef(oid) AS tipo_check
FROM pg_constraint
WHERE conname = 'clientes_tipo_check';
