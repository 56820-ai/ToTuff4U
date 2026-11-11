// Supabase Edge Function: moderate-player-name
// Set OPENAI_API_KEY with: supabase secrets set OPENAI_API_KEY=...
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "Moderation service is not configured yet." }, { status: 503, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 24) {
      return Response.json({ error: "Player names must be 1–24 characters." }, { status: 400, headers: corsHeaders });
    }

    const moderation = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: name })
    });
    if (!moderation.ok) {
      console.error("OpenAI moderation error:", moderation.status, await moderation.text());
      return Response.json({ error: "Name moderation is temporarily unavailable. Please try again." }, { status: 502, headers: corsHeaders });
    }
    const result = await moderation.json();
    const flagged = result.results?.[0]?.flagged === true;
    return Response.json({ allowed: !flagged }, { headers: corsHeaders });
  } catch (error) {
    console.error("Name moderation failed:", error);
    return Response.json({ error: "Name moderation is temporarily unavailable. Please try again." }, { status: 500, headers: corsHeaders });
  }
});
