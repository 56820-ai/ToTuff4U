(function () {
  "use strict";
  var games = {
    "/g/slope": { title: "Slope", label: "Score" },
    "/g/retro-bowl": { title: "Retro Bowl", label: "Total coins" },
    "/g/gunspin": { title: "Gunspin", label: "Distance" },
    "/g/blockblast": { title: "Block Blast", label: "Score" },
    "/g/driftboss": { title: "Drift Boss", label: "Score" },
    "/g/snowrider3d": { title: "Snow Rider 3D", label: "Score / distance" },
    "/g/geodash": { title: "Geometry Dash", label: "Progress percent (0-100)" },
    "/g/subway-surfers": { title: "Subway Surfers", label: "Score" }
  };
  var path = location.pathname.replace(/\/+$/, "").toLowerCase();
  var game = games[path];
  if (!game) return;
  function name() {
    var key = "arcadeLeaderboardPlayerName", saved = "";
    try { saved = localStorage.getItem(key) || ""; } catch (e) {}
    if (!saved) {
      saved = (window.prompt("Enter your leaderboard name (24 characters max):", "") || "").trim().slice(0, 24);
      if (saved) try { localStorage.setItem(key, saved); } catch (e) {}
    }
    return saved;
  }
  function addButton() {
    if (document.getElementById("arcadeManualScoreButton")) return;
    var button = document.createElement("button");
    button.id = "arcadeManualScoreButton";
    button.type = "button";
    button.textContent = "Submit " + game.label;
    button.title = "Submit the score shown in the game";
    button.style.cssText = "position:fixed;z-index:2147483647;top:12px;right:12px;padding:10px 14px;border:2px solid #6b9dff;border-radius:10px;background:#111827;color:#fff;font:600 14px Arial;cursor:pointer;box-shadow:0 3px 14px #0008";
    button.addEventListener("click", async function () {
      if (!window.ArcadeScores || !window.ArcadeScores.configured) {
        window.alert("The leaderboard connection is not ready. Reload the game and try again.");
        return;
      }
      var raw = window.prompt("Enter your " + game.label + " exactly as shown in the game:", "");
      if (raw === null || !raw.trim()) return;
      var value = Number(raw.replace(/,/g, "").replace(/%$/, "").trim());
      if (!Number.isSafeInteger(value) || value < 0 || (game.label.indexOf("percent") !== -1 && value > 100)) {
        window.alert("Enter a valid whole-number " + game.label + ".");
        return;
      }
      var player = name();
      if (!player) return;
      button.disabled = true;
      button.textContent = "Submitting…";
      var ok = await window.ArcadeScores.submit(game.title, value, player);
      button.disabled = false;
      button.textContent = ok ? "Score submitted ✓" : "Try submitting again";
      if (ok) setTimeout(function () { button.textContent = "Submit " + game.label; }, 2200);
    });
    document.body.appendChild(button);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton);
  else addButton();
  var tries = 0;
  var retry = setInterval(function () {
    addButton();
    if (++tries >= 20 || document.getElementById("arcadeManualScoreButton")) clearInterval(retry);
  }, 500);
})();