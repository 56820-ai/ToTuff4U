const ALLOWED_ORIGIN = "https://56820-ai.github.io";

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
  if (!ip || ip.length > 64 || /[\s,;]/.test(ip)) return null;
  return ip.toLowerCase().replace(/^\[|\]$/g, "");
}

async function hashIp(ip, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function submitScore(request, env) {
  if (!env.DB || !env.IP_HASH_SECRET || env.IP_HASH_SECRET.length < 32) {
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
  if (kind === "session" && BigInt(scoreText) < 5n) {
    return json({ error: "Playtime submissions must be at least 5 seconds." }, 400);
  }
  if (kind === "score" && gameTitle.toLowerCase() === "slope" && BigInt(scoreText) > 1500n) {
    return json({ error: "Slope scores are limited to 1,500." }, 400);
  }

  const ipHash = await hashIp(ip, env.IP_HASH_SECRET);
  let inserted;
  try {
    inserted = await env.DB.prepare(
      "INSERT INTO scores (player_name, game_title, score) VALUES (?, ?, ?)"
    ).bind(playerName, gameTitle, scoreText).run();
    const scoreId = inserted.meta.last_row_id;
    await env.DB.prepare(
      "INSERT INTO score_ip_records (score_id, ip_hash) VALUES (?, ?)"
    ).bind(scoreId, ipHash).run();
    return json({ success: true });
  } catch (error) {
    if (inserted?.meta?.last_row_id) {
      await env.DB.prepare("DELETE FROM scores WHERE id = ?")
        .bind(inserted.meta.last_row_id).run().catch(() => {});
    }
    console.error("Score submission failed:", error);
    return json({ error: "The score could not be saved securely." }, 500);
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
      if (!env.DB) return json({ error: "Database binding is missing." }, 503);
      const rawLimit = Number(url.searchParams.get("limit") || 20000);
      const rawOffset = Number(url.searchParams.get("offset") || 0);
      const limit = Number.isSafeInteger(rawLimit) ? Math.max(1, Math.min(rawLimit, 20000)) : 20000;
      const offset = Number.isSafeInteger(rawOffset) ? Math.max(0, rawOffset) : 0;
      try {
        // Return only the three podium entries per game. This keeps browser
        // responses small instead of sending the entire score history.
        const result = await env.DB.prepare(`
          WITH base AS (
            SELECT
              id, player_name, game_title, score, created_at,
              lower(trim(game_title)) AS game_key,
              lower(trim(player_name)) AS player_key,
              CASE WHEN ltrim(score, '0') = '' THEN '0' ELSE ltrim(score, '0') END AS normalized_score
            FROM scores
          ),
          cookie_best AS (
            SELECT *,
              ROW_NUMBER() OVER (
                PARTITION BY player_key
                ORDER BY length(normalized_score) DESC, normalized_score DESC, created_at DESC, id ASC
              ) AS player_rank
            FROM base
            WHERE game_key = 'cookie clicker'
          ),
          cookie_top AS (
            SELECT *,
              ROW_NUMBER() OVER (
                ORDER BY length(normalized_score) DESC, normalized_score DESC, created_at DESC, id ASC
              ) AS game_rank
            FROM cookie_best
            WHERE player_rank = 1
          ),
          timed_totals AS (
            SELECT game_key, player_key, SUM(CAST(score AS INTEGER)) AS total_score,
              MAX(created_at) AS latest_created_at
            FROM base
            WHERE game_key IN ('minecraft', 'retro bowl time', 'blocky combat swat time')
            GROUP BY game_key, player_key
          ),
          timed_top AS (
            SELECT
              (SELECT b.id FROM base b WHERE b.game_key = t.game_key AND b.player_key = t.player_key ORDER BY b.created_at DESC, b.id ASC LIMIT 1) AS id,
              (SELECT b.player_name FROM base b WHERE b.game_key = t.game_key AND b.player_key = t.player_key ORDER BY b.created_at DESC, b.id ASC LIMIT 1) AS player_name,
              (SELECT b.game_title FROM base b WHERE b.game_key = t.game_key AND b.player_key = t.player_key ORDER BY b.created_at DESC, b.id ASC LIMIT 1) AS game_title,
              CAST(t.total_score AS TEXT) AS score,
              t.latest_created_at AS created_at,
              ROW_NUMBER() OVER (
                PARTITION BY t.game_key
                ORDER BY t.total_score DESC, t.latest_created_at DESC, t.player_key ASC
              ) AS game_rank
            FROM timed_totals t
          ),
          normal_top AS (
            SELECT *,
              ROW_NUMBER() OVER (
                PARTITION BY game_key
                ORDER BY length(normalized_score) DESC, normalized_score DESC, created_at DESC, id ASC
              ) AS game_rank
            FROM base
            WHERE game_key NOT IN ('cookie clicker', 'minecraft', 'retro bowl time', 'blocky combat swat time')
              AND (game_key <> 'slope' OR CAST(score AS INTEGER) <= 1500)
          )
          SELECT id, player_name, game_title, score, created_at FROM normal_top WHERE game_rank <= 3
          UNION ALL
          SELECT id, player_name, game_title, score, created_at FROM cookie_top WHERE game_rank <= 3
          UNION ALL
          SELECT id, player_name, game_title, score, created_at FROM timed_top WHERE game_rank <= 3
        `).all();
        return json(result.results || []);
      } catch (error) {
        console.error("Leaderboard read failed:", error);
        return json({ error: "The leaderboard could not be loaded." }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/submit-score") {
      return submitScore(request, env);
    }
    return json({ error: "Not found." }, 404);
  }
};
