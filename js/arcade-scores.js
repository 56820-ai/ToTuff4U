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
  const configured = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(config.apiUrl || "");

  async function request(path, options) {
    if (!configured) throw new Error("The shared score database has not been configured yet.");
    const response = await fetch(config.apiUrl.replace(/\/$/, "") + path, {
      ...options,
      headers: {
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


  function getPlayerCookieId() {
    const key = "arcade_player_id";
    const match = document.cookie.match(new RegExp("(?:^|; )" + key + "=([a-f0-9]{64})(?:;|$)"));
    if (match) return match[1];
    if (!window.crypto || !window.crypto.getRandomValues) throw new Error("This browser cannot create a secure player cookie.");
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    const id = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
    document.cookie = key + "=" + id + "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
    const saved = document.cookie.match(new RegExp("(?:^|; )" + key + "=([a-f0-9]{64})(?:;|$)"));
    if (!saved) throw new Error("Your browser is blocking Arcade Atlas cookies. Enable cookies to save personal scores.");
    return saved[1];
  }

  async function submitThroughServer(gameTitle, score, playerName, kind, keepalive) {
    if (!configured) throw new Error("The shared score database has not been configured yet.");
    const endpoint = config.apiUrl.replace(/\/$/, "") + "/submit-score";
    const response = await fetch(endpoint, {
      method: "POST",
      keepalive: !!keepalive,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        player_name: playerName,
        game_title: String(gameTitle).slice(0, 60),
        score: typeof score === "bigint" ? score.toString() : String(score),
        kind: kind,
        player_cookie_id: getPlayerCookieId()
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
      window.ArcadeScores.lastSubmitError = "No player name was supplied.";
      console.info("Arcade Atlas: a player name is required to submit a high score.");
      return false;
    }
    if (!/^[0-9]{1,500}$/.test(scoreText)) {
      window.ArcadeScores.lastSubmitError = "The detected score was not a valid 1–500 digit whole number (received " + (scoreText ? scoreText.length + " characters" : "an empty value") + ").";
      return false;
    }
    if (!gameTitle || !String(gameTitle).trim()) {
      window.ArcadeScores.lastSubmitError = "The game title is missing.";
      return false;
    }
    if (String(gameTitle).trim().toLowerCase() === "slope" && BigInt(scoreText) > 1500n) {
      window.ArcadeScores.lastSubmitError = "Slope scores are limited to 1,500.";
      console.warn("Arcade Atlas: Slope score rejected (maximum 1,500).");
      window.alert("That Slope score was rejected. The leaderboard limit is 1,500.");
      return false;
    }
    window.ArcadeScores.lastSubmitError = "Submission started but did not complete; check the browser console for a network or script error.";
    try {
      await submitThroughServer(gameTitle, scoreText, playerName, "score", false);
      window.ArcadeScores.lastSubmitError = "";
      console.info("Arcade Atlas: high score submitted.");
      return true;
    } catch (error) {
      window.ArcadeScores.lastSubmitError = error && error.message ? error.message : String(error);
      console.warn("Arcade Atlas: high score was not submitted.", window.ArcadeScores.lastSubmitError);
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
      const scores = await request("/scores", { method: "GET" });
      if (!Array.isArray(scores)) throw new Error("Score service returned an invalid leaderboard response.");
      return scores;
    } catch (error) {
      window.ArcadeScores.lastLoadError = error && error.message ? error.message : String(error);
      console.warn("Arcade Atlas: could not load leaderboard.", window.ArcadeScores.lastLoadError);
      return [];
    }
  }

  async function getMyScores() {
    const cookieId = getPlayerCookieId();
    return request("/my-scores", { method: "GET", headers: { "X-Arcade-Player": cookieId } });
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

  window.ArcadeScores = { configured, submit, submitSession, getScores, getMyScores, getPlayerCookieId, getPlayerName, promptAndSubmit, lastLoadError: "", lastSubmitError: "" };
})();
