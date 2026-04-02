const birdImg = new Image();
birdImg.src = "bird.png";
const slingshotImg = new Image();
slingshotImg.src = "slingshot.jpg";

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const tlabel = document.getElementById("tlabel");
const SS_W = 52,
  SS_H = 60;
const FORK_Y_FRAC = 0.18;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const wrap = canvas.parentElement;
  canvas.width = wrap.clientWidth * dpr;
  canvas.height = wrap.clientHeight * dpr;
  canvas.style.width = wrap.clientWidth + "px";
  canvas.style.height = wrap.clientHeight + "px";
}
window.addEventListener("resize", () => {
  resize();
  if (!animRunning) drawIdle();
});
setTimeout(() => {
  resize();
  drawIdle();
}, 20);

function bind(sid, nid) {
  const s = document.getElementById(sid),
    n = document.getElementById(nid);
  s.addEventListener("input", () => {
    n.value = s.value;
  });
  n.addEventListener("change", () => {
    let v = Math.max(
      parseFloat(n.min),
      Math.min(parseFloat(n.max), parseFloat(n.value))
    );
    n.value = v;
    s.value = v;
  });
}
bind("vel-s", "vel-n");
bind("angle-s", "angle-n");
bind("h0-s", "h0-n");
bind("g-s", "g-n");

function getParams() {
  return {
    vel: parseFloat(document.getElementById("vel-n").value),
    angle: parseFloat(document.getElementById("angle-n").value),
    h0: parseFloat(document.getElementById("h0-n").value),
    g: parseFloat(document.getElementById("g-n").value),
  };
}

function simulate(vel, angleDeg, h0, g) {
  const rad = (angleDeg * Math.PI) / 180;
  let vx = vel * Math.cos(rad),
    vy = vel * Math.sin(rad);
  const dt = 0.001;
  const pts = [];
  let x = 0,
    y = h0,
    maxH = h0;
  for (let i = 0; i < 500000; i++) {
    pts.push({ x, y });
    vy -= g * dt;
    x += vx * dt;
    y += vy * dt;
    if (y > maxH) maxH = y;
    if (y <= 0) {
      const py = pts[pts.length - 1].y,
        frac = py / (py - y);
      pts.push({ x: pts[pts.length - 1].x + vx * dt * frac, y: 0 });
      return {
        pts,
        maxH,
        time: pts.length * dt,
        impactV: Math.sqrt(vx * vx + vy * vy),
      };
    }
  }
  return { pts, maxH, time: pts.length * dt, impactV: 0 };
}

function makeT(pts, h0) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width,
    H = canvas.height;
  const pad = { l: 72 * dpr, r: 44 * dpr, t: 40 * dpr, b: 64 * dpr };
  const maxX = Math.max(...pts.map((p) => p.x), 1);
  const maxY = Math.max(...pts.map((p) => p.y), h0 + 1, 1);
  const s = Math.min(
    (W - pad.l - pad.r) / (maxX * 1.12),
    (H - pad.t - pad.b) / (maxY * 1.2)
  );
  return {
    toS: (wx, wy) => ({ x: pad.l + wx * s, y: H - pad.b - wy * s }),
    s,
    pad,
    W,
    H,
    maxX,
    maxY,
    dpr,
  };
}

