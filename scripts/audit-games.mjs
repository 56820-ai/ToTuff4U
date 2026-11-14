import { chromium } from "playwright";
import { readFile, writeFile, appendFile } from "node:fs/promises";

const BASE = "http://127.0.0.1:4173/ToTuff4U";
const gamesData = JSON.parse(await readFile("games.json", "utf8"));
const catalog = Array.isArray(gamesData.games) ? gamesData.games : [];
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--enable-unsafe-swiftshader"]
});
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
const uiAudit = { leaderboard: {}, blockyCombat: {} };
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
  uiAudit.leaderboard = { status: response?.status() || null, ...state, errors };
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
    `- Blocky Combat timer detected: ${!!uiAudit.blockyCombat.timer}`,
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
  duckmathError: duckmath.error
}, null, 2));
