const SIZE = 120;
const HALF = SIZE / 2;
const Z_FAR = -240;
const Z_NEAR = -120;

const rots = [
  { ry: 0, rx: 0 },
  { ry: 90, rx: 0 },
  { ry: 180, rx: 0 },
  { ry: 270, rx: 0 },
  { ry: 0, rx: 90 },
  { ry: 0, rx: -90 },
];

const tray = document.getElementById("tray");
const totalEl = document.getElementById("total");
const turnEl = document.getElementById("turn");
const selectedEl = document.getElementById("selected");
const roundEl = document.getElementById("round");
const targetEl = document.getElementById("target");
const msgEl = document.getElementById("msg");
const rollBtn = document.getElementById("roll");
const bankBtn = document.getElementById("bank");
const newBtn = document.getElementById("new");
const statsBtn = document.getElementById("statsBtn");
const statsPanel = document.getElementById("statsPanel");
const clockEl = document.getElementById("clock");
const hotBanner = document.getElementById("hotBanner");
const hotFlash = document.getElementById("hotFlash");
const nerveEl = document.getElementById("nerve");
const orderBtn = document.getElementById("order");
const pauseBtn = document.getElementById("pause");
const abandonBtn = document.getElementById("abandon");
const confirmEl = document.getElementById("confirm");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");
const menuBtn = document.getElementById("menuBtn");
const menuDrop = document.getElementById("menuDrop");

const template = tray.querySelector(".die");
for (let i = 1; i < 6; i++) tray.append(template.cloneNode(true));
const dieEls = [...tray.querySelectorAll(".die")];

gsap.set(".face", {
  position: "absolute",
  userSelect: "none",
  width: "100%",
  height: "100%",
  rotateY: (i) => rots[i % 6].ry,
  rotateX: (i) => rots[i % 6].rx,
  transformOrigin: `50% 50% -${HALF}px`,
  z: HALF,
  backgroundImage: "url(dieSprite.svg)",
  backgroundPosition: (i) => `0px -${(i % 6) * SIZE}px`,
  backgroundSize: `${SIZE}px ${SIZE * 6}px`,
  backgroundRepeat: "no-repeat",
});

gsap.set(".die", { width: SIZE, height: SIZE, perspective: 400 });
gsap.set(".cube", {
  position: "absolute",
  width: SIZE,
  height: SIZE,
  transformStyle: "preserve-3d",
  z: Z_FAR,
});

dieEls.forEach((el, i) => {
  el.setAttribute("aria-label", `Die ${i + 1}`);
  el.addEventListener("click", () => selectDie(i));
  el.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      selectDie(i);
    }
  });
});

let hotTimer = 0;
let busy = false;
let clockBase = 0;
let clockAt = 0;
let clockRunning = false;
let primed = false;
let lastTotal = 0;
let lastTurn = 0;
let lastSelected = 0;
let lastPhase = "ready";
let lastFaces = [1, 1, 1, 1, 1, 1];
let lastRound = 0;
let lastPaused = false;
let attracting = false;
let restoring = false;
let attractTl = null;
let attractTimer = 0;
let attractMove = null;
let clientId = "";
try {
  clientId = localStorage.getItem("farkle-id") || "";
  if (!clientId) {
    clientId = (crypto.randomUUID && crypto.randomUUID()) || `f${Date.now()}`;
    localStorage.setItem("farkle-id", clientId);
  }
} catch {
  clientId = `f${Date.now()}`;
}
const mouseMoves = [];
let keyStirs = 0;
let lastPtr = { x: 0, y: 0 };
const IDLE_MS = 3 * 60 * 1000;
const ATTRACT_IDLE_MS = 3 * 60 * 1000;
const ATTRACT_SOON_MS = 1600;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener(
    "animationend",
    () => {
      el.classList.remove(cls);
    },
    { once: true }
  );
}

function accentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff5a00";
}

