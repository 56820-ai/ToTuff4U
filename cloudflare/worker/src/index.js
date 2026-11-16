const ALLOWED_ORIGIN = "https://56820-ai.github.io";
const NEON_FUNCTION_URL = "https://br-flat-grass-bdhxbnam-arcadeapi.compute.c-8.us-east-2.aws.neon.tech";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
      "Cache-Control": "no-store"
    }
  });
}

function getClientIp(request) {
  const ip = request.headers.get("CF-Connecting-IP")?.trim() || "";
  if (!ip || ip.length > 64 || /[\\s,;]/.test(ip)) return null;
  return ip.toLowerCase().replace(/^\\[|\\]$/g, "");
}

async function hashIp(ip, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function callNeon(path, env, init = {}) {
  if (!env.NEON_API_KEY) return json({ error: "Neon API authentication is not configured." }, 503);
  try {
    const response = await fetch(NEON_FUNCTION_URL + path, {
      ...init,
      headers: {
        "Authorization": `Bearer ${env.NEON_API_KEY}`,
        ...(init.headers || {})
      }
    });
    const data = await response.json();
    return json(data, response.status);
  } catch (error) {
    console.error("Neon API request failed:", error);
    return json({ error: "The score database could not be reached." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      if (origin && origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed." }, 403);

    if (request.method === "GET" && url.pathname === "/scores") {
      return callNeon("/scores", env);
    }

    if (request.method === "POST" && url.pathname === "/submit-score") {
      if (!env.IP_HASH_SECRET || env.IP_HASH_SECRET.length < 32) {
        return json({ error: "Score submission is not configured on the server." }, 503);
      }
      const ip = getClientIp(request);
      if (!ip) return json({ error: "The server could not determine your network address." }, 503);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: "Invalid JSON request." }, 400); }

      const playerName = typeof body.player_name === "string" ? body.player_name.trim().slice(0, 24) : "";
      const gameTitle = typeof body.game_title === "string" ? body.game_title.trim().slice(0, 60) : "";
      const scoreText = typeof body.score === "string" ? body.score.trim() :
        Number.isSafeInteger(body.score) && body.score >= 0 ? String(body.score) : "";
      const kind = body.kind === "session" ? "session" : body.kind === "score" ? "score" : "";

      if (!playerName) return json({ error: "A valid player name is required." }, 400);
      if (!gameTitle) return json({ error: "A valid game title is required." }, 400);
      if (!kind) return json({ error: "The submission type is missing or invalid." }, 400);
      if (!/^[0-9]{1,500}$/.test(scoreText)) {
        return json({ error: "The score must be a whole-number decimal string containing 1–500 digits." }, 400);
      }
      if (kind === "score" && gameTitle.toLowerCase() === "daily pick streak" && (BigInt(scoreText) < 1n || BigInt(scoreText) > 36500n)) {
        return json({ error: "Daily Pick Streak must be between 1 and 36,500 days." }, 400);
      }
      if (kind === "session" && BigInt(scoreText) < 5n) {
        return json({ error: "Playtime submissions must be at least 5 seconds." }, 400);
      }
      if (kind === "score" && gameTitle.toLowerCase() === "slope" && BigInt(scoreText) > 1500n) {
        return json({ error: "Slope scores are limited to 1,500." }, 400);
      }

      const ipHash = await hashIp(ip, env.IP_HASH_SECRET);
      return callNeon("/submit-score", env, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-arcade-ip-hash": ipHash },
        body: JSON.stringify({ player_name: playerName, game_title: gameTitle, score: scoreText, kind })
      });
    }
    return json({ error: "Not found." }, 404);
  }
};