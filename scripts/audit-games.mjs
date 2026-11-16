import { chromium } from "playwright";
import { readFile, writeFile, appendFile } from "node:fs/promises";

const BASE = "http://127.0.0.1:4173/ToTuff4U";
const gamesData = JSON.parse(await readFile("games.json", "utf8"));
const catalog = Array.isArray(gamesData.games) ? gamesData.games : [];
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
// The Chromium audit uses software WebGL so GPU-backed arcade games can be checked in CI.
const results = [];
const ignoreUrl = /googletagmanager|google-analytics|doubleclick|pagead|adsbygoogle|hotjar|posthog|favicon|apple-touch-icon|manifest|source-map/i;

function gameUrl(game) {
  const p = String(game.path || "");
  if (/^https?:\/\//i.test(p)) return p;
  const [pathPart, queryPart] = p.split("?", 2);
  const normalizedPath = pathPart.replace(/^\/+/, "").replace(/\/+$/, "");
  return BASE + "/" + normalizedPath + "/" + (queryPart !== undefined ? "?" + queryPart : "");
}
function categoryFor(value) {
  const s = Array.isArray(value) ? value.join(" ") : String(value || "");
  if (/sport|football|basketball|soccer|baseball/i.test(s)) return "SPORTS";
  if (/race|drift|car|motor|bike/i.test(s)) return "RACING";
  if (/puzzle|logic|word|card|board/i.test(s)) return "PUZZLE";
  if (/strategy|tower defense/i.test(s)) return "STRATEGY";
  if (/idle|clicker|tycoon|simulation|simulator/i.test(s)) return "SIMULATION";
  if (/horror/i.test(s)) return "HORROR";
  if (/platform/i.test(s)) return "PLATFORMER";
  if (/adventure|rpg/i.test(s)) return "ADVENTURE";
  if (/action|shooter|fps|fighting/i.test(s)) return "ACTION";
  return "ARCADE";
}
function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function slugFromGame(game) {
  const query = String(game?.path || "").split("?")[1] || "";
  const match = query.match(/(?:^|&)title=([^&]*)/);
  try { return match ? decodeURIComponent(match[1]) : String(game?.title || ""); }
  catch { return String(game?.title || ""); }
}
function formatGameTitle(value) {
  const slug = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  const special = {
    "snek-io": "Snek.io",
    "worldguessr": "WorldGuessr",
    "the-worlds-hardest-game": "The World's Hardest Game",
    "the-worlds-hardest-game-2": "The World's Hardest Game 2",
    "worlds-hardest-game": "World's Hardest Game",
    "fnf-garcello": "FNF Garcello",
    "cs-online": "CS Online",
    "cs-surf": "CS Surf",
    "uno-online": "UNO Online",
    "ovo-multiplayer": "OvO Multiplayer",
    "e-life-simulator": "E-Life Simulator",
    "bffs-black-friday-collection": "BFFs Black Friday Collection"
  };
  if (special[slug]) return special[slug];
  const words = { fnf:"FNF", gta:"GTA", cs:"CS", csgo:"CSGO", uno:"UNO", ovo:"OvO", fps:"FPS", btd:"BTD", f1:"F1", bffs:"BFFs", moto:"Moto", x3m:"X3M", "2d":"2D", "3d":"3D", papas:"Papa's", duckcraft:"DuckCraft", eaglecraft:"EagleCraft", maddoxcraft:"MaddoxCraft", nba:"NBA", nfl:"NFL", io:"io" };
  return slug.split("-").filter(Boolean).map(word => words[word] || (/^\d+$/.test(word) ? word : word[0].toUpperCase() + word.slice(1))).join(" ");
}
function suitableForMiddleSchool(app) {
  const text = [app?.title, app?.categories, app?.description].flat().join(" ").toLowerCase();
  return !/(horror|gore|blood|adult|nsfw|sexual|nudity|casino|gambling|mortal.?kombat|doom|omori|fnaf|five.?nights|granny|poppy.?playtime|ultrakill|doki.?doki|pokemon|super.?mario|street.?fighter|portal|animal.?crossing|grand.?theft|gta|roblox|fortnite|among.?us|super.?smash|hollow.?knight|pizza.?tower|twerk|poop.?clicker|happy.?wheels|binding.?of.?isaac|backrooms|backdooms)/i.test(text);
}
function normalizeIcon(icon) {
  if (typeof icon !== "string" || !icon.trim()) return "";
  if (icon.startsWith("/assets/")) return "duckmath-site" + icon;
  if (icon.startsWith("assets/")) return "duckmath-site/" + icon;
  if (icon.startsWith("/ToTuff4U/duckmath-site/")) return icon.slice("/ToTuff4U/".length);
  return icon;
}
async function checkGame(game) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const localFailures = [];
  const externalFailures = [];
  const pageErrors = [];
  page.on("dialog", d => d.accept().catch(() => {}));
  page.on("pageerror", e => pageErrors.push(String(e.message || e).slice(0, 220)));
  page.on("response", r => {
    if (r.status() < 400 || ignoreUrl.test(r.url())) return;
    const item = { status: r.status(), url: r.url().slice(0, 300) };
    if (r.url().startsWith(BASE)) localFailures.push(item);
    else externalFailures.push(item);
  });
  let response = null;
  let navigationError = "";
  const url = gameUrl(game);
  try {
    response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 16000 });
    await page.waitForTimeout(900);
    if (String(game.path || "").startsWith("g/one-button-collection/?")) {
      await page.waitForFunction(() => document.querySelector("canvas"), undefined, { timeout: 10000 }).catch(() => {});
    }
  } catch (e) {
    navigationError = String(e.message || e).slice(0, 260);
  }
  const status = response ? response.status() : null;
  const title = await page.title().catch(() => "");
  const body = await page.locator("body").innerText({ timeout: 1500 }).catch(() => "");
  const frames = await page.locator("iframe").evaluateAll(els => els.map(f => f.getAttribute("src") || f.src).filter(Boolean)).catch(() => []);
  const canvases = await page.locator("canvas").count().catch(() => 0);
  const requiresCanvas = String(game.path || "").startsWith("g/one-button-collection/?");
  const missingCanvas = requiresCanvas && canvases === 0;
  const mainFrameUrl = page.url();
  const missingPage = /(^|\n)\s*(404|page not found|file not found|error response)\s*(\n|$)/i.test(body.slice(0, 900)) ||
    /error response/i.test(title);
  const criticalPageErrors = pageErrors.filter(message =>
    /Invalid or unexpected token|Unexpected token|Unexpected number|missing \) after argument list|Invalid regular expression|THREE is not defined|Identifier .* already declared|check is not defined/i.test(message)
  );
  const missingCoreAssets = localFailures.filter(item =>
    /\.(js|wasm|unityweb|data|json)(?:[?#]|$)/i.test(item.url) &&
    !/(\/js\/(main|favicon|panic|gtag|auto-clicker|autoclicker)\.js|\/storage\/js\/cloak\.js|save\.dat|optiondata\.dat|savedata\.ini|service.?worker|\/sw\.js|\/cdn-cgi\/|detectmobilebrowser\.js|prebid.*\.js|websdkwrapper\.js|\/cdn\.fbrq\/)/i.test(item.url)
  );
  const iframeHosts = frames.map(src => { try { return new URL(src, url).host; } catch { return ""; } }).filter(Boolean);
  const failedGameFrames = externalFailures.filter(item => iframeHosts.some(host => item.url.includes(host)));
  const hardFailure = !response || status >= 400 || missingPage || !!navigationError ||
    criticalPageErrors.length > 0 || missingCoreAssets.length > 0 || failedGameFrames.length > 0 || missingCanvas;
  await page.close().catch(() => {});
  return {
    title: game.title,
    url,
    status,
    pageTitle: title,
    mainFrameUrl,
    hardFailure,
    navigationError,
    localFailures: localFailures.slice(0, 12),
    missingCoreAssets: missingCoreAssets.slice(0, 12),
    criticalPageErrors: criticalPageErrors.slice(0, 8),
    failedGameFrames: failedGameFrames.slice(0, 8),
    externalFailures: externalFailures.slice(0, 8),
    pageErrors: pageErrors.slice(0, 8),
    iframeSources: frames.slice(0, 5),
    canvasCount: canvases,
    missingCanvas
  };
}

// Verify every catalog logo actually loads in Chromium.
const logoPage = await browser.newPage();
const logoUrls = catalog.map(game => {
  const image = String(game.image || "");
  const remote = image.startsWith("https://") || image.startsWith("http://") ||
    image.startsWith("data:") || image.startsWith("blob:");
  const cleanImage = image.startsWith("/") ? image.slice(1) : image;
  return {
    title: game.title,
    url: remote ? image : BASE + "/" + cleanImage
  };
});
const logoAudit = await logoPage.evaluate(async items => {
  let cursor = 0;
  const results = new Array(items.length);
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      const item = items[i];
      results[i] = await new Promise(resolve => {
        const image = new Image();
        const timeout = setTimeout(() => resolve({ title: item.title, url: item.url, ok: false, reason: "timeout" }), 9000);
        image.onload = () => {
          clearTimeout(timeout);
          resolve({ title: item.title, url: item.url, ok: image.naturalWidth > 0, width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = () => {
          clearTimeout(timeout);
          resolve({ title: item.title, url: item.url, ok: false, reason: "image load error" });
        };
        image.src = item.url;
      });
    }
  }
  await Promise.all(Array.from({ length: 10 }, worker));
  return results;
}, logoUrls, { timeout: 180000 }).catch(error => [{ title: "Logo audit", ok: false, reason: String(error.message || error) }]);
await logoPage.close();

const workers = 4;
let cursor = 0;
await Promise.all(Array.from({ length: workers }, async () => {
  while (cursor < catalog.length) {
    const i = cursor++;
    results[i] = await checkGame(catalog[i]);
  }
}));

// Check the two custom interfaces touched by this maintenance pass.
const uiAudit = { leaderboard: {}, blockyCombat: {}, catalog: {}, collections: {}, dailyPick: {}, connectFour: {}, chess: {} };
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e).slice(0, 220)));
  const response = await page.goto(BASE + "/leaderboard/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => ({
    hasScoreList: !!document.getElementById("score-list"),
    hasLogoFunction: typeof getGameLogo === "function",
    logoCount: typeof catalogLogos !== "undefined" ? catalogLogos.size : 0,
    blockyLogo: typeof getGameLogo === "function" ? getGameLogo("Blocky Combat SWAT Time") : ""
  })).catch(() => ({ hasScoreList: false, hasLogoFunction: false, logoCount: 0, blockyLogo: "" }));
  const dailyStreakIconResponse = await page.request.get(BASE + "/images/daily-pick-streak.svg").catch(() => null);
  const dailyStreakLogo = await page.evaluate(() => typeof getGameLogo === "function" ? getGameLogo("Daily Pick Streak") : "");
  uiAudit.leaderboard = { status: response?.status() || null, ...state, dailyStreakLogo, dailyStreakIconStatus: dailyStreakIconResponse?.status() || null, errors };
  await page.close();
} catch (e) {
  uiAudit.leaderboard.error = String(e.message || e).slice(0, 300);
}
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e).slice(0, 220)));
  const response = await page.goto(BASE + "/g/duckdb2-blocky-combat-swat-main/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => ({
    timer: document.getElementById("arcade-playtime-timer")?.textContent || "",
    scoreService: !!(window.ArcadeScores && typeof window.ArcadeScores.submitSession === "function")
  }));
  uiAudit.blockyCombat = { status: response?.status() || null, ...state, errors };
  await page.close();
} catch (e) {
  uiAudit.blockyCombat.error = String(e.message || e).slice(0, 300);
}

