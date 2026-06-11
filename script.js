const state = {
  coins: Number(localStorage.getItem("progresso-coins") || 0),
  discordUserId: localStorage.getItem("discord_user_id") || "discord-demo-user",
  sound: localStorage.getItem("neon-sound") !== "off",
  activeGame: null,
  activeGameId: null,
};

const API_BASE_URL = "";

const games = [
  {
    id: "platform",
    module: "platform",
    title: "Dash Platformer",
    icon: "2D",
    accent: "#E68A00",
    desc: "Duas fases, pulo fluido, dash aereo e colisao AABB.",
  },
  {
    id: "snake",
    module: "snake",
    title: "Snake",
    icon: "S",
    accent: "#E68A00",
    desc: "Canvas, velocidade crescente e recorde local.",
  },
  {
    id: "bullethell",
    module: "bullethell",
    title: "Bullet Hell",
    icon: "BH",
    accent: "#E68A00",
    desc: "Sobreviva aos projeteis em uma caixa de batalha.",
  },
  {
    id: "clicker",
    module: "clicker",
    title: "Tap Rush",
    icon: "TAP",
    accent: "#E68A00",
    desc: "Clique rapido, compre upgrades e gere pontos.",
  },
  {
    id: "jokenpo",
    module: "jokenpo",
    title: "RPS Impact",
    icon: "RPS",
    accent: "#E68A00",
    desc: "Pedra, papel e tesoura com sequencia de acertos.",
  },
  {
    id: "parkour",
    module: "parkour",
    title: "Parkour 3D",
    icon: "3D",
    accent: "#E68A00",
    desc: "Rigidbody, saltos, wall run e plataformas 3D.",
  },
];

const $ = (selector) => document.querySelector(selector);
const mount = $("#gameMount");
const coinBalance = $("#coinBalance");
const discordUserIdInput = $("#discordUserId");
const toast = $("#toast");
const particleCanvas = $("#particles");
const pctx = particleCanvas.getContext("2d");
let audioCtx;
let particles = [];

function updateBalance() {
  coinBalance.textContent = `${state.coins} Progresso Coins`;
}

async function earnCoins(amount, label = "moedas ganhas", game = "game-hub") {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return;
  state.coins += value;
  localStorage.setItem("progresso-coins", String(state.coins));
  updateBalance();
  showToast(`+${value} Progresso Coins - ${label}`);
  burstParticles();
  beep(760, 0.08, "triangle");
  await syncCoinsWithBackend({ amount: value, game });
}

// Future Discord economy integration: change API_BASE_URL when the bot backend is ready.
async function syncCoinsWithBackend({ amount, game }) {
  const payload = {
    discordId: state.discordUserId,
    amount,
    game,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/economy/add-coins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Falha ao sincronizar moedas: ${response.status}`);
    }

    return response.json().catch(() => null);
  } catch (error) {
    console.warn("Sincronizacao de moedas pendente.", { payload, error });
    return null;
  }
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
  earnCoins,
  showToast,
  beep,
};

function renderIcon(icon) {
  if (icon.length === 1) {
    return `<span class="icon-main">${icon}</span><span class="icon-dot" aria-hidden="true"></span>`;
  }

  return `<span class="icon-main">${icon.slice(0, -1)}</span><span class="icon-accent">${icon.slice(-1)}</span>`;
}

function renderCards() {
  $("#gameGrid").innerHTML = games.map((game) => `
    <button class="game-card" style="--accent:${game.accent}" data-game="${game.id}" type="button">
      <span class="game-icon">${renderIcon(game.icon)}</span>
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
      <span class="progress-symbol" data-label="GO">GO</span>
      <p>Escolha uma atividade para ganhar moedas, acompanhar seu saldo e explorar novos desafios.</p>
    </div>`;
}

async function loadGame(id) {
  destroyActiveGame();
  const game = games.find((item) => item.id === id);
  if (!game) return;

  state.activeGameId = id;
  setArena(game);
  mount.innerHTML = `<div class="empty-state"><span class="progress-symbol" data-label="...">...</span><p>Carregando ${game.title}</p></div>`;
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
    instance.init(mount, (amount, label) => earnCoins(amount, label, game.id));
    instance.start();
  } catch (error) {
    console.error(error);
    mount.innerHTML = `
      <div class="empty-state">
        <span class="progress-symbol" data-label="!">!</span>
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
      color: Math.random() > 0.5 ? "#003366" : "#E68A00",
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

discordUserIdInput.value = state.discordUserId;
discordUserIdInput.addEventListener("change", () => {
  state.discordUserId = discordUserIdInput.value.trim() || "discord-demo-user";
  localStorage.setItem("discord_user_id", state.discordUserId);
  discordUserIdInput.value = state.discordUserId;
  showToast("Discord ID atualizado");
});

$("#backButton").addEventListener("click", () => {
  destroyActiveGame();
  state.activeGameId = null;
  showEmptyArena();
});

window.addEventListener("resize", resizeParticles);
renderCards();
updateBalance();
resizeParticles();
animateParticles();
$("#soundToggle").textContent = state.sound ? "S" : "X";
