import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { provincia, ciudad, cantidad = 20 } = await req.json();
    const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_KEY");
    if (!GOOGLE_KEY) throw new Error("GOOGLE_PLACES_KEY no configurada");

    const zona = ciudad ? `${ciudad}, ${provincia || "Argentina"}` : `${provincia}, Argentina`;
    const query = `bicicletería en ${zona}`;

    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask": [
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.internationalPhoneNumber",
          "places.websiteUri",
          "places.location",
          "places.addressComponents",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: Math.min(Number(cantidad), 20),
        languageCode: "es",
        regionCode: "AR",
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Google Places error ${resp.status}: ${err}`);
    }

    const data = await resp.json();

    const results = (data.places || []).map((p: any) => {
      const addr = p.formattedAddress || "";
      // Extraer ciudad y provincia de addressComponents
      const comps: any[] = p.addressComponents || [];
      const ciudad2 = comps.find((c) => c.types?.includes("locality"))?.longText || "";
      const prov2 = comps.find((c) => c.types?.includes("administrative_area_level_1"))?.longText || "";
      const calle = comps.find((c) => c.types?.includes("route"))?.longText || "";
      const numero = comps.find((c) => c.types?.includes("street_number"))?.longText || "";
      const dirCorta = [calle, numero].filter(Boolean).join(" ");

      return {
        nombre: p.displayName?.text || "—",
        ciudad: ciudad2,
        provincia: prov2,
        direccion: dirCorta || addr,
        telefono: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
        web: p.websiteUri || null,
        instagram: null,
        email: "",
      };
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
