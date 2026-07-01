import "./chihiros-doser-card-v3.js";

class ChihirosPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (!this._card) {
      this.innerHTML = `
        <style>
          :host {
            display: block;
            min-height: 100vh;
            background: var(--primary-background-color);
            color: var(--primary-text-color);
          }
          .chihiros-panel {
            width: 100%;
            box-sizing: border-box;
            padding: 12px;
          }
        </style>
        <main class="chihiros-panel">
          <chihiros-doser-card-v3></chihiros-doser-card-v3>
        </main>`;
      this._card = this.querySelector("chihiros-doser-card-v3");
      this._card.setConfig({
        default_tab: "doser",
        show_mac: true,
      });
    }
    if (this._hass) {
      this._card.hass = this._hass;
    }
  }
}

customElements.define("chihiros-panel", ChihirosPanel);