try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e).slice(0, 220)));
  const response = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await page.waitForSelector("#favoritesOnlyToggle", { timeout: 12000 });
  await page.waitForSelector("#all-games-grid .game-card .favorite-star", { timeout: 12000 });
  await page.evaluate(() => {
    const overlay = document.getElementById("patchNotesOverlay");
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.setAttribute("aria-hidden", "true");
    }
  });
  await page.waitForFunction(() => { const section = document.getElementById("daily-pick-section"); return section && getComputedStyle(section).display !== "none"; }, undefined, { timeout: 10000 });
  const dailyStreakLink = page.locator("#daily-pick-leaderboard-link");
  const dailyStreakLinkVisible = await dailyStreakLink.isVisible();
  await dailyStreakLink.click();
  await page.waitForFunction(() => document.getElementById("leaderboard-content")?.classList.contains("active"), undefined, { timeout: 4000 });
  const dailyStreakLinkWorks = dailyStreakLinkVisible && await page.locator("#leaderboard-frame").count() === 1;
  await page.locator('.nav-item[data-page="home"]').click();
  await page.waitForFunction(() => document.getElementById("home-content")?.classList.contains("active"), undefined, { timeout: 4000 });
  const actionChip = page.locator('#category-quick-filters button[data-category="ACTION"]');
  await actionChip.click({ timeout: 4000 });
  await page.waitForFunction(() => document.getElementById("categoryFilter")?.value === "ACTION", undefined, { timeout: 4000 });
  const quickFilterActive = await actionChip.getAttribute("aria-pressed") === "true";
  await page.locator('#category-quick-filters button[data-category=""]').click({ timeout: 4000 });
  await page.waitForFunction(() => document.getElementById("categoryFilter")?.value === "", undefined, { timeout: 4000 });
  const quickFilterCleared = await page.locator('#category-quick-filters button[data-category=""]').getAttribute("aria-pressed") === "true";
  const star = page.locator("#all-games-grid .game-card .favorite-star").first();
  const favoriteButton = await star.evaluate(el => ({
    tag: el.tagName.toLowerCase(),
    pressed: el.getAttribute("aria-pressed"),
    label: el.getAttribute("aria-label") || ""
  }));
  const firstHref = await page.locator("#all-games-grid .game-card a").first().getAttribute("href");
  await page.evaluate(href => {
    const key = normalizeGamePath(href);
    localStorage.setItem("gamePlayCounts", JSON.stringify({ [key]: 4 }));
    updateMostPlayedSection();
  }, firstHref);
  const mostPlayedBefore = await page.locator("#most-played-section").evaluate(el => getComputedStyle(el).display !== "none");
  await star.focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector("#all-games-grid .favorite-star")?.getAttribute("aria-pressed") === "true", undefined, { timeout: 4000 });
  await page.locator("#favoritesOnlyToggle").click();
  await page.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent.includes("1 game in favorites"), undefined, { timeout: 4000 });
  const filteredCards = await page.locator("#all-games-grid .game-card").count();
  await page.waitForFunction(() => {
    const section = document.getElementById("most-played-section");
    return section && getComputedStyle(section).display === "none";
  }, undefined, { timeout: 4000 });
  const mostPlayedHidden = await page.locator("#most-played-section").evaluate(el => getComputedStyle(el).display === "none");
  await page.locator("#all-games-grid .favorite-star").first().focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent.startsWith("0 games in favorites"), undefined, { timeout: 4000 });
  const emptyMessage = await page.locator("#all-games-grid .empty-games-message").textContent();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#favoritesOnlyToggle", { timeout: 10000 });
  await page.evaluate(() => {
    const overlay = document.getElementById("patchNotesOverlay");
    if (overlay) {
      overlay.classList.remove("visible");
      overlay.setAttribute("aria-hidden", "true");
    }
  });
  await page.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent.startsWith("0 games in favorites"), undefined, { timeout: 10000 });
  const persistedFilter = await page.locator("#favoritesOnlyToggle").getAttribute("aria-pressed");
  await page.waitForFunction(() => {
    const section = document.getElementById("most-played-section");
    return section && getComputedStyle(section).display === "none";
  }, undefined, { timeout: 4000 });
  const mostPlayedHiddenAfterReload = await page.locator("#most-played-section").evaluate(el => getComputedStyle(el).display === "none");
  await page.locator("#favoritesOnlyToggle").click();
  await page.waitForFunction(() => {
    const section = document.getElementById("most-played-section");
    return section && getComputedStyle(section).display !== "none";
  }, undefined, { timeout: 4000 });
  const mostPlayedVisibleAfterClear = await page.locator("#most-played-section").evaluate(el => getComputedStyle(el).display !== "none");
  await page.evaluate(() => {
    localStorage.removeItem("favoriteGames");
    localStorage.removeItem("arcadeAtlasFavoritesOnly");
    localStorage.removeItem("gamePlayCounts");
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.goto(BASE + "/?q=slope&category=ARCADE&sort=az&mode=multiplayer", { waitUntil: "domcontentloaded", timeout: 16000 });
  await page.evaluate(() => { const overlay = document.getElementById("patchNotesOverlay"); if (overlay) { overlay.classList.remove("visible"); overlay.setAttribute("aria-hidden", "true"); } });
  await page.waitForFunction(() => document.getElementById("searchInput")?.value === "slope" && document.getElementById("categoryFilter")?.value === "ARCADE", undefined, { timeout: 10000 });
  const sharedFiltersLoaded = await page.locator("#sortFilter").inputValue() === "az" &&
    await page.locator('#category-quick-filters button[data-mode="multiplayer"]').getAttribute("aria-pressed") === "true";
  await page.locator("#shareCatalogButton").click();
  const shareLinkCopied = await page.locator("#shareCatalogButton").textContent().then(text => String(text || "").includes("copied"));
  const copiedShareUrl = await page.evaluate(async () => await navigator.clipboard.readText().catch(() => ""));
  const shareUrlValid = (() => { try { const url = new URL(copiedShareUrl); return url.searchParams.get("q") === "slope" && url.searchParams.get("category") === "ARCADE" && url.searchParams.get("sort") === "az" && url.searchParams.get("mode") === "multiplayer" && !url.searchParams.has("favorites") && !url.searchParams.has("collection"); } catch { return false; } })();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await page.waitForSelector("#all-games-grid .game-card", { timeout: 10000 });
  const syncPage = await page.context().newPage();
  await syncPage.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await syncPage.waitForSelector("#all-games-grid .game-card", { timeout: 10000 });
  await syncPage.evaluate(() => { const overlay = document.getElementById("patchNotesOverlay"); if (overlay) { overlay.classList.remove("visible"); overlay.setAttribute("aria-hidden", "true"); } });
  const syncedGame = await syncPage.locator("#all-games-grid .game-card").first().evaluate(card => ({
    path: normalizeGamePath(card.querySelector("a")?.getAttribute("href") || ""),
    title: card.querySelector(".game-card-title")?.textContent || "",
    image: card.querySelector(".game-card-image")?.getAttribute("src") || "",
    category: "ARCADE"
  }));
  await syncPage.evaluate(game => {
    localStorage.setItem("favoriteGames", JSON.stringify([game]));
    localStorage.setItem("arcadeAtlasGameRatings", JSON.stringify({ [game.path]: 5 }));
  }, syncedGame);
  const syncedCard = page.locator("#all-games-grid .game-card").filter({ has: page.getByText(syncedGame.title, { exact: true }) }).first();
  await page.waitForFunction(title => {
    const cards = [...document.querySelectorAll("#all-games-grid .game-card")];
    const card = cards.find(item => item.querySelector(".game-card-title")?.textContent === title);
    return card?.querySelector(".favorite-star")?.getAttribute("aria-pressed") === "true" && card?.querySelector('.game-rating button[aria-pressed="true"]')?.getAttribute("aria-label")?.includes("5 out of 5");
  }, syncedGame.title, { timeout: 6000 });
  const crossTabPreferencesSynced = await syncedCard.locator(".favorite-star").getAttribute("aria-pressed") === "true" &&
    await syncedCard.locator('.game-rating button[aria-pressed="true"]').getAttribute("aria-label").then(label => String(label || "").includes("5 out of 5"));
  await syncPage.evaluate(() => { localStorage.removeItem("favoriteGames"); localStorage.removeItem("arcadeAtlasGameRatings"); });
  await syncPage.close();
  const ok = response?.status() === 200 &&
    favoriteButton.tag === "button" &&
    favoriteButton.pressed === "false" &&
    !!favoriteButton.label &&
    mostPlayedBefore &&
    filteredCards === 1 &&
    mostPlayedHidden &&
    String(emptyMessage || "").includes("Star a game") &&
    persistedFilter === "true" &&
    mostPlayedHiddenAfterReload &&
    mostPlayedVisibleAfterClear &&
    quickFilterActive && quickFilterCleared && sharedFiltersLoaded && shareLinkCopied && shareUrlValid && dailyStreakLinkWorks && crossTabPreferencesSynced;
  uiAudit.catalog = {
    status: response?.status() || null,
    favoriteButton,
    mostPlayedBefore,
    filteredCards,
    mostPlayedHidden,
    emptyMessage,
    persistedFilter,
    mostPlayedHiddenAfterReload,
    mostPlayedVisibleAfterClear,
    sharedFiltersLoaded,
    shareLinkCopied,
    shareUrlValid,
    dailyStreakLinkWorks,
    crossTabPreferencesSynced,
    quickFilterActive,
    quickFilterCleared,
    quickFiltersOk: quickFilterActive && quickFilterCleared,
    errors,
    ok
  };
  await page.close();
} catch (e) {
  uiAudit.catalog.error = String(e.message || e).slice(0, 300);
}

try {
  const collectionsContext = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await collectionsContext.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e).slice(0, 220)));
  const response = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await page.waitForSelector("#createCollectionButton", { timeout: 12000 });
  await page.evaluate(() => {
    const overlay = document.getElementById("patchNotesOverlay");
    if (overlay) { overlay.classList.remove("visible"); overlay.setAttribute("aria-hidden", "true"); }
    localStorage.removeItem("arcadeAtlasCollectionsV1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#createCollectionButton", { timeout: 10000 });
  await page.locator("#createCollectionButton").click();
  await page.locator("#collection-name-input").fill("Arcade Night");
  await page.locator("#collection-form").evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]").some(item => item.name === "Arcade Night"), undefined, { timeout: 4000 });
  const created = await page.locator("#collections-grid .collection-card").count() === 1;

  const slopeAdd = page.locator('#all-games-grid .game-card').filter({ has: page.getByText("Slope", { exact: true }) }).first().locator('.collection-add-button');
  await slopeAdd.click();
  await page.locator('#collection-options input[data-collection-id]').check();
  await page.locator('#collection-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]").some(item => item.name === "Arcade Night" && item.paths.length === 1), undefined, { timeout: 4000 });
  const storedPaths = await page.evaluate(() => JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]")[0]?.paths || []);
  await page.locator('#collections-grid .collection-browse-button').last().click();
  await page.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent === "1 game in Arcade Night", undefined, { timeout: 4000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent === "1 game in Arcade Night", undefined, { timeout: 10000 });
  const filterPersistedAfterReload = await page.locator("#clearCollectionFilter").isVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportCollectionsButton").click();
  const backupDownload = await downloadPromise;
  const backupPath = await backupDownload.path();
  const backup = backupPath ? JSON.parse(await readFile(backupPath, "utf8")) : null;
  const backupValid = /^arcade-atlas-playlists-\d{4}-\d{2}-\d{2}\.json$/.test(backupDownload.suggestedFilename()) &&
    backup?.format === "arcade-atlas-playlists" && backup.version === 1 && backup.collections?.[0]?.paths?.length === 1;
  const connectFourPath = await page.evaluate(() => cachedGames.find(game => game.title === "Connect Four").path);
  await page.locator("#collection-import-file").setInputFiles({
    name: "playlists.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      format: "arcade-atlas-playlists",
      version: 1,
      collections: [
        { name: "Arcade Night", paths: [connectFourPath, "https://example.invalid/game"] },
        { name: "Co-op Night", paths: [connectFourPath] }
      ]
    }))
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]").some(item => item.name === "Co-op Night"), undefined, { timeout: 4000 });
  const importState = await page.evaluate(() => JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]"));
  const importMergedAndSanitized = importState.length === 2 && importState[0].paths.length === 2 &&
    importState[0].paths.every(path => !/^https?:/i.test(path)) && importState[1].paths.length === 1;

  const syncPage = await collectionsContext.newPage();
  syncPage.on("pageerror", e => errors.push(String(e.message || e).slice(0, 220)));
  await syncPage.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await syncPage.waitForSelector("#collections-grid .collection-card", { timeout: 10000 });
  await syncPage.evaluate(() => {
    const overlay = document.getElementById("patchNotesOverlay");
    if (overlay) { overlay.classList.remove("visible"); overlay.setAttribute("aria-hidden", "true"); }
  });
  const secondTabCollections = await syncPage.locator("#collections-grid .collection-card").count();
  await syncPage.locator("#collections-grid .collection-card").filter({ hasText: "Arcade Night" }).locator(".collection-browse-button").last().click();
  await syncPage.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent === "2 games in Arcade Night", undefined, { timeout: 4000 });

  await page.evaluate(() => { window.__collectionOpened = ""; window.open = url => { window.__collectionOpened = url; return null; }; });
  await page.locator('#collections-grid .collection-play-button').click();
  const randomLaunch = await page.evaluate(() => window.__collectionOpened || "");
  const allowedLaunches = await page.evaluate(() => ["Slope", "Connect Four"].map(title => buildGameHref(cachedGames.find(game => game.title === title).path)));

  await page.locator('#collections-grid .collection-browse-button').last().click();
  await page.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent === "2 games in Arcade Night", undefined, { timeout: 4000 });
  const filteredTitle = await page.locator('#all-games-grid .game-card-title').textContent();
  const filteredCards = await page.locator('#all-games-grid .game-card').count();
  await page.locator('#clearCollectionFilter').click();
  await page.waitForFunction(() => document.getElementById("clearCollectionFilter")?.style.display === "none", undefined, { timeout: 4000 });

  await page.locator('#collections-grid button[aria-label="Rename Arcade Night"]').click();
  await page.locator('#collection-name-input').fill("Arcade Favorites");
  await page.locator('#collection-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]").some(item => item.name === "Arcade Favorites"), undefined, { timeout: 4000 });
  await syncPage.waitForFunction(() => document.querySelector("#collections-grid h3")?.textContent === "Arcade Favorites", undefined, { timeout: 4000 });
  await syncPage.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent === "2 games in Arcade Favorites", undefined, { timeout: 4000 });
  await page.locator('#collections-grid button[aria-label="Delete Arcade Favorites"]').click();
  const customDeleteDialog = await page.locator('#collection-dialog').evaluate(dialog => dialog.open) &&
    (await page.locator('#collection-dialog-title').textContent()) === "Delete playlist?";
  await page.locator('#collection-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]").some(item => item.name === "Arcade Favorites"), undefined, { timeout: 4000 });
  await syncPage.waitForFunction(() => document.getElementById("clearCollectionFilter")?.style.display === "none", undefined, { timeout: 4000 });
  await syncPage.waitForFunction(() => document.getElementById("catalogResultsCount")?.textContent === "100 games", undefined, { timeout: 4000 });
  const deleted = await page.locator('#collections-grid .collection-card').count() === 1 &&
    (await page.locator('#collections-grid h3').textContent()) === "Co-op Night";
  const crossTabSynced = secondTabCollections === 2;
  const tooManyCollections = Array.from({ length: 20 }, (_, index) => ({ name: "Imported " + index, paths: [connectFourPath] }));
  await page.locator("#collection-import-file").setInputFiles({
    name: "many-playlists.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "arcade-atlas-playlists", version: 1, collections: tooManyCollections }))
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]").length === 12, undefined, { timeout: 4000 });
  const importLimitRespected = await page.evaluate(() => JSON.parse(localStorage.getItem("arcadeAtlasCollectionsV1") || "[]").length === MAX_GAME_COLLECTIONS);
  const ok = response?.status() === 200 && created && storedPaths.length === 1 && backupValid && importMergedAndSanitized && allowedLaunches.includes(randomLaunch) &&
    filterPersistedAfterReload && filteredTitle === "Slope" && filteredCards === 2 && crossTabSynced && customDeleteDialog && deleted && importLimitRespected && errors.length === 0;
  uiAudit.collections = { status: response?.status() || null, created, storedPaths, filterPersistedAfterReload, backupValid, importMergedAndSanitized, randomLaunch, filteredTitle, filteredCards, crossTabSynced, customDeleteDialog, deleted, importLimitRespected, errors, ok };
  await page.evaluate(() => localStorage.removeItem("arcadeAtlasCollectionsV1"));
  await syncPage.close();
  await page.close();
  await collectionsContext.close();
} catch (e) {
  uiAudit.collections.error = String(e.message || e).slice(0, 300);
}

try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e).slice(0, 220)));
  const response = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await page.waitForSelector("#daily-pick-play", { timeout: 12000 });
  await page.waitForSelector("#daily-pick-title", { timeout: 12000 });
  const titleBefore = await page.locator("#daily-pick-title").textContent();
  const expectedHref = await page.evaluate(() => buildGameHref(getDailyPickGame(cachedGames).path));
  await page.evaluate(() => {
    window.open = url => { window.__dailyPickOpened = url; return null; };
  });
  await page.locator("#daily-pick-play").click();
  const firstState = await page.evaluate(() => ({
    state: JSON.parse(localStorage.getItem("arcadeAtlasDailyPlayStreak") || "{}"),
    opened: window.__dailyPickOpened || ""
  }));
  await page.locator("#daily-pick-play").click();
  const secondState = await page.evaluate(() => JSON.parse(localStorage.getItem("arcadeAtlasDailyPlayStreak") || "{}"));
  const today = await page.evaluate(() => getDailyDateKey());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#daily-pick-title", { timeout: 10000 });
  const titleAfterReload = await page.locator("#daily-pick-title").textContent();
  const streakLabel = await page.locator("#daily-pick-streak").textContent();
  const ok = response?.status() === 200 &&
    !!titleBefore && titleBefore === titleAfterReload &&
    firstState.state.lastDate === today &&
    Number(firstState.state.streak) === 1 &&
    Number(secondState.streak) === 1 &&
    firstState.opened === expectedHref &&
    String(streakLabel || "").includes("1 day") &&
    errors.length === 0;
  uiAudit.dailyPick = {
    status: response?.status() || null,
    title: titleBefore,
    stableAfterReload: titleBefore === titleAfterReload,
    firstState: firstState.state,
    secondLaunchDidNotInflateStreak: Number(secondState.streak) === 1,
    openedExpectedGame: firstState.opened === expectedHref,
    streakLabel,
    errors,
    ok
  };
  await page.close();
} catch (e) {
  uiAudit.dailyPick.error = String(e.message || e).slice(0, 300);
}

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e).slice(0, 220)));
  const response = await page.goto(BASE + "/g/connect-four/", { waitUntil: "domcontentloaded", timeout: 16000 });
  await page.waitForSelector("#board button", { timeout: 10000 });
  const buttonCount = await page.locator("#board button").count();
  await page.locator("#board button").first().click();
  const state = await page.evaluate(() => ({
    bottomLeftDisc: Game.board[5][0],
    nextPlayer: Game.currentPlayer,
    renderedDisc: document.querySelector("#board tr:nth-child(6) td:nth-child(1) button")?.className || ""
  }));
  const ok = response?.status() === 200 &&
    buttonCount === 42 &&
    state.bottomLeftDisc === "black" &&
    state.nextPlayer === "red" &&
    state.renderedDisc.includes("black") &&
    errors.length === 0;
  uiAudit.connectFour = { status: response?.status() || null, buttonCount, ...state, errors, ok };
  await page.close();
} catch (e) {
  uiAudit.connectFour.error = String(e.message || e).slice(0, 300);
}