function accentGlow(alpha) {
  const hex = accentColor().replace("#", "");
  if (hex.length !== 6) return `rgba(255, 90, 0, ${alpha})`;
  const n = parseInt(hex, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyAccent(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  document.documentElement.style.setProperty("--accent", hex);
  try {
    localStorage.setItem("farkle-accent", hex);
  } catch {
    /* ignore */
  }
  const picker = document.getElementById("accentColor");
  if (picker && picker.value !== hex) picker.value = hex;
}

function popScore(el, scale) {
  if (!primed || reduceMotion) return;
  gsap.killTweensOf(el);
  gsap.fromTo(
    el,
    { scale: 1, color: "#fff" },
    {
      scale,
      color: accentColor(),
      duration: 0.18,
      ease: "back.out(3.2)",
      yoyo: true,
      repeat: 1,
      yoyoEase: "power2.in",
      onComplete: () => gsap.set(el, { clearProps: "transform,color" }),
    }
  );
}

function shake(el, intensity, times) {
  if (!primed || reduceMotion) return;
  gsap.killTweensOf(el, "x");
  gsap.fromTo(
    el,
    { x: 0 },
    {
      x: intensity,
      duration: 0.05,
      yoyo: true,
      repeat: times,
      ease: "power1.inOut",
      onComplete: () => gsap.set(el, { x: 0 }),
    }
  );
}

function sparkDice(hot, dice, kind) {
  if (reduceMotion) return;
  dieEls.forEach((el, i) => {
    const die = dice && dice[i];
    if (!die) return;
    const hit =
      hot ||
      kind === "hot" ||
      (kind === "selected" && die.selected && !die.locked) ||
      (kind === "locked" && die.locked);
    if (!hit) return;
    restartAnim(el, hot ? "juice-hot-spark" : "juice-spark");
  });
}

function fmtMs(ms) {
  if (ms == null) return "—";
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function tickClock() {
  let ms = clockBase;
  if (clockRunning && !lastPaused) {
    const extra = Date.now() - clockAt;
    if (extra >= IDLE_MS) clockRunning = false;
    else ms += extra;
  }
  clockEl.textContent = fmtMs(ms);
}

function showFace(el, value) {
  const rot = rots[value - 1];
  gsap.set(el.querySelector(".cube"), {
    rotationX: -rot.rx,
    rotationY: -rot.ry,
    z: Z_FAR,
  });
}

function attractSoon() {
  const freshStart = lastPhase === "ready" && lastRound === 0 && lastTotal === 0;
  return lastPaused || freshStart || lastPhase === "won" || lastPhase === "abandoned";
}

function armAttract() {
  clearTimeout(attractTimer);
  if (reduceMotion) return;
  if (lastPaused) {
    startAttract();
    return;
  }
  attractTimer = setTimeout(() => {
    if (busy) {
      armAttract();
      return;
    }
    startAttract();
  }, attractSoon() ? ATTRACT_SOON_MS : ATTRACT_IDLE_MS);
}

function startAttract() {
  if (attracting || busy || restoring || reduceMotion) return;
  attracting = true;
  const cubes = dieEls.map((el) => el.querySelector(".cube"));
  const waves = [
    { dir: 1, spinX: 360, spinY: 90, stagger: 0.13, bounce: 4, dur: 1.05, near: Z_NEAR },
    { dir: 1, spinX: -360, spinY: 180, stagger: 0.11, bounce: 5, dur: 1.18, near: Z_NEAR + 25 },
    { dir: 1, spinX: 360, spinY: 90, stagger: 0.16, bounce: 3, dur: 0.92, near: Z_NEAR - 15 },
  ];
  attractTl = gsap.timeline({ repeat: -1, repeatDelay: 0.28 });
  let t = 0;
  waves.forEach((wave) => {
    cubes.forEach((cube, i) => {
      const slot = wave.dir === 1 ? i : 5 - i;
      const at = t + slot * wave.stagger;
      const flip = i % 2 === 0 ? 1 : -1;
      attractTl.to(
        cube,
        { duration: wave.dur * 0.42, z: wave.near, ease: "expo" },
        at
      );
      attractTl.to(
        cube,
        {
          duration: wave.dur * 0.58,
          z: Z_FAR,
          ease: `bounce.out(${wave.bounce})`,
        },
        at + wave.dur * 0.42
      );
      attractTl.to(
        cube,
        {
          duration: wave.dur,
          rotationX: `+=${wave.spinX * flip}`,
          rotationY: `+=${wave.spinY * flip}`,
          ease: "sine.inOut",
        },
        at
      );
    });
    t += 5 * wave.stagger + wave.dur + 0.22;
  });
}

function restoreFaces() {
  const cubes = dieEls.map((el) => el.querySelector(".cube"));
  return gsap
    .timeline()
    .to(
      cubes,
      {
        duration: 0.55,
        z: Z_NEAR,
        ease: "expo",
        stagger: 0.07,
      },
      0
    )
    .to(
      cubes,
      {
        duration: 0.7,
        z: Z_FAR,
        ease: "bounce.out(4)",
        stagger: 0.07,
      },
      0.28
    )
    .to(
      cubes,
      {
        duration: 0.85,
        ease: "back",
        stagger: 0.07,
        rotationX: (i) => -rots[lastFaces[i] - 1].rx,
        rotationY: (i) => -rots[lastFaces[i] - 1].ry,
      },
      0
    );
}

function wakeAttract(restore) {
  clearTimeout(attractTimer);
  if (!attracting && !restoring) return Promise.resolve();
  attracting = false;
  restoring = false;
  if (attractTl) {
    attractTl.kill();
    attractTl = null;
  }
  gsap.killTweensOf(dieEls.map((el) => el.querySelector(".cube")));
  if (restore && !reduceMotion) {
    restoring = true;
    return restoreFaces().then(() => {
      restoring = false;
    });
  }
  lastFaces.forEach((value, i) => showFace(dieEls[i], value));
  return Promise.resolve();
}

function onPointerMove(ev) {
  if (lastPaused) return;
  if (!attracting) {
    attractMove = { x: ev.clientX, y: ev.clientY };
    return;
  }
  if (!attractMove) {
    attractMove = { x: ev.clientX, y: ev.clientY };
    return;
  }
  if (Math.hypot(ev.clientX - attractMove.x, ev.clientY - attractMove.y) < 14) return;
  attractMove = { x: ev.clientX, y: ev.clientY };
  wakeAttract(true).then(armAttract);
}

function applyState(state) {
  const totalUp = primed && state.total > lastTotal;
  const turnUp = primed && state.turn > lastTurn;
  const selectedUp = primed && state.selected > lastSelected;
  totalEl.textContent = state.total;
  turnEl.textContent = state.turn;
  selectedEl.textContent = state.selected;
  roundEl.textContent = state.round;
  targetEl.textContent = state.target;
  msgEl.textContent = state.paused ? "Paused." : state.message;
  const over = state.phase === "won" || state.phase === "abandoned";
  const paused = !!state.paused;
  rollBtn.disabled = busy || over || paused || !state.can_roll;
  bankBtn.disabled = busy || over || paused || !state.can_bank;
  orderBtn.disabled = busy || over || paused || !state.can_arrange;
  pauseBtn.disabled = busy || over;
  pauseBtn.textContent = paused ? "Unpause" : "Pause";
  abandonBtn.disabled = busy || over || !state.can_abandon;
  newBtn.disabled = busy || !over;
  if (over) confirmEl.hidden = true;
  nerveEl.textContent = state.nerve ?? 1000;
  clockBase = state.elapsed_ms || 0;
  clockAt = Date.now();
  lastPaused = paused;
  clockRunning = !over && !paused && !!state.clock_running;
  tickClock();
  lastPhase = state.phase;
  lastFaces = state.dice.map((die) => die.value);
  lastRound = state.round;
  if (!statsPanel.hidden) refreshStats();
  state.dice.forEach((die, i) => {
    const el = dieEls[i];
    el.classList.toggle("selected", die.selected);
    el.classList.toggle("locked", die.locked);
    el.classList.toggle("selectable", !busy && !paused && state.phase === "choose" && die.live && !die.locked);
    el.setAttribute("aria-label", `Die ${i + 1}, ${die.value}`);
    if (!attracting) showFace(el, die.value);
  });
  if (state.hot) {
    flashHot(state.hot_note, state.dice);
    if (totalUp) popScore(totalEl, 1.85);
    else if (turnUp) popScore(turnEl, 1.45);
  } else if (totalUp) {
    popScore(totalEl, 1.7);
    shake(document.querySelector(".scores"), 3, 5);
  } else if (turnUp) {
    popScore(turnEl, 1.35);
    sparkDice(false, state.dice, "locked");
  } else if (selectedUp) {
    popScore(selectedEl, 1.25);
    sparkDice(false, state.dice, "selected");
  }
  lastTotal = state.total;
  lastTurn = state.turn;
  lastSelected = state.selected;
  primed = true;
  armAttract();
}

function entropySample() {
  return {
    id: clientId,
    t: Date.now(),
    perf: typeof performance !== "undefined" ? performance.now() : 0,
    x: lastPtr.x,
    y: lastPtr.y,
    w: window.innerWidth,
    h: window.innerHeight,
    keys: keyStirs,
    moves: mouseMoves.splice(0, mouseMoves.length),
  };
}

window.addEventListener(
  "pointermove",
  (ev) => {
    lastPtr = { x: ev.clientX, y: ev.clientY };
    mouseMoves.push([Math.round(ev.timeStamp), ev.clientX, ev.clientY]);
    if (mouseMoves.length > 64) mouseMoves.shift();
  },
  { passive: true }
);
window.addEventListener(
  "keydown",
  () => {
    keyStirs += 1;
  },
  { passive: true }
);

async function api(path, body) {
  if (body !== undefined) {
    body = { ...body, entropy: entropySample() };
  }
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function animateRoll(indices, values) {
  const cubes = indices.map((i) => dieEls[i].querySelector(".cube"));
  return gsap
    .timeline()
    .fromTo(
      cubes,
      { z: Z_FAR },
      {
        duration: 0.75,
        z: Z_NEAR,
        ease: "expo",
        yoyoEase: "bounce.out(5)",
        repeat: 1,
      },
      0
    )
    .fromTo(
      cubes,
      { rotationX: (i) => (i % 2 === 0 ? "-=360" : "+=360") },
      {
        duration: 1.5,
        ease: "back",
        rotationX: (i) => -rots[values[i] - 1].rx,
        rotationY: (i) => -rots[values[i] - 1].ry,
      },
      0
    );
}

async function roll() {
  if (busy || lastPaused) return;
  await wakeAttract(false);
  busy = true;
  rollBtn.disabled = true;
  bankBtn.disabled = true;
  msgEl.textContent = "Rolling…";
  try {
    const data = await api("/api/roll", {});
    await animateRoll(data.rolled, data.values);
    busy = false;
    applyState(data);
  } catch (err) {
    busy = false;
    msgEl.textContent = err.message;
    const state = await api("/api/state");
    applyState(state);
  }
}

async function selectDie(index) {
  if (busy || lastPaused) return;
  if (dieEls[index] && dieEls[index].classList.contains("locked")) return;
  await wakeAttract(true);
  try {
    applyState(await api("/api/select", { index }));
  } catch {
    /* ignore clicks that the server rejects */
  }
}

async function bank() {
  if (busy || lastPaused) return;
  await wakeAttract(true);
  try {
    applyState(await api("/api/bank", {}));
  } catch (err) {
    msgEl.textContent = err.message;
  }
}

async function newGame() {
  if (busy) return;
  await wakeAttract(true);
  try {
    applyState(await api("/api/new", {}));
  } catch (err) {
    msgEl.textContent = err.message;
  }
}

function flashHot(note, dice) {
  let text = "Hot dice";
  if (note && note.first) text = "Hot dice — first time";
  else if (note && note.streak >= 2) text = `Hot dice — ×${note.streak}`;
  else if (note && note.full_six) text = "Hot dice — all six";
  hotBanner.textContent = text;
  hotBanner.hidden = false;
  clearTimeout(hotTimer);
    sparkDice(true, dice, "hot");
  if (!reduceMotion) {
    shake(tray, 7, 9);
    gsap.killTweensOf(hotBanner);
    gsap.fromTo(
      hotBanner,
      { scale: 0.55, y: 10, opacity: 0 },
      { scale: 1.08, y: 0, opacity: 1, duration: 0.28, ease: "back.out(2.6)" }
    );
    gsap.fromTo(
      hotBanner,
      { boxShadow: `0 0 0 0 ${accentGlow(0.85)}` },
      {
        boxShadow: `0 0 28px 8px ${accentGlow(0)}`,
        duration: 0.7,
        ease: "power2.out",
        delay: 0.1,
      }
    );
    gsap.fromTo(hotFlash, { opacity: 0.95 }, { opacity: 0, duration: 0.7, ease: "power2.out" });
    const heading = document.querySelector("h1");
    if (heading) {
      gsap.fromTo(
        heading,
        { scale: 1, color: "#fff" },
        {
          scale: 1.08,
          color: accentColor(),
          duration: 0.22,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
          onComplete: () => gsap.set(heading, { clearProps: "transform,color" }),
        }
      );
    }
  }
  hotTimer = setTimeout(() => {
    if (reduceMotion) {
      hotBanner.hidden = true;
      return;
    }
    gsap.to(hotBanner, {
      opacity: 0,
      y: -6,
      duration: 0.28,
      ease: "power2.in",
      onComplete: () => {
        hotBanner.hidden = true;
        gsap.set(hotBanner, { opacity: 1, y: 0, scale: 1 });
      },
    });
  }, 2200);
}

function row(label, value) {
  return `<div class="stats-row"><span>${label}</span><span>${value}</span></div>`;
}

function section(title, rows) {
  return `<section class="stats-section"><h3>${title}</h3><div class="stats-rows">${rows}</div></section>`;
}

function faceCells(facePct) {
  return [1, 2, 3, 4, 5, 6]
    .map((f) => {
      const row = facePct[String(f)] || { count: 0, pct: 0 };
      const pos = `0px -${(f - 1) * 22}px`;
      return `<div class="face-cell"><span class="mini-die" style="background-position:${pos}"></span>${row.count} · ${row.pct}%</div>`;
    })
    .join("");
}

function renderStats(data) {
  const L = data.lifetime;
  const G = data.game;
  const best = L.best_combo;
  const common = L.most_common_combo;
  const last = L.last_blunder;
  const worst = L.worst_blunder;
  statsPanel.innerHTML = [
    `<header class="stats-hero"><span class="stats-hero-label">Nerve</span><span class="stats-hero-value">${L.nerve ?? 1000}</span></header>`,
    section(
      "This game",
      [
        row("Time", fmtMs(G.elapsed_ms)),
        row("Rounds", G.rounds),
        row("Farkles", `${G.farkles} · lost ${G.points_farkled}`),
        row("Banked", G.points_banked),
        row("Hot dice", G.hot_dice || 0),
        row("Blunders", `${G.blunders || 0} · ${G.blunder_points || 0} pts`),
        row("Blunder busts", G.blunder_busts || 0),
      ].join("")
    ),
    `<section class="stats-section hot-stats"><h3>Hot dice</h3><div class="stats-rows">${[
      row("This game", G.hot_dice || 0),
      row("Lifetime", L.hot_dice || 0),
      row("All six", `${G.hot_dice_six || 0} game · ${L.hot_dice_six || 0} life`),
      row("Streak", `${G.hot_streak || 0} now / ${L.best_hot_streak || 0} best`),
      row("First time", L.hot_dice ? "Yes" : "Not yet"),
    ].join("")}</div></section>`,
    section(
      "Rating",
      [
        row("Nerve", L.nerve ?? 1000),
        row("Games rated", L.games_rated || 0),
        row("Wins / abandons", `${L.games_won} / ${L.abandons || 0}`),
      ].join("")
    ),
    section(
      "Streaks",
      [
        row("No-bust", `${G.no_bust_streak} now / ${L.best_no_bust_streak} best`),
        row("Bust", `${G.bust_streak} now / ${L.longest_bust_streak} longest`),
        row("On fire", `${G.on_fire_streak} now / ${L.best_on_fire_streak} best`),
      ].join("")
    ),
    section(
      "Lifetime",
      [
        row("Games", `${L.games_started} started · ${L.games_won} won`),
        row("Abandons", L.abandons || 0),
        row("Fewest rounds", L.fewest_rounds_to_win ?? "—"),
        row("Banked", L.points_banked),
        row("Lost to bust", `${L.points_farkled} · biggest ${L.biggest_bust}`),
        row("Avg / round", `${L.avg_per_round} · best ${L.best_round_score}`),
        row("Efficiency", `${L.efficiency}%`),
        row("Farkle rate", `${L.farkle_rate}%`),
        row("Push your luck", L.push_your_luck),
        row("Leftover dice", L.avg_remaining_dice),
        row("First-roll / 6-die farkles", `${L.first_roll_farkles} / ${L.six_die_farkles}`),
        row("Rolls / banks", `${L.rolls} / ${L.banks}`),
        row("Exact 10k", `${L.exact_10000_wins} · overshoot ${L.last_overshoot}`),
      ].join("")
    ),
    `<section class="stats-section"><h3>Dice</h3><div class="face-grid">${faceCells(L.face_pct)}</div></section>`,
    section(
      "Combos",
      [
        row("Best combo", best && best.label ? `${best.label} (${best.score})` : "—"),
        row("Most common", common ? `${common.label} ×${common.count}` : "—"),
      ].join("")
    ),
    section(
      "Blunders",
      [
        row("Count", `${L.blunders || 0} · ${L.blunder_rate || 0}%`),
        row("Points left", L.blunder_points || 0),
        row("Blunder busts", L.blunder_busts || 0),
        row("Last", last && last.label ? `${last.label} (${last.cost})` : "—"),
        row("Worst", worst && worst.label ? `${worst.label} (${worst.cost})` : "—"),
      ].join("")
    ),
    section(
      "Time",
      [
        row("Played", fmtMs(L.time_played_ms)),
        row("Fastest win", fmtMs(L.fastest_win_ms)),
        row("Avg / round", fmtMs(L.avg_time_per_round_ms)),
      ].join("")
    ),
  ].join("");
}

async function refreshStats() {
  try {
    renderStats(await api("/api/stats"));
  } catch {
    statsPanel.textContent = "Could not load stats.";
  }
}

statsBtn.addEventListener("click", async () => {
  closeMenu();
  statsPanel.hidden = !statsPanel.hidden;
  statsBtn.textContent = statsPanel.hidden ? "Stats" : "Hide stats";
  if (!statsPanel.hidden) await refreshStats();
});

setInterval(tickClock, 250);

function closeMenu() {
  menuDrop.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
  const open = menuDrop.hidden;
  menuDrop.hidden = !open;
  menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

menuBtn.addEventListener("click", (ev) => {
  ev.stopPropagation();
  wakeAttract(true).then(armAttract);
  toggleMenu();
});

document.addEventListener("click", (ev) => {
  if (!menuDrop.hidden && !ev.target.closest(".menu")) closeMenu();
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeMenu();
});

async function pauseClock() {
  if (busy || pauseBtn.disabled) return;
  if (lastPaused) await wakeAttract(true);
  try {
    applyState(await api("/api/pause", {}));
  } catch (err) {
    msgEl.textContent = err.message;
  }
}

async function orderDice() {
  if (busy || lastPaused) return;
  await wakeAttract(true);
  try {
    applyState(await api("/api/arrange", {}));
  } catch (err) {
    msgEl.textContent = err.message;
  }
}

function askAbandon() {
  if (busy || abandonBtn.disabled) return;
  closeMenu();
  wakeAttract(true).then(armAttract);
  confirmEl.hidden = false;
}

confirmNo.addEventListener("click", () => {
  confirmEl.hidden = true;
});

confirmYes.addEventListener("click", async () => {
  confirmEl.hidden = true;
  if (busy) return;
  await wakeAttract(true);
  try {
    applyState(await api("/api/abandon", {}));
  } catch (err) {
    msgEl.textContent = err.message;
  }
});

rollBtn.addEventListener("click", roll);
bankBtn.addEventListener("click", bank);
newBtn.addEventListener("click", () => {
  closeMenu();
  newGame();
});
orderBtn.addEventListener("click", orderDice);
pauseBtn.addEventListener("click", pauseClock);
abandonBtn.addEventListener("click", askAbandon);

api("/api/state").then(applyState).catch(() => {
  msgEl.textContent = "Could not reach the game server.";
});

try {
  applyAccent(localStorage.getItem("farkle-accent") || "#ff5a00");
} catch {
  applyAccent("#ff5a00");
}

const accentInput = document.getElementById("accentColor");
if (accentInput) {
  accentInput.addEventListener("input", (ev) => applyAccent(ev.target.value));
  accentInput.addEventListener("click", (ev) => ev.stopPropagation());
}

document.querySelectorAll(".actions button").forEach((btn) => {
  btn.addEventListener("pointerdown", () => {
    if (btn.disabled) return;
    btn.classList.add("is-shimmer");
    clearTimeout(btn._shimmerTimer);
    btn._shimmerTimer = setTimeout(() => btn.classList.remove("is-shimmer"), 700);
  });
});

window.addEventListener("pointermove", onPointerMove, { passive: true });
window.addEventListener(
  "pointerdown",
  (ev) => {
    if (!attracting || lastPaused) return;
    const node = ev.target && ev.target.closest ? ev.target.closest("button, .die") : null;
    if (node) return;
    wakeAttract(true).then(armAttract);
  },
  { passive: true }
);
window.addEventListener(
  "keydown",
  (ev) => {
    if (lastPaused) return;
    const node = ev.target && ev.target.closest ? ev.target.closest("button, .die") : null;
    if (node) return;
    wakeAttract(true).then(armAttract);
  },
  { passive: true }
);
