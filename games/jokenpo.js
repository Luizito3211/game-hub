(() => {
const stat = (label, value) => `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong></div>`;
const arcade = () => window.NeonArcade || {};

window.NeonGames ??= {};

class JokenpoGame {
  init(container, onCoinsEarned) {
    this.container = container;
    this.onCoinsEarned = onCoinsEarned;
    this.wins = 0;
    this.streak = 0;
    this.choices = ["Pedra", "Papel", "Tesoura"];
    this.beats = { Pedra: "Tesoura", Papel: "Pedra", Tesoura: "Papel" };
    this.container.innerHTML = `
      <div class="game-panel">
        <div class="stats">${stat("Vitorias", "<span id='rpsWins'>0</span>")}${stat("Streak", "<span id='rpsStreak'>0</span>")}${stat("Premio", "30 moedas/vitoria")}</div>
        <div class="rps-choices">${this.choices.map((c) => `<button class="choice-button" data-choice="${c}" type="button">${c}</button>`).join("")}</div>
        <div class="impact" id="impact">Escolha sua jogada</div>
      </div>`;
    this.onChoice = this.onChoice.bind(this);
  }

  start() {
    this.buttons = [...this.container.querySelectorAll(".choice-button")];
    this.buttons.forEach((button) => button.addEventListener("click", this.onChoice));
  }

  destroy() {
    this.buttons.forEach((button) => button.removeEventListener("click", this.onChoice));
    this.container.innerHTML = "";
  }

  onChoice(event) {
    const player = event.currentTarget.dataset.choice;
    const cpu = this.choices[Math.floor(Math.random() * this.choices.length)];
    const impact = this.container.querySelector("#impact");
    impact.classList.remove("hit");
    void impact.offsetWidth;
    impact.classList.add("hit");

    if (player === cpu) {
      impact.textContent = `${player} x ${cpu}: empate`;
      arcade().beep?.(260, 0.05, "sine");
      return;
    }

    if (this.beats[player] === cpu) {
      this.wins += 1;
      this.streak += 1;
      impact.textContent = `${player} quebra ${cpu}. Vitoria!`;
      this.container.querySelector("#rpsWins").textContent = this.wins;
      this.container.querySelector("#rpsStreak").textContent = this.streak;
      this.onCoinsEarned(30 + this.streak * 5, "streak de impacto");
      return;
    }

    this.streak = 0;
    this.container.querySelector("#rpsStreak").textContent = this.streak;
    impact.textContent = `${cpu} vence ${player}. Streak resetado.`;
  }
}

window.NeonGames.jokenpo = JokenpoGame;
})();
