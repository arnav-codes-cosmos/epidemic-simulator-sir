// Agent-based SIR simulation with a mean-field SIR ODE overlay.
const TPD = 10;            // ticks per simulated day
const R_CONTACT = 10;      // contact radius (px)
const SPEED = 2;           // px per tick
const W = 640, H = 420;
const $ = id => document.getElementById(id);
const world = $('world').getContext('2d'), graph = $('graph').getContext('2d');
const COL = {S:'#4c9be8', I:'#ef5b4c', R:'#5fc48a'};

let dots, hist, ode, tick, paused = false, cEMA, peak, ended;
const params = {};

function readParams() {
  params.p = $('p').value / 100;          // infection chance per contact-tick
  params.T = +$('t').value;               // recovery time, days
  params.d = $('d').value / 100;          // fraction of dots standing still
  $('o-p').textContent = $('p').value + '%';
  $('o-t').textContent = params.T + ' days';
  $('o-d').textContent = $('d').value + '%';
  $('o-n').textContent = $('n').value;
  params.gamma = 1 / (params.T * TPD);    // per-tick recovery rate
}

function reset() {
  readParams();
  const N = +$('n').value;
  dots = Array.from({length: N}, () => {
    const a = Math.random() * 6.283;
    return {x: Math.random()*W, y: Math.random()*H, vx: Math.cos(a)*SPEED, vy: Math.sin(a)*SPEED,
            st: 'S', rank: Math.random()};  // rank decides who is distancing
  });
  const i0 = Math.max(3, Math.round(N * 0.01));
  for (let k = 0; k < i0; k++) dots[k].st = 'I';
  hist = []; tick = 0; cEMA = null; peak = 0; ended = false;
  ode = {S: 1 - i0/N, I: i0/N, R: 0};
  $('pause').textContent = 'Pause'; paused = false;
}

function step() {
  const N = dots.length, r2 = R_CONTACT*R_CONTACT;
  for (const d of dots) {
    if (d.rank < params.d) continue;      // distancing: stay put
    d.x += d.vx; d.y += d.vy;
    if (d.x < 0 || d.x > W) { d.vx *= -1; d.x = Math.min(W, Math.max(0, d.x)); }
    if (d.y < 0 || d.y > H) { d.vy *= -1; d.y = Math.min(H, Math.max(0, d.y)); }
    if (Math.random() < 0.02) { const a = Math.random()*6.283; d.vx = Math.cos(a)*SPEED; d.vy = Math.sin(a)*SPEED; }
  }
  // spatial hash so contact checks stay fast
  const cols = Math.ceil(W / R_CONTACT) + 1, grid = new Map();
  dots.forEach((d, k) => {
    const key = (d.y / R_CONTACT | 0) * cols + (d.x / R_CONTACT | 0);
    (grid.get(key) || grid.set(key, []).get(key)).push(k);
  });
  let pairs = 0; const newly = new Set();
  dots.forEach((a, ia) => {
    const cx = a.x / R_CONTACT | 0, cy = a.y / R_CONTACT | 0;
    for (let gy = cy-1; gy <= cy+1; gy++) for (let gx = cx-1; gx <= cx+1; gx++) {
      const cell = grid.get(gy*cols + gx); if (!cell) continue;
      for (const ib of cell) {
        if (ib <= ia) continue;
        const b = dots[ib], dx = a.x-b.x, dy = a.y-b.y;
        if (dx*dx + dy*dy > r2) continue;
        pairs++;
        if (a.st === 'I' && b.st === 'S' && Math.random() < params.p) newly.add(ib);
        else if (b.st === 'I' && a.st === 'S' && Math.random() < params.p) newly.add(ia);
      }
    }
  });
  newly.forEach(k => dots[k].st = 'I');
  const pRec = 1 - Math.exp(-params.gamma);   // exponential recovery, matches the ODE
  for (const d of dots) if (d.st === 'I' && !newly.has(dots.indexOf(d)) && Math.random() < pRec) d.st = 'R';

  // measured contact rate per person per tick -> effective beta for the equations
  const c = 2 * pairs / N;
  cEMA = cEMA === null ? c : cEMA * 0.99 + c * 0.01;
  const beta = params.p * cEMA;
  const dS = -beta * ode.S * ode.I, dR = params.gamma * ode.I;
  ode.S += dS; ode.R += dR; ode.I -= dS + dR;
  tick++;
  const n = {S:0, I:0, R:0}; dots.forEach(d => n[d.st]++);
  hist.push({S: n.S/N, I: n.I/N, R: n.R/N, oS: ode.S, oI: ode.I, oR: ode.R});
  peak = Math.max(peak, n.I / N);
  if (n.I === 0 && !ended) { ended = true; }
  return {n, N, beta};
}

function finalSize(R0) {                      // solve x = 1 - exp(-R0 x)
  if (R0 <= 1) return 0;
  let x = 0.5; for (let k = 0; k < 100; k++) x = 1 - Math.exp(-R0 * x);
  return x;
}

function drawWorld() {
  world.clearRect(0, 0, W, H);
  for (const st of ['S','R','I']) {
    world.fillStyle = COL[st]; world.beginPath();
    for (const d of dots) if (d.st === st) { world.moveTo(d.x+3, d.y); world.arc(d.x, d.y, 3, 0, 6.283); }
    world.fill();
  }
}

function drawGraph() {
  const gw = 640, gh = 260, pad = 28, xMax = Math.max(600, tick);
  graph.clearRect(0, 0, gw, gh);
  graph.strokeStyle = '#2a3544'; graph.fillStyle = '#8b98a8'; graph.font = '11px sans-serif'; graph.lineWidth = 1;
  for (let f = 0; f <= 1; f += 0.25) {
    const y = gh - pad - f * (gh - 2*pad);
    graph.beginPath(); graph.moveTo(pad, y); graph.lineTo(gw - 8, y); graph.stroke();
    graph.fillText(Math.round(f*100) + '%', 2, y + 4);
  }
  graph.fillText('day ' + Math.round(xMax / TPD), gw - 50, gh - 8);
  const X = t => pad + t / xMax * (gw - pad - 8), Y = v => gh - pad - v * (gh - 2*pad);
  const line = (key, color, dashed, width) => {
    graph.strokeStyle = color; graph.lineWidth = width; graph.setLineDash(dashed ? [5, 4] : []);
    graph.beginPath();
    hist.forEach((h, t) => t ? graph.lineTo(X(t), Y(h[key])) : graph.moveTo(X(t), Y(h[key])));
    graph.stroke();
  };
  ['S','I','R'].forEach(k => { line('o'+k, COL[k], true, 1.5); line(k, COL[k], false, 2); });
  graph.setLineDash([]);
}

function updateStats(s) {
  $('c-s').textContent = s.n.S; $('c-i').textContent = s.n.I; $('c-r').textContent = s.n.R;
  $('c-day').textContent = (tick / TPD).toFixed(0);
  const R0 = s.beta / params.gamma;
  $('c-r0').textContent = R0.toFixed(2);
  $('c-peak').textContent = (peak * 100).toFixed(0) + '%';
  $('c-fo').textContent = (finalSize(R0) * 100).toFixed(0) + '%';
  $('c-fs').textContent = ((s.N - s.n.S) / s.N * 100).toFixed(0) + '%';
}

function frame() {
  if (!paused && !ended) { var s = step(); updateStats(s); }
  drawWorld(); drawGraph();
  requestAnimationFrame(frame);
}

['p','t','d'].forEach(id => $(id).addEventListener('input', readParams));  // live changes
$('n').addEventListener('input', reset);
$('reset').onclick = reset;
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; };
reset(); frame();
