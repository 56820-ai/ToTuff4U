import { chromium } from "playwright";
import { readFile, writeFile, appendFile } from "node:fs/promises";

const BASE = "http://127.0.0.1:4173";
const gamesData = JSON.parse(await readFile("games.json", "utf8"));
const catalog = Array.isArray(gamesData.games) ? gamesData.games : [];
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--enable-unsafe-swiftshader"]
});
const results = [];
const ignoreUrl = /googletagmanager|google-analytics|doubleclick|pagead|adsbygoogle|hotjar|posthog/i;

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
  } catch (e) {
    navigationError = String(e.message || e).slice(0, 260);
  }
  const status = response ? response.status() : null;
  const title = await page.title().catch(() => "");
  const body = await page.locator("body").innerText({ timeout: 1500 }).catch(() => "");
  const frames = await page.locator("iframe").evaluateAll(els => els.map(f => f.getAttribute("src") || f.src).filter(Boolean)).catch(() => []);
  const canvases = await page.locator("canvas").count().catch(() => 0);
  const mainFrameUrl = page.url();
  const missingPage = /(^|\n)\s*(404|page not found|file not found)\s*(\n|$)/i.test(body.slice(0, 900));
  const hardFailure = !response || status >= 400 || missingPage || localFailures.length > 0 || !!navigationError;
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
    externalFailures: externalFailures.slice(0, 8),
    pageErrors: pageErrors.slice(0, 8),
    iframeSources: frames.slice(0, 5),
    canvasCount: canvases
  };
}

const workers = 4;
let cursor = 0;
await Promise.all(Array.from({ length: workers }, async () => {
  while (cursor < catalog.length) {
    const i = cursor++;
    results[i] = await checkGame(catalog[i]);
  }
}));

// DuckMath is backed by its own live catalog service. Verify its app list and
// test each returned game's page wrapper before adding it to Arcade Atlas.
const duckmath = { homeStatus: null, dynamicCards: 0, cachedApps: 0, checked: 0, verified: [], broken: [], error: "" };
let additions = [];
try {
  const home = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  home.on("dialog", d => d.accept().catch(() => {}));
  const r = await home.goto(BASE + "/duckmath-site/", { waitUntil: "domcontentloaded", timeout: 20000 });
  duckmath.homeStatus = r ? r.status() : null;
  await home.waitForFunction(() => {
    try { return JSON.parse(localStorage.getItem("apps11") || "[]").length > 0; }
    catch { return false; }
  }, undefined, { timeout: 18000 }).catch(() => {});
  const state = await home.evaluate(() => ({
    cards: document.querySelectorAll("#icon_image a").length,
    apps: JSON.parse(localStorage.getItem("apps11") || "[]")
  })).catch(() => ({ cards: 0, apps: [] }));
  duckmath.dynamicCards = state.cards;
  duckmath.cachedApps = state.apps.length;
  await home.close();

  const apps = state.apps.filter(a => a && typeof a.title === "string" && a.title.trim()).slice(0, 500);
  duckmath.checked = apps.length;
  let appCursor = 0;
  const appResults = new Array(apps.length);
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (appCursor < apps.length) {
      const i = appCursor++;
      const app = apps[i];
      const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
      const failures = [];
      page.on("dialog", d => d.accept().catch(() => {}));
      page.on("response", resp => {
        if (resp.status() >= 400 && !ignoreUrl.test(resp.url())) failures.push({ status: resp.status(), url: resp.url().slice(0, 250) });
      });
      let loaded = false;
      let iframeSrc = "";
      let error = "";
      try {
        const target = BASE + "/duckmath-site/g4m3s/?title=" + encodeURIComponent(app.title);
        const res = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 12000 });
        if (!res || res.status() >= 400) error = "game page HTTP " + (res ? res.status() : "no response");
        await page.waitForFunction(() => {
          const f = document.getElementById("gameFrame");
          return !!f && !!f.getAttribute("src") && f.getAttribute("src") !== "about:blank";
        }, undefined, { timeout: 7000 }).catch(() => {});
        iframeSrc = await page.locator("#gameFrame").getAttribute("src").catch(() => "") || "";
        await page.waitForTimeout(500);
        const childFrames = page.frames().filter(f => f !== page.mainFrame()).map(f => f.url());
        loaded = !!iframeSrc && childFrames.some(u => u && u !== "about:blank" && !u.startsWith("chrome-error:"));
        if (!loaded && !error) error = "game iframe did not navigate";
        if (failures.some(f => f.status >= 400 && (f.url === iframeSrc || f.url.includes(new URL(iframeSrc, BASE).host)))) {
          loaded = false;
          error = "game iframe returned an HTTP error";
        }
      } catch (e) {
        error = String(e.message || e).slice(0, 220);
      }
      appResults[i] = { app, loaded, iframeSrc, error, failures: failures.slice(0, 5) };
      await page.close().catch(() => {});
    }
  }));
  for (const result of appResults) {
    if (result?.loaded) {
      duckmath.verified.push(result.app.title);
      const titleKey = result.app.title.trim().toLowerCase();
      if (!catalog.some(g => String(g.title || "").trim().toLowerCase() === titleKey)) {
        const icon = normalizeIcon(result.app.icon);
        if (icon) additions.push({
          title: result.app.title.trim(),
          path: "duckmath-site/g4m3s/?title=" + encodeURIComponent(result.app.title.trim()),
          image: icon,
          category: categoryFor(result.app.categories)
        });
      }
    } else if (result) {
      duckmath.broken.push({ title: result.app.title, error: result.error, iframeSrc: result.iframeSrc, failures: result.failures });
    }
  }
} catch (e) {
  duckmath.error = String(e.message || e).slice(0, 500);
}

const existing = new Set(catalog.map(g => String(g.title || "").trim().toLowerCase()));
const uniqueAdditions = additions.filter((g, i, arr) => {
  const key = g.title.toLowerCase();
  if (existing.has(key)) return false;
  existing.add(key);
  return arr.findIndex(x => x.title.toLowerCase() === key) === i;
});
if (uniqueAdditions.length) {
  gamesData.games.push(...uniqueAdditions);
  await writeFile("games.json", JSON.stringify(gamesData, null, 2) + "\n");
}

const report = {
  generatedAt: new Date().toISOString(),
  catalogCount: catalog.length,
  catalogPassed: results.filter(r => !r.hardFailure).length,
  catalogFailed: results.filter(r => r.hardFailure),
  catalogWarnings: results.filter(r => r.pageErrors.length || r.externalFailures.length),
  duckmath,
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
    `- DuckMath dynamic games found: ${duckmath.cachedApps}`,
    `- DuckMath game pages tested: ${duckmath.checked}`,
    `- DuckMath game pages verified: ${duckmath.verified.length}`,
    `- DuckMath game pages not verified: ${duckmath.broken.length}`,
    `- New DuckMath games added to Arcade Atlas: ${uniqueAdditions.length}`,
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
  duckmathFound: duckmath.cachedApps,
  duckmathVerified: duckmath.verified.length,
  duckmathBroken: duckmath.broken.length,
  added: uniqueAdditions.length,
  duckmathError: duckmath.error
}, null, 2));
