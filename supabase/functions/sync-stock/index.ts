// ============================================================
// sync-stock — Edge Function (Supabase / Deno)
// Contabilium  →  public.stock  (+ aviso Telegram al vender una bici)
//
// SOLO LECTURA de Contabilium. Escribe únicamente en public.stock (upsert).
// Se ejecuta por cron (ej: cada 15 min). Nada de esto vive en el CRM.
//
// Secrets que necesita (Supabase → Edge Functions → Secrets):
//   CONTABILIUM_CLIENT_ID       = federicosigal@hotmail.com
//   CONTABILIUM_CLIENT_SECRET   = (API Key de Contabilium)
//   CONTABILIUM_DEPOSITO        = 106678
//   SUPABASE_URL                = https://nwlvvtcltnatkuljtlob.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = (service_role key)
//   TELEGRAM_BOT_TOKEN          = (token de @BotFather)   [opcional]
//   TELEGRAM_CHAT_ID            = (chat/grupo destino)    [opcional]
// ============================================================

const CONTA_BASE = "https://rest.contabilium.com";

const env = (k: string) => Deno.env.get(k) ?? "";

// 1) Token de Contabilium (client_credentials)
async function getContabiliumToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env("CONTABILIUM_CLIENT_ID"),
    client_secret: env("CONTABILIUM_CLIENT_SECRET"),
  });
  const r = await fetch(`${CONTA_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`Contabilium /token ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (!j.access_token) throw new Error("Contabilium: sin access_token");
  return j.access_token as string;
}

// 2) Todo el stock del depósito (paginado)
async function getStock(token: string, deposito: string) {
  const items: any[] = [];
  const pageSize = 50;
  for (let page = 0; page < 500; page++) {
    const url = `${CONTA_BASE}/api/inventarios/getStockByDeposito?id=${deposito}&page=${page}&pageSize=${pageSize}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`getStockByDeposito ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const arr = j?.Items ?? [];
    items.push(...arr);
    if (arr.length < pageSize) break;
  }
  return items;
}

// 3) Nombre y precio de un producto (concepto) por Id
async function getConcepto(token: string, id: number): Promise<{ nombre: string; precio: number | null }> {
  try {
    const r = await fetch(`${CONTA_BASE}/api/conceptos/getConcepto?id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { nombre: "", precio: null };
    const j = await r.json();
    const precio = j?.PrecioFinal != null ? Number(j.PrecioFinal) : null;
    return { nombre: (j?.Nombre ?? "").toString(), precio };
  } catch {
    return { nombre: "", precio: null };
  }
}

// Helpers Supabase (PostgREST con service_role)
function sbHeaders() {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function leerStockActual(): Promise<Map<string, any>> {
  const url = `${env("SUPABASE_URL")}/rest/v1/stock?select=codigo,nombre,stock_actual,precio`;
  const r = await fetch(url, { headers: sbHeaders() });
  const map = new Map<string, any>();
  if (r.ok) for (const row of await r.json()) map.set(row.codigo, row);
  return map;
}

async function upsertStock(rows: any[]) {
  if (!rows.length) return;
  const url = `${env("SUPABASE_URL")}/rest/v1/stock?on_conflict=codigo,deposito_id`;
  const r = await fetch(url, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert stock ${r.status}: ${await r.text()}`);
}

// 4) Aviso Telegram (solo bicis vendidas)
async function avisarTelegram(texto: string) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chat = env("TELEGRAM_CHAT_ID");
  if (!token || !chat) return; // si no está configurado, no hace nada
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto, parse_mode: "HTML" }),
  });
}

const esBici = (nombre: string) => nombre.trim().toUpperCase().startsWith("BIC ");

Deno.serve(async () => {
  try {
    const deposito = env("CONTABILIUM_DEPOSITO") || "106678";
    const token = await getContabiliumToken();
    const items = await getStock(token, deposito);
    const previo = await leerStockActual();

    const rows: any[] = [];
    const ventasBici: string[] = [];
    const ahora = new Date().toISOString();

    for (const it of items) {
      const codigo = String(it.Codigo ?? "");
      if (!codigo) continue;
      const prev = previo.get(codigo);

      // Nombre y precio: reusar lo guardado; si falta alguno, pedirlo a Contabilium
      // (una sola llamada trae los dos). Se cachea para no recargar la API.
      let nombre = prev?.nombre ?? "";
      let precio: number | null = prev?.precio ?? null;
      if (!nombre || precio == null) {
        const c = await getConcepto(token, it.Id);
        if (!nombre) nombre = c.nombre;
        if (precio == null) precio = c.precio;
      }

      const stockActual = Number(it.StockActual ?? 0);
      const reservado = Number(it.StockReservado ?? 0);
      const disponible = Number(it.StockConReservas ?? 0);

      // Detección de venta: bajó el stock físico respecto a lo guardado
      if (prev && prev.stock_actual != null) {
        const vendidas = Number(prev.stock_actual) - stockActual;
        if (vendidas > 0 && esBici(nombre)) {
          ventasBici.push(
            `🚲 <b>Venta</b> — ${nombre}\nVendidas: <b>${vendidas}</b> · Quedan: <b>${disponible}</b>`,
          );
        }
      }

      rows.push({
        id: it.Id ?? null,
        codigo,
        nombre: nombre || null,
        precio: precio,
        deposito_id: Number(deposito),
        stock_actual: stockActual,
        stock_reservado: reservado,
        stock_con_reservas: disponible,
        updated_at: ahora,
      });
    }

    // Deduplicar por (codigo) — Contabilium puede repetir un código en el depósito,
    // y el upsert no admite la misma clave dos veces en el mismo batch. Conserva el último.
    const dedup = Array.from(new Map(rows.map((r) => [r.codigo, r])).values());

    await upsertStock(dedup);
    for (const msg of ventasBici) await avisarTelegram(msg);

    return new Response(
      JSON.stringify({ ok: true, productos: dedup.length, avisos: ventasBici.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[sync-stock]", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
