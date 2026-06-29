-- ============================================================
-- Tabla public.stock — la llena el sincronizador (Contabilium/FEPA).
-- El CRM SOLO LEE de esta tabla.
-- Ejecutar en: Supabase → SQL Editor → Run.
-- ============================================================

create table if not exists public.stock (
    id                  bigint,                       -- Id del producto en Contabilium (IDConcepto)
    codigo              text        not null,         -- SKU
    nombre              text,                          -- nombre del producto (se resuelve vía conceptos)
    deposito_id         integer     not null,         -- depósito de Contabilium (ej: 106678)
    stock_actual        numeric     not null default 0,
    stock_reservado     numeric     not null default 0,
    stock_con_reservas  numeric     not null default 0, -- = disponible (lo que muestra el CRM)
    updated_at          timestamptz not null default now(),
    primary key (codigo, deposito_id)                 -- clave natural para el upsert del sync
);

-- Índice para búsquedas/orden por nombre
create index if not exists stock_nombre_idx on public.stock (nombre);

-- RLS: el CRM lee con la clave pública (anon). Solo SELECT, nunca escribe.
alter table public.stock enable row level security;

drop policy if exists "stock_select_publico" on public.stock;
create policy "stock_select_publico"
    on public.stock for select
    to anon, authenticated
    using (true);

-- Realtime: para que el CRM actualice los números solos cuando cambie el stock.
alter publication supabase_realtime add table public.stock;

-- Refrescar el cache del esquema de la API
notify pgrst, 'reload schema';
