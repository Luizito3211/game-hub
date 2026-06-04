const state = {
  xp: Number(localStorage.getItem("neon-xp") || 0),
  sound: localStorage.getItem("neon-sound") !== "off",
  activeGame: null,
  activeGameId: null,
};

const games = [
  {
    id: "platform",
    module: "platform",
    title: "Dash Platformer",
    icon: "2D",
    accent: "#24f7ff",
    desc: "Duas fases, pulo fluido, dash aereo e colisao AABB.",
  },
  {
    id: "snake",
    module: "snake",
    title: "Snake",
    icon: "S",
    accent: "#b9ff3d",
    desc: "Canvas, velocidade crescente e recorde local.",
  },
  {
    id: "bullethell",
    module: "bullethell",
    title: "Bullet Hell",
    icon: "BH",
    accent: "#ff2bd6",
    desc: "Sobreviva aos projeteis em uma caixa de batalha.",
  },
  {
    id: "clicker",
    module: "clicker",
    title: "Tap Rush",
    icon: "TAP",
    accent: "#ffd166",
    desc: "Clique rapido, compre upgrades e gere pontos.",
  },
  {
    id: "jokenpo",
    module: "jokenpo",
    title: "RPS Impact",
    icon: "RPS",
    accent: "#ff4d6d",
    desc: "Pedra, papel e tesoura com streak neon.",
  },
  {
    id: "parkour",
    module: "parkour",
    title: "Neon Parkour 3D",
    icon: "3D",
    accent: "#24f7ff",
    desc: "Rigidbody, saltos, wall run e plataformas neon.",
  },
];

const $ = (selector) => document.querySelector(selector);
const mount = $("#gameMount");
const levelLabel = $("#levelLabel");
const xpLabel = $("#xpLabel");
const xpFill = $("#xpFill");
const toast = $("#toast");
const particleCanvas = $("#particles");
const pctx = particleCanvas.getContext("2d");
let audioCtx;
let particles = [];

function levelFromXp(xp) {
  return Math.floor(xp / 300) + 1;
}

function updateXpUi() {
  const level = levelFromXp(state.xp);
  const inLevel = state.xp % 300;
  levelLabel.textContent = `Nivel ${level}`;
  xpLabel.textContent = `${state.xp} XP`;
  xpFill.style.width = `${(inLevel / 300) * 100}%`;
}

function addXp(amount, label = "XP ganho") {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return;
  state.xp += value;
  localStorage.setItem("neon-xp", String(state.xp));
  updateXpUi();
  showToast(`+${value} XP - ${label}`);
  burstParticles();
  beep(760, 0.08, "triangle");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function beep(freq = 420, duration = 0.05, type = "sine") {
  if (!state.sound) return;
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

window.NeonArcade = {
  addXp,
  showToast,
  beep,
};

function renderCards() {
  $("#gameGrid").innerHTML = games.map((game) => `
    <button class="game-card" style="--accent:${game.accent}" data-game="${game.id}" type="button">
      <span class="game-icon">${game.icon}</span>
      <span>
        <h3>${game.title}</h3>
        <p>${game.desc}</p>
      </span>
    </button>
  `).join("");

  document.querySelectorAll(".game-card").forEach((card) => {
    card.addEventListener("click", () => loadGame(card.dataset.game));
  });
}

function setArena(game) {
  $("#arenaTag").textContent = "Arena ativa";
  $("#gameTitle").textContent = game.title;
}

function showEmptyArena() {
  $("#arenaTag").textContent = "Dashboard";
  $("#gameTitle").textContent = "Selecione um jogo";
  mount.innerHTML = `
    <div class="empty-state">
      <span>GO</span>
      <p>Entre em qualquer card para ganhar XP global, subir de nivel e liberar feedback neon.</p>
    </div>`;
}

async function loadGame(id) {
  destroyActiveGame();
  const game = games.find((item) => item.id === id);
  if (!game) return;

  state.activeGameId = id;
  setArena(game);
  mount.innerHTML = `<div class="empty-state"><span>...</span><p>Carregando ${game.title}</p></div>`;
  beep(320, 0.06, "square");

  try {
    const GameClass = window.NeonGames?.[game.module];
    if (state.activeGameId !== id) return;
    if (typeof GameClass !== "function") {
      throw new Error(`Classe do jogo nao registrada: ${game.module}`);
    }

    const instance = new GameClass();
    validateGame(instance, game.title);
    state.activeGame = instance;
    instance.init(mount, addXp);
    instance.start();
  } catch (error) {
    console.error(error);
    mount.innerHTML = `
      <div class="empty-state">
        <span>!</span>
        <p>Este jogo nao carregou. Verifique o arquivo games/${game.module}.js.</p>
      </div>`;
  }
}

function validateGame(instance, title) {
  ["init", "start", "destroy"].forEach((method) => {
    if (typeof instance[method] !== "function") {
      throw new Error(`${title} precisa implementar ${method}().`);
    }
  });
}

function destroyActiveGame() {
  if (!state.activeGame) return;
  state.activeGame.destroy();
  state.activeGame = null;
}

function resizeParticles() {
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
}

function burstParticles() {
  const cx = window.innerWidth - 150;
  const cy = 90;
  for (let i = 0; i < 28; i++) {
    particles.push({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 7,
      vy: (Math.random() - 0.5) * 7,
      life: 48,
      color: Math.random() > 0.5 ? "#24f7ff" : "#ff2bd6",
    });
  }
}

function animateParticles() {
  pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particles = particles.filter((p) => p.life-- > 0);
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04;
    pctx.globalAlpha = Math.max(0, p.life / 48);
    pctx.fillStyle = p.color;
    pctx.fillRect(p.x, p.y, 4, 4);
  });
  pctx.globalAlpha = 1;
  requestAnimationFrame(animateParticles);
}

$("#soundToggle").addEventListener("click", () => {
  state.sound = !state.sound;
  localStorage.setItem("neon-sound", state.sound ? "on" : "off");
  $("#soundToggle").textContent = state.sound ? "S" : "X";
  showToast(state.sound ? "Sons ativados" : "Sons desligados");
  beep(520, 0.05, "triangle");
});

$("#backButton").addEventListener("click", () => {
  destroyActiveGame();
  state.activeGameId = null;
  showEmptyArena();
});

window.addEventListener("resize", resizeParticles);
renderCards();
updateXpUi();
resizeParticles();
animateParticles();
$("#soundToggle").textContent = state.sound ? "S" : "X";
