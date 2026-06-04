export default class ExampleGame {
  init(container, onXpGain) {
    this.container = container;
    this.onXpGain = onXpGain;
    this.container.innerHTML = `
      <div class="game-panel">
        <div class="stats">
          <div class="stat"><span class="stat-label">Status</span><strong>Pronto</strong></div>
        </div>
        <button class="primary-button" id="exampleButton" type="button">Ganhar XP</button>
      </div>`;
    this.button = this.container.querySelector("#exampleButton");
    this.handleClick = this.handleClick.bind(this);
  }

  start() {
    this.button.addEventListener("click", this.handleClick);
  }

  destroy() {
    this.button.removeEventListener("click", this.handleClick);
    this.container.innerHTML = "";
  }

  handleClick() {
    this.onXpGain(10, "exemplo modular");
  }
}
