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
const confirmMsg = document.getElementById("confirmMsg");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");
const menuBtn = document.getElementById("menuBtn");
const menuDrop = document.getElementById("menuDrop");
const playArea = document.getElementById("playArea");
const homePanel = document.getElementById("homePanel");
const tutorialPanel = document.getElementById("tutorialPanel");
const homeBtn = document.getElementById("homeBtn");
const homeNew = document.getElementById("homeNew");
const homeContinue = document.getElementById("homeContinue");
const homeContinueMeta = document.getElementById("homeContinueMeta");
const homeTutorial = document.getElementById("homeTutorial");
const tutorialBack = document.getElementById("tutorialBack");
const homeMulti = document.getElementById("homeMulti");
const lobbyPanel = document.getElementById("lobbyPanel");
const lobbyHub = document.getElementById("lobbyHub");
const lobbyRoom = document.getElementById("lobbyRoom");
const lobbyBack = document.getElementById("lobbyBack");
const lobbyName = document.getElementById("lobbyName");
const lobbyMsg = document.getElementById("lobbyMsg");
const lobbySub = document.getElementById("lobbySub");
const lobbyCreateForm = document.getElementById("lobbyCreateForm");
const lobbyMode = document.getElementById("lobbyMode");
const lobbySeats = document.getElementById("lobbySeats");
const lobbyForfeit = document.getElementById("lobbyForfeit");
const lobbySeatsField = document.getElementById("lobbySeatsField");
const lobbyForfeitField = document.getElementById("lobbyForfeitField");
const lobbyRooms = document.getElementById("lobbyRooms");
const lobbyEmpty = document.getElementById("lobbyEmpty");
const lobbyCode = document.getElementById("lobbyCode");
const lobbyRules = document.getElementById("lobbyRules");
const lobbyPlayers = document.getElementById("lobbyPlayers");
const lobbyReady = document.getElementById("lobbyReady");
const lobbyLeave = document.getElementById("lobbyLeave");
const rivalsEl = document.getElementById("rivals");
const forfeitScore = document.getElementById("forfeitScore");
const forfeitClock = document.getElementById("forfeitClock");
const clockScore = document.getElementById("clockScore");
const nerveScore = document.getElementById("nerveScore");
const roundScore = document.getElementById("roundScore");
const mpOver = document.getElementById("mpOver");
const mpOverTitle = document.getElementById("mpOverTitle");
const mpOverWinner = document.getElementById("mpOverWinner");
const mpOverMeta = document.getElementById("mpOverMeta");
const mpOverStandings = document.getElementById("mpOverStandings");
const mpOverFacts = document.getElementById("mpOverFacts");
const mpOverHome = document.getElementById("mpOverHome");
const mpOverLobby = document.getElementById("mpOverLobby");
const storeBtn = document.getElementById("storeBtn");
const decorBtn = document.getElementById("decorBtn");
const storePanel = document.getElementById("storePanel");
const decorPanel = document.getElementById("decorPanel");
const storeGrid = document.getElementById("storeGrid");
const decorGrid = document.getElementById("decorGrid");
const storeWallet = document.getElementById("storeWallet");
const storeMsg = document.getElementById("storeMsg");
const storeBack = document.getElementById("storeBack");
const decorBack = document.getElementById("decorBack");
const decorRemove = document.getElementById("decorRemove");
const decorEmpty = document.getElementById("decorEmpty");
const stickerBoard = document.getElementById("stickerBoard");
const placeOverlay = document.getElementById("placeOverlay");
const placeItem = document.getElementById("placeItem");
const placeImg = document.getElementById("placeImg");
const placeRing = document.getElementById("placeRing");
const placeScale = document.getElementById("placeScale");
const placeOk = document.getElementById("placeOk");
const peelConfirm = document.getElementById("peelConfirm");
const peelYes = document.getElementById("peelYes");
const peelNo = document.getElementById("peelNo");
const peelHint = document.getElementById("peelHint");
const peelCancel = document.getElementById("peelCancel");

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
  el.dataset.dieSize = String(SIZE);
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
let lastCanContinue = false;
let currentView = "home";
let returnView = "home";
let confirmAction = "abandon";
let mpRoom = "";
let mpPoll = 0;
let lastRollSeq = 0;
let rivalDice = {};
let rivalBusy = {};
let lastRivalSeq = {};
let mpRemainBase = 0;
let mpRemainAt = 0;
let mpHold = false;
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

function fmtNum(n) {
  if (n == null || n === "—") return n;
  const num = Number(n);
  if (!Number.isFinite(num)) return n;
  return num.toLocaleString("en-US");
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
  if (forfeitClock && currentView === "multiplay") {
    forfeitClock.textContent = mpHold ? "—" : fmtMs(Math.max(0, mpRemainBase - (Date.now() - mpRemainAt)));
  }
}

function dieSizeOf(el) {
  return Number(el && el.dataset.dieSize) || SIZE;
}

function showFace(el, value) {
  const size = dieSizeOf(el);
  const rot = rots[value - 1];
  gsap.set(el.querySelector(".cube"), {
    rotationX: -rot.rx,
    rotationY: -rot.ry,
    z: -size * 2,
  });
}

function attractSoon() {
  const freshStart = lastPhase === "ready" && lastRound === 0 && lastTotal === 0;
  return lastPaused || freshStart || lastPhase === "won" || lastPhase === "abandoned";
}

