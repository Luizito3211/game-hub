(() => {
const stat = (label, value) => `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong></div>`;
const arcade = () => window.NeonArcade || {};

window.NeonGames ??= {};

class ClickerGame {
  init(container, onCoinsEarned) {
    this.container = container;
    this.onCoinsEarned = onCoinsEarned;
    this.points = 0;
    this.perClick = 1;
    this.upgradeCost = 35;
    this.autoCost = 90;
    this.auto = 0;
    this.container.innerHTML = `
      <div class="game-panel clicker-core">
        <div class="stats">${stat("Pontos", "<span id='tapPoints'>0</span>")}${stat("Por clique", "<span id='tapPower'>1</span>")}${stat("Auto", "<span id='autoPower'>0</span>/s")}</div>
        <button class="tap-target" id="tapTarget" type="button">TAP</button>
        <div class="shop">
          <button class="primary-button" id="buyPower" type="button">Forca +1 - <span id="upgradeCost">35</span></button>
          <button class="primary-button" id="buyAuto" type="button">Auto +1/s - <span id="autoCost">90</span></button>
        </div>
      </div>`;
    this.tapButton = this.container.querySelector("#tapTarget");
    this.powerButton = this.container.querySelector("#buyPower");
    this.autoButton = this.container.querySelector("#buyAuto");
    this.onTap = this.onTap.bind(this);
    this.buyPower = this.buyPower.bind(this);
    this.buyAuto = this.buyAuto.bind(this);
  }

  start() {
    this.tapButton.addEventListener("click", this.onTap);
    this.powerButton.addEventListener("click", this.buyPower);
    this.autoButton.addEventListener("click", this.buyAuto);
    this.interval = setInterval(() => {
      if (this.auto) {
        this.points += this.auto;
        this.paint();
      }
    }, 1000);
    this.paint();
  }

  destroy() {
    clearInterval(this.interval);
    this.tapButton.removeEventListener("click", this.onTap);
    this.powerButton.removeEventListener("click", this.buyPower);
    this.autoButton.removeEventListener("click", this.buyAuto);
    this.container.innerHTML = "";
  }

  onTap() {
    this.points += this.perClick;
    if (this.points % 20 < this.perClick) this.onCoinsEarned(10, "combo tap");
    arcade().beep?.(440, 0.035, "square");
    this.paint();
  }

  buyPower() {
    if (this.points < this.upgradeCost) return;
    this.points -= this.upgradeCost;
    this.perClick += 1;
    this.upgradeCost = Math.ceil(this.upgradeCost * 1.55);
    this.onCoinsEarned(20, "upgrade comprado");
    this.paint();
  }

  buyAuto() {
    if (this.points < this.autoCost) return;
    this.points -= this.autoCost;
    this.auto += 1;
    this.autoCost = Math.ceil(this.autoCost * 1.65);
    this.onCoinsEarned(25, "auto tap instalado");
    this.paint();
  }

  paint() {
    this.container.querySelector("#tapPoints").textContent = this.points;
    this.container.querySelector("#tapPower").textContent = this.perClick;
    this.container.querySelector("#upgradeCost").textContent = this.upgradeCost;
    this.container.querySelector("#autoCost").textContent = this.autoCost;
    this.container.querySelector("#autoPower").textContent = this.auto;
  }
}

window.NeonGames.clicker = ClickerGame;
})();
