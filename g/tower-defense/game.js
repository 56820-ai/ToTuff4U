(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const moneyEl = document.getElementById('money');
  const livesEl = document.getElementById('lives');
  const waveEl = document.getElementById('wave');
  const messageEl = document.getElementById('message');
  const startEl = document.getElementById('start');
  const restartEl = document.getElementById('restart');

  const W = canvas.width, H = canvas.height, N = 13, T = W / N;
  const COST = 30;

  // Path as grid cells from entry to base.
  const PATH = [
    [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],
    [4,5],[3,5],[2,5],[1,5],[1,6],[1,7],[1,8],[1,9],[1,10],[1,11],
    [2,11],[3,11],[4,11],[5,11],[6,11],[7,11],[8,11],[9,11],[10,11],[11,11]
  ];

  let grid, towers, enemies, bullets, money, lives, wave, running, pathPts, spawnQ, spawnTimer, over;

  function pathPoints() {
    return PATH.map(([c, r]) => ({ x: c * T + T / 2, y: r * T + T / 2 }));
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function newGame() {
    grid = Array.from({ length: N }, () => new Array(N).fill(0));
    for (const [c, r] of PATH) grid[r][c] = -1; // path
    towers = []; enemies = []; bullets = [];
    money = 100; lives = 20; wave = 0; running = false; over = false; spawnQ = 0; spawnTimer = 0;
    pathPts = pathPoints();
    moneyEl.textContent = '100'; livesEl.textContent = '20'; waveEl.textContent = '0';
    messageEl.textContent = 'Click an empty tile to build a tower (30). Then Start Wave.';
    draw();
  }

  function inPath(c, r) { return grid[r][c] === -1; }

  function buildTower(c, r) {
    if (!inB(c, r) || grid[r][c] !== 0) return false;
    if (money < COST) { messageEl.textContent = 'Not enough money!'; return false; }
    money -= COST; grid[r][c] = 1;
    towers.push({ x: c * T + T / 2, y: r * T + T / 2, range: T * 2.4, cd: 0, rate: 28, dmg: 10 });
    moneyEl.textContent = String(money);
    return true;
  }

  function inB(c, r) { return c >= 0 && c < N && r >= 0 && r < N; }

  function startWave() {
    if (over || running) return;
    wave++; waveEl.textContent = String(wave);
    spawnQ = 6 + wave * 2; running = true; messageEl.textContent = `Wave ${wave} incoming!`;
  }

  function spawnEnemy() {
    const hp = 20 + wave * 8;
    enemies.push({ seg: 0, t: 0, x: pathPts[0].x, y: pathPts[0].y, hp, max: hp, speed: 1.1 + wave * 0.05, r: 11 });
  }

  function update() {
    if (spawnQ > 0) { spawnTimer++; if (spawnTimer > 35) { spawnTimer = 0; spawnQ--; spawnEnemy(); } }

    for (const e of enemies) {
      e.seg += (e.speed / T) * 0.5;
      let s = Math.floor(e.seg);
      if (s >= pathPts.length - 1) {
        lives--; livesEl.textContent = String(lives);
        if (lives <= 0) { over = true; running = false; messageEl.textContent = 'Base destroyed!'; }
        e.dead = true; continue;
      }
      const a = pathPts[s], b = pathPts[s + 1];
      const f = e.seg - s;
      e.x = a.x + (b.x - a.x) * f;
      e.y = a.y + (b.y - a.y) * f;
    }

    for (const tw of towers) {
      tw.cd--;
      if (tw.cd <= 0) {
        let target = null, bestD = tw.range;
        for (const e of enemies) { const d = dist(tw, e); if (d < bestD) { bestD = d; target = e; } }
        if (target) { bullets.push({ x: tw.x, y: tw.y, tx: target, dmg: tw.dmg, speed: 6 }); tw.cd = tw.rate; }
      }
    }

    for (const b of bullets) {
      if (!b.tx || b.tx.dead) { b.done = true; continue; }
      const dx = b.tx.x - b.x, dy = b.tx.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) { b.tx.hp -= b.dmg; b.done = true; if (b.tx.hp <= 0 && !b.tx.dead) { b.tx.dead = true; money += 8; moneyEl.textContent = String(money); } }
      else { b.x += dx / d * b.speed; b.y += dy / d * b.speed; }
    }

    enemies = enemies.filter(e => !e.dead);
    bullets = bullets.filter(b => !b.done);

    if (running && spawnQ === 0 && enemies.length === 0 && !over) { running = false; messageEl.textContent = `Wave ${wave} cleared! Build and Start next.`; }
  }

  function loop() {
    if (running && !over) { update(); draw(); }
    else draw();
    requestAnimationFrame(loop);
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#13243a'); g.addColorStop(1, '#0d1530');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = c * T, y = r * T;
      if (grid[r][c] === -1) { ctx.fillStyle = '#3a2e1a'; ctx.fillRect(x, y, T, T); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x + 1, y + 1, T - 2, T - 2); }
    }
    // base
    const base = pathPts[pathPts.length - 1];
    ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = '#80ed99'; ctx.fillStyle = '#80ed99';
    ctx.beginPath(); ctx.arc(base.x, base.y, T * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    for (const tw of towers) {
      ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#4cc9f0'; ctx.fillStyle = '#4cc9f0';
      ctx.beginPath(); ctx.arc(tw.x, tw.y, T * 0.34, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#0d1530'; ctx.beginPath(); ctx.arc(tw.x, tw.y, T * 0.16, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of enemies) {
      ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = '#ff5e7e'; ctx.fillStyle = '#ff5e7e';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#0d1530'; ctx.fillRect(e.x - e.r, e.y - e.r - 5, e.r * 2, 3);
      ctx.fillStyle = '#80ed99'; ctx.fillRect(e.x - e.r, e.y - e.r - 5, e.r * 2 * (e.hp / e.max), 3);
    }
    for (const b of bullets) { ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
  }

  canvas.addEventListener('click', e => {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) * (W / rect.width) / T);
    const r = Math.floor((e.clientY - rect.top) * (H / rect.height) / T);
    if (inB(c, r)) buildTower(c, r);
  });

  startEl.addEventListener('click', startWave);
  restartEl.addEventListener('click', newGame);
  newGame();
  requestAnimationFrame(loop);
})();
