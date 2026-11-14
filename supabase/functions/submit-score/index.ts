import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://56820-ai.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getClientIp(req: Request): string | null {
  // Prefer the address added by the trusted edge proxy. If unavailable,
  // use the last X-Forwarded-For entry (the closest proxy-added address).
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip")?.trim();
  const candidate = cfIp || (forwarded ? forwarded.split(",").map(v => v.trim()).filter(Boolean).at(-1) : "") || realIp || "";
  if (!candidate || candidate.length > 64 || /[\s,;]/.test(candidate)) return null;
  return candidate.toLowerCase().replace(/^\[|\]$/g, "");
}

async function hashIp(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin");
  if (origin && origin !== "https://56820-ai.github.io") return json({ error: "Origin not allowed" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ipHashSecret = Deno.env.get("IP_HASH_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !ipHashSecret || ipHashSecret.length < 32) {
    console.error("Missing server configuration for score submission.");
    return json({ error: "Score submission is not configured on the server yet." }, 503);
  }

  const ip = getClientIp(req);
  if (!ip) return json({ error: "The server could not determine your network address." }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON request." }, 400);
  }

  const playerName = typeof body.player_name === "string" ? body.player_name.trim().slice(0, 24) : "";
  const gameTitle = typeof body.game_title === "string" ? body.game_title.trim().slice(0, 60) : "";
  const scoreText = typeof body.score === "string" ? body.score :
    Number.isSafeInteger(body.score) ? String(body.score) : "";
  const kind = body.kind === "session" ? "session" : body.kind === "score" ? "score" : "";
  if (!playerName || !gameTitle || !kind || !/^[0-9]{1,500}$/.test(scoreText) ||
      (kind === "session" && BigInt(scoreText) < 5n)) {
    return json({ error: "Invalid score submission." }, 400);
  }
  if (kind === "score" && gameTitle.toLowerCase() === "slope" && BigInt(scoreText) > 1500n) {
    return json({ error: "Slope scores are limited to 1,500." }, 400);
  }

  try {
    const ipHash = await hashIp(ip, ipHashSecret);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: inserted, error: scoreError } = await supabase
      .from("scores")
      .insert({ player_name: playerName, game_title: gameTitle, score: scoreText })
      .select("id")
      .single();

    if (scoreError || !inserted?.id) {
      console.error("Score insert failed:", scoreError?.message || "Missing score id");
      return json({ error: "The score could not be saved." }, 500);
    }

    const { error: ipError } = await supabase
      .from("score_ip_records")
      .insert({ score_id: String(inserted.id), ip_hash: ipHash });

    if (ipError) {
      // Avoid leaving a score without its corresponding private IP record.
      await supabase.from("scores").delete().eq("id", inserted.id);
      console.error("Private IP record insert failed:", ipError.message);
      return json({ error: "The score could not be saved securely." }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Score submission failed:", error instanceof Error ? error.message : String(error));
    return json({ error: "The score could not be saved." }, 500);
  }
});
