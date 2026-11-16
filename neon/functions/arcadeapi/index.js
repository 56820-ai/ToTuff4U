import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const ALLOWED_ORIGINS = new Set(["https://56820-ai.github.io", "https://duckmath.org", "https://www.duckmath.org"]);
function response(data, status=200, origin="") {
  const headers = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(data), {status, headers});
}
export default { async fetch(request) {
  const url = new URL(request.url), origin = request.headers.get("Origin") || "";
  if (request.method==="OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null,{status:403});
    return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":origin || "https://56820-ai.github.io","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}});
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return response({error:"Origin not allowed."},403,origin);
  if (request.method==="GET" && (url.pathname==="/" || url.pathname==="/health")) {
    try { await pool.query("SELECT 1"); return response({ok:true,service:"Arcade Atlas Neon API"},200,origin); }
    catch(e) { console.error(e); return response({error:"Database unavailable."},500,origin); }
  }
  if (request.method==="GET" && url.pathname==="/scores") {
    try {
      const {rows}=await pool.query("SELECT id, player_name, game_title, score, created_at FROM leaderboard_top_scores ORDER BY game_key ASC, rank ASC");
      return response(rows,200,origin);
    } catch(e) { console.error("Leaderboard read failed",e); return response({error:"The leaderboard could not be loaded."},500,origin); }
  }
  if (request.method==="POST" && url.pathname==="/submit-score") {
    let body; try { body=await request.json(); } catch { return response({error:"Invalid JSON request."},400,origin); }
    const player=typeof body.player_name==="string"?body.player_name.trim().slice(0,24):"";
    const game=typeof body.game_title==="string"?body.game_title.trim().slice(0,60):"";
    const score=typeof body.score==="string"?body.score.trim():(Number.isSafeInteger(body.score)&&body.score>=0?String(body.score):"");
    const kind=body.kind==="session"?"session":body.kind==="score"?"score":"";
    if(!player||!game||!kind||!/^[0-9]{1,500}$/.test(score)) return response({error:"Invalid player, game, submission type, or score."},400,origin);
    const value=BigInt(score);
    if(value===0n) return response({error:"Zero scores are not accepted."},400,origin);
    if(kind==="session"&&value<5n) return response({error:"Playtime submissions must be at least 5 seconds."},400,origin);
    if(kind==="score"&&game.toLowerCase()==="daily pick streak"&&(value<1n||value>36500n)) return response({error:"Daily Pick Streak must be between 1 and 36,500 days."},400,origin);
    if(kind==="score"&&game.toLowerCase()==="slope"&&value>1500n) return response({error:"Slope scores are limited to 1,500."},400,origin);
    const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    try {
      const client=await pool.connect();
      try {
        await client.query("BEGIN");
        const inserted=await client.query("INSERT INTO scores (player_name,game_title,score) VALUES ($1,$2,$3) RETURNING id",[player,game,score]);
        const secret=process.env.IP_HASH_SECRET;
        if(secret && secret.length>=32) {
          const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
          const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(ip));
          const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
          await client.query("INSERT INTO score_ip_records(score_id,ip_hash) VALUES($1,$2)",[inserted.rows[0].id,hash]);
        }
        await client.query("COMMIT");
      } catch(e) { await client.query("ROLLBACK").catch(()=>{}); throw e; }
      finally { client.release(); }
      return response({success:true},200,origin);
    } catch(e) { console.error("Score submission failed",e); return response({error:"The score could not be saved."},500,origin); }
  }
  return response({error:"Not found."},404,origin);
}};
