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


  async function submitThroughServer(gameTitle, score, playerName, kind, keepalive) {
    if (!configured) throw new Error("The shared score database has not been configured yet.");
    const endpoint = config.supabaseUrl.replace(/\/$/, "") + "/functions/v1/submit-score";
    const response = await fetch(endpoint, {
      method: "POST",
      keepalive: !!keepalive,
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: "Bearer " + config.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        player_name: playerName,
        game_title: String(gameTitle).slice(0, 60),
        score: Number(score),
        kind: kind
      })
    });
    const responseText = await response.text();
    let result = null;
    if (responseText.trim()) {
      try { result = JSON.parse(responseText); }
      catch (_) { throw new Error("Score server returned an unreadable response (HTTP " + response.status + ")."); }
    }
    if (!response.ok || !result || result.success !== true) {
      const detail = result && result.error ? result.error : "HTTP " + response.status;
      throw new Error("Score server rejected the submission: " + detail);
    }
    return result;
  }

  async function submit(gameTitle, score, playerName) {
    playerName = typeof playerName === "string" ? playerName.trim().slice(0, 24) : "";
    const scoreText = typeof score === "bigint" ? score.toString() :
      typeof score === "string" ? score.trim() :
      Number.isSafeInteger(score) && score >= 0 ? String(score) : "";
    if (!playerName) {
      console.info("Arcade Atlas: a player name is required to submit a high score.");
      return false;
    }
    if (!/^[0-9]{1,100}$/.test(scoreText) || !gameTitle) return false;
    if (String(gameTitle).trim().toLowerCase() === "slope" && BigInt(scoreText) > 1500n) {
      console.warn("Arcade Atlas: Slope score rejected (maximum 1,500).");
      window.alert("That Slope score was rejected. The leaderboard limit is 1,500.");
      return false;
    }
    try {
      await submitThroughServer(gameTitle, scoreText, playerName, "score", false);
      console.info("Arcade Atlas: high score submitted.");
      return true;
    } catch (error) {
      console.warn("Arcade Atlas: high score was not submitted.", error.message);
      window.alert("Your score could not be added to the leaderboard.\\n\\nReason: " + error.message);
      return false;
    }
  }

  async function submitSession(gameTitle, seconds, playerName) {
    playerName = typeof playerName === "string" ? playerName.trim().slice(0, 24) : "";
    seconds = Number(seconds);
    if (!playerName || !Number.isSafeInteger(seconds) || seconds < 5 || !gameTitle || !configured) return false;
    try {
      await submitThroughServer(gameTitle, seconds, playerName, "session", true);
      return true;
    } catch (error) {
      console.warn("Arcade Atlas: playtime was not submitted.", error.message);
      return false;
    }
  }

  async function getScores() {
    window.ArcadeScores.lastLoadError = "";
    try {
      // Fetch the entire score history in pages. A single 1,000-row query can
      // hide games whose scores are older or smaller than the busiest games.
      const pageSize = 1000;
      const allScores = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = await request(
          "scores?select=id,player_name,game_title,score,created_at&order=created_at.desc&limit=" + pageSize + "&offset=" + offset,
          { method: "GET" }
        );
        if (!Array.isArray(page) || page.length === 0) break;
        allScores.push(...page);
        if (page.length < pageSize) break;
      }
      return allScores;
    } catch (error) {
      window.ArcadeScores.lastLoadError = error && error.message ? error.message : String(error);
      console.warn("Arcade Atlas: could not load online scores.", window.ArcadeScores.lastLoadError);
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

  window.ArcadeScores = { configured, submit, submitSession, getScores, getPlayerName, promptAndSubmit, lastLoadError: "" };
})();
