window.ChihirosLedPanelMixin = (Base) => class extends Base {
  resolveLedDevices() {
    const configured = Array.isArray(this.config.led_devices) ? this.config.led_devices : null;
    const devices = configured && configured.length ? configured : [
      {
        id: "led_1",
        label: "Geraet 1",
        name: this.config.led_name || "Universal WRGB",
        address: this.config.led_address || "FF:D2:2C:EB:9A:E2",
        model: "WRGB",
        power_entity: this.config.led_power_entity || "",
        channels: [
          { id: 1, name: "Rot", color: "#ff4d4f", value: 80, entity: "" },
          { id: 2, name: "Gruen", color: "#39d353", value: 110, entity: "" },
          { id: 3, name: "Blau", color: "#2ea8ff", value: 101, entity: "" },
          { id: 4, name: "Weiss", color: "#f0f6fc", value: 100, entity: "" },
        ],
      },
      {
        id: "led_2",
        label: "Geraet 2",
        name: "RGB Light",
        address: "DEMO:LED:02",
        model: "RGB",
        power_entity: "",
        channels: [
          { id: 1, name: "Rot", color: "#ff4d4f", value: 80, entity: "" },
          { id: 2, name: "Gruen", color: "#39d353", value: 90, entity: "" },
          { id: 3, name: "Blau", color: "#2ea8ff", value: 95, entity: "" },
        ],
      },
      {
        id: "led_3",
        label: "Geraet 3",
        name: "Single Channel",
        address: "DEMO:LED:03",
        model: "Dimmer",
        power_entity: "",
        channels: [
          { id: 1, name: "Helligkeit", color: "#f0f6fc", value: 70, entity: "" },
        ],
      },
    ];
    return devices.map((device, index) => ({
      id: String(device.id || `led_${index + 1}`),
      label: String(device.label || device.tab_name || device.name || `Geraet ${index + 1}`),
      name: String(device.name || `LED ${index + 1}`),
      address: String(device.address || ""),
      model: String(device.model || "LED"),
      power_entity: String(device.power_entity || ""),
      channels: Array.isArray(device.channels) && device.channels.length ? device.channels.map((channel, chIndex) => ({
        id: Number(channel.id || chIndex + 1),
        name: String(channel.name || `CH${chIndex + 1}`),
        color: String(channel.color || "#2ea8ff"),
        value: Number.isFinite(Number(channel.value)) ? Number(channel.value) : 0,
        entity: String(channel.entity || ""),
      })) : [],
    }));
  }

  applyLedDevice(deviceId) {
    const device = this.ledDevices.find((item) => item.id === deviceId) || this.ledDevices[0] || {};
    this.activeLedDeviceId = device.id || "led_1";
    this.activeLedDevice = device;
    this.ledChannels = device.channels || [];
  }

  setLedDevice(deviceId) {
    if (deviceId === this.activeLedDeviceId) return;
    this.dialogState = null;
    this.applyLedDevice(deviceId);
    this.render();
  }

  ledDeviceTabs() {
    if (!this.ledDevices || this.ledDevices.length < 2) return "";
    const tabs = this.ledDevices.map((device) => `
        <button type="button" data-led-device="${this.escapeHtml(device.id)}" class="${device.id === this.activeLedDeviceId ? "active" : ""}">
          ${this.escapeHtml(device.label || device.name)}
        </button>`).join("");
    return `<nav class="doser-device-tabs" aria-label="LED Geraete">${tabs}</nav>`;
  }

  ledChannelValue(channel) {
    if (channel.entity && this._hass && this._hass.states[channel.entity]) {
      const parsed = Number.parseFloat(this._hass.states[channel.entity].state);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    return Math.max(0, Math.min(150, Math.round(Number(channel.value || 0))));
  }

  ledChannelCard(channel) {
    const value = this.ledChannelValue(channel);
    const action = channel.entity ? `more:${channel.entity}` : "";
    return `
      <section class="card led-channel" style="--led-color:${channel.color}">
        <h2>CH${channel.id} ${this.escapeHtml(channel.name)}<i></i></h2>
        <div class="led-channel-body">
          <ha-icon icon="mdi:led-strip-variant"></ha-icon>
          <strong>${value} %</strong>
        </div>
        <input type="range" min="0" max="150" step="1" value="${value}" data-led-number="${channel.entity}" data-led-device-channel="${channel.id}" ${channel.entity ? "" : ""}>
        <div class="led-actions">
          <button class="mini" data-action="${action || `led-local:${channel.id}`}" title="${this.tr("details")}"><ha-icon icon="mdi:tune"></ha-icon></button>
          <button class="mini" data-action="${action || `led-local:${channel.id}`}" title="${this.tr("save")}"><ha-icon icon="mdi:content-save-outline"></ha-icon></button>
          <button class="mini" data-action="${action || `led-local:${channel.id}`}" title="${this.tr("history")}"><ha-icon icon="mdi:chart-line"></ha-icon></button>
        </div>
      </section>`;
  }

  ledPanel() {
    const device = this.activeLedDevice || {};
    const channels = this.ledChannels || [];
    const columns = Math.max(1, Math.min(4, channels.length || 1));
    const showMac = this.uiSettings && this.uiSettings.showMac !== false;
    const macLine = showMac && device.address ? `<small>${this.escapeHtml(device.address)}</small>` : "";
    const powerAction = device.power_entity ? `press:${device.power_entity}` : `led-local-power:${this.activeLedDeviceId}`;
    return `
      ${this.ledDeviceTabs()}
      <div class="led-page">
        <section class="card led-device-card">
          <div class="led-device-head">
            <ha-icon icon="mdi:lightbulb-on-outline"></ha-icon>
            <div>
              <h2>${this.escapeHtml(device.name || "LED")}</h2>
              <span>${this.escapeHtml(device.model || "LED")}</span>
              ${macLine}
            </div>
            <b class="ok">${this.tr("online")}</b>
          </div>
          <button class="action-row" data-action="${powerAction}">
            <ha-icon icon="mdi:power"></ha-icon>
            <span>${this.tr("status")}</span>
            <b>${this.tr("on")}</b>
          </button>
          <button class="action-row" data-action="led-local-template:${this.activeLedDeviceId}">
            <ha-icon icon="mdi:playlist-star"></ha-icon>
            <span>Template laden</span>
            <b>${this.tr("change")}</b>
          </button>
        </section>
        <section class="card led-channels-card">
          <h2>Farbkanaele</h2>
          <div class="led-channels channels-${columns}" style="--channel-columns:${columns}">
            ${channels.map((channel) => this.ledChannelCard(channel)).join("")}
          </div>
        </section>
      </div>`;
  }
};