function drawGrid(t) {
  const { toS, W, H, pad, maxX, maxY, dpr } = t;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = dpr * 0.8;
  ctx.setLineDash([4 * dpr, 6 * dpr]);
  for (let i = 1; i <= 5; i++) {
    const { x } = toS((maxX * 1.05 * i) / 5, 0);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, H - pad.b);
    ctx.stroke();
  }
  for (let i = 1; i <= 4; i++) {
    const { y } = toS(0, (maxY * 1.1 * i) / 4);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  const o = toS(0, 0);
  ctx.beginPath();
  ctx.moveTo(pad.l, o.y);
  ctx.lineTo(W - pad.r, o.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(o.x, pad.t);
  ctx.lineTo(o.x, H - pad.b);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = `${10 * dpr}px 'DM Mono',monospace`;
  ctx.textAlign = "center";
  for (let i = 1; i <= 5; i++) {
    const wx = (maxX * 1.05 * i) / 5;
    const { x } = toS(wx, 0);
    ctx.fillText(wx.toFixed(0) + "m", x, H - pad.b + 16 * dpr);
  }
  ctx.textAlign = "right";
  for (let i = 1; i <= 4; i++) {
    const wy = (maxY * 1.1 * i) / 4;
    const { y } = toS(0, wy);
    ctx.fillText(wy.toFixed(0) + "m", pad.l - 8 * dpr, y + 4 * dpr);
  }
  const { y: gy } = toS(0, 0);
  ctx.fillStyle = "rgba(58,196,160,0.05)";
  ctx.fillRect(pad.l, gy, W - pad.l - pad.r, H - gy);
  ctx.strokeStyle = "rgba(58,196,160,0.3)";
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.moveTo(pad.l, gy);
  ctx.lineTo(W - pad.r, gy);
  ctx.stroke();
  ctx.restore();
}

function drawSlingshot(t, h0) {
  const { toS, dpr } = t;
  const { x: ox, y: oy } = toS(0, h0);
  const w = SS_W * dpr,
    h = SS_H * dpr;
  ctx.drawImage(slingshotImg, ox - w * 0.5, oy - h, w, h);
}

function drawBird(t, wx, wy, atSlingshot, h0) {
  const { toS, dpr } = t;
  if (atSlingshot) {
    const { x: ox, y: oy } = toS(0, h0);
    const h = SS_H * dpr;
    const imgTop = oy - h;
    const forkY = imgTop + FORK_Y_FRAC * h;
    const sz = 26 * dpr;
    ctx.drawImage(birdImg, ox - sz * 0.5, forkY - sz * 0.5, sz, sz);
  } else {
    const { x, y } = toS(wx, wy);
    const sz = 26 * dpr;
    ctx.drawImage(birdImg, x - sz * 0.5, y - sz * 0.5, sz, sz);
  }
}

function drawIdle() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dummy = [
    { x: 0, y: 0 },
    { x: 80, y: 40 },
    { x: 160, y: 0 },
  ];
  const t = makeT(dummy, 0);
  drawGrid(t);
  drawSlingshot(t, 0);
  drawBird(t, 0, 0, true, 0);
}

let animRunning = false,
  animId = null;

document.getElementById("launch-btn").addEventListener("click", () => {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
  const p = getParams();
  const sim = simulate(p.vel, p.angle, p.h0, p.g);
  const t = makeT(sim.pts, p.h0);
  const land = sim.pts[sim.pts.length - 1];
  document.getElementById("s-range").textContent = land.x.toFixed(2) + " m";
  document.getElementById("s-height").textContent = sim.maxH.toFixed(2) + " m";
  document.getElementById("s-time").textContent = sim.time.toFixed(2) + " s";
  document.getElementById("s-impact").textContent =
    sim.impactV.toFixed(2) + " m/s";
  const total = sim.pts.length;
  const step = Math.max(1, Math.floor(total / 200));
  let idx = 0;
  animRunning = true;

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(t);
    ctx.save();
    ctx.strokeStyle = "rgba(232,162,58,0.8)";
    ctx.lineWidth = 2.2 * t.dpr;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= idx && i < total; i++) {
      const { x, y } = t.toS(sim.pts[i].x, sim.pts[i].y);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    drawSlingshot(t, p.h0);
    const done = idx >= total - 1;
    if (!done) {
      const cur = sim.pts[idx];
      drawBird(t, cur.x, cur.y, false, p.h0);
      tlabel.textContent = `t = ${(idx * 0.001).toFixed(2)} s`;
      idx += step;
      animId = requestAnimationFrame(frame);
    } else {
      const { x: lx, y: ly } = t.toS(land.x, 0);
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, 5 * t.dpr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(58,196,160,0.85)";
      ctx.fill();
      ctx.restore();
      tlabel.textContent = `Landed at ${land.x.toFixed(2)} m`;
      animRunning = false;
      animId = null;
    }
  }
  animId = requestAnimationFrame(frame);
});

document.getElementById("reset-btn").addEventListener("click", () => {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
  animRunning = false;
  ["s-range", "s-height", "s-time", "s-impact"].forEach(
    (id) => (document.getElementById(id).textContent = "—")
  );
  tlabel.textContent = "";
  drawIdle();
});