// Exercise Chess beyond a simple HTTP load: start a match, make e2-e4,
// and confirm the computer responds and hands the turn back to the player.
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e).slice(0, 220)));
  const response = await page.goto(BASE + "/g/chess/", { waitUntil: "domcontentloaded", timeout: 16000 });
  const canvas = page.locator("#game canvas");
  await canvas.waitFor({ state: "visible", timeout: 12000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Chess canvas has no visible bounds");
  const scale = box.width / 1080;
  // The start overlay's Play control is centered at logical game coordinate (540, 1510).
  await page.mouse.click(box.x + 540 * scale, box.y + 1510 * scale);
  await page.waitForFunction(() => document.getElementById("status")?.textContent.includes("White to move"), undefined, { timeout: 6000 });
  // White pawn: e2 -> e4. Board origin (60, 448), square size 120.
  await page.mouse.click(box.x + 600 * scale, box.y + 1228 * scale);
  await page.mouse.click(box.x + 600 * scale, box.y + 988 * scale);
  await page.waitForFunction(() => document.getElementById("status")?.textContent.includes("White to move — You"), undefined, { timeout: 8000 });
  const status = await page.locator("#status").textContent();
  const ok = response?.status() === 200 && status?.includes("White to move — You") && errors.length === 0;
  uiAudit.chess = { status: response?.status() || null, canvasVisible: true, openingMove: "e2-e4", computerReplied: !!status?.includes("White to move — You"), errors, ok };
  await page.close();
} catch (e) {
  uiAudit.chess.error = String(e.message || e).slice(0, 300);
}

// DuckMath is backed by its own live catalog service. Verify its app list and
// test each returned game's page wrapper before adding it to Arcade Atlas.
const duckmath = { homeStatus: null, dynamicCards: 0, cachedApps: 0, checked: 0, verified: [], broken: [], excludedForAge: [], error: "" };
let additions = [];
// DuckMath catalog importing is intentionally disabled: Arcade Atlas removed all DuckMath games.


const failedTitles = new Set(results.filter(r => r.hardFailure).map(r => normalizeTitle(r.title)));
const removedBrokenGames = gamesData.games.filter(g => failedTitles.has(normalizeTitle(g.title)));
gamesData.games = gamesData.games.filter(g => !failedTitles.has(normalizeTitle(g.title)));

const importedEntries = gamesData.games.filter(g => String(g.path || "").startsWith("duckmath-site/g4m3s/"));
const nativeEntries = gamesData.games.filter(g => !String(g.path || "").startsWith("duckmath-site/g4m3s/"));
const nativeKeys = new Set(nativeEntries.map(g => normalizeTitle(g.title)));
const excludedKeys = new Set(duckmath.excludedForAge.map(normalizeTitle));
const seenTitles = new Set(nativeKeys);
const keptImported = [];
const removedUnsuitableDuckMath = [];
const removedDuplicateDuckMath = [];
for (const game of importedEntries) {
  const slug = slugFromGame(game);
  const key = normalizeTitle(slug);
  if (excludedKeys.has(key) || !suitableForMiddleSchool({ title: slug })) {
    removedUnsuitableDuckMath.push(game.title);
    continue;
  }
  if (seenTitles.has(key)) {
    removedDuplicateDuckMath.push(game.title);
    continue;
  }
  game.title = formatGameTitle(slug);
  seenTitles.add(key);
  keptImported.push(game);
}
gamesData.games = [...nativeEntries, ...keptImported];
const existing = new Set(gamesData.games.map(g => normalizeTitle(g.title)));
const uniqueAdditions = additions.filter((game, index, array) => {
  const key = normalizeTitle(slugFromGame(game));
  if (existing.has(key)) return false;
  existing.add(key);
  return array.findIndex(item => normalizeTitle(slugFromGame(item)) === key) === index;
});
if (uniqueAdditions.length) gamesData.games.push(...uniqueAdditions);
if (removedBrokenGames.length || removedUnsuitableDuckMath.length || removedDuplicateDuckMath.length || uniqueAdditions.length) {
  await writeFile("games.json", JSON.stringify(gamesData, null, 2) + "\n");
}
const report = {
  generatedAt: new Date().toISOString(),
  catalogCount: catalog.length,
  catalogPassed: results.filter(r => !r.hardFailure).length,
  catalogFailed: results.filter(r => r.hardFailure),
  catalogWarnings: results.filter(r => r.pageErrors.length || r.externalFailures.length || r.localFailures.length),
  removedBrokenGames: removedBrokenGames.map(g => g.title),
  removedUnsuitableDuckMath,
  removedDuplicateDuckMath,
  logoAudit,
  brokenLogos: logoAudit.filter(x => !x.ok),
  duckmath,
  uiAudit,
  duckmathAddedToArcadeAtlas: uniqueAdditions.map(g => g.title)
};
await writeFile("arcade-atlas-game-audit.json", JSON.stringify(report, null, 2) + "\n");
if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    "# Arcade Atlas browser audit",
    "",
    `- Arcade Atlas entries tested: ${report.catalogCount}`,
    `- Arcade Atlas pages passing hard checks: ${report.catalogPassed}`,
    `- Arcade Atlas hard failures: ${report.catalogFailed.length}`,
    `- Broken Arcade Atlas games removed: ${removedBrokenGames.length}`,
    `- Unsuitable DuckMath catalog entries removed: ${removedUnsuitableDuckMath.length}`,
    `- Duplicate DuckMath catalog entries removed: ${removedDuplicateDuckMath.length}`,
    `- Catalog logos checked: ${logoAudit.length}`,
    `- Broken catalog logos: ${report.brokenLogos.length}`,
    `- DuckMath dynamic games found: ${duckmath.cachedApps}`,
    `- DuckMath game pages tested: ${duckmath.checked}`,
    `- DuckMath game pages verified: ${duckmath.verified.length}`,
    `- DuckMath game pages not verified: ${duckmath.broken.length}`,
    `- DuckMath titles excluded for middle-school suitability: ${duckmath.excludedForAge.length}`,
    `- New DuckMath games added to Arcade Atlas: ${uniqueAdditions.length}`,
    `- Leaderboard logo map loaded: ${uiAudit.leaderboard.logoCount || 0}`,
    `- Daily Pick streak icon loaded: ${uiAudit.leaderboard.dailyStreakLogo === "../images/daily-pick-streak.svg" && uiAudit.leaderboard.dailyStreakIconStatus === 200}`,
    `- Blocky Combat timer detected: ${!!uiAudit.blockyCombat.timer}`,
    `- Chess vs Computer opening-move and AI-reply test passed: ${!!uiAudit.chess.ok}`,
    `- Catalog filters, favorites, share links, Daily Pick leaderboard navigation, and cross-tab preference tests passed: ${!!uiAudit.catalog.ok}`,
    `- Quick category filter UI smoke test passed: ${!!uiAudit.catalog.quickFiltersOk}`,
    `- Custom playlist create, backup, restore, filter persistence, random play, cross-tab sync, rename, delete, and import-limit tests passed: ${!!uiAudit.collections.ok}`,
    `- Daily Pick rotation and streak test passed: ${!!uiAudit.dailyPick.ok}`,
    `- Connect Four two-player board smoke test passed: ${!!uiAudit.connectFour.ok}`,
    "",
    "## Removed broken Arcade Atlas games",
    ...report.removedBrokenGames.map(title => `- ${title}`),
    "",
    "## Broken catalog logos",
    ...report.brokenLogos.map(x => `- ${x.title}: ${x.reason || (x.width + "x" + x.height)} (${x.url})`),
    "",
    "## Arcade Atlas hard failures",
    ...report.catalogFailed.map(x => `- ${x.title}: HTTP ${x.status || "no response"}; ${x.navigationError || x.localFailures.map(y => y.url).join(", ")}`),
    "",
    "## DuckMath games not verified",
    ...duckmath.broken.slice(0, 80).map(x => `- ${x.title}: ${x.error}`),
    ""
  ].join("\n");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}
