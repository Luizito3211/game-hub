(() => {
const stat = (label, value) => `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong></div>`;
const arcade = () => window.NeonArcade || {};

window.NeonGames ??= {};

class SnakeGame {
  init(container, onCoinsEarned) {
    this.container = container;
    this.onCoinsEarned = onCoinsEarned;
    const best = Number(localStorage.getItem("snake-best") || 0);
    this.container.innerHTML = `
      <div class="game-panel snake-wrap">
        <div class="stats">${stat("Score", "<span id='snakeScore'>0</span>")}${stat("Recorde", `<span id='snakeBest'>${best}</span>`)}${stat("Controle", "Setas/WASD")}</div>
        <canvas id="snakeCanvas" width="420" height="420"></canvas>
        <button class="primary-button" id="snakeRestart" type="button">Iniciar / Reiniciar</button>
      </div>`;
    this.canvas = this.container.querySelector("#snakeCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.scoreLabel = this.container.querySelector("#snakeScore");
    this.bestLabel = this.container.querySelector("#snakeBest");
    this.restartButton = this.container.querySelector("#snakeRestart");
    this.size = 21;
    this.tile = this.canvas.width / this.size;
    this.onKeyDown = this.onKeyDown.bind(this);
    this.startRound = this.startRound.bind(this);
  }

  start() {
    window.addEventListener("keydown", this.onKeyDown);
    this.restartButton.addEventListener("click", this.startRound);
    this.startRound();
  }

  destroy() {
    clearInterval(this.timer);
    window.removeEventListener("keydown", this.onKeyDown);
    this.restartButton.removeEventListener("click", this.startRound);
    this.container.innerHTML = "";
  }

  startRound() {
    this.snake = [{ x: 10, y: 10 }];
    this.apple = { x: 5, y: 5 };
    this.dir = { x: 1, y: 0 };
    this.nextDir = this.dir;
    this.score = 0;
    this.apples = 0;
    this.finished = false;
    this.scoreLabel.textContent = "0";
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 115);
    this.draw();
  }

  placeApple() {
    do {
      this.apple = { x: Math.floor(Math.random() * this.size), y: Math.floor(Math.random() * this.size) };
    } while (this.snake.some((p) => p.x === this.apple.x && p.y === this.apple.y));
  }

  tick() {
    this.dir = this.nextDir;
    const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };
    const crashed = head.x < 0 || head.y < 0 || head.x >= this.size || head.y >= this.size || this.snake.some((p) => p.x === head.x && p.y === head.y);
    if (crashed) {
      clearInterval(this.timer);
      if (!this.finished) {
        this.finished = true;
        const coins = this.apples * 12;
        if (coins > 0) this.onCoinsEarned(coins, "rodada de Snake finalizada");
      }
      arcade().showToast?.("Snake finalizado");
      return;
    }

    this.snake.unshift(head);
    if (head.x === this.apple.x && head.y === this.apple.y) {
      this.apples += 1;
      this.score += 10;
      this.scoreLabel.textContent = this.score;
      if (this.score > Number(localStorage.getItem("snake-best") || 0)) {
        localStorage.setItem("snake-best", String(this.score));
        this.bestLabel.textContent = this.score;
      }
      this.placeApple();
    } else {
      this.snake.pop();
    }
    this.draw();
  }

  draw() {
    this.ctx.fillStyle = "#f8fafc";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = "#d8e0ea";
    for (let i = 0; i <= this.size; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * this.tile, 0);
      this.ctx.lineTo(i * this.tile, this.canvas.height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * this.tile);
      this.ctx.lineTo(this.canvas.width, i * this.tile);
      this.ctx.stroke();
    }
    this.ctx.fillStyle = "#e68a00";
    this.ctx.fillRect(this.apple.x * this.tile + 3, this.apple.y * this.tile + 3, this.tile - 6, this.tile - 6);
    this.ctx.fillStyle = "#003366";
    this.snake.forEach((p) => this.ctx.fillRect(p.x * this.tile + 2, p.y * this.tile + 2, this.tile - 4, this.tile - 4));
  }

  onKeyDown(event) {
    const map = {
      ArrowUp: [0, -1],
      w: [0, -1],
      ArrowDown: [0, 1],
      s: [0, 1],
      ArrowLeft: [-1, 0],
      a: [-1, 0],
      ArrowRight: [1, 0],
      d: [1, 0],
    };
    if (!map[event.key]) return;
    event.preventDefault();
    const [x, y] = map[event.key];
    if (x + this.dir.x || y + this.dir.y) this.nextDir = { x, y };
  }
}

window.NeonGames.snake = SnakeGame;
})();