function armAttract() {
  clearTimeout(attractTimer);
  if (currentView !== "play") return;
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
  totalEl.textContent = fmtNum(state.total);
  turnEl.textContent = fmtNum(state.turn);
  selectedEl.textContent = fmtNum(state.selected);
  roundEl.textContent = fmtNum(state.round);
  targetEl.textContent = fmtNum(state.target);
  msgEl.textContent = state.paused ? "Paused." : state.message;
  const over = state.phase === "won" || state.phase === "abandoned" || state.phase === "lost";
  const paused = !!state.paused;
  rollBtn.disabled = busy || over || paused || !state.can_roll;
  rollBtn.textContent = state.hot_ready && state.can_roll && !over && !paused ? "Roll all six" : "Roll";
  rollBtn.classList.toggle("is-hot", !!state.hot_ready && !!state.can_roll && !over && !paused);
  bankBtn.disabled = busy || over || paused || !state.can_bank;
  orderBtn.disabled = busy || over || paused || !state.can_arrange;
  pauseBtn.disabled = busy || over || !!state.multiplayer;
  pauseBtn.textContent = paused ? "Unpause" : "Pause";
  abandonBtn.disabled = busy || over || !state.can_abandon;
  newBtn.disabled = busy || !over || !!state.multiplayer;
  if (over) confirmEl.hidden = true;
  nerveEl.textContent = fmtNum(state.nerve ?? 1000);
  clockBase = state.elapsed_ms || 0;
  clockAt = Date.now();
  lastPaused = paused;
  if (!state.multiplayer) lastCanContinue = !!state.can_abandon;
  updateHomeMenu(state);
  clockRunning = !over && !paused && !!state.clock_running;
  tickClock();
  lastPhase = state.phase;
  lastFaces = state.dice.map((die) => die.value);
  lastRound = state.round;
  if (!statsPanel.hidden) refreshStats();
  paintStickers(state.stickers);
  state.dice.forEach((die, i) => {
    const el = dieEls[i];
    el.classList.toggle("selected", die.selected);
    el.classList.toggle("locked", die.locked);
    el.classList.toggle("selectable", !busy && !paused && state.phase === "choose" && die.live && !die.locked);
    el.setAttribute("aria-label", `Die ${i + 1}, ${die.value}`);
    if (!attracting && !busy) showFace(el, die.value);
  });
  paintHotCue(state);
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
  if (currentView === "play") armAttract();
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

function animateRoll(indices, values, nodes) {
  const list = nodes || dieEls;
  const size = dieSizeOf(list[indices[0]] || list[0]);
  const cubes = indices.map((i) => list[i] && list[i].querySelector(".cube")).filter(Boolean);
  if (!cubes.length) return Promise.resolve();
  return gsap
    .timeline()
    .fromTo(
      cubes,
      { z: -size * 2 },
      {
        duration: 0.75,
        z: -size,
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
    const data = mpRoom
      ? await api("/api/mp/roll", mpPayload())
      : await api("/api/roll", {});
    const rolled = data.rolled || (data.roll_event && data.roll_event.rolled) || [];
    const values = data.values || (data.roll_event && data.roll_event.values) || [];
    await animateRoll(rolled, values);
    busy = false;
    if (data.multiplayer) applyMpState(data);
    else applyState(data);
  } catch (err) {
    busy = false;
    msgEl.textContent = err.message;
    try {
      if (mpRoom) applyMpState(await api("/api/mp/state", mpPayload()));
      else applyState(await api("/api/state"));
    } catch {
      /* ignore */
    }
  }
}

async function selectDie(index) {
  if (busy || lastPaused) return;
  if (dieEls[index] && dieEls[index].classList.contains("locked")) return;
  await wakeAttract(true);
  try {
    const data = mpRoom
      ? await api("/api/mp/select", mpPayload({ index }))
      : await api("/api/select", { index });
    if (data.multiplayer) applyMpState(data);
    else applyState(data);
  } catch {
    /* ignore clicks that the server rejects */
  }
}

async function bank() {
  if (busy || lastPaused) return;
  await wakeAttract(true);
  try {
    const data = mpRoom
      ? await api("/api/mp/bank", mpPayload())
      : await api("/api/bank", {});
    if (data.multiplayer) applyMpState(data);
    else applyState(data);
  } catch (err) {
    msgEl.textContent = err.message;
  }
}

async function newGame() {
  if (busy) return;
  await wakeAttract(true);
  try {
    applyState(await api("/api/new", {}));
    showView("play");
  } catch (err) {
    msgEl.textContent = err.message;
  }
}

async function startFreshGame() {
  if (busy) return;
  await wakeAttract(true);
  try {
    if (lastCanContinue) await api("/api/abandon", {});
    applyState(await api("/api/new", {}));
    showView("play");
  } catch (err) {
    msgEl.textContent = err.message;
  }
}

function updateHomeMenu(state) {
  if (!homeContinue) return;
  const on = !!state.can_abandon;
  homeContinue.hidden = !on;
  if (on && homeContinueMeta) {
    homeContinueMeta.textContent = `${fmtNum(state.total)} pts · round ${fmtNum(state.round)}`;
  }
}

function showHotReadyBanner() {
  hotBanner.textContent = "Hot dice — roll all six";
  hotBanner.hidden = false;
  gsap.killTweensOf(hotBanner);
  gsap.set(hotBanner, { opacity: 1, y: 0, scale: 1 });
}

function paintHotCue(state) {
  const over = state.phase === "won" || state.phase === "abandoned" || state.phase === "lost";
  if (state.hot || over || state.paused) return;
  if (state.hot_ready && state.can_roll) {
    if (!hotTimer) showHotReadyBanner();
    return;
  }
  if (!hotTimer) hotBanner.hidden = true;
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
      return `<div class="face-cell"><span class="mini-die" style="background-position:${pos}"></span>${fmtNum(row.count)} · ${row.pct}%</div>`;
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
    `<header class="stats-hero"><span class="stats-hero-label">Nerve</span><span class="stats-hero-value">${fmtNum(L.nerve ?? 1000)}</span></header>`,
    section(
      "This game",
      [
        row("Time", fmtMs(G.elapsed_ms)),
        row("Rounds", fmtNum(G.rounds)),
        row("Farkles", `${fmtNum(G.farkles)} · lost ${fmtNum(G.points_farkled)}`),
        row("Banked", fmtNum(G.points_banked)),
        row("Hot dice", fmtNum(G.hot_dice || 0)),
        row("Blunders", `${fmtNum(G.blunders || 0)} · ${fmtNum(G.blunder_points || 0)} pts`),
        row("Blunder busts", fmtNum(G.blunder_busts || 0)),
      ].join("")
    ),
    `<section class="stats-section hot-stats"><h3>Hot dice</h3><div class="stats-rows">${[
      row("This game", fmtNum(G.hot_dice || 0)),
      row("Lifetime", fmtNum(L.hot_dice || 0)),
      row("All six", `${fmtNum(G.hot_dice_six || 0)} game · ${fmtNum(L.hot_dice_six || 0)} life`),
      row("Streak", `${fmtNum(G.hot_streak || 0)} now / ${fmtNum(L.best_hot_streak || 0)} best`),
      row("First time", L.hot_dice ? "Yes" : "Not yet"),
    ].join("")}</div></section>`,
    section(
      "Rating",
      [
        row("Nerve", fmtNum(L.nerve ?? 1000)),
        row("Games rated", fmtNum(L.games_rated || 0)),
        row("Wins / abandons", `${fmtNum(L.games_won)} / ${fmtNum(L.abandons || 0)}`),
      ].join("")
    ),
    section(
      "Streaks",
      [
        row("No-bust", `${fmtNum(G.no_bust_streak)} now / ${fmtNum(L.best_no_bust_streak)} best`),
        row("Bust", `${fmtNum(G.bust_streak)} now / ${fmtNum(L.longest_bust_streak)} longest`),
        row("On fire", `${fmtNum(G.on_fire_streak)} now / ${fmtNum(L.best_on_fire_streak)} best`),
      ].join("")
    ),
    section(
      "Lifetime",
      [
        row("Current Wallet", fmtNum(L.wallet ?? L.points_banked)),
        row("All Time Banked", fmtNum(L.points_banked)),
        row("Games", `${fmtNum(L.games_started)} started · ${fmtNum(L.games_won)} won`),
        row("Abandons", fmtNum(L.abandons || 0)),
        row("Fewest rounds", L.fewest_rounds_to_win ?? "—"),
        row("Lost to bust", `${fmtNum(L.points_farkled)} · biggest ${fmtNum(L.biggest_bust)}`),
        row("Avg / round", `${fmtNum(L.avg_per_round)} · best ${fmtNum(L.best_round_score)}`),
        row("Efficiency", `${L.efficiency}%`),
        row("Farkle rate", `${L.farkle_rate}%`),
        row("Push your luck", fmtNum(L.push_your_luck)),
        row("Leftover dice", L.avg_remaining_dice),
        row("First-roll / 6-die farkles", `${fmtNum(L.first_roll_farkles)} / ${fmtNum(L.six_die_farkles)}`),
        row("Rolls / banks", `${fmtNum(L.rolls)} / ${fmtNum(L.banks)}`),
        row("Exact 10k", `${fmtNum(L.exact_10000_wins)} · overshoot ${fmtNum(L.last_overshoot)}`),
      ].join("")
    ),
    `<section class="stats-section"><h3>Dice</h3><div class="face-grid">${faceCells(L.face_pct)}</div></section>`,
    section(
      "Combos",
      [
        row("Best combo", best && best.label ? `${best.label} (${fmtNum(best.score)})` : "—"),
        row("Most common", common ? `${common.label} ×${fmtNum(common.count)}` : "—"),
      ].join("")
    ),
    section(
      "Blunders",
      [
        row("Count", `${fmtNum(L.blunders || 0)} · ${L.blunder_rate || 0}%`),
        row("Points left", fmtNum(L.blunder_points || 0)),
        row("Blunder busts", fmtNum(L.blunder_busts || 0)),
        row("Last", last && last.label ? `${last.label} (${fmtNum(last.cost)})` : "—"),
        row("Worst", worst && worst.label ? `${worst.label} (${fmtNum(worst.cost)})` : "—"),
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

function showView(name) {
  currentView = name;
  document.body.classList.toggle("is-multi", name === "multiplay");
  if (name !== "multiplay") document.body.classList.remove("is-blitz");
  if (homePanel) homePanel.hidden = name !== "home";
  if (tutorialPanel) tutorialPanel.hidden = name !== "tutorial";
  if (lobbyPanel) lobbyPanel.hidden = name !== "lobby";
  if (rivalsEl) rivalsEl.hidden = name !== "multiplay";
  if (mpOver && name !== "multiplay") mpOver.hidden = true;
  playArea.hidden = name !== "play" && name !== "multiplay";
  storePanel.hidden = name !== "store";
  decorPanel.hidden = name !== "decor";
  if (homeBtn) homeBtn.hidden = name === "home" || name === "tutorial" || name === "lobby";
  if (forfeitScore) forfeitScore.hidden = name !== "multiplay";
  if (clockScore) clockScore.hidden = name === "multiplay";
  if (nerveScore) nerveScore.hidden = name === "multiplay";
  if (roundScore) roundScore.hidden = name === "multiplay";
  if (name !== "play" && name !== "multiplay") {
    statsPanel.hidden = true;
    statsBtn.textContent = "Stats";
    confirmEl.hidden = true;
    clearTimeout(attractTimer);
    if (attracting) wakeAttract(false);
  }
  if (name === "play") armAttract();
  if (name !== "lobby" && name !== "multiplay") stopMpPoll();
}

function playerName() {
  const typed = lobbyName && lobbyName.value.trim();
  if (typed) return typed;
  try {
    return localStorage.getItem("farkle-name") || "Player";
  } catch {
    return "Player";
  }
}

function savePlayerName() {
  if (!lobbyName) return;
  const name = lobbyName.value.trim();
  if (!name) return;
  try {
    localStorage.setItem("farkle-name", name);
  } catch {
    /* ignore */
  }
}

function mpPayload(extra) {
  return { player: clientId, room: mpRoom, name: playerName(), ...(extra || {}) };
}

function stopMpPoll() {
  clearInterval(mpPoll);
  mpPoll = 0;
}

function startMpPoll() {
  stopMpPoll();
  mpPoll = setInterval(() => {
    if (mpRoom) pollMp();
    else refreshLobbyList();
  }, currentView === "multiplay" ? 320 : 900);
}

function showLobbyMsg(err) {
  if (!lobbyMsg) return;
  if (!err) {
    lobbyMsg.hidden = true;
    lobbyMsg.textContent = "";
    return;
  }
  lobbyMsg.hidden = false;
  lobbyMsg.textContent = err;
}

function setLobbyScreen(room) {
  if (lobbyHub) lobbyHub.hidden = !!room;
  if (lobbyRoom) lobbyRoom.hidden = !room;
  if (lobbySub) lobbySub.textContent = room ? "Waiting for everyone to ready up" : "Join or create a table";
}

function renderLobbyPlayers(data) {
  if (!lobbyPlayers) return;
  const seated = data.players || [];
  const seats = Number(data.seats) || seated.length;
  const rows = seated.map((row) => {
    const tags = [
      row.is_you ? "You" : "",
      row.is_host ? "Host" : "",
      row.ready ? "Ready" : "Not ready",
    ].filter(Boolean).join(" · ");
    return `<li><span>${row.name}</span><span class="${row.ready ? "is-ready" : ""}">${tags}</span></li>`;
  });
  for (let i = seated.length; i < seats; i++) {
    rows.push(`<li class="is-open"><span>Open seat</span><span>Waiting</span></li>`);
  }
  lobbyPlayers.innerHTML = rows.join("");
  if (lobbyReady) lobbyReady.textContent = data.you && data.you.ready ? "Unready" : "Ready";
}

function renderLobbyRoom(data) {
  mpRoom = data.room;
  setLobbyScreen(true);
  if (lobbyCode) lobbyCode.textContent = data.room;
  if (lobbyRules) {
    lobbyRules.textContent = data.simultaneous
      ? `${data.mode_label} · 2 player race · first to ${fmtNum(data.target)}`
      : `${data.mode_label} · ${data.seats} seats · ${data.forfeit_sec}s turn forfeit · first to ${fmtNum(data.target)}`;
  }
  const seated = (data.players || []).length;
  const ready = (data.players || []).filter((row) => row.ready).length;
  if (lobbySub) {
    lobbySub.textContent = seated < data.seats
      ? `Waiting for players · ${seated}/${data.seats} seated`
      : `All seated — ready up to start (${ready}/${data.seats})`;
  }
  renderLobbyPlayers(data);
}

async function refreshLobbyList() {
  if (!lobbyRooms || currentView !== "lobby" || mpRoom) return;
  try {
    const data = await fetch("/api/mp/lobby").then((res) => res.json());
    const rooms = data.rooms || [];
    const html = rooms
      .map((row) => `<article class="lobby-room-row">
        <p><b>${row.id}</b> ${row.mode_label}<span>${row.host} · ${row.taken}/${row.seats}${row.simultaneous ? " · race" : ` · ${row.forfeit_sec}s turns`}</span></p>
        <button type="button" data-join="${row.id}">Join</button>
      </article>`)
      .join("");
    if (lobbyRooms.innerHTML === html) {
      lobbyEmpty.hidden = rooms.length > 0;
      return;
    }
    lobbyEmpty.hidden = rooms.length > 0;
    lobbyRooms.innerHTML = html;
  } catch {
    /* keep last list */
  }
}

function prepareTray(tray, size = SIZE) {
  const half = size / 2;
  const nodes = [...tray.querySelectorAll(".die")];
  nodes.forEach((el) => {
    el.dataset.dieSize = String(size);
  });
  gsap.set(tray.querySelectorAll(".face"), {
    position: "absolute",
    userSelect: "none",
    width: "100%",
    height: "100%",
    rotateY: (i) => rots[i % 6].ry,
    rotateX: (i) => rots[i % 6].rx,
    transformOrigin: `50% 50% -${half}px`,
    z: half,
    backgroundImage: "url(dieSprite.svg)",
    backgroundPosition: (i) => `0px -${(i % 6) * size}px`,
    backgroundSize: `${size}px ${size * 6}px`,
    backgroundRepeat: "no-repeat",
  });
  gsap.set(nodes, { width: size, height: size, perspective: size * (400 / SIZE) });
  gsap.set(tray.querySelectorAll(".cube"), {
    position: "absolute",
    width: size,
    height: size,
    transformStyle: "preserve-3d",
    z: -size * 2,
  });
  nodes.forEach((el) => showFace(el, 1));
  return nodes;
}

function showRivalFace(el, value) {
  const v = Math.max(1, Math.min(6, Number(value) || 1));
  el.style.backgroundPosition = `0px -${(v - 1) * 38}px`;
}

function animateRivalRoll(nodes, indices, values) {
  const list = (indices || []).map((i) => nodes[i]).filter(Boolean);
  if (!list.length) return Promise.resolve();
  const proxy = { t: 0 };
  return gsap.to(proxy, {
    t: 1,
    duration: 0.65,
    ease: "none",
    onUpdate() {
      list.forEach((el) => {
        el.style.backgroundPosition = `0px -${Math.floor(Math.random() * 6) * 38}px`;
      });
    },
    onComplete() {
      (indices || []).forEach((i, n) => {
        if (nodes[i]) showRivalFace(nodes[i], values[n]);
      });
    },
  });
}

function paintRivals(rivals) {
  if (!rivalsEl) return;
  const ids = (rivals || []).map((row) => row.id).join(",");
  if (rivalsEl.dataset.ids !== ids) {
    rivalDice = {};
    rivalBusy = {};
    lastRivalSeq = {};
    rivalsEl.replaceChildren();
    rivalsEl.dataset.ids = ids;
    (rivals || []).forEach((row) => {
      const seat = document.createElement("article");
      seat.className = "rival-seat";
      seat.dataset.id = row.id;
      seat.innerHTML = `<header><span></span><b></b></header><div class="rival-tray"></div>`;
      const tray = seat.querySelector(".rival-tray");
      for (let i = 0; i < 6; i++) {
        const pip = document.createElement("span");
        pip.className = "rival-die";
        tray.append(pip);
      }
      rivalDice[row.id] = [...tray.querySelectorAll(".rival-die")];
      rivalsEl.append(seat);
    });
  }
  (rivals || []).forEach((row) => {
    const seat = rivalsEl.querySelector(`[data-id="${row.id}"]`);
    if (!seat) return;
    seat.classList.toggle("is-turn", !!row.is_turn);
    seat.classList.toggle("is-farkle", row.phase === "hold");
    const head = seat.querySelector("span");
    const total = seat.querySelector("b");
    const live = (row.dice || []).some((die) => die.live);
    let tag = "";
    if (row.phase === "hold") tag = " · farkle";
    else if (row.is_turn && live) tag = " · rolling";
    if (head) head.textContent = row.name + tag;
    if (total) total.textContent = fmtNum(row.total);
    const nodes = rivalDice[row.id] || [];
    const incoming = row.last_roll && row.last_roll.seq > (lastRivalSeq[row.id] || 0);
    (row.dice || []).forEach((die, i) => {
      if (!nodes[i]) return;
      nodes[i].classList.toggle("is-locked", !!die.locked);
      nodes[i].classList.toggle("is-selected", !!die.selected);
      if (!incoming && !rivalBusy[row.id]) showRivalFace(nodes[i], die.value);
    });
    if (incoming) {
      lastRivalSeq[row.id] = row.last_roll.seq;
      rivalBusy[row.id] = true;
      animateRivalRoll(nodes, row.last_roll.rolled || [], row.last_roll.values || []).then(() => {
        rivalBusy[row.id] = false;
        (row.dice || []).forEach((die, i) => {
          if (nodes[i]) showRivalFace(nodes[i], die.value);
        });
      });
    }
  });
}

function applyMpState(data, { animateSelf } = {}) {
  if (data.status === "lobby") {
    showView("lobby");
    renderLobbyRoom(data);
    startMpPoll();
    return;
  }
  if (data.status === "playing" || data.status === "finished") {
    showView("multiplay");
    paintRivals(data.rivals || []);
    document.body.classList.toggle("is-blitz", data.mode === "blitz" || !!data.simultaneous);
    mpRemainBase = data.simultaneous ? 0 : data.turn_remaining_ms || 0;
    mpRemainAt = Date.now();
    mpHold = !!data.hold || !!data.simultaneous;
    if (forfeitScore) forfeitScore.hidden = data.mode === "blitz" || !!data.simultaneous;
    if (forfeitClock) forfeitClock.textContent = mpHold ? "—" : fmtMs(mpRemainBase);
    if (data.roll_event) lastRollSeq = Math.max(lastRollSeq, data.roll_event.seq || 0);
    if (tray) tray.classList.toggle("is-waiting", !data.simultaneous && !(data.you && data.you.is_turn));
    startMpPoll();
    applyState({
      ...data,
      paused: false,
      stickers: lastStickers,
      nerve: 1000,
      clock_running: false,
      elapsed_ms: 0,
    });
    if (data.status === "finished") {
      stopMpPoll();
      renderMpRecap(data);
    } else if (mpOver) {
      mpOver.hidden = true;
    }
    if (animateSelf && data.rolled) {
      /* self roll already animated by caller */
    }
  }
}

function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMpRecap(data) {
  if (!mpOver) return;
  const recap = data.recap || {};
  const youWon = !!recap.you_won;
  if (mpOverTitle) mpOverTitle.textContent = youWon ? "You win" : "Game over";
  if (mpOverWinner) {
    const name = recap.winner_name || "No winner";
    const pts = fmtNum(recap.winner_total || 0);
    mpOverWinner.textContent = recap.reason === "left"
      ? `${name} wins — everyone else left`
      : `${name} · ${pts}`;
  }
  if (mpOverMeta) {
    const bits = [
      recap.mode_label || data.mode_label,
      recap.target ? `first to ${fmtNum(recap.target)}` : "",
      recap.elapsed_ms ? fmtMs(recap.elapsed_ms) : "",
    ].filter(Boolean);
    mpOverMeta.textContent = bits.join(" · ");
  }
  if (mpOverStandings) {
    mpOverStandings.innerHTML = (recap.standings || [])
      .map((row, i) => {
        const tags = [
          row.is_you ? "You" : "",
          row.winner ? "Winner" : "",
        ].filter(Boolean).join(" · ");
        const line = [
          `${fmtNum(row.banks)} banked`,
          `${fmtNum(row.farkles)} farkle${row.farkles === 1 ? "" : "s"}`,
          row.best_bank ? `best ${fmtNum(row.best_bank)}` : "",
        ].filter(Boolean).join(" · ");
        return `<li class="${row.winner ? "is-winner" : ""}">
          <span class="place">${i + 1}</span>
          <span class="who">${esc(row.name)}${tags ? ` · ${tags}` : ""}</span>
          <span class="pts">${fmtNum(row.total)}</span>
          <span class="line">${line}</span>
        </li>`;
      })
      .join("");
  }
  if (mpOverFacts) {
    const you = (recap.standings || []).find((row) => row.is_you) || {};
    const facts = [
      ["Turns", fmtNum(recap.turns || 0)],
      ["Your rolls", fmtNum(you.rolls || 0)],
      ["Your farkles", fmtNum(you.farkles || 0)],
      ["Timeouts", fmtNum(you.timeouts || 0)],
    ];
    mpOverFacts.innerHTML = facts
      .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
      .join("");
  }
  mpOver.hidden = false;
}

async function pollMp() {
  if (!mpRoom || busy) return;
  try {
    const data = await api("/api/mp/state", mpPayload());
    if (currentView === "lobby" || currentView === "multiplay") applyMpState(data);
  } catch (err) {
    if (currentView === "lobby") showLobbyMsg(err.message);
  }
}

async function openLobby() {
  closeMenu();
  showLobbyMsg();
  mpRoom = "";
  lastRollSeq = 0;
  setLobbyScreen(false);
  if (lobbyName) {
    try {
      lobbyName.value = localStorage.getItem("farkle-name") || "";
    } catch {
      lobbyName.value = "";
    }
  }
  showView("lobby");
  syncCreateForm();
  startMpPoll();
  await refreshLobbyList();
}

async function leaveMp(backHome) {
  const room = mpRoom;
  mpRoom = "";
  lastRollSeq = 0;
  rivalDice = {};
  rivalBusy = {};
  lastRivalSeq = {};
  mpRemainBase = 0;
  if (tray) tray.classList.remove("is-waiting");
  if (rivalsEl) {
    rivalsEl.replaceChildren();
    rivalsEl.dataset.ids = "";
  }
  if (mpOver) mpOver.hidden = true;
  stopMpPoll();
  if (room) {
    try {
      await api("/api/mp/leave", { player: clientId, room });
    } catch {
      /* already gone */
    }
  }
  if (backHome) showView("home");
}

async function createMp(ev) {
  if (ev) ev.preventDefault();
  savePlayerName();
  showLobbyMsg();
  try {
    const data = await api("/api/mp/create", {
      player: clientId,
      name: playerName(),
      mode: lobbyMode.value,
      seats: Number(lobbySeats.value),
      forfeit_sec: Number(lobbyForfeit.value),
    });
    lastRollSeq = 0;
    renderLobbyRoom(data);
    startMpPoll();
  } catch (err) {
    showLobbyMsg(err.message);
  }
}

async function joinMp(code) {
  savePlayerName();
  showLobbyMsg();
  try {
    const data = await api("/api/mp/join", {
      player: clientId,
      name: playerName(),
      room: code,
    });
    lastRollSeq = 0;
    renderLobbyRoom(data);
    startMpPoll();
  } catch (err) {
    showLobbyMsg(err.message);
  }
}

function renderStore(data) {
  storeWallet.textContent = fmtNum(data.wallet || 0);
  storeGrid.innerHTML = (data.items || [])
    .map((item) => {
      const label = item.owned ? "Owned" : "Buy";
      const disabled = item.owned || !item.affordable ? "disabled" : "";
      return `<article class="shop-tile" data-id="${item.id}">
        <span class="shop-kind">Sticker</span>
        <div class="shop-art"><img src="${item.image}" alt="${item.name}" /></div>
        <h3>${item.name}</h3>
        <p class="shop-price">${fmtNum(item.price)}</p>
        <button type="button" class="shop-buy" data-id="${item.id}" ${disabled}>${label}</button>
      </article>`;
    })
    .join("");
}

async function refreshStore() {
  storeMsg.hidden = true;
  try {
    renderStore(await api("/api/store"));
  } catch (err) {
    storeMsg.hidden = false;
    storeMsg.textContent = err.message;
  }
}

const STICKER_MIN_SCALE = 0.55;
const STICKER_MAX_SIDE = 240;

let decorItems = [];
let lastStickers = [];
let decorRemoveMode = false;
let placing = null;
let peelId = "";
let ringTimer = 0;

function stickerBox(natW, natH, scale) {
  const long = Math.max(natW, natH) || 1;
  const maxLong = Math.min(long, STICKER_MAX_SIDE);
  const k = (maxLong / long) * scale;
  return { w: Math.max(32, Math.round(natW * k)), h: Math.max(32, Math.round(natH * k)) };
}

function stickerSignature(items) {
  return (items || [])
    .map((item) => [item.id, item.image, item.x, item.y, item.z, item.scale, item.rotation, item.kind].join(":"))
    .join("|") + (decorRemoveMode ? "|peel" : "");
}

function sizeBoardSticker(img, item) {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return false;
  const box = stickerBox(natW, natH, Number(item.scale) || 1);
  img.style.width = `${box.w}px`;
  img.style.height = "auto";
  img.style.visibility = "visible";
  return true;
}

function paintStickers(items) {
  if (placing) return;
  if (items) lastStickers = items;
  const next = lastStickers || [];
  const sig = stickerSignature(next);
  if (stickerBoard.dataset.sig === sig && stickerBoard.childElementCount === next.length) return;
  stickerBoard.dataset.sig = sig;
  stickerBoard.replaceChildren();
  next.forEach((item) => {
    const img = document.createElement("img");
    img.className = "board-sticker";
    if (item.kind === "residue") img.classList.add("is-residue");
    else if (decorRemoveMode) img.classList.add("is-peelable");
    img.alt = "";
    img.draggable = false;
    img.dataset.id = item.id;
    img.dataset.kind = item.kind || "sticker";
    img.style.visibility = "hidden";
    img.style.width = `${STICKER_MAX_SIDE}px`;
    img.style.height = "auto";
    const rot = Number(item.rotation) || 0;
    img.style.left = `${(Number(item.x) || 0.5) * 100}%`;
    img.style.top = `${(Number(item.y) || 0.5) * 100}%`;
    img.style.zIndex = String(Number(item.z) || 0);
    img.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
    img.onload = () => sizeBoardSticker(img, item);
    img.src = item.image;
    stickerBoard.append(img);
    if (img.complete) sizeBoardSticker(img, item);
  });
}

stickerBoard.addEventListener("click", async (ev) => {
  if (placing) return;
  const mark = ev.target.closest(".board-sticker");
  if (!mark || !mark.dataset.id) return;
  ev.preventDefault();
  ev.stopPropagation();
  if (mark.classList.contains("is-residue")) {
    try {
      const data = await api("/api/residue/remove", { id: mark.dataset.id });
      paintStickers(data.stickers);
      if (!decorPanel.hidden) renderDecor(data);
    } catch {
      mark.remove();
    }
    return;
  }
  if (!decorRemoveMode) return;
  peelId = mark.dataset.id;
  peelConfirm.hidden = false;
});

function layoutPlacement() {
  if (!placing) return;
  const box = stickerBox(placing.natW, placing.natH, placing.scale);
  const ring = Math.max(box.w, box.h) * 1.22 + 18;
  placeItem.style.left = `${placing.x}px`;
  placeItem.style.top = `${placing.y}px`;
  placeImg.style.setProperty("--sticker-w", `${box.w}px`);
  placeImg.style.setProperty("--sticker-rot", `${placing.rotation}deg`);
  placeRing.style.setProperty("--ring", `${ring}px`);
  layoutBoardPreview(box);
}

function layoutBoardPreview(box) {
  if (!placing) return;
  let preview = document.getElementById("placePreview");
  if (!preview) {
    preview = document.createElement("img");
    preview.id = "placePreview";
    preview.className = "board-sticker";
    preview.alt = "";
    preview.draggable = false;
    stickerBoard.append(preview);
  }
  preview.src = placing.image;
  preview.style.left = `${(placing.x / window.innerWidth) * 100}%`;
  preview.style.top = `${(placing.y / window.innerHeight) * 100}%`;
  preview.style.width = `${box.w}px`;
  preview.style.height = "auto";
  preview.style.zIndex = "999";
  preview.style.transform = `translate(-50%, -50%) rotate(${placing.rotation}deg)`;
}

function showRotateRing() {
  placeRing.hidden = false;
  clearTimeout(ringTimer);
  ringTimer = setTimeout(() => {
    placeRing.hidden = true;
  }, 420);
}

function endPlacement() {
  placing = null;
  placeOverlay.hidden = true;
  document.body.classList.remove("is-placing");
  placeOverlay.classList.remove("is-dragging");
  placeRing.hidden = true;
  document.getElementById("placePreview")?.remove();
  stickerBoard.querySelectorAll(".board-sticker").forEach((el) => {
    el.hidden = false;
  });
}

function beginPlacement(item, clientX, clientY) {
  endPeelMode();
  showView("play");
  peelConfirm.hidden = true;
  placing = {
    id: item.id,
    image: item.image,
    name: item.name,
    x: clientX,
    y: clientY,
    scale: item.placed ? Number(item.scale) || 1 : 1,
    rotation: item.placed ? Number(item.rotation) || 0 : 0,
    natW: 240,
    natH: 240,
  };
  document.body.classList.add("is-placing");
  placeOverlay.hidden = false;
  placeImg.src = item.image;
  placeImg.alt = item.name;
  const pic = new Image();
  pic.onload = () => {
    if (!placing || placing.id !== item.id) return;
    placing.natW = pic.naturalWidth || 240;
    placing.natH = pic.naturalHeight || 240;
    layoutPlacement();
  };
  pic.src = item.image;
  layoutPlacement();
  stickerBoard.querySelectorAll(".board-sticker").forEach((el) => {
    el.hidden = el.dataset.id === item.id;
  });
}

function grabDecorSticker(ev, item) {
  ev.preventDefault();
  const startX = ev.clientX;
  const startY = ev.clientY;
  let live = false;
  const onMove = (moveEv) => {
    if (!live && Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY) > 7) {
      live = true;
      beginPlacement(item, moveEv.clientX, moveEv.clientY);
    } else if (live && placing) {
      placing.x = moveEv.clientX;
      placing.y = moveEv.clientY;
      layoutPlacement();
    }
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (!live) beginPlacement(item, window.innerWidth / 2, window.innerHeight / 2);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function renderDecor(data) {
  const items = data.items || [];
  decorItems = items;
  if (data.stickers) lastStickers = data.stickers;
  if (!decorRemoveMode) paintStickers(lastStickers);
  const shown = items.filter((row) => row.wear === "pristine");
  const placed = items.some((row) => row.placed);
  if (decorRemove) {
    decorRemove.disabled = !placed;
    decorRemove.textContent = "Remove sticker";
  }
  if (!items.length) {
    decorEmpty.hidden = false;
    decorEmpty.textContent = "No decorations yet. Visit the Store to buy stickers.";
    decorGrid.innerHTML = "";
    return;
  }
  if (!shown.length) {
    decorEmpty.hidden = false;
    decorEmpty.textContent = "Worn stickers stay on the table. Use Remove sticker to peel one off.";
    decorGrid.innerHTML = "";
    return;
  }
  decorEmpty.hidden = true;
  decorGrid.innerHTML = shown
    .map((item) => {
      const actions = item.can_edit
        ? `<div class="shop-actions"><button type="button" class="shop-edit" data-id="${item.id}">Edit</button></div>`
        : "";
      const hint = item.can_place
        ? `<p class="shop-hint">Click or drag to place</p>`
        : `<p class="shop-hint">Placed</p>`;
      const tileClass = ["shop-tile", item.can_place ? "is-placeable" : ""]
        .filter(Boolean)
        .join(" ");
      return `<article class="${tileClass}" data-id="${item.id}">
        <span class="shop-kind">Sticker</span>
        <div class="shop-art"><img src="${item.image}" alt="${item.name}" draggable="false" /></div>
        <h3>${item.name}</h3>
        <p class="shop-wear">${item.wear_label}</p>
        ${hint}
        ${actions}
      </article>`;
    })
    .join("");
}

async function refreshDecor() {
  try {
    renderDecor(await api("/api/decorations"));
  } catch {
    decorEmpty.hidden = false;
    decorEmpty.textContent = "Could not load decorations.";
    decorGrid.innerHTML = "";
  }
}

async function openStore() {
  closeMenu();
  endPeelMode();
  if (!storePanel.hidden) {
    showView(returnView);
    return;
  }
  if (currentView === "home" || currentView === "play" || currentView === "lobby" || currentView === "multiplay") {
    returnView = currentView;
  }
  showView("store");
  await refreshStore();
}

async function openDecor() {
  closeMenu();
  endPeelMode();
  if (!decorPanel.hidden) {
    showView(returnView);
    return;
  }
  if (currentView === "home" || currentView === "play" || currentView === "lobby" || currentView === "multiplay") {
    returnView = currentView;
  }
  showView("decor");
  await refreshDecor();
}

storeBtn.addEventListener("click", openStore);
decorBtn.addEventListener("click", openDecor);
storeBack.addEventListener("click", () => {
  endPeelMode();
  showView(returnView);
});
decorBack.addEventListener("click", () => {
  endPeelMode();
  showView(returnView);
});

function hasPlacedSticker() {
  return (lastStickers || []).some((row) => row.kind !== "residue");
}

function startPeelMode() {
  if (!hasPlacedSticker()) return;
  decorRemoveMode = true;
  peelId = "";
  peelConfirm.hidden = true;
  showView("play");
  document.body.classList.add("is-peeling");
  if (peelHint) peelHint.hidden = false;
  paintStickers(lastStickers);
}

function endPeelMode() {
  const was = decorRemoveMode;
  decorRemoveMode = false;
  peelId = "";
  peelConfirm.hidden = true;
  if (peelHint) peelHint.hidden = true;
  document.body.classList.remove("is-peeling");
  if (was) paintStickers(lastStickers);
}

if (decorRemove) {
  decorRemove.addEventListener("click", () => {
    if (!hasPlacedSticker()) return;
    startPeelMode();
  });
}

decorGrid.addEventListener("pointerdown", (ev) => {
  if (ev.target.closest("button")) return;
  const tile = ev.target.closest(".shop-tile");
  if (!tile) return;
  const item = decorItems.find((row) => row.id === tile.dataset.id);
  if (!item || !item.can_place) return;
  grabDecorSticker(ev, item);
});

decorGrid.addEventListener("click", (ev) => {
  const edit = ev.target.closest(".shop-edit");
  if (edit) {
    const item = decorItems.find((row) => row.id === edit.dataset.id);
    if (!item || !item.can_edit) return;
    const x = (Number(item.x) || 0.5) * window.innerWidth;
    const y = (Number(item.y) || 0.5) * window.innerHeight;
    beginPlacement(item, x, y);
  }
});

peelNo.addEventListener("click", () => {
  peelConfirm.hidden = true;
  peelId = "";
});

if (peelCancel) {
  peelCancel.addEventListener("click", () => {
    endPeelMode();
    showView("decor");
    renderDecor({ items: decorItems, stickers: lastStickers });
  });
}

peelYes.addEventListener("click", async () => {
  const id = peelId;
  peelConfirm.hidden = true;
  peelId = "";
  if (!id) return;
  try {
    const data = await api("/api/sticker/remove", { id });
    decorItems = data.items || [];
    lastStickers = data.stickers || [];
    if (!hasPlacedSticker()) endPeelMode();
    else paintStickers(lastStickers);
  } catch (err) {
    endPeelMode();
    showView("decor");
    decorEmpty.hidden = false;
    decorEmpty.textContent = err.message;
  }
});

placeImg.addEventListener("pointerdown", (ev) => {
  if (!placing || ev.button) return;
  ev.preventDefault();
  ev.stopPropagation();
  placeOverlay.classList.add("is-dragging");
  const dx = ev.clientX - placing.x;
  const dy = ev.clientY - placing.y;
  const onMove = (moveEv) => {
    placing.x = moveEv.clientX - dx;
    placing.y = moveEv.clientY - dy;
    layoutPlacement();
  };
  const onUp = () => {
    placeOverlay.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
});

placeScale.addEventListener("pointerdown", (ev) => {
  if (!placing) return;
  ev.preventDefault();
  ev.stopPropagation();
  const startDist = Math.hypot(ev.clientX - placing.x, ev.clientY - placing.y) || 1;
  const startScale = placing.scale;
  const onMove = (moveEv) => {
    const dist = Math.hypot(moveEv.clientX - placing.x, moveEv.clientY - placing.y);
    placing.scale = Math.min(1, Math.max(STICKER_MIN_SCALE, startScale * (dist / startDist)));
    layoutPlacement();
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
});

placeOverlay.addEventListener(
  "wheel",
  (ev) => {
    if (!placing) return;
    ev.preventDefault();
    placing.rotation = (placing.rotation + ev.deltaY * 0.18) % 360;
    if (placing.rotation < 0) placing.rotation += 360;
    layoutPlacement();
    showRotateRing();
  },
  { passive: false }
);

placeOk.addEventListener("click", async (ev) => {
  ev.stopPropagation();
  if (!placing) return;
  const payload = {
    id: placing.id,
    x: placing.x / window.innerWidth,
    y: placing.y / window.innerHeight,
    scale: placing.scale,
    rotation: placing.rotation,
  };
  try {
    const data = await api("/api/sticker/place", payload);
    endPlacement();
    paintStickers(data.stickers);
  } catch (err) {
    endPlacement();
    showView("decor");
    decorEmpty.hidden = false;
    decorEmpty.textContent = err.message;
  }
});

storeGrid.addEventListener("click", async (ev) => {
  const btn = ev.target.closest(".shop-buy");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  storeMsg.hidden = true;
  try {
    renderStore(await api("/api/buy", { id: btn.dataset.id }));
  } catch (err) {
    storeMsg.hidden = false;
    storeMsg.textContent = err.message;
    btn.disabled = false;
  }
});

statsBtn.addEventListener("click", async () => {
  closeMenu();
  endPeelMode();
  if (currentView === "store" || currentView === "decor" || currentView === "tutorial") {
    showView(returnView);
  }
  const opening = statsPanel.hidden;
  statsPanel.hidden = !opening;
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
  if (ev.key !== "Escape") return;
  closeMenu();
  if (placing) {
    endPlacement();
    return;
  }
  if (!peelConfirm.hidden) {
    peelConfirm.hidden = true;
    peelId = "";
    return;
  }
  if (decorRemoveMode) {
    endPeelMode();
    showView("decor");
    renderDecor({ items: decorItems, stickers: lastStickers });
    return;
  }
  peelConfirm.hidden = true;
  if (currentView === "tutorial") {
    showView("home");
    return;
  }
  if (currentView === "lobby") {
    if (mpRoom) leaveMp(false).then(() => {
      setLobbyScreen(false);
      startMpPoll();
    });
    else showView("home");
    return;
  }
  if (currentView === "multiplay") return;
  if (!storePanel.hidden || !decorPanel.hidden) showView(returnView);
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
    const data = mpRoom
      ? await api("/api/mp/arrange", mpPayload())
      : await api("/api/arrange", {});
    if (data.multiplayer) applyMpState(data);
    else applyState(data);
  } catch (err) {
    msgEl.textContent = err.message;
  }
}

function askConfirm(action, message, yesLabel) {
  confirmAction = action;
  if (confirmMsg) confirmMsg.textContent = message;
  confirmYes.textContent = yesLabel;
  confirmEl.classList.toggle("confirm-float", currentView !== "play");
  confirmEl.hidden = false;
}

function goHome() {
  closeMenu();
  if (placing) endPlacement();
  endPeelMode();
  if (mpRoom) {
    leaveMp(true);
    return;
  }
  showView("home");
}

function askAbandon() {
  if (busy || abandonBtn.disabled) return;
  closeMenu();
  wakeAttract(true).then(armAttract);
  if (mpRoom) {
    askConfirm("leave-mp", "Leave this multiplayer table?", "Leave");
    return;
  }
  askConfirm("abandon", "Are you sure?", "Abandon");
}

confirmNo.addEventListener("click", () => {
  confirmEl.hidden = true;
});

confirmYes.addEventListener("click", async () => {
  confirmEl.hidden = true;
  if (busy) return;
  if (confirmAction === "new") {
    await startFreshGame();
    return;
  }
  if (confirmAction === "leave-mp") {
    await leaveMp(true);
    return;
  }
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
if (homeBtn) homeBtn.addEventListener("click", goHome);
if (homeNew) {
  homeNew.addEventListener("click", () => {
    if (lastCanContinue) {
      askConfirm("new", "Start a new game? The current one will be abandoned.", "New game");
      return;
    }
    startFreshGame();
  });
}
if (homeContinue) {
  homeContinue.addEventListener("click", () => {
    showView("play");
  });
}
if (homeTutorial) {
  homeTutorial.addEventListener("click", () => showView("tutorial"));
}
if (tutorialBack) {
  tutorialBack.addEventListener("click", () => showView("home"));
}
if (homeMulti) homeMulti.addEventListener("click", openLobby);
if (lobbyBack) {
  lobbyBack.addEventListener("click", async () => {
    if (mpRoom) {
      await leaveMp(false);
      setLobbyScreen(false);
      showView("lobby");
      startMpPoll();
      await refreshLobbyList();
      return;
    }
    showView("home");
  });
}
if (lobbyCreateForm) lobbyCreateForm.addEventListener("submit", createMp);
function syncCreateForm() {
  const blitz = lobbyMode && lobbyMode.value === "blitz";
  if (lobbySeats) {
    if (blitz) lobbySeats.value = "2";
    lobbySeats.disabled = blitz;
  }
  if (lobbySeatsField) lobbySeatsField.hidden = !!blitz;
  if (lobbyForfeitField) lobbyForfeitField.hidden = !!blitz;
}

if (lobbyMode) {
  lobbyMode.addEventListener("change", () => {
    if (!lobbyForfeit) return;
    lobbyForfeit.value = lobbyMode.value === "blitz" ? "20" : "45";
    syncCreateForm();
  });
  syncCreateForm();
}
if (lobbyRooms) {
  lobbyRooms.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-join]");
    if (btn) joinMp(btn.dataset.join);
  });
}
if (lobbyReady) {
  lobbyReady.addEventListener("click", async () => {
    if (!mpRoom) return;
    try {
      const on = lobbyReady.textContent !== "Unready";
      applyMpState(await api("/api/mp/ready", mpPayload({ ready: on })));
    } catch (err) {
      showLobbyMsg(err.message);
    }
  });
}
if (lobbyLeave) {
  lobbyLeave.addEventListener("click", async () => {
    await leaveMp(false);
    setLobbyScreen(false);
    showView("lobby");
    startMpPoll();
    await refreshLobbyList();
  });
}
if (mpOverHome) {
  mpOverHome.addEventListener("click", () => {
    leaveMp(true);
  });
}
if (mpOverLobby) {
  mpOverLobby.addEventListener("click", async () => {
    await leaveMp(false);
    await openLobby();
  });
}
if (lobbyName) {
  lobbyName.addEventListener("change", savePlayerName);
}

showView("home");
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