await browser.close();
console.log(JSON.stringify({
  catalogCount: report.catalogCount,
  catalogPassed: report.catalogPassed,
  catalogFailed: report.catalogFailed.length,
  removedBrokenGames: report.removedBrokenGames.length,
  duckmathFound: duckmath.cachedApps,
  duckmathVerified: duckmath.verified.length,
  duckmathBroken: duckmath.broken.length,
  added: uniqueAdditions.length,
  duckmathError: duckmath.error,
  catalogUiOk: !!uiAudit.catalog.ok,
  collectionsUiOk: !!uiAudit.collections.ok,
  dailyPickOk: !!uiAudit.dailyPick.ok,
  connectFourOk: !!uiAudit.connectFour.ok
}, null, 2));
const failedUiChecks = [
  ["leaderboard", uiAudit.leaderboard.status === 200 && uiAudit.leaderboard.dailyStreakLogo === "../images/daily-pick-streak.svg" && uiAudit.leaderboard.dailyStreakIconStatus === 200],
  ["catalog and cross-tab preferences", !!uiAudit.catalog.ok],
  ["playlists", !!uiAudit.collections.ok],
  ["Daily Pick", !!uiAudit.dailyPick.ok],
  ["Connect Four", !!uiAudit.connectFour.ok]
].filter(([, passed]) => !passed).map(([name]) => name);
if (failedUiChecks.length) {
  console.error("Arcade Atlas UI audit failed:", failedUiChecks.join(", "));
  process.exitCode = 1;
}
