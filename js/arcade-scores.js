// Google Tag Manager container, initialized once per page.
(function () {
  if (window.__arcadeAtlasGTM_KHTBG5BX) return;
  window.__arcadeAtlasGTM_KHTBG5BX = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-KHTBG5BX';
  (document.head || document.documentElement).appendChild(s);
})();
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
        "Content-Type": "application/json",
        ...(options && options.headers ? options.headers : {})
      }
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error("Score service returned " + response.status + ": " + detail.slice(0, 180));
    }
    if (response.status === 204) return null;
    const responseText = await response.text();
    if (!responseText.trim()) return null;
    try {
      return JSON.parse(responseText);
    } catch (error) {
      throw new Error("Score service returned invalid JSON: " + responseText.slice(0, 180));
    }
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

  async function submitSession(gameTitle, seconds, playerName) {
    playerName = typeof playerName === "string" ? playerName.trim().slice(0, 24) : "";
    seconds = Number(seconds);
    if (!playerName || !Number.isSafeInteger(seconds) || seconds < 5 || !gameTitle || !configured) return false;
    try {
      const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/scores", {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: config.supabaseAnonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ player_name: playerName, game_title: String(gameTitle).slice(0, 60), score: seconds })
      });
      if (!response.ok) throw new Error("Score service returned " + response.status);
      return true;
    } catch (error) {
      console.warn("Arcade Atlas: playtime was not submitted.", error.message);
      return false;
    }
  }

  async function getScores() {
    try {
      return await request("scores?select=id,player_name,game_title,score,created_at&order=score.desc&limit=1000", {
        method: "GET"
      });
    } catch (error) {
      console.warn("Arcade Atlas: could not load online scores.", error.message);
      return [];
    }
  }

  function getPlayerName(promptText) {
    const key = "arcadeLeaderboardPlayerName";
    let saved = "";
    try { saved = (localStorage.getItem(key) || "").trim().slice(0, 24); } catch (error) {}
    if (saved) return saved;
    const entered = window.prompt(promptText || "Enter your name for the leaderboard (24 characters max):", "");
    if (entered === null || !entered.trim()) return "";
    saved = entered.trim().slice(0, 24);
    try { localStorage.setItem(key, saved); } catch (error) {}
    return saved;
  }

  async function promptAndSubmit(gameTitle, score) {
    const playerName = getPlayerName("Enter your name for the leaderboard (24 characters max):");
    if (!playerName) return false;
    return submit(gameTitle, score, playerName);
  }

  window.ArcadeScores = { configured, submit, submitSession, getScores, getPlayerName, promptAndSubmit };
})();
