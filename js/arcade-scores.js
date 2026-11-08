(function () {
  "use strict";

  const config = window.ARCADE_ATLAS_SCORE_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || "") &&
    typeof config.supabaseAnonKey === "string" &&
    config.supabaseAnonKey.length > 20 &&
    !config.supabaseAnonKey.includes("YOUR_");

  async function request(path, options) {
    if (!configured) throw new Error("The shared score database has not been configured yet.");
    const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, {
      ...options,
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: "Bearer " + config.supabaseAnonKey,
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {})
      }
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error("Score service returned " + response.status + ": " + detail.slice(0, 180));
    }
    return response.status === 204 ? null : response.json();
  }

  async function submit(gameTitle, score, playerName) {
    playerName = typeof playerName === "string" ? playerName.trim().slice(0, 24) : "";
    const numericScore = Number(score);
    if (!playerName) {
      console.info("Arcade Atlas: a player name is required to submit a high score.");
      return false;
    }
    if (!Number.isSafeInteger(numericScore) || numericScore < 0 || !gameTitle) return false;
    try {
      await request("scores", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          player_name: playerName,
          game_title: String(gameTitle).slice(0, 60),
          score: numericScore
        })
      });
      console.info("Arcade Atlas: high score submitted.");
      return true;
    } catch (error) {
      console.warn("Arcade Atlas: high score was not submitted.", error.message);
      window.alert("Your score could not be added to the leaderboard.\n\nReason: " + error.message);
      return false;
    }
  }

  async function getScores() {
    try {
      return await request("scores?select=id,player_name,game_title,score,created_at&order=created_at.desc&limit=100", {
        method: "GET"
      });
    } catch (error) {
      console.warn("Arcade Atlas: could not load online scores.", error.message);
      return [];
    }
  }

  async function promptAndSubmit(gameTitle, score) {
    const playerName = window.prompt("New high score! Enter your name for the leaderboard (24 characters max):", "");
    if (playerName === null || !playerName.trim()) return false;
    return submit(gameTitle, score, playerName);
  }

  window.ArcadeScores = { configured, submit, getScores, promptAndSubmit };
})();
