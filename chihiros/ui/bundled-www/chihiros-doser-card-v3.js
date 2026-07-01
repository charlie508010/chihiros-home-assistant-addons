import "./panels/chihiros-led-panel.js";

class ChihirosDoserCard extends window.ChihirosLedPanelMixin(HTMLElement) {
  setConfig(config) {
    this.config = config || {};
    const defaultChannels = this.config.channels || [
      { id: 1, name: "Nitrat", color: "#2ea8ff" },
      { id: 2, name: "Phosphat", color: "#39d353" },
      { id: 3, name: "Eisen", color: "#ff9300" },
      { id: 4, name: "Kalium", color: "#a855f7" },
    ];
    this.doserDevices = this.resolveDoserDevices(defaultChannels);
    this.activeDoserDeviceId = this.activeDoserDeviceId || (this.doserDevices[0] && this.doserDevices[0].id) || "device_1";
    this.applyDoserDevice(this.activeDoserDeviceId, false);
    this.ledDevices = this.resolveLedDevices();
    this.activeLedDeviceId = this.activeLedDeviceId || (this.ledDevices[0] && this.ledDevices[0].id) || "led_1";
    this.applyLedDevice(this.activeLedDeviceId);
    this.uiSettings = this.loadUiSettings();
    this.ctlDevice = this.ctlDevice || this.config.ctl_device || "doser_1";
    this.applyChannelNames();
    this.dialogState = this.dialogState || null;
    this.activeTab = this.activeTab || this.config.default_tab || "doser";
  }

  set hass(hass) {
    this._hass = hass;
    if (this.dialogState) return;
    this.render();
  }

  connectedCallback() {
    window.setTimeout(() => this.refreshDoserEntities(), 750);
  }

  getCardSize() {
    return 8;
  }

  language() {
    const uiLanguage = String((this.uiSettings && this.uiSettings.language) || "").toLowerCase();
    if (uiLanguage === "de" || uiLanguage === "en") return uiLanguage;
    const configured = String(this.config.language || "").toLowerCase();
    const hassLanguage = String(
      (this._hass && this._hass.locale && this._hass.locale.language) ||
      (this._hass && this._hass.language) ||
      ""
    ).toLowerCase();
    const lang = configured || hassLanguage;
    return lang.startsWith("en") ? "en" : "de";
  }

  uiSettingsKey() {
    return `chihiros-doser-card-v3:${String(this.deviceAddress || "default").toLowerCase()}:ui`;
  }

  loadUiSettings() {
    const defaults = {
      language: String(this.config.language || "").toLowerCase().startsWith("en") ? "en" : "de",
      showMac: this.config.show_mac !== false,
      channelNames: {},
      doserSafety: {
        maxAutoMl: 50.0,
        maxManualMl: 50.0,
        maxDailyMl: 250.0,
      },
    };
    try {
      const raw = window.localStorage.getItem(this.uiSettingsKey());
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch (_err) {
      return defaults;
    }
  }

  saveUiSettings() {
    try {
      window.localStorage.setItem(this.uiSettingsKey(), JSON.stringify(this.uiSettings || {}));
    } catch (_err) {
      // Local storage can be unavailable in restricted browser modes.
    }
  }

  resolveDoserDevices(defaultChannels) {
    const configured = Array.isArray(this.config.doser_devices)
      ? this.config.doser_devices
      : (Array.isArray(this.config.devices) ? this.config.devices : null);
    const devices = configured && configured.length ? configured : [
      {
        id: "device_1",
        label: "Geraet 1",
        name: this.config.name || "Geraet 1",
        address: this.config.address || "DF:2A:88:E7:8A:90",
        model: this.config.model || "Dosing Pump",
        entity_prefix: this.config.entity_prefix || "dydosedf2a88e78a90",
        container_full_ml: this.config.container_full_ml || 500,
        channels: defaultChannels,
      },
      {
        id: "device_2",
        label: "Geraet 2",
        name: "Geraet 2",
        address: "DEMO:DOSER:02",
        model: "Dosing Pump",
        entity_prefix: "dydoser2",
        container_full_ml: this.config.container_full_ml || 500,
        entities: {},
        channels: [
          { id: 1, name: "Calcium", color: "#2ea8ff" },
          { id: 2, name: "Magnesium", color: "#39d353" },
        ],
      },
      {
        id: "device_3",
        label: "Geraet 3",
        name: "Geraet 3",
        address: "DEMO:DOSER:03",
        model: "Dosing Pump",
        entity_prefix: "dydoser3",
        container_full_ml: this.config.container_full_ml || 500,
        entities: {},
        channels: [
          { id: 1, name: "KH", color: "#2ea8ff" },
        ],
      },
    ];
    return devices.map((device, index) => ({
      id: String(device.id || `device_${index + 1}`),
      label: String(device.label || device.tab_name || device.name || `Geraet ${index + 1}`),
      name: String(device.name || `Geraet ${index + 1}`),
      address: String(device.address || this.config.address || "DF:2A:88:E7:8A:90"),
      model: String(device.model || this.config.model || "Dosing Pump"),
      entity_prefix: String(device.entity_prefix || this.config.entity_prefix || "dydosedf2a88e78a90"),
      container_full_ml: Number(device.container_full_ml || this.config.container_full_ml || 500),
      entities: device.entities || (index === 0 ? this.config.entities : {}),
      channels: Array.isArray(device.channels) && device.channels.length ? device.channels : defaultChannels,
    }));
  }

  applyDoserDevice(deviceId, reloadSettings = true) {
    const device = this.doserDevices.find((item) => item.id === deviceId) || this.doserDevices[0] || {};
    this.activeDoserDeviceId = device.id || "device_1";
    this.activeDoserDevice = device;
    this.baseChannels = device.channels || [];
    this.channels = this.baseChannels;
    this.deviceName = device.name || this.config.name || "Chihiros Doser";
    this.deviceModel = device.model || this.config.model || "Dosing Pump";
    this.deviceAddress = device.address || this.config.address || "DF:2A:88:E7:8A:90";
    this.containerFullMl = Number(device.container_full_ml || this.config.container_full_ml || 500);
    if (reloadSettings) {
      this.uiSettings = this.loadUiSettings();
      this.applyChannelNames();
    }
  }

  setDoserDevice(deviceId) {
    if (deviceId === this.activeDoserDeviceId) return;
    this.dialogState = null;
    this.applyDoserDevice(deviceId, true);
    this.render();
    window.setTimeout(() => this.refreshDoserEntities(), 250);
  }

  doserSafetySettings() {
    const safety = (this.uiSettings && this.uiSettings.doserSafety) || {};
    const legacySingle = Number.parseFloat(safety.maxSingleMl);
    const maxAuto = Number.parseFloat(safety.maxAutoMl);
    const maxManual = Number.parseFloat(safety.maxManualMl);
    const maxDaily = Number.parseFloat(safety.maxDailyMl);
    return {
      maxAutoMl: Number.isFinite(maxAuto) ? maxAuto : (Number.isFinite(legacySingle) ? legacySingle : 50.0),
      maxManualMl: Number.isFinite(maxManual) ? maxManual : (Number.isFinite(legacySingle) ? legacySingle : 50.0),
      maxDailyMl: Number.isFinite(maxDaily) ? maxDaily : 250.0,
    };
  }

  saveDoserSafetySettings(maxAutoMl, maxManualMl, maxDailyMl) {
    this.uiSettings = this.uiSettings || {};
    this.uiSettings.doserSafety = {
      maxAutoMl: Number(maxAutoMl),
      maxManualMl: Number(maxManualMl),
      maxDailyMl: Number(maxDailyMl),
    };
    this.saveUiSettings();
  }

  applyChannelNames() {
    const names = (this.uiSettings && this.uiSettings.channelNames) || {};
    this.channels = this.baseChannels.map((channel) => ({
      ...channel,
      name: String(names[channel.id] || channel.name || "").trim() || channel.name,
    }));
  }

  tr(key) {
    const dict = {
      de: {
        unknown: "Unbekannt",
        press: "Druecken",
        start: "Start",
        change: "Aendern",
        edit: "Bearbeiten",
        details: "Details",
        close: "Schliessen",
        cancel: "Abbrechen",
        save: "Speichern",
        on: "an",
        off: "aus",
        led: "LED",
        doser: "Doser",
        ruehrer: "Ruehrer",
        heizer: "Heizer",
        config: "Config",
        ctl: "CTL",
        display: "Anzeige",
        language_label: "Sprache",
        language_de: "Deutsch",
        language_en: "Englisch",
        show_mac: "MAC-Adresse anzeigen",
        channel_names: "Kanalnamen",
        ctl_commands: "CTL Befehle",
        copy_command: "Befehl kopieren",
        command_copied: "Befehl kopiert",
        no_entities: "Keine passenden Home-Assistant-Entities gefunden.",
        fetch_data: "Daten holen",
        read_daily: "Tageswerte lesen",
        catch_up: "Nachholen",
        catch_up_edit: "Nachholen bearbeiten",
        catch_up_timer_status: "Naechster Nachhol-Lauf",
        status: "Status",
        calibrate: "Kalibrieren",
        calibrate_channel: "kalibrieren",
        next: "Weiter",
        step_label: "Schritt",
        manual: "Manuell",
        automatic: "Automatisch",
        daily_amounts: "Tagesmengen",
        container: "Behaelter",
        container_volume: "Behaelter Volumen",
        active: "Aktiv",
        today: "Heute",
        time: "Zeit",
        planned_amount: "Planmenge",
        history: "Historie",
        history_total: "Historie gesamt",
        no_history: "Noch keine Doser-Aktionen gespeichert",
        dose: "Dosieren",
        dose_now: "Direkt dosieren",
        schedule_title: "Doser Zeitplan",
        channel: "Kanal",
        schedule: "Zeitplan",
        scheduler: "Scheduler",
        amount: "Menge",
        weekdays: "Wochentage",
        actions: "Aktionen",
        single_dose: "Einzeldosis",
        interval: "Intervall",
        interval_minutes: "Intervall Minuten",
        timer_list: "Timerliste",
        time_window: "Zeitfenster",
        everyday: "taeglich",
        reset: "Zuruecksetzen",
        reset_schedule: "Zeitplan zuruecksetzen",
        reset_schedule_question: "Soll der Zeitplan fuer diesen Kanal wirklich zurueckgesetzt werden?",
        reset_schedule_effect: "Dabei wird der Scheduler fuer diesen Kanal am Geraet deaktiviert und lokal geloescht. Der Sendestatus wird in der Datenbank gespeichert.",
        reset_schedule_yes: "Ja, zuruecksetzen",
        reset_schedule_no: "Nein, behalten",
        valid_from_tomorrow: "Plan gueltig ab morgen",
        valid_from_tomorrow_note: "Sendet den Zeitplan mit App-Flag mode27[3]=1. Nutzen, wenn der Kanal heute bereits automatisch dosiert hat.",
        auto_limit_reached: "Automatik Limit erreicht",
        auto_limit_reached_note: "Zeitplan wird als gueltig ab morgen gesendet.",
        settings: "Schutz & Einstellungen",
        overdose: "Ueberdosierungsschutz",
        auto_limit: "Automatisch Limit",
        manual_limit: "Manuell Limit pro Kanal",
        daily_limit: "Tagesmenge Limit",
        manual_limit_note: "0.00 mL sperrt manuelle Dosierung komplett.",
        safety_edit: "Ueberdosierungsschutz bearbeiten",
        max_auto_ml: "Automatisch Limit",
        max_manual_ml: "Manuell Limit pro Kanal",
        max_daily_ml: "Maximale Tagesdosis",
        auto_fill: "Auto Befuellen",
        threshold: "Schwellwert",
        low_container_push: "Push bei niedrigem Behaelter",
        auto_fill_edit: "Auto Befuellen bearbeiten",
        push_targets: "Push-Geraete",
        push_target_1: "Push-Geraet 1",
        push_target_2: "Push-Geraet 2",
        push_target_3: "Push-Geraet 3",
        no_push_target: "Kein Zusatzgeraet",
        push_message: "Push-Nachricht",
        push_message_hint: "Platzhalter: {ch}, {channel}, {device}, {remaining}, {threshold}",
        connection: "Verbindung",
        device: "Geraet",
        model: "Modell",
        source: "Quelle",
        online: "Online",
        prepare: "Vorbereiten",
        prepare_text: "Schlauch in Messbecher legen und Messbecher leeren.",
        start_sequence: "Startsequenz senden",
        start_sequence_text: "Pumpe laufen lassen, bis die Kalibrier-Menge im Messbecher ist.",
        measured_save: "Gemessene Menge speichern",
        measured_amount: "Gemessene Menge in mL",
        optional_check: "Optional pruefen",
        send_test: "Danach Testdosierung senden",
        test_amount: "Testmenge in mL",
        save_calibration: "Kalibrierwert speichern",
        calibration_failed: "Kalibrierung fehlgeschlagen",
        enter_measured: "Bitte die gemessene Menge eintragen.",
        schedule_edit: "Zeitplan bearbeiten",
        debug_output: "Debug Ausgabe",
        result_output: "Rueckmeldung",
        debug_capture: "Debug-Ausgabe anzeigen",
        debug_sending: "Sende Zeitplan an das Geraet...",
        debug_empty: "Keine Debug-Ausgabe zurueckgegeben.",
        container_edit: "Behaelter bearbeiten",
        manual_dose: "Manuell dosieren",
        manual_blocked: "Manuell gesperrt",
        mode: "Modus",
        next_time: "Naechste Zeit",
        auto_today: "Automatisch heute",
        manual_today: "Manuell heute",
        today_total: "Heute gesamt",
      },
      en: {
        unknown: "Unknown",
        press: "Press",
        start: "Start",
        change: "Change",
        edit: "Edit",
        details: "Details",
        close: "Close",
        cancel: "Cancel",
        save: "Save",
        on: "on",
        off: "off",
        led: "LED",
        doser: "Doser",
        ruehrer: "Stirrer",
        heizer: "Heater",
        config: "Config",
        ctl: "CTL",
        display: "Display",
        language_label: "Language",
        language_de: "German",
        language_en: "English",
        show_mac: "Show MAC address",
        channel_names: "Channel names",
        ctl_commands: "CTL commands",
        copy_command: "Copy command",
        command_copied: "Command copied",
        no_entities: "No matching Home Assistant entities found.",
        fetch_data: "Fetch data",
        read_daily: "Read daily values",
        catch_up: "Catch-up",
        catch_up_edit: "Edit catch-up",
        catch_up_timer_status: "Next catch-up run",
        status: "Status",
        calibrate: "Calibrate",
        calibrate_channel: "calibrate",
        next: "Next",
        step_label: "Step",
        manual: "Manual",
        automatic: "Automatic",
        daily_amounts: "Daily amounts",
        container: "Container",
        container_volume: "Container volume",
        active: "Active",
        today: "Today",
        time: "Time",
        planned_amount: "Planned amount",
        history: "History",
        history_total: "Full history",
        no_history: "No doser actions saved yet",
        dose: "Dose",
        dose_now: "Dose now",
        schedule_title: "Doser schedule",
        channel: "Channel",
        schedule: "Schedule",
        scheduler: "Scheduler",
        amount: "Amount",
        weekdays: "Weekdays",
        actions: "Actions",
        single_dose: "Single dose",
        interval: "Interval",
        interval_minutes: "Interval minutes",
        timer_list: "Timer list",
        time_window: "Time window",
        everyday: "daily",
        reset: "Reset",
        reset_schedule: "Reset schedule",
        reset_schedule_question: "Do you really want to reset the schedule for this channel?",
        reset_schedule_effect: "This disables the scheduler for this channel on the device and removes it locally. The send status is stored in the database.",
        reset_schedule_yes: "Yes, reset",
        reset_schedule_no: "No, keep it",
        valid_from_tomorrow: "Plan valid from tomorrow",
        valid_from_tomorrow_note: "Sends the schedule with app flag mode27[3]=1. Use this when the channel already dosed automatically today.",
        auto_limit_reached: "Automatic limit reached",
        auto_limit_reached_note: "Schedule will be sent as valid from tomorrow.",
        settings: "Protection & settings",
        overdose: "Overdose protection",
        auto_limit: "Automatic limit",
        manual_limit: "Manual limit per channel",
        daily_limit: "Daily limit",
        manual_limit_note: "0.00 mL blocks manual dosing completely.",
        safety_edit: "Edit overdose protection",
        max_auto_ml: "Automatic limit",
        max_manual_ml: "Manual limit per channel",
        max_daily_ml: "Max daily dose",
        auto_fill: "Auto refill",
        threshold: "Threshold",
        low_container_push: "Low container push",
        auto_fill_edit: "Edit auto refill",
        push_targets: "Push devices",
        push_target_1: "Push device 1",
        push_target_2: "Push device 2",
        push_target_3: "Push device 3",
        no_push_target: "No extra device",
        push_message: "Push message",
        push_message_hint: "Placeholders: {ch}, {channel}, {device}, {remaining}, {threshold}",
        connection: "Connection",
        device: "Device",
        model: "Model",
        source: "Source",
        online: "Online",
        prepare: "Prepare",
        prepare_text: "Place the tube in a measuring cup and empty the cup.",
        start_sequence: "Send start sequence",
        start_sequence_text: "Run the pump until the calibration amount is in the measuring cup.",
        measured_save: "Save measured amount",
        measured_amount: "Measured amount in mL",
        optional_check: "Optional check",
        send_test: "Send test dose afterwards",
        test_amount: "Test amount in mL",
        save_calibration: "Save calibration value",
        calibration_failed: "Calibration failed",
        enter_measured: "Enter the measured amount.",
        schedule_edit: "Edit schedule",
        debug_output: "Debug output",
        result_output: "Response",
        debug_capture: "Show debug output",
        debug_sending: "Sending schedule to device...",
        debug_empty: "No debug output returned.",
        container_edit: "Edit container",
        manual_dose: "Manual dose",
        manual_blocked: "Manual blocked",
        mode: "Mode",
        next_time: "Next time",
        auto_today: "Automatic today",
        manual_today: "Manual today",
        today_total: "Today total",
      },
    };
    const lang = this.language();
    return (dict[lang] && dict[lang][key]) || dict.de[key] || key;
  }

  channelSlug(ch) {
    const channel = this.baseChannels.find((item) => item.id === Number(ch));
    const name = channel ? channel.name : "";
    const suffix = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    return suffix ? `ch${ch}_${suffix}` : `ch${ch}`;
  }

  entityMap() {
    if (this.activeDoserDevice && this.activeDoserDevice.entities) return this.activeDoserDevice.entities;
    return this.config.entities || {};
  }

  entityPrefix() {
    return String(
      (this.activeDoserDevice && this.activeDoserDevice.entity_prefix) ||
      this.config.entity_prefix ||
      "dydosedf2a88e78a90"
    ).toLowerCase();
  }

  entity(prefix, ch, suffix) {
    const map = this.entityMap();
    const key = `${prefix}${ch}_${suffix}`;
    if (map[key]) return map[key];
    const mac = this.entityPrefix();
    if (prefix === "sensor") return `sensor.${mac}_${this.channelSlug(ch)}_${suffix}`;
    return "";
  }

  entities(ch) {
    const map = this.entityMap();
    const mac = this.entityPrefix();
    const slug = this.channelSlug(ch);
    return {
      daily: this.entity("sensor", ch, "daily_dose"),
      autoDaily: this.entity("sensor", ch, "auto_daily_dose"),
      manualDaily: this.entity("sensor", ch, "manual_daily_dose"),
      remainingSensor: this.entity("sensor", ch, "remaining"),
      scheduleTimeSensor: this.entity("sensor", ch, "schedule_time"),
      scheduleDoseSensor: this.entity("sensor", ch, "schedule_amount"),
      active: map[`switch${ch}_active`] || `switch.${mac}_${slug}_schedule_active`,
      scheduleDose: map[`number${ch}_schedule_amount`] || `number.${mac}_${slug}_schedule_amount`,
      remaining: map[`number${ch}_remaining`] || `number.${mac}_${slug}_remaining_volume`,
      manual: map[`number${ch}_manual`] || `number.${mac}_pump_${ch}_dose_volume`,
      doseNow: map[`button${ch}_dose_now`] || `button.${mac}_dose_pump_${ch}`,
      reset: map[`button${ch}_reset`] || `button.${mac}_${slug}_reset_schedule`,
      calibrate: map[`button${ch}_calibrate`] || `button.${mac}_${slug}_start_calibration`,
    };
  }

  historyEntity() {
    const map = this.entityMap();
    const mac = this.entityPrefix();
    return map.history || `sensor.${mac}_doser_history`;
  }

  timerStatusEntity() {
    const map = this.entityMap();
    const mac = this.entityPrefix();
    return map.timer_status || `sensor.${mac}_doser_timer_status`;
  }

  lowContainerNotificationSwitch() {
    const map = this.entityMap();
    const mac = this.entityPrefix();
    return map.low_container_notification || `switch.${mac}_low_container_notification`;
  }

  lowContainerPushSettings() {
    const entity = this.historyEntity();
    const attrs = this._hass && this._hass.states[entity] ? this._hass.states[entity].attributes : {};
    const targets = Array.isArray(attrs.low_container_push_targets) ? attrs.low_container_push_targets : [];
    return {
      enabled: typeof attrs.low_container_push_enabled === "boolean" ? attrs.low_container_push_enabled : this.isOn(this.lowContainerNotificationSwitch()),
      targets: targets.map((target) => String(target || "").replace(/^notify\./, "")).filter(Boolean).slice(0, 3),
      message: String(attrs.low_container_push_message || "{ch} {channel}: nur noch {remaining} mL im Behaelter. Schwellwert: {threshold} mL."),
    };
  }

  notifyServices() {
    const services = this._hass && this._hass.services && this._hass.services.notify ? this._hass.services.notify : {};
    return Object.keys(services)
      .filter((service) => service && service !== "persistent_notification")
      .sort((a, b) => a.localeCompare(b));
  }

  notifyOptions(selected = "") {
    const services = this.notifyServices();
    const value = String(selected || "").replace(/^notify\./, "");
    if (value && !services.includes(value)) services.unshift(value);
    return [
      `<option value="">${this.tr("no_push_target")}</option>`,
      ...services.map((service) => `<option value="${this.escapeHtml(service)}" ${service === value ? "selected" : ""}>notify.${this.escapeHtml(service)}</option>`),
    ].join("");
  }

  state(entity) {
    if (!entity || !this._hass || !this._hass.states[entity]) return this.tr("unknown");
    const obj = this._hass.states[entity];
    if (obj.state === "unknown" || obj.state === "unavailable") return this.tr("unknown");
    const unit = obj.attributes.unit_of_measurement || "";
    return unit ? `${obj.state} ${unit}` : obj.state;
  }

  stateFallback(entity, fallbackEntity, fallbackText = "0.0 mL") {
    const value = this.state(entity);
    if (value !== this.tr("unknown")) return value;
    if (fallbackEntity) {
      const fallback = this.state(fallbackEntity);
      if (fallback !== this.tr("unknown")) return fallback;
    }
    return fallbackText;
  }

  numericState(entity, fallback = "1.0") {
    if (!entity || !this._hass || !this._hass.states[entity]) return fallback;
    const value = Number.parseFloat(this._hass.states[entity].state);
    return Number.isFinite(value) ? value.toFixed(1) : fallback;
  }

  numericValue(entity, fallback = 0) {
    if (!entity || !this._hass || !this._hass.states[entity]) return fallback;
    const value = Number.parseFloat(this._hass.states[entity].state);
    return Number.isFinite(value) ? value : fallback;
  }

  autoLimitReached(e) {
    const safety = this.doserSafetySettings();
    return this.numericValue(e.autoDaily, 0) >= safety.maxAutoMl;
  }

  rawState(entity, fallback = "") {
    if (!entity || !this._hass || !this._hass.states[entity]) return fallback;
    const value = this._hass.states[entity].state;
    if (value === "unknown" || value === "unavailable") return fallback;
    return value;
  }

  stateAttr(entity, attr, fallback = "") {
    if (!entity || !this._hass || !this._hass.states[entity]) return fallback;
    const value = this._hass.states[entity].attributes[attr];
    if (value === undefined || value === null || value === "") return fallback;
    return String(value);
  }

  scheduleKindFromId(timeEntity) {
    const typeId = Number.parseInt(this.stateAttr(timeEntity, "schedule_type_id", "1"), 10);
    const kinds = {
      1: "single_dose",
      2: "interval",
      3: "timer",
      4: "window",
    };
    return kinds[typeId] || "single_dose";
  }

  scheduleKindLabel(timeEntity) {
    const value = this.scheduleKindFromId(timeEntity);
    const labels = {
      single_dose: this.tr("single_dose"),
      interval: this.tr("interval"),
      timer: this.tr("timer_list"),
      window: this.tr("time_window"),
    };
    return labels[value] || value || this.tr("single_dose");
  }

  setNumber(entity, value) {
    const number = Number.parseFloat(value);
    if (!entity || !this._hass || !Number.isFinite(number)) return;
    this._hass.callService("number", "set_value", { entity_id: entity, value: number });
  }

  isOn(entity) {
    return this._hass && this._hass.states[entity] && this._hass.states[entity].state === "on";
  }

  press(entity) {
    if (!entity || !this._hass) return;
    const [domain] = entity.split(".");
    if (domain === "button") {
      this._hass.callService("button", "press", { entity_id: entity });
    } else if (domain === "switch") {
      this._hass.callService("switch", "toggle", { entity_id: entity });
    } else if (domain === "light") {
      this._hass.callService("light", "toggle", { entity_id: entity });
    }
  }

  async callChihiros(service, data = {}, returnResponse = false) {
    if (!this._hass) return;
    const serviceData = {
      address: this.deviceAddress,
      ...data,
    };
    if (returnResponse && this._hass.connection && this._hass.connection.sendMessagePromise) {
      return await this._hass.connection.sendMessagePromise({
        type: "call_service",
        domain: "chihiros",
        service,
        service_data: serviceData,
        return_response: true,
      });
    }
    return await this._hass.callService("chihiros", service, {
      ...serviceData,
    }, undefined, true, returnResponse);
  }

  serviceResponse(response) {
    let value = response && response.response ? response.response : response;
    if (value && typeof value === "object" && !value.debug_output && !value.send_status && !value.send_detail) {
      if (value.chihiros && typeof value.chihiros === "object") value = value.chihiros;
      const keys = Object.keys(value);
      if (keys.length === 1 && value[keys[0]] && typeof value[keys[0]] === "object") value = value[keys[0]];
    }
    return value;
  }

  serviceResultOutput(service, response, debug = false) {
    const serviceResponse = this.serviceResponse(response);
    if (debug && serviceResponse && serviceResponse.debug_output) return serviceResponse.debug_output;
    const ok = !serviceResponse || !serviceResponse.send_status || serviceResponse.send_status === "ok";
    return [
      ok ? "OK" : "FAIL",
      `Service: chihiros.${service}`,
      serviceResponse && serviceResponse.send_status ? `Status: ${serviceResponse.send_status}` : "",
      serviceResponse && serviceResponse.send_detail ? `Antwort: ${serviceResponse.send_detail}` : "",
    ].filter(Boolean).join("\n") || this.tr("debug_empty");
  }

  async callChihirosWithDialog(service, data = {}, options = {}) {
    const channel = Number(options.channel || data.pump || 1);
    const debug = Boolean(options.debug);
    this.dialogState = { type: "debug", channel, output: this.tr("debug_sending"), running: true, debug, noChannel: Boolean(options.noChannel), level: "pending" };
    this.render();
    try {
      const response = await this.callChihiros(service, data, Boolean(options.returnResponse));
      const output = this.serviceResultOutput(service, response, debug);
      this.dialogState = {
        type: "debug",
        channel,
        output,
        debug,
        noChannel: Boolean(options.noChannel),
        running: false,
        level: output.trim().startsWith("FAIL") ? "error" : "ok",
      };
      this.render();
      return response;
    } catch (err) {
      this.dialogState = {
        type: "debug",
        channel,
        output: `FAIL\nService: chihiros.${service}\n${err && err.message ? err.message : err}`,
        debug,
        noChannel: Boolean(options.noChannel),
        running: false,
        level: "error",
      };
      this.render();
      return null;
    }
  }

  escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async refreshHistory() {
    const entity = this.historyEntity();
    if (!this._hass || !entity) return;
    await this._hass.callService("homeassistant", "update_entity", { entity_id: entity });
    window.setTimeout(() => this.render(), 350);
  }

  async refreshChannelEntities(channel) {
    if (!this._hass) return;
    const e = this.entities(channel);
    const entityIds = [
      this.historyEntity(),
      e.daily,
      e.autoDaily,
      e.manualDaily,
      e.remainingSensor,
      e.scheduleTimeSensor,
      e.scheduleDoseSensor,
      e.active,
    ].filter(Boolean);
    await this._hass.callService("homeassistant", "update_entity", { entity_id: entityIds });
    window.setTimeout(() => this.render(), 350);
  }

  doserRefreshEntities() {
    const ids = [this.historyEntity(), this.timerStatusEntity()];
    this.channels.forEach((ch) => {
      const e = this.entities(ch.id);
      ids.push(
        e.daily,
        e.autoDaily,
        e.manualDaily,
        e.remainingSensor,
        e.scheduleTimeSensor,
        e.scheduleDoseSensor,
        e.active,
      );
    });
    return [...new Set(ids.filter(Boolean))];
  }

  async refreshDoserEntities() {
    if (!this._hass || this._doserRefreshRunning) return;
    this._doserRefreshRunning = true;
    try {
      await this._hass.callService("homeassistant", "update_entity", { entity_id: this.doserRefreshEntities() });
      if (!this.dialogState) window.setTimeout(() => this.render(), 250);
    } catch (_err) {
      // Ignore refresh failures; Home Assistant will keep the last pushed state.
    } finally {
      this._doserRefreshRunning = false;
    }
  }

  ctlCommandGroups() {
    return [
      {
        title: "Doser",
        prefix: "chihirosctl doser",
        commands: [
          "gui",
          "read-dosing-auto",
          "read-dosing-container",
          "show-schedules",
          "clear-schedule",
          "set-schedule-active",
          "enable-schedule",
          "disable-schedule",
          "reset-schedule-device",
          "show-auto-totals",
          "read-auto-totals",
          "wait-auto-totals",
          "watch-auto-totals",
          "show-manual-totals",
          "show-daily-totals",
          "set-auto-total",
          "clear-auto-totals",
          "remove-setting",
          "reset-settings",
          "set-dosing-pump-manuell-ml",
          "calibration-start-sequence",
          "enable-auto-mode-dosing-pump",
          "add-setting-dosing-pump",
          "probe-totals",
          "show-containers",
          "set-container",
          "add-container",
          "show-history",
          "clear-history",
        ],
      },
      {
        title: "LED",
        prefix: "chihirosctl led",
        commands: [
          "list-devices",
          "turn-on",
          "turn-off",
          "set-color-brightness",
          "set-brightness",
          "set-rgb-brightness",
          "add-setting",
          "add-rgb-setting",
          "delete-setting",
          "reset-settings",
          "enable-auto-mode",
          "enable-manual-mode",
          "gui",
        ],
      },
      {
        title: "Ruehrer",
        prefix: "chihirosctl magstirrer",
        commands: [
          "show",
          "set-channel-name",
          "show-channel-names",
          "set-power",
          "run-for",
          "enable-auto-mode",
          "set-timers",
          "clear-timers",
          "set-runtime-speed",
          "add-setting",
          "enable-schedule",
          "disable-schedule",
          "show-schedules",
          "clear-schedules",
          "decode-frame",
        ],
      },
      {
        title: "Config",
        prefix: "chihirosctl config",
        commands: [
          "set-language",
          "show-language",
          "delete-language",
          "set-device",
          "show-device",
          "delete-device",
          "set-doser",
          "show-doser",
          "delete-doser",
          "set-led",
          "show-led",
          "delete-led",
          "set-magstirrer",
          "show-magstirrer",
          "delete-magstirrer",
          "set-doser-safety",
          "show-doser-safety",
          "delete-doser-safety",
          "set-doser-magstirrer-link",
          "set-doser-magstirrer-link-active",
          "show-magstirrer-defaults",
          "set-magstirrer-defaults",
          "set-magstirrer-runtime",
          "delete-magstirrer-runtime",
          "show-magstirrer-runtime",
          "show-doser-magstirrer-links",
          "delete-doser-magstirrer-link",
          "db-info",
          "db-migrate",
          "list-profiles",
          "set-device-name",
          "delete-device-name",
          "set-device-model",
          "delete-device-model",
          "set-channel-name",
          "delete-channel-name",
          "show-local-names",
        ],
      },
      {
        title: "Template",
        prefix: "chihirosctl template",
        commands: [
          "load-template-standart",
          "set-template-standart",
          "create-standard-template",
          "set-template",
          "create-template",
          "load-template",
          "delete-template",
          "show",
          "list-templates",
          "list-standard-templates",
          "delete-standard-template",
          "set-on-preset",
          "show-on-preset",
          "clear-on-preset",
        ],
      },
      {
        title: "Wireshark",
        prefix: "chihirosctl wireshark",
        commands: [
          "config list",
          "config set",
          "config delete",
          "config show",
          "config show-settings",
          "config set-settings",
          "parse",
          "peek",
          "bytes-encode",
          "bytes-decode",
          "raw-command",
          "btsnoop-to-jsonl",
          "extract-frames",
          "gui",
          "collect",
        ],
      },
    ];
  }

  copyCtlCommand(text) {
    const value = this.resolveCtlCommand(text);
    const done = () => {
      this.dialogState = {
        type: "debug",
        channel: 1,
        output: `${this.tr("command_copied")}\n${value}`,
        debug: false,
        running: false,
      };
      this.render();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(done);
      return;
    }
    done();
  }

  resolveCtlCommand(text) {
    const device = String(this.ctlDevice || "doser_1").trim() || "doser_1";
    return String(text || "").replaceAll("{device}", device);
  }

  addHistoryEntries(entries) {
    const current = Array.isArray(this.historyOverlay) ? this.historyOverlay : [];
    this.historyOverlay = [...entries, ...current].slice(0, 8);
  }

  nowHistoryEntry(action, pump, detail = "") {
    const now = new Date();
    return {
      ts: now.toISOString(),
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      date: now.toISOString().slice(0, 10),
      action,
      detail,
      pump,
    };
  }

  openDialog(type, channel = 1) {
    this.dialogState = { type, channel: Number(channel) || 1 };
    this.render();
    if (type === "schedule") this.refreshChannelEntities(Number(channel) || 1);
  }

  closeDialog() {
    this.dialogState = null;
    this.render();
  }

  selectedWeekdayAllows(date, weekdaysValue) {
    const values = String(weekdaysValue || "everyday").split(",").filter(Boolean);
    if (!values.length || values.includes("everyday")) return true;
    const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return values.includes(names[date.getDay()]);
  }

  minutesUntilNextSchedule(kind, value, weekdaysValue) {
    const now = new Date();
    const candidate = new Date(now);
    if (kind === "interval") {
      const minute = Number.parseInt(value, 10);
      if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
      candidate.setSeconds(0, 0);
      candidate.setMinutes(minute);
      if (candidate <= now) candidate.setHours(candidate.getHours() + 1);
      while (!this.selectedWeekdayAllows(candidate, weekdaysValue)) candidate.setHours(candidate.getHours() + 1);
      return Math.ceil((candidate - now) / 60000);
    }
    if (!/^\d{2}:\d{2}$/.test(String(value || ""))) return null;
    const [hourText, minuteText] = String(value).split(":");
    const hour = Number.parseInt(hourText, 10);
    const minute = Number.parseInt(minuteText, 10);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    candidate.setHours(hour, minute, 0, 0);
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    while (!this.selectedWeekdayAllows(candidate, weekdaysValue)) candidate.setDate(candidate.getDate() + 1);
    return Math.ceil((candidate - now) / 60000);
  }

  updateScheduleTimeWarning(form) {
    const input = form && form.querySelector("[data-schedule-time]");
    const warning = form && form.querySelector("[data-schedule-time-warning]");
    if (warning) warning.hidden = true;
    if (input) input.setCustomValidity("");
    return true;
  }

  updateScheduleTimeInput(form) {
    const kind = form && form.querySelector("[data-schedule-kind]");
    const input = form && form.querySelector("[data-schedule-time]");
    const label = form && form.querySelector("[data-schedule-time-label]");
    const amount = form && form.querySelector("[data-schedule-ml]");
    const amountHint = form && form.querySelector("[data-schedule-ml-hint]");
    if (!kind || !input || !label) return;
    if (kind.value === "interval") {
      let current = Number.parseInt(input.value, 10);
      if (/^\d{2}:\d{2}$/.test(input.value)) current = Number.parseInt(input.value.slice(3, 5), 10);
      input.type = "number";
      input.min = "0";
      input.max = "59";
      input.step = "1";
      input.value = Number.isInteger(current) && current >= 0 && current <= 59 ? String(current) : "0";
      label.textContent = this.tr("interval_minutes");
      if (amount) amount.min = "5.0";
      if (amountHint) amountHint.hidden = false;
      this.updateScheduleTimeWarning(form);
      return;
    }
    input.type = "time";
    input.removeAttribute("min");
    input.removeAttribute("max");
    input.removeAttribute("step");
    if (!/^\d{2}:\d{2}$/.test(input.value)) {
      const minute = Number.parseInt(input.value, 10);
      input.value = Number.isInteger(minute) && minute >= 0 && minute <= 59 ? `00:${String(minute).padStart(2, "0")}` : "00:00";
    }
    label.textContent = this.tr("time");
    if (amount) amount.min = "0.2";
    if (amountHint) amountHint.hidden = true;
    this.updateScheduleTimeWarning(form);
  }

  async saveScheduleDialog(form) {
    const channel = Number(form.channel.value);
    const ml = Number.parseFloat(form.ml.value);
    const scheduleKind = form.kind.value || "single_dose";
    const debug = Boolean(form.debug && form.debug.checked);
    const e = this.entities(channel);
    const autoLimitReached = this.autoLimitReached(e);
    const validFromTomorrow = Boolean(form.valid_from_tomorrow && form.valid_from_tomorrow.checked) || autoLimitReached;
    const active = validFromTomorrow ? true : form.active.checked;
    if (!Number.isFinite(channel) || !Number.isFinite(ml)) return;
    let displayTime = form.time.value || "00:00";
    const data = {
      pump: channel,
      active,
      kind: scheduleKind,
      ml,
      weekdays: String(form.weekdays.value || "everyday").split(",").filter(Boolean),
      send: true,
      valid_from_tomorrow: validFromTomorrow,
    };
    if (debug) data.debug = true;
    if (scheduleKind !== "interval") data.time = displayTime;
    if (scheduleKind === "interval") {
      const interval = Number.parseInt(form.time.value, 10);
      if (!Number.isInteger(interval) || interval < 0 || interval > 59) {
        form.time.focus();
        form.time.reportValidity();
        return;
      }
      if (ml < 5.0) {
        form.ml.min = "5.0";
        form.ml.focus();
        form.ml.reportValidity();
        return;
      }
      data.interval = interval;
      displayTime = `00:${String(interval).padStart(2, "0")}`;
    }
    const response = await this.callChihirosWithDialog("set_doser_schedule", data, { channel, debug, returnResponse: true });
    if (!response) return;
    const state = active ? "aktiv" : "inaktiv";
    const serviceResponse = this.serviceResponse(response);
    const sendOk = !serviceResponse || !serviceResponse.send_status || serviceResponse.send_status === "ok";
    this.addHistoryEntries([
      this.nowHistoryEntry(sendOk ? "Geraet senden OK" : "Geraet senden FAIL", channel, serviceResponse && serviceResponse.send_detail ? serviceResponse.send_detail : "an Geraet gesendet"),
      this.nowHistoryEntry("Zeitplan gespeichert", channel, `${state}, ${scheduleKind}, ${displayTime}, ${ml.toFixed(1)} mL${validFromTomorrow ? ", gueltig ab morgen" : ""}`),
    ]);
    await this.refreshChannelEntities(channel);
  }

  async saveContainerDialog(form) {
    const channel = Number(form.channel.value);
    const ml = Number.parseFloat(form.ml.value);
    if (!Number.isFinite(channel) || !Number.isFinite(ml)) return;
    await this.callChihirosWithDialog("set_doser_container", { pump: channel, ml }, { channel });
    await this.refreshChannelEntities(channel);
  }

  async saveSafetyDialog(form) {
    const maxAutoMl = Number.parseFloat(form.max_auto_ml.value);
    const maxManualMl = Number.parseFloat(form.max_manual_ml.value);
    const maxDailyMl = Number.parseFloat(form.max_daily_ml.value);
    if (!Number.isFinite(maxAutoMl) || !Number.isFinite(maxManualMl) || !Number.isFinite(maxDailyMl)) return;
    const response = await this.callChihirosWithDialog(
      "set_doser_safety",
      { max_auto_ml: maxAutoMl, max_manual_ml: maxManualMl, max_daily_ml: maxDailyMl },
      { channel: 1, returnResponse: true, noChannel: true },
    );
    if (!response) return;
    this.saveDoserSafetySettings(maxAutoMl, maxManualMl, maxDailyMl);
    await this.refreshHistory();
  }

  async saveAutoFillDialog(form) {
    const enabled = Boolean(form.enabled && form.enabled.checked);
    const targets = Array.from(form.querySelectorAll("[name='target']"))
      .map((select) => String(select.value || "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const message = String(form.message.value || "").trim();
    const response = await this.callChihirosWithDialog(
      "set_doser_push_settings",
      { enabled, targets, message },
      { channel: 1, returnResponse: true, noChannel: true },
    );
    if (!response) return;
    await this.refreshDoserEntities();
  }

  async saveManualDialog(form) {
    const channel = Number(form.channel.value);
    const ml = Number.parseFloat(form.ml.value);
    if (!Number.isFinite(channel) || !Number.isFinite(ml)) return;
    const safety = this.doserSafetySettings();
    const e = this.entities(channel);
    const currentManual = this.numericValue(e.manualDaily, 0);
    if (form.dose_now.checked && currentManual + ml > safety.maxManualMl) {
      this.dialogState = {
        type: "debug",
        channel,
        output: `FAIL\nUeberdosierungsschutz\nCH${channel}: Manuell ${(currentManual + ml).toFixed(1)} mL > Limit ${safety.maxManualMl.toFixed(1)} mL`,
        running: false,
        level: "error",
      };
      this.render();
      return;
    }
    const currentDaily = this.numericValue(e.daily, 0);
    if (form.dose_now.checked && currentDaily + ml > safety.maxDailyMl) {
      this.dialogState = {
        type: "debug",
        channel,
        output: `FAIL\nUeberdosierungsschutz\nCH${channel}: Tagesmenge ${(currentDaily + ml).toFixed(1)} mL > Limit ${safety.maxDailyMl.toFixed(1)} mL`,
        running: false,
        level: "error",
      };
      this.render();
      return;
    }
    await this._hass.callService("number", "set_value", { entity_id: e.manual, value: ml });
    if (form.dose_now.checked) {
      try {
        await this._hass.callService("button", "press", { entity_id: e.doseNow });
      } catch (err) {
        this.dialogState = {
          type: "debug",
          channel,
          output: `FAIL\nUeberdosierungsschutz\n${err && err.message ? err.message : err}`,
          running: false,
          level: "error",
        };
        this.render();
        return;
      }
    }
    this.dialogState = {
      type: "debug",
      channel,
      output: `OK\nFunktion: ${this.tr("manual")}\n${ml.toFixed(1)} mL${form.dose_now.checked ? "\nDosierung gestartet" : ""}`,
      running: false,
    };
    this.render();
    await this.refreshChannelEntities(channel);
  }

  async saveCalibrationDialog(form) {
    const channel = Number(form.channel.value);
    if (!Number.isFinite(channel)) return;
    try {
      const measured = Number.parseFloat(String(form.measured_ml.value || "").replace(",", "."));
      if (!Number.isFinite(measured)) {
        window.alert(this.tr("enter_measured"));
        return;
      }
      const data = { pump: channel, ml: measured };
      if (form.send_test.checked) {
        const test = Number.parseFloat(String(form.test_ml.value || "").replace(",", "."));
        if (Number.isFinite(test)) data.test_ml = test;
      }
      await this.callChihirosWithDialog("submit_doser_calibration", data, { channel });
      await this.refreshChannelEntities(channel);
    } catch (err) {
      this.dialogState = {
        type: "debug",
        channel,
        output: `FAIL\n${this.tr("calibration_failed")}: ${(err && err.message) || err}`,
        running: false,
      };
      this.render();
    }
  }

  moreInfo(entity) {
    if (!entity) return;
    const event = new Event("hass-more-info", { bubbles: true, composed: true });
    event.detail = { entityId: entity };
    this.dispatchEvent(event);
  }

  actionButton(label, icon, action, accent = false) {
    return `
      <button class="tile ${accent ? "accent" : ""}" data-action="${action}">
        <ha-icon icon="${icon}"></ha-icon>
        <span>${label}</span>
      </button>`;
  }

  row(icon, label, value, action = "") {
    const attr = action ? ` data-action="${action}"` : "";
    return `
      <div class="row"${attr}>
        <ha-icon icon="${icon}"></ha-icon>
        <span>${label}</span>
        <strong>${value}</strong>
      </div>`;
  }

  scheduleToggle(entity) {
    const on = this.isOn(entity);
    return `
      <button class="schedule-toggle ${on ? "on" : ""}" data-action="press:${entity}" title="${this.tr("active")}">
        <span class="toggle ${on ? "on" : ""}"></span>
        <span>${on ? this.tr("on") : this.tr("off")}</span>
      </button>`;
  }

  formatTimerTime(value) {
    if (!value || value === "-") return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  topActions() {
    const mac = this.entityPrefix();
    const read = this.config.read_button || `button.${mac}_${this.channelSlug(1)}_read_daily_values`;
    const timerStatus = this.timerStatusEntity();
    const nextBaseline = this.stateAttr(timerStatus, "next_baseline", "-");
    const nextResult = this.stateAttr(timerStatus, "next_result", "-");
    const timerRange = `${this.escapeHtml(this.formatTimerTime(nextBaseline))} -> ${this.escapeHtml(this.formatTimerTime(nextResult))}`;
    const calibrationRows = this.channels.map((ch) => `
        <button class="action-row" data-action="dialog:calibration:${ch.id}">
          <ha-icon icon="mdi:scale-balance"></ha-icon>
          <span>CH${ch.id} ${this.tr("calibrate_channel")}</span>
          <b>${this.tr("start")}</b>
        </button>`).join("");
    return `
      <section class="card top-card tools-card">
        <h2>${this.tr("fetch_data")}</h2>
        <button class="action-row" data-press="${read}">
          <ha-icon icon="mdi:download-circle"></ha-icon>
          <span>${this.tr("read_daily")}</span>
          <b>${this.tr("press")}</b>
        </button>
        <h2 class="sub-head">${this.tr("catch_up")}</h2>
        <button class="action-row" data-action="more:${timerStatus}">
          <ha-icon icon="mdi:timer-cog-outline"></ha-icon>
          <span>${this.tr("catch_up_timer_status")}<small class="timer-range">${timerRange}</small></span>
          <b>${this.state(timerStatus)}</b>
        </button>
        <button class="action-row" data-action="more:${read}">
          <ha-icon icon="mdi:pencil"></ha-icon>
          <span>${this.tr("catch_up_edit")}</span>
          <b>${this.tr("change")}</b>
        </button>
        <h2 class="sub-head">${this.tr("calibrate")}</h2>
        ${calibrationRows}
      </section>`;
  }

  deviceTabs() {
    const tab = this.activeTab;
    const item = (id, label) => `
        <button type="button" data-tab="${id}" class="${tab === id ? "active" : ""}">${label}</button>`;
    return `
      <nav class="device-tabs" aria-label="Chihiros Bereiche">
        ${item("led", this.tr("led"))}
        ${item("doser", this.tr("doser"))}
        ${item("ruehrer", this.tr("ruehrer"))}
        ${item("heizer", this.tr("heizer"))}
        ${item("config", this.tr("config"))}
        ${item("ctl", this.tr("ctl"))}
      </nav>`;
  }

  setTab(tab) {
    this.activeTab = tab || "doser";
    this.render();
  }

  doserDeviceTabs() {
    if (!this.doserDevices || this.doserDevices.length < 2) return "";
    const tabs = this.doserDevices.map((device) => `
        <button type="button" data-doser-device="${this.escapeHtml(device.id)}" class="${device.id === this.activeDoserDeviceId ? "active" : ""}">
          ${this.escapeHtml(device.label || device.name)}
        </button>`).join("");
    return `<nav class="doser-device-tabs" aria-label="Doser Geraete">${tabs}</nav>`;
  }

  entityLabel(entityId, state) {
    return (state && state.attributes && state.attributes.friendly_name) || entityId;
  }

  entityValue(entityId, state) {
    if (!state || state.state === "unknown" || state.state === "unavailable") return this.tr("unknown");
    const unit = state.attributes.unit_of_measurement || "";
    return unit ? `${state.state} ${unit}` : state.state;
  }

  entityIcon(entityId, state) {
    if (state && state.attributes && state.attributes.icon) return state.attributes.icon;
    const domain = entityId.split(".")[0];
    if (domain === "light") return "mdi:lightbulb";
    if (domain === "switch") return "mdi:toggle-switch";
    if (domain === "button") return "mdi:gesture-tap-button";
    if (domain === "number") return "mdi:numeric";
    if (domain === "sensor") return "mdi:eye";
    return "mdi:chip";
  }

  findEntities(kind) {
    const configured = this.config[`${kind}_entities`];
    if (Array.isArray(configured) && configured.length) return configured;
    if (!this._hass) return [];
    const patterns = {
      led: ["led", "light", "wrgb", "rgb", "dyu1000", "chihiros"],
      ruehrer: ["ruehrer", "rührer", "stirrer", "magstirrer", "mix", "dymix"],
      heizer: ["heizer", "heater", "heat", "thermostat", "temperature"],
    }[kind] || [];
    const allowed = new Set(["light", "switch", "button", "number", "sensor", "binary_sensor", "climate"]);
    return Object.entries(this._hass.states)
      .filter(([entityId, state]) => {
        const domain = entityId.split(".")[0];
        if (!allowed.has(domain)) return false;
        const haystack = `${entityId} ${this.entityLabel(entityId, state)}`.toLowerCase();
        return patterns.some((pattern) => haystack.includes(pattern));
      })
      .map(([entityId]) => entityId)
      .slice(0, 48);
  }

  entityRow(entityId) {
    const state = this._hass && this._hass.states[entityId];
    const domain = entityId.split(".")[0];
    const action = domain === "button" || domain === "switch" || domain === "light"
      ? `press:${entityId}`
      : `more:${entityId}`;
    const value = domain === "button" ? this.tr("press") : this.entityValue(entityId, state);
    return `
      <button class="entity-row" data-action="${action}">
        <ha-icon icon="${this.entityIcon(entityId, state)}"></ha-icon>
        <span>${this.entityLabel(entityId, state)}</span>
        <b>${value}</b>
      </button>`;
  }

  haDevicePanel(kind, title) {
    const entities = this.findEntities(kind);
    const rows = entities.length
      ? entities.map((entityId) => this.entityRow(entityId)).join("")
      : `<div class="empty-note">${this.tr("no_entities")}</div>`;
    return `
      <div class="ha-tab-page">
        <section class="card ha-entities-card">
          <h2>${title}</h2>
          ${rows}
        </section>
      </div>`;
  }

  tabContent() {
    if (this.activeTab === "led") return this.ledPanel();
    if (this.activeTab === "ruehrer") return this.haDevicePanel("ruehrer", this.tr("ruehrer"));
    if (this.activeTab === "heizer") return this.haDevicePanel("heizer", this.tr("heizer"));
    if (this.activeTab === "config") return this.configPanel();
    if (this.activeTab === "ctl") return this.ctlPanel();
    const columns = Math.max(1, Math.min(4, this.channels.length || 1));
    return `
        ${this.doserDeviceTabs()}
        <div class="top top-four">
          ${this.autoPanel(true)}
          ${this.manualPanel(true)}
          ${this.dailyPanel(true)}
          ${this.containerPanel(true)}
        </div>
        <section class="card channels-panel">
          <div class="channels channels-${columns}" style="--channel-columns:${columns}">${this.channels.map((ch) => this.channelCard(ch)).join("")}</div>
        </section>
        <div class="middle wide-middle">
          ${this.scheduleTable()}
          ${this.historyPanel()}
        </div>
        ${this.settings()}`;
  }

  ctlPanel() {
    const commandGroups = this.ctlCommandGroups().map((group) => `
          <div class="ctl-group">
            <h3>${this.escapeHtml(group.title)}</h3>
            <div class="ctl-command-list">
              ${group.commands.map((cmd) => {
                const needsDevice = group.title === "Doser" && cmd !== "gui";
                const text = `${group.prefix} ${cmd}${needsDevice ? " {device}" : ""}`;
                return `
                  <button type="button" class="ctl-command" data-copy="${this.escapeHtml(text)}" title="${this.tr("copy_command")}">
                    <code>${this.escapeHtml(text)}</code>
                    <ha-icon icon="mdi:content-copy"></ha-icon>
                  </button>`;
              }).join("")}
            </div>
          </div>`).join("");
    return `
      <div class="ctl-page">
        <section class="card config-card ctl-card">
          <h2>${this.tr("ctl_commands")}</h2>
          <div class="ctl-device-row">
            <input type="text" data-ctl-device value="${this.escapeHtml(this.ctlDevice || "doser_1")}" placeholder="doser_1 oder MAC">
            <button type="button" data-ctl-device-save>OK</button>
          </div>
          ${commandGroups}
        </section>
      </div>`;
  }

  configPanel() {
    const lang = this.language();
    const showMac = this.uiSettings && this.uiSettings.showMac !== false;
    const channelNameRows = this.channels.map((ch) => `
          <label class="config-row">
            <span>CH${ch.id}</span>
            <input type="text" value="${this.escapeHtml(ch.name)}" data-channel-name="${ch.id}">
          </label>`).join("");
    return `
      <div class="config-page">
        <section class="card config-card">
          <h2>${this.tr("display")}</h2>
          <label class="config-row">
            <span>${this.tr("language_label")}</span>
            <select data-ui-setting="language">
              <option value="de" ${lang === "de" ? "selected" : ""}>${this.tr("language_de")}</option>
              <option value="en" ${lang === "en" ? "selected" : ""}>${this.tr("language_en")}</option>
            </select>
          </label>
          <label class="config-check">
            <input type="checkbox" data-ui-setting="showMac" ${showMac ? "checked" : ""}>
            <span>${this.tr("show_mac")}</span>
          </label>
          <h2 class="sub-head">${this.tr("channel_names")}</h2>
          ${channelNameRows}
        </section>
      </div>`;
  }

  bottleVisual(ch, e) {
    const remaining = this.numericValue(e.remainingSensor, 0);
    const full = Number.isFinite(this.containerFullMl) && this.containerFullMl > 0 ? this.containerFullMl : 500;
    const percent = Math.max(0, Math.min(100, Math.round((remaining / full) * 100)));
    const level = Math.max(6, Math.min(82, percent));
    const fillOpacity = Math.max(0.38, Math.min(0.78, 0.32 + percent / 180));
    return `
        <div class="bottle-wrap" data-action="dialog:container:${ch.id}">
        <div class="bottle" style="--fill:${ch.color};--level:${level}%;--fill-opacity:${fillOpacity}"><i></i></div>
        <div class="bottle-text">
          <span>${this.tr("container_volume")}</span>
          <strong>${this.state(e.remainingSensor)}</strong>
        </div>
      </div>`;
  }

  manualControl(e, ch) {
    const safety = this.doserSafetySettings();
    const currentManual = this.numericValue(e.manualDaily, 0);
    const nextManual = currentManual + this.numericValue(e.manual, 0);
    const manualBlocked = nextManual > safety.maxManualMl;
    return `
      <div class="manual-control ${manualBlocked ? "blocked" : ""}">
        <label data-action="dialog:manual:${ch}"><ha-icon icon="mdi:cup-water"></ha-icon><span>${this.tr("manual")}</span></label>
        <div class="manual-input">
          <input type="number" min="0.2" max="999.9" step="0.1" value="${this.numericState(e.manual)}" data-number="${e.manual}">
          <span>mL</span>
        </div>
        <button class="dose-inline ${manualBlocked ? "blocked" : ""}" data-action="${manualBlocked ? `manual-blocked:${ch}` : `press:${e.doseNow}`}" title="${manualBlocked ? this.tr("manual_blocked") : this.tr("dose")}">
          <ha-icon icon="mdi:play-circle"></ha-icon>
        </button>
      </div>`;
  }

  historyEntries(limit = 8) {
    const entity = this.historyEntity();
    const attrs = this._hass && this._hass.states[entity] ? this._hass.states[entity].attributes : {};
    const storedEntries = Array.isArray(attrs.entries) ? attrs.entries : [];
    const overlayEntries = Array.isArray(this.historyOverlay) ? this.historyOverlay : [];
    const seen = new Set();
    return [...storedEntries, ...overlayEntries].filter((entry) => {
      const key = `${entry.date || ""}|${entry.time || ""}|${entry.pump || ""}|${entry.action || ""}|${entry.detail || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  channelHistoryRows(channel, limit = 3, compact = true) {
    const entries = this.historyEntries(Math.max(60, limit * 8)).filter((entry) => Number(entry.pump || 0) === Number(channel)).slice(0, limit);
    if (!entries.length) {
      return `<div class="channel-history-empty">${this.tr("no_history")}</div>`;
    }
    return entries.map((entry) => {
      const detailText = this.historyDetailText(entry.detail || "");
      const detail = detailText ? ` · ${detailText}` : "";
      return `
        <div class="channel-history-row" data-action="dialog:history:${channel}">
          <span>${this.historyActionText(entry.action || "")}</span>
          <small>${entry.date || ""} ${entry.time || ""}${compact ? "" : detail}</small>
        </div>`;
    }).join("");
  }

  channelCard(ch) {
    const e = this.entities(ch.id);
    const active = this.isOn(e.active);
    const autoLocked = this.autoLimitReached(e);
    return `
      <section class="channel">
        <div class="channel-card card ${active ? "" : "inactive"} ${autoLocked ? "auto-locked" : ""}" style="--dot:${ch.color}">
          <h2>CH${ch.id} ${ch.name}<i></i></h2>
          <div class="sub">${this.tr("status")}</div>
          ${this.bottleVisual(ch, e)}
          ${this.row(autoLocked ? "mdi:lock-outline" : "mdi:calendar-check", this.tr("active"), autoLocked ? this.tr("auto_limit_reached") : (active ? this.tr("on") : this.tr("off")), `dialog:schedule:${ch.id}`)}
          ${this.row("mdi:eye", this.tr("today"), this.state(e.daily), `more:${e.daily}`)}
          ${this.row("mdi:clock-outline", this.tr("time"), this.state(e.scheduleTimeSensor), `dialog:schedule:${ch.id}`)}
          ${this.row("mdi:cup-water", this.tr("planned_amount"), this.state(e.scheduleDoseSensor), `dialog:schedule:${ch.id}`)}
          ${this.row("mdi:eye", this.tr("history"), this.tr("details"), `dialog:history:${ch.id}`)}
          ${this.manualControl(e, ch.id)}
        </div>
      </section>`;
  }

  scheduleTable() {
    const rows = this.channels.map((ch) => {
      const e = this.entities(ch.id);
      const active = this.isOn(e.active);
      const autoLocked = this.autoLimitReached(e);
      return `
        <tr class="${active ? "" : "inactive-row"} ${autoLocked ? "auto-locked-row" : ""}">
          <td><span class="legend" style="background:${ch.color}"></span>CH${ch.id} ${ch.name}</td>
          <td>${autoLocked ? `<span class="schedule-lock"><ha-icon icon="mdi:lock-outline"></ha-icon>${this.tr("auto_limit_reached")}</span>` : this.scheduleToggle(e.active)}</td>
          <td>${this.scheduleKindLabel(e.scheduleTimeSensor)}</td>
          <td>${this.state(e.scheduleTimeSensor)}</td>
          <td>${this.state(e.scheduleDoseSensor)}</td>
          <td>${this.tr("everyday")}</td>
          <td>
            <button class="mini" data-action="dialog:schedule:${ch.id}" title="${this.tr("edit")}"><ha-icon icon="mdi:pencil"></ha-icon></button>
            <button class="mini" data-action="dialog:reset-schedule:${ch.id}" title="${this.tr("reset")}"><ha-icon icon="mdi:calendar-remove"></ha-icon></button>
          </td>
        </tr>`;
    }).join("");
    return `
      <section class="card schedule">
        <h2>${this.tr("schedule_title")}</h2>
        <table>
        <thead><tr><th>${this.tr("channel")}</th><th>${this.tr("schedule")}</th><th>${this.tr("scheduler")}</th><th>${this.tr("time")}</th><th>${this.tr("amount")}</th><th>${this.tr("weekdays")}</th><th>${this.tr("actions")}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }

  manualPanel(compact = false) {
    const rows = this.channels.map((ch) => {
      const e = this.entities(ch.id);
      return `
        <div class="value-row" data-action="more:${e.manualDaily}">
          <span class="legend" style="background:${ch.color}"></span>
          <ha-icon icon="mdi:hand-water"></ha-icon>
          <span>CH${ch.id} ${ch.name}</span>
          <strong>${this.stateFallback(e.manualDaily, "", "0.0 mL")}</strong>
        </div>`;
    }).join("");
    return `<section class="card manual-panel ${compact ? "top-card" : ""}"><h2>${this.tr("manual")}</h2>${rows}</section>`;
  }

  autoPanel(compact = false) {
    const rows = this.channels.map((ch) => {
      const e = this.entities(ch.id);
      return `
        <div class="value-row" data-action="more:${e.autoDaily}">
          <span class="legend" style="background:${ch.color}"></span>
          <ha-icon icon="mdi:calendar-sync"></ha-icon>
          <span>CH${ch.id} ${ch.name}</span>
          <strong>${this.stateFallback(e.autoDaily, "", "0.0 mL")}</strong>
        </div>`;
    }).join("");
    return `<section class="card auto-panel ${compact ? "top-card" : ""}"><h2>${this.tr("automatic")}</h2>${rows}</section>`;
  }

  dailyPanel(compact = false) {
    const rows = this.channels.map((ch) => {
      const e = this.entities(ch.id);
      return `
        <div class="value-row" data-action="more:${e.daily}">
          <span class="legend" style="background:${ch.color}"></span>
          <ha-icon icon="mdi:eye"></ha-icon>
          <span>CH${ch.id} ${ch.name}</span>
          <strong>${this.stateFallback(e.daily, "", "0.0 mL")}</strong>
        </div>`;
    }).join("");
    return `<section class="card daily-panel ${compact ? "top-card" : ""}"><h2>${this.tr("daily_amounts")}</h2>${rows}</section>`;
  }

  containerPanel(compact = false) {
    const rows = this.channels.map((ch) => {
      const e = this.entities(ch.id);
      return `
        <div class="container-row" data-action="dialog:container:${ch.id}">
          <span class="legend" style="background:${ch.color}"></span>
          <ha-icon icon="mdi:bottle-tonic-outline"></ha-icon>
          <span>CH${ch.id} ${ch.name}</span>
          <strong>${this.state(e.remainingSensor)}</strong>
          <button class="mini edit" data-action="dialog:container:${ch.id}" title="Bearbeiten">
            <ha-icon icon="mdi:pencil"></ha-icon>
          </button>
        </div>`;
    }).join("");
    return `<section class="card containers ${compact ? "top-card" : ""}"><h2>${this.tr("container")}</h2>${rows}</section>`;
  }

  historyActionText(action = "") {
    if (this.language() !== "en") return action || this.tr("actions");
    const map = {
      "Auto-Differenz": "Auto difference",
      "Automatische Dosierung": "Automatic dose",
      "Behaelter gesetzt": "Container updated",
      "Geraet senden FAIL": "Device send failed",
      "Geraet senden OK": "Device send OK",
      "Geraet senden nicht angefordert": "Device send not requested",
      "Kalibrierung gespeichert": "Calibration saved",
      "Kalibrierung gestartet": "Calibration started",
      "Manuelle Dosierung": "Manual dose",
      "Push Behaelterstand": "Container push",
      "Scheduler erfolgreich": "Scheduler successful",
      "Tageswerte vom Geraet": "Daily values from device",
      "Zeitplan gespeichert": "Schedule saved",
      "Zeitplan zurueckgesetzt": "Schedule reset",
    };
    return map[action] || action || this.tr("actions");
  }

  historyTitleText(entry, channel) {
    const action = entry.action || "";
    const actionText = this.historyActionText(action);
    const channelTitleActions = new Set([
      "Scheduler erfolgreich",
      "Zeitplan gespeichert",
      "Geraet senden OK",
      "Geraet senden FAIL",
      "Geraet senden nicht angefordert",
    ]);
    return channel && channelTitleActions.has(action) ? `${actionText} ${channel}` : actionText;
  }

  historyDetailText(detail = "") {
    if (this.language() !== "en" || !detail) return detail;
    return String(detail)
      .replaceAll("an Geraet gesendet", "sent to device")
      .replaceAll("nicht an Geraet gesendet", "not sent to device")
      .replaceAll("nur lokal gespeichert", "saved locally only")
      .replaceAll("lokal zurueckgesetzt", "reset locally")
      .replaceAll("Zeitplan gesendet", "schedule sent")
      .replaceAll("Zeitplan deaktiviert", "schedule disabled")
      .replaceAll("Zeitplan nicht gesendet", "schedule not sent")
      .replaceAll("ausgefuehrt um", "executed at")
      .replaceAll("aktiv", "active")
      .replaceAll("inaktiv", "inactive")
      .replaceAll("taeglich", "daily")
      .replaceAll("Einzeldosis", "single dose")
      .replaceAll("Intervall", "interval");
  }

  historyPanel(compact = false) {
    const entity = this.historyEntity();
    const entries = this.historyEntries(compact ? 4 : 8);
    const rows = entries.length ? entries.map((entry) => {
      const pump = Number(entry.pump || 0);
      const ch = this.channels.find((item) => item.id === pump);
      const color = ch ? ch.color : "#3d82b8";
      const channel = ch ? `CH${ch.id} ${ch.name}` : this.tr("doser");
      const title = this.historyTitleText(entry, ch ? channel : "");
      const detailText = this.historyDetailText(entry.detail || "");
      const detail = detailText ? ` · ${detailText}` : "";
      return `
        <div class="history-row" data-action="${pump ? `dialog:history:${pump}` : `more:${entity}`}">
          <span class="legend" style="background:${color}"></span>
          <span>${title}</span>
          <small>${entry.date || ""} ${entry.time || ""} · ${channel}${detail}</small>
        </div>`;
    }).join("") : `
      <div class="history-empty" data-action="dialog:history-all:1">
        <ha-icon icon="mdi:eye"></ha-icon>
        <span>${this.tr("no_history")}</span>
      </div>`;
    return `<section class="card history-card ${compact ? "top-card front-history" : ""}">
      <h2 class="card-title-action">
        <span>${this.tr("history_total")}</span>
        <button class="mini eye-action" data-action="dialog:history-all:1" title="${this.tr("history_total")}"><ha-icon icon="mdi:eye"></ha-icon></button>
      </h2>
      <div class="front-history-list">
        ${rows}
      </div>
    </section>`;
  }

  settings() {
    const lowNotification = this.lowContainerNotificationSwitch();
    const pushSettings = this.lowContainerPushSettings();
    const pushTargetText = pushSettings.targets.length ? pushSettings.targets.map((target) => `notify.${target}`).join(", ") : this.tr("no_push_target");
    const macRow = this.uiSettings && this.uiSettings.showMac === false ? "" : `<p><b>MAC</b><span>${this.deviceAddress}</span></p>`;
    const safety = this.doserSafetySettings();
    return `
      <h2 class="section-title">${this.tr("settings")}</h2>
      <div class="settings">
        <div class="settings-stack">
          <section class="card small">
            <h2>${this.tr("overdose")}</h2>
            <p><b>${this.tr("auto_limit")}</b><span>${safety.maxAutoMl.toFixed(1)} ml</span></p>
            <p><b>${this.tr("manual_limit")}</b><span>${safety.maxManualMl.toFixed(1)} ml</span></p>
            <p><b>${this.tr("daily_limit")}</b><span>${safety.maxDailyMl.toFixed(1)} ml</span></p>
            <small class="settings-note">${this.tr("manual_limit_note")}</small>
            <button class="link" data-action="dialog:safety:1">${this.tr("edit").toUpperCase()}</button>
          </section>
          <section class="card small">
            <h2>${this.tr("auto_fill")}</h2>
            <p><b>${this.tr("status")}</b><span>${this.tr("off")}</span></p>
            <p><b>${this.tr("threshold")}</b><span>10 %</span></p>
            <p><b>${this.tr("low_container_push")}</b>${this.scheduleToggle(lowNotification)}</p>
            <p><b>${this.tr("push_targets")}</b><span>${pushTargetText}</span></p>
            <button class="link" data-action="dialog:auto-fill:1">${this.tr("change").toUpperCase()}</button>
          </section>
        </div>
        ${this.topActions()}
        <section class="card small"><h2>${this.tr("connection")}</h2><p><b>${this.tr("device")}</b><span>${this.deviceName}</span></p><p><b>${this.tr("model")}</b><span>${this.deviceModel}</span></p>${macRow}<p><b>${this.tr("status")}</b><span class="ok">${this.tr("online")}</span></p><p><b>BLE</b><span>bei Aktion</span></p><p><b>${this.tr("source")}</b><span>Home Assistant</span></p><button class="link">${this.tr("details").toUpperCase()}</button></section>
      </div>`;
  }

  dialog() {
    if (!this.dialogState) return "";
    const ch = this.channels.find((item) => item.id === this.dialogState.channel) || this.channels[0];
    const e = this.entities(ch.id);
    if (this.dialogState.type === "schedule") return this.scheduleDialog(ch, e);
    if (this.dialogState.type === "container") return this.containerDialog(ch, e);
    if (this.dialogState.type === "manual") return this.manualDialog(ch, e);
    if (this.dialogState.type === "safety") return this.safetyDialog();
    if (this.dialogState.type === "auto-fill") return this.autoFillDialog();
    if (this.dialogState.type === "calibration") return this.calibrationDialog(ch);
    if (this.dialogState.type === "history") return this.historyDialog(ch, e);
    if (this.dialogState.type === "history-all") return this.historyAllDialog();
    if (this.dialogState.type === "reset-schedule") return this.resetScheduleDialog(ch, e);
    if (this.dialogState.type === "debug") return this.debugDialog(ch);
    return "";
  }

  channelOptions(selected) {
    return this.channels.map((ch) =>
      `<option value="${ch.id}" ${ch.id === selected ? "selected" : ""}>CH${ch.id} ${ch.name}</option>`
    ).join("");
  }

  scheduleDialog(ch, e) {
    const scheduleKind = this.scheduleKindFromId(e.scheduleTimeSensor);
    const intervalMinutes = this.stateAttr(e.scheduleTimeSensor, "interval_minutes", "0");
    const time = scheduleKind === "interval" ? intervalMinutes : this.rawState(e.scheduleTimeSensor, "00:00");
    const timeInputType = scheduleKind === "interval" ? "number" : "time";
    const timeInputLimits = scheduleKind === "interval" ? ' min="0" max="59" step="1"' : "";
    const timeLabel = scheduleKind === "interval" ? this.tr("interval_minutes") : this.tr("time");
    const ml = this.numericState(e.scheduleDoseSensor, "2.0");
    const autoLocked = this.autoLimitReached(e);
    const kindOption = (value, label) =>
      `<option value="${value}" ${scheduleKind === value ? "selected" : ""}>${label}</option>`;
    return `
      <div class="modal-backdrop">
        <section class="modal card history-modal">
          <h2>${this.tr("schedule_edit")}</h2>
          <form data-dialog-form="schedule">
            <label>${this.tr("channel")}<select name="channel" data-dialog-channel-select="schedule">${this.channelOptions(ch.id)}</select></label>
            <label>${this.tr("mode")}<select name="kind" data-schedule-kind>${kindOption("single_dose", this.tr("single_dose"))}${kindOption("interval", this.tr("interval"))}${kindOption("timer", this.tr("timer_list"))}${kindOption("window", this.tr("time_window"))}</select></label>
            <label class="check"><input type="checkbox" name="active" ${autoLocked || this.isOn(e.active) ? "checked" : ""} ${autoLocked ? "disabled" : ""}> ${this.tr("active")}</label>
            <label class="check ${autoLocked ? "auto-locked-check" : ""}"><input type="checkbox" name="valid_from_tomorrow" ${autoLocked ? "checked disabled" : ""}> ${this.tr("valid_from_tomorrow")}${autoLocked ? `<small class="input-hint">${this.tr("auto_limit_reached_note")}</small>` : ""}</label>
            <label><span data-schedule-time-label>${timeLabel}</span><input name="time" type="${timeInputType}" value="${time}"${timeInputLimits} data-schedule-time><small class="input-hint-red" data-schedule-time-warning hidden></small></label>
            <label>${this.tr("amount")}<input name="ml" type="number" min="${scheduleKind === "interval" ? "5.0" : "0.2"}" max="999.9" step="0.1" value="${ml}" data-schedule-ml><small class="input-hint-red" data-schedule-ml-hint ${scheduleKind === "interval" ? "" : "hidden"}>Minimum 5,0 mL</small></label>
            <label>${this.tr("weekdays")}<select name="weekdays" data-schedule-weekdays><option value="everyday">${this.tr("everyday")}</option><option value="monday,tuesday,wednesday,thursday,friday">Mo-Fr</option><option value="saturday,sunday">Wochenende</option></select></label>
            <label class="check"><input type="checkbox" name="debug"> ${this.tr("debug_capture")}</label>
            <div class="modal-actions">
              <button type="button" class="link" data-action="close-dialog">${this.tr("cancel")}</button>
              <button type="submit" class="primary">${this.tr("save")}</button>
            </div>
          </form>
        </section>
      </div>`;
  }

  containerDialog(ch, e) {
    return `
      <div class="modal-backdrop">
        <section class="modal card">
          <h2>${this.tr("container_edit")}</h2>
          <form data-dialog-form="container">
            <label>${this.tr("channel")}<select name="channel">${this.channelOptions(ch.id)}</select></label>
            <label>${this.tr("container_volume")}<input name="ml" type="number" min="0" max="9999" step="0.1" value="${this.numericState(e.remainingSensor, "0.0")}"></label>
            <div class="modal-actions">
              <button type="button" class="link" data-action="close-dialog">${this.tr("cancel")}</button>
              <button type="submit" class="primary">${this.tr("save")}</button>
            </div>
          </form>
        </section>
      </div>`;
  }

  autoFillDialog() {
    const settings = this.lowContainerPushSettings();
    const targets = [settings.targets[0] || "", settings.targets[1] || "", settings.targets[2] || ""];
    return `
      <div class="modal-backdrop">
        <section class="modal card">
          <h2>${this.tr("auto_fill_edit")}</h2>
          <form data-dialog-form="auto-fill">
            <label class="check"><input type="checkbox" name="enabled" ${settings.enabled ? "checked" : ""}> ${this.tr("low_container_push")}</label>
            <label>${this.tr("push_message")}<textarea name="message" rows="3">${this.escapeHtml(settings.message)}</textarea><small class="input-hint">${this.tr("push_message_hint")}</small></label>
            <label>${this.tr("push_target_1")}<select name="target">${this.notifyOptions(targets[0])}</select></label>
            <label>${this.tr("push_target_2")}<select name="target">${this.notifyOptions(targets[1])}</select></label>
            <label>${this.tr("push_target_3")}<select name="target">${this.notifyOptions(targets[2])}</select></label>
            <div class="modal-actions">
              <button type="button" class="link" data-action="close-dialog">${this.tr("cancel")}</button>
              <button type="submit" class="primary">${this.tr("save")}</button>
            </div>
          </form>
        </section>
      </div>`;
  }

  manualDialog(ch, e) {
    return `
      <div class="modal-backdrop">
        <section class="modal card">
          <h2>${this.tr("manual_dose")}</h2>
          <form data-dialog-form="manual">
            <label>${this.tr("channel")}<select name="channel">${this.channelOptions(ch.id)}</select></label>
            <label>${this.tr("amount")}<input name="ml" type="number" min="0.2" max="999.9" step="0.1" value="${this.numericState(e.manual)}"></label>
            <label class="check"><input type="checkbox" name="dose_now"> ${this.tr("dose_now")}</label>
            <div class="modal-actions">
              <button type="button" class="link" data-action="close-dialog">${this.tr("cancel")}</button>
              <button type="submit" class="primary">${this.tr("save")}</button>
            </div>
          </form>
        </section>
      </div>`;
  }

  safetyDialog() {
    const safety = this.doserSafetySettings();
    return `
      <div class="modal-backdrop">
        <section class="modal card">
          <h2>${this.tr("safety_edit")}</h2>
          <form data-dialog-form="safety">
            <label>${this.tr("max_auto_ml")}<input name="max_auto_ml" type="number" min="0.2" max="999.9" step="0.1" value="${safety.maxAutoMl.toFixed(1)}"></label>
            <label>${this.tr("max_manual_ml")}<input name="max_manual_ml" type="number" min="0" max="999.9" step="0.1" value="${safety.maxManualMl.toFixed(1)}"><small class="input-hint">${this.tr("manual_limit_note")}</small></label>
            <label>${this.tr("max_daily_ml")}<input name="max_daily_ml" type="number" min="0.2" max="9999.9" step="0.1" value="${safety.maxDailyMl.toFixed(1)}"></label>
            <div class="modal-actions">
              <button type="button" class="link" data-action="close-dialog">${this.tr("cancel")}</button>
              <button type="submit" class="primary">${this.tr("save")}</button>
            </div>
          </form>
        </section>
      </div>`;
  }

  resetScheduleDialog(ch, e) {
    return `
      <div class="modal-backdrop">
        <section class="modal card">
          <h2>${this.tr("reset_schedule")}</h2>
          <p><b>CH${ch.id} ${ch.name}</b></p>
          <p>${this.tr("reset_schedule_question")}</p>
          <p>${this.tr("reset_schedule_effect")}</p>
          <div class="modal-actions">
            <button type="button" class="link" data-action="close-dialog">${this.tr("reset_schedule_no")}</button>
            <button type="button" class="primary" data-action="confirm-reset:${ch.id}">${this.tr("reset_schedule_yes")}</button>
          </div>
        </section>
      </div>`;
  }

  calibrationDialog(ch) {
    const step = Number(this.dialogState && this.dialogState.step ? this.dialogState.step : 1);
    if (step <= 1) {
      return `
        <div class="modal-backdrop">
          <section class="modal card calibration-modal">
            <h2>${this.tr("calibrate")} · CH${ch.id} ${ch.name}</h2>
            <div class="calibration-steps">
              <div class="step active-step">
                <b>${this.tr("step_label")} 1</b>
                <span>${this.tr("prepare_text")}</span>
                <span>${this.tr("start_sequence_text")}</span>
              </div>
            </div>
            <div class="modal-actions sticky-actions">
              <button type="button" class="link" data-action="close-dialog">${this.tr("cancel")}</button>
              <button type="button" class="secondary" data-action="calibration-start-next:${ch.id}">
                <ha-icon icon="mdi:play-circle"></ha-icon>
                ${this.tr("start_sequence")} / ${this.tr("next")}
              </button>
            </div>
          </section>
        </div>`;
    }
    return `
      <div class="modal-backdrop">
        <section class="modal card calibration-modal">
          <h2>${this.tr("calibrate")} · CH${ch.id} ${ch.name}</h2>
          <form data-dialog-form="calibration">
            <label>${this.tr("channel")}<select name="channel">${this.channelOptions(ch.id)}</select></label>
            <div class="calibration-steps">
              <div class="step active-step">
                <b>${this.tr("step_label")} 2 · ${this.tr("measured_save")}</b>
                <label>${this.tr("measured_amount")}<input name="measured_ml" type="number" min="0" max="99.99" step="0.01" placeholder="z.B. 4.0"></label>
                <b>${this.tr("optional_check")}</b>
                <label class="check"><input type="checkbox" name="send_test"> ${this.tr("send_test")}</label>
                <label>${this.tr("test_amount")}<input name="test_ml" type="number" min="0.2" max="999.9" step="0.1" value="4.0"></label>
              </div>
            </div>
            <div class="modal-actions sticky-actions">
              <button type="button" class="link" data-action="close-dialog">${this.tr("cancel")}</button>
              <button type="submit" class="primary">${this.tr("save_calibration")}</button>
            </div>
          </form>
        </section>
      </div>`;
  }

  debugDialog(ch) {
    const output = this.dialogState && this.dialogState.output ? this.dialogState.output : "";
    const title = this.dialogState && this.dialogState.debug ? this.tr("debug_output") : this.tr("result_output");
    const suffix = this.dialogState && this.dialogState.noChannel ? "" : ` · CH${ch.id} ${ch.name}`;
    const levelClass = this.dialogState && this.dialogState.level === "error" ? " error" : "";
    return `
      <div class="modal-backdrop">
        <section class="modal card debug-modal${levelClass}">
          <h2>${title}${suffix}</h2>
          <pre class="debug-output${levelClass}">${this.escapeHtml(output)}</pre>
          <div class="modal-actions">
            <button type="button" class="link" data-action="close-dialog">${this.tr("close")}</button>
          </div>
        </section>
      </div>`;
  }

  historyDialog(ch, e) {
    return `
      <div class="modal-backdrop">
        <section class="modal card">
          <h2>${this.tr("history")} · CH${ch.id} ${ch.name}</h2>
          <div class="dialog-history">
            ${this.row("mdi:calendar-check", this.tr("active"), this.isOn(e.active) ? this.tr("on") : this.tr("off"), `more:${e.active}`)}
            ${this.row("mdi:eye", this.tr("today_total"), this.stateFallback(e.daily, "", "0.0 mL"), `more:${e.daily}`)}
            ${this.row("mdi:calendar-sync", this.tr("auto_today"), this.stateFallback(e.autoDaily, e.daily), `more:${e.autoDaily}`)}
            ${this.row("mdi:hand-water", this.tr("manual_today"), this.stateFallback(e.manualDaily, "", "0.0 mL"), `more:${e.manualDaily}`)}
            ${this.row("mdi:bottle-tonic-outline", this.tr("container_volume"), this.state(e.remainingSensor), `more:${e.remainingSensor}`)}
            ${this.row("mdi:clock-outline", this.tr("next_time"), this.state(e.scheduleTimeSensor), `more:${e.scheduleTimeSensor}`)}
            ${this.row("mdi:cup-water", this.tr("planned_amount"), this.state(e.scheduleDoseSensor), `more:${e.scheduleDoseSensor}`)}
            <div class="dialog-history-list">
              ${this.channelHistoryRows(ch.id, 120, false)}
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="link" data-action="close-dialog">${this.tr("close")}</button>
          </div>
        </section>
      </div>`;
  }

  historyAllDialog() {
    const entries = this.historyEntries(500);
    const rows = entries.length ? entries.map((entry) => {
      const pump = Number(entry.pump || 0);
      const ch = this.channels.find((item) => item.id === pump);
      const color = ch ? ch.color : "#3d82b8";
      const channel = ch ? `CH${ch.id} ${ch.name}` : this.tr("doser");
      const title = this.historyTitleText(entry, ch ? channel : "");
      const detailText = this.historyDetailText(entry.detail || "");
      const detail = detailText ? ` · ${detailText}` : "";
      return `
        <div class="history-row" data-action="${pump ? `dialog:history:${pump}` : `more:${this.historyEntity()}`}">
          <span class="legend" style="background:${color}"></span>
          <span>${title}</span>
          <small>${entry.date || ""} ${entry.time || ""} · ${channel}${detail}</small>
        </div>`;
    }).join("") : `
      <div class="history-empty" data-action="more:${this.historyEntity()}">
        <ha-icon icon="mdi:history"></ha-icon>
        <span>${this.tr("no_history")}</span>
      </div>`;
    return `
      <div class="modal-backdrop">
        <section class="modal card history-modal">
          <h2>${this.tr("history_total")}</h2>
          <div class="dialog-history-list all-history-list">
            ${rows}
          </div>
          <div class="modal-actions">
            <button type="button" class="link" data-action="close-dialog">${this.tr("close")}</button>
          </div>
        </section>
      </div>`;
  }

  render() {
    if (!this._hass) return;
    this.innerHTML = `
      <style>
        :host { display:block; color: var(--primary-text-color); }
        .wrap { max-width: 1640px; margin: 0 auto; padding: 10px 10px 20px; }
        .device-tabs { display:flex; gap:8px; margin:0 0 12px; }
        .device-tabs button { min-height:34px; min-width:88px; border:1px solid rgba(81,154,190,.28); border-radius:8px; background:rgba(10,18,21,.88); color:var(--primary-text-color); font:inherit; cursor:pointer; }
        .device-tabs button.active { border-color:#03c9ff; color:#03c9ff; background:rgba(0,122,166,.18); font-weight:700; }
        .doser-device-tabs { display:flex; flex-wrap:wrap; gap:8px; margin:-2px 0 12px; }
        .doser-device-tabs button { min-height:32px; min-width:96px; border:1px solid rgba(81,154,190,.28); border-radius:8px; background:rgba(10,18,21,.72); color:var(--primary-text-color); font:inherit; cursor:pointer; padding:0 12px; }
        .doser-device-tabs button.active { border-color:#03c9ff; color:#03c9ff; background:rgba(0,122,166,.18); font-weight:700; }
        .ha-tab-page { display:grid; grid-template-columns:1fr; gap:10px; }
        .ha-entities-card { min-height:220px; }
        .led-page { display:grid; grid-template-columns:minmax(260px, 360px) 1fr; gap:10px; align-items:start; }
        .led-device-card { min-height:220px; }
        .led-device-head { display:grid; grid-template-columns:48px 1fr auto; align-items:start; gap:12px; margin-bottom:10px; }
        .led-device-head > ha-icon { --mdc-icon-size:38px; color:#f0f6fc; }
        .led-device-head h2 { margin-bottom:2px; }
        .led-device-head span, .led-device-head small { display:block; color:rgba(255,255,255,.66); line-height:1.35; }
        .led-device-head b { align-self:start; padding:3px 10px; border-radius:999px; background:rgba(57,211,83,.14); border:1px solid rgba(57,211,83,.35); font-size:12px; }
        .led-channels-card { min-height:220px; }
        .led-channels { display:grid; grid-template-columns:repeat(var(--channel-columns, 4), minmax(0,1fr)); gap:10px; }
        .led-channel { min-height:172px; display:grid; gap:10px; }
        .led-channel h2 { font-size:16px; font-weight:700; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,.09); }
        .led-channel h2 i { float:right; width:10px; height:10px; margin-top:7px; border-radius:50%; background:var(--led-color); box-shadow:0 0 13px var(--led-color); }
        .led-channel-body { display:grid; grid-template-columns:40px 1fr; align-items:center; gap:10px; }
        .led-channel-body ha-icon { --mdc-icon-size:30px; color:var(--led-color); }
        .led-channel-body strong { justify-self:end; font-size:18px; }
        .led-channel input[type="range"] { width:100%; accent-color:var(--led-color); }
        .led-actions { display:grid; grid-template-columns:repeat(3, 32px); gap:8px; justify-content:end; }
        .led-actions .mini { border:1px solid rgba(81,154,190,.35); border-radius:6px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; padding:0; }
        .config-page { display:grid; grid-template-columns:minmax(280px, 520px); gap:10px; align-items:start; }
        .config-card { min-height:180px; }
        .config-row { display:grid; grid-template-columns:1fr minmax(160px, 220px); gap:12px; align-items:center; min-height:44px; margin:8px 0; font-weight:600; }
        .config-row select, .config-row input { min-height:36px; border:1px solid rgba(81,154,190,.35); border-radius:6px; background:rgba(255,255,255,.08); color:var(--primary-text-color); padding:0 10px; font:inherit; }
        .config-check { display:flex; align-items:center; gap:10px; min-height:40px; margin:8px 0; font-weight:600; }
        .config-check input { width:18px; height:18px; }
        .ctl-page { display:grid; grid-template-columns:repeat(2, minmax(280px, 1fr)); gap:10px; align-items:start; }
        .ctl-card { max-height:calc(100vh - 150px); overflow:auto; }
        .ctl-device-row { display:grid; grid-template-columns:minmax(0, 1fr) 64px; gap:8px; margin:8px 0 12px; }
        .ctl-device-row input { min-height:34px; border:1px solid rgba(81,154,190,.35); border-radius:6px; background:rgba(255,255,255,.08); color:var(--primary-text-color); padding:0 10px; font:inherit; }
        .ctl-device-row button { min-height:34px; border:1px solid rgba(3,201,255,.65); border-radius:6px; background:rgba(0,122,166,.18); color:var(--primary-text-color); font:inherit; font-weight:700; cursor:pointer; }
        .ctl-group { margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.08); }
        .ctl-group:first-of-type { margin-top:0; padding-top:0; border-top:0; }
        .ctl-group h3 { margin:0 0 7px; font-size:13px; color:rgba(255,255,255,.78); letter-spacing:0; }
        .ctl-command-list { display:grid; grid-template-columns:1fr; gap:4px; }
        .ctl-command { display:grid; grid-template-columns:minmax(0, 1fr) 24px; align-items:center; gap:8px; min-height:30px; width:100%; border:1px solid rgba(81,154,190,.18); border-radius:6px; background:rgba(0,0,0,.16); color:inherit; cursor:pointer; text-align:left; padding:4px 8px; }
        .ctl-command:hover { border-color:rgba(3,201,255,.55); background:rgba(0,122,166,.14); }
        .ctl-command code { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color:rgba(255,255,255,.86); }
        .ctl-command ha-icon { --mdc-icon-size:18px; justify-self:end; color:#03c9ff; }
        .entity-row { display:grid; grid-template-columns:28px minmax(0,1fr) auto; align-items:center; gap:10px; min-height:34px; width:100%; padding:0; border:0; border-bottom:1px solid rgba(255,255,255,.07); background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
        .entity-row:last-child { border-bottom:0; }
        .entity-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .entity-row b { color:rgba(255,255,255,.9); font-weight:700; }
        .empty-note { min-height:120px; display:flex; align-items:center; color:rgba(255,255,255,.66); }
        .top { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:12px; }
        .top-four { grid-template-columns: 1fr 1fr 1fr 1fr; }
        .top-front { grid-template-columns: 1.25fr 1fr 1fr 1fr; }
        .top-split { grid-template-columns: 1fr 1fr; }
        .channels { display:grid; grid-template-columns: repeat(var(--channel-columns, 4), minmax(0,1fr)); gap:10px; }
        .channels-1 { grid-template-columns:1fr; }
        .channels-2 { grid-template-columns:repeat(2, minmax(0,1fr)); }
        .channels-3 { grid-template-columns:repeat(3, minmax(0,1fr)); }
        .channels-4 { grid-template-columns:repeat(4, minmax(0,1fr)); }
        .middle { display:grid; grid-template-columns: 1.05fr .95fr; gap:10px; margin-top:10px; }
        .wide-middle { grid-template-columns: 1.25fr .75fr; }
        .single-middle { grid-template-columns:1fr; }
        .side-stack { display:grid; grid-template-columns:1fr; gap:10px; }
        .quick { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; }
        .card, .tile { border:1px solid rgba(81,154,190,.28); border-radius:8px; background:linear-gradient(135deg, rgba(20,31,35,.98), rgba(9,15,17,.98)); box-shadow:none; }
        .card { padding:12px 14px; }
        h1, h2 { margin:0; font-weight:500; letter-spacing:0; }
        h1 { font-size:20px; margin-bottom:18px; }
        h2 { font-size:18px; margin-bottom:12px; }
        .brand b { display:block; font-size:16px; margin-bottom:12px; }
        .brand span { display:block; line-height:1.45; color:rgba(255,255,255,.82); }
        .top-card { min-height: 132px; }
        .tools-card { min-height: 190px; }
        .sub-head { margin-top:12px; margin-bottom:6px; font-size:15px; font-weight:700; }
        .row, .action-row { display:grid; grid-template-columns:28px 1fr auto; align-items:center; gap:8px; min-height:30px; border:0; color:inherit; background:transparent; width:100%; text-align:left; padding:0; font:inherit; }
        ha-icon { color:#3d82b8; }
        .row strong { font-weight:500; }
        .action-row small { display:block; margin-top:2px; color:rgba(255,255,255,.58); font-size:11px; line-height:1.25; }
        .action-row .timer-range { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .action-row b, .add, .link { color:#03c9ff; font-weight:600; }
        .toggle { width:34px; height:18px; border-radius:999px; background:#586069; position:relative; border:1px solid rgba(255,255,255,.18); }
        .toggle:after { content:''; position:absolute; width:14px; height:14px; top:1px; left:2px; border-radius:50%; background:#d0d7de; }
        .toggle.on { background:#007aa6; border-color:#03c9ff; }
        .toggle.on:after { left:17px; background:#2bd2ff; }
        .section-title { margin:16px 0 8px 16px; }
        .channels-panel { padding: 12px 12px; margin-top: 8px; }
        .channels-panel > h2 { margin: 0 0 10px 4px; }
        .channel-card { min-height: 188px; border-bottom-left-radius:8px; border-bottom-right-radius:8px; }
        .channel-card.inactive { filter:grayscale(.85); opacity:.62; }
        .channel-card.inactive h2 i { background:#77808a; box-shadow:none; }
        .channel-card.inactive .bottle i { opacity:.35; }
        .channel-card.auto-locked { filter:grayscale(.72); }
        .channel-card.auto-locked .row:first-of-type { color:rgba(255,255,255,.62); }
        .channel-card.auto-locked .row:first-of-type ha-icon { color:#9aa0a6; }
        .channel-card h2 { font-weight:700; position:relative; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,.09); }
        .channel-card h2 i { float:right; width:10px; height:10px; margin-top:7px; border-radius:50%; background:var(--dot); box-shadow:0 0 13px var(--dot); }
        .sub { margin:8px 0 4px; font-weight:700; font-size:12px; color:rgba(255,255,255,.78); }
        .bottle-wrap { display:grid; grid-template-columns:48px 1fr; gap:12px; align-items:center; margin:8px 0 8px; }
        .bottle { width:30px; height:44px; border:2px solid rgba(255,255,255,.5); border-radius:6px 6px 8px 8px; position:relative; margin-left:4px; background:rgba(0,0,0,.24); overflow:hidden; }
        .bottle:before { content:''; position:absolute; width:14px; height:7px; border:2px solid rgba(255,255,255,.5); border-bottom:0; border-radius:4px 4px 0 0; top:-8px; left:6px; }
        .bottle i { position:absolute; left:3px; right:3px; bottom:3px; height:var(--level, 68%); border-radius:4px; background:linear-gradient(180deg, color-mix(in srgb, var(--fill) 38%, white), var(--fill)); opacity:var(--fill-opacity, .72); box-shadow:0 0 6px color-mix(in srgb, var(--fill) 28%, transparent); transition:height .2s ease, opacity .2s ease; }
        .bottle-text { display:grid; grid-template-columns:1fr auto; align-items:center; gap:10px; min-width:0; }
        .bottle-text strong { font-size:16px; font-weight:600; justify-self:end; white-space:nowrap; }
        .bottle-text span { color:rgba(255,255,255,.72); font-size:12px; min-width:0; }
        .tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:6px; }
        .tiles.compact-actions { grid-template-columns:repeat(3,1fr); }
        .tile { min-height:58px; color:inherit; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font:inherit; }
        .tile ha-icon { --mdc-icon-size:28px; }
        .tile.accent ha-icon { color:#ffc400; }
        .manual-control { margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.09); display:grid; grid-template-columns:auto minmax(104px, 1fr) 38px; gap:8px; align-items:center; }
        .manual-control.blocked label { opacity:.58; filter:grayscale(.9); }
        .manual-control label { display:flex; gap:10px; align-items:center; min-width:0; }
        .manual-input { min-height:28px; display:flex; align-items:center; justify-content:flex-end; gap:7px; background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.12); border-bottom-color:rgba(255,255,255,.55); border-radius:6px 6px 2px 2px; padding:1px 8px; min-width:0; }
        .manual-input input { width:58px; height:24px; color:var(--primary-text-color); background:transparent; border:0; text-align:right; font:inherit; outline:0; }
        .manual-input input:disabled { color:rgba(255,255,255,.52); }
        .manual-input span { color:rgba(255,255,255,.72); }
        .dose-inline { width:32px; height:32px; border:1px solid rgba(81,154,190,.35); border-radius:999px; background:rgba(10,18,21,.88); color:inherit; display:flex; align-items:center; justify-content:center; padding:0; cursor:pointer; font:inherit; }
        .dose-inline ha-icon { color:#ffc400; --mdc-icon-size:22px; }
        .dose-inline.blocked { border-color:rgba(255,255,255,.16); background:rgba(90,90,90,.28); cursor:not-allowed; }
        .dose-inline.blocked ha-icon { color:#858585; }
        .schedule table { width:100%; border-collapse:collapse; font-size:12px; }
        .schedule th, .schedule td { border:1px solid rgba(255,255,255,.12); padding:6px 8px; text-align:left; }
        .schedule tr.inactive-row { color:rgba(255,255,255,.48); filter:grayscale(.85); }
        .schedule tr.auto-locked-row { color:rgba(255,255,255,.56); background:rgba(130,130,130,.08); filter:grayscale(.75); }
        .schedule-lock { display:inline-flex; align-items:center; gap:7px; color:rgba(255,255,255,.64); font-weight:600; }
        .schedule-lock ha-icon { --mdc-icon-size:17px; color:#9aa0a6; }
        .schedule td:nth-child(2) { white-space:nowrap; }
        .schedule-toggle { display:inline-flex; align-items:center; gap:8px; border:0; background:transparent; color:inherit; font:inherit; cursor:pointer; padding:0; }
        .schedule-toggle .toggle { flex:0 0 auto; }
        .tabs { display:grid; grid-template-columns:repeat(4,1fr); background:rgba(0,0,0,.32); border-radius:7px; overflow:hidden; margin-bottom:12px; }
        .tabs span, .tabs b { padding:7px; text-align:center; font-weight:500; }
        .tabs b { color:#03c9ff; border-bottom:2px solid #03c9ff; }
        .legend { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:8px; }
        .mini, .add, .link { border:0; background:transparent; cursor:pointer; font:inherit; }
        .quick .tile { min-height:88px; }
        .quick .tile ha-icon { --mdc-icon-size:48px; color:#4c84b4; }
        .containers, .manual-panel, .auto-panel { min-height: 0; }
        .container-row { display:grid; grid-template-columns:12px 28px 1fr auto 28px; align-items:center; gap:8px; min-height:30px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,.07); }
        .container-row:last-child { border-bottom:0; }
        .container-row strong { font-weight:600; }
        .mini.edit { padding:0; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; }
        .mini.edit ha-icon { --mdc-icon-size:20px; }
        .value-row { display:grid; grid-template-columns:12px 28px 1fr auto; align-items:center; gap:8px; min-height:30px; border-bottom:1px solid rgba(255,255,255,.07); cursor:pointer; }
        .value-row:last-child { border-bottom:0; }
        .value-row strong, .container-row strong { justify-self:end; text-align:right; min-width:76px; padding-left:12px; }
        .value-row strong { font-weight:700; }
        .history-card { min-height: 130px; }
        .card-title-action { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .eye-action { width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; color:#2b8fcd; }
        .eye-action ha-icon { --mdc-icon-size:20px; }
        .front-history { min-height: 142px; }
        .front-history-list { max-height:270px; overflow-y:auto; padding-right:4px; }
        .history-row { display:grid; grid-template-columns:12px 1fr; grid-template-rows:auto auto; align-items:center; gap:2px 8px; min-height:38px; border-bottom:1px solid rgba(255,255,255,.07); cursor:pointer; }
        .history-row:last-child { border-bottom:0; }
        .history-row small { grid-column:2; color:rgba(255,255,255,.62); font-size:11px; }
        .history-empty { min-height:88px; display:flex; align-items:center; gap:10px; color:rgba(255,255,255,.68); cursor:pointer; }
        .channel-history { margin-top:7px; padding-top:7px; border-top:1px solid rgba(255,255,255,.09); cursor:pointer; }
        .channel-history-title { display:grid; grid-template-columns:24px 1fr; align-items:center; gap:10px; min-height:26px; }
        .channel-history-title ha-icon { color:#2b8fcd; --mdc-icon-size:20px; }
        .channel-history-scroll { max-height:88px; overflow-y:auto; padding-right:4px; }
        .channel-history-row { display:grid; gap:1px; min-height:28px; padding:4px 0 4px 34px; border-bottom:1px solid rgba(255,255,255,.06); }
        .channel-history-row:last-child { border-bottom:0; }
        .channel-history-row span { font-weight:600; font-size:12px; }
        .channel-history-row small { color:rgba(255,255,255,.62); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .channel-history-empty { padding:5px 0 4px 34px; color:rgba(255,255,255,.55); font-size:12px; }
        .settings { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
        .settings-stack { display:grid; grid-template-columns:1fr; gap:10px; }
        .small { min-height:96px; }
        .small p { display:grid; grid-template-columns:1fr auto; margin:7px 0; }
        .settings-note, .input-hint { color:rgba(255,255,255,.58); font-size:11px; line-height:1.35; }
        .settings-note { display:block; margin:2px 0 8px; }
        .ok { color:#39d353; }
        .modal-backdrop { position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.58); display:flex; align-items:center; justify-content:center; padding:20px; }
        .modal { width:min(520px, calc(100vw - 40px)); }
        .modal form { display:grid; gap:12px; }
        .modal label { display:grid; gap:6px; font-weight:600; }
        .input-hint-red { color:#ff4d4f; font-weight:700; line-height:1; }
        .modal .check { display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-weight:500; }
        .modal .check .input-hint { flex:1 0 100%; margin-left:24px; }
        .modal input, .modal select, .modal textarea { min-height:38px; border:1px solid rgba(81,154,190,.35); border-radius:6px; background:rgba(255,255,255,.08); color:var(--primary-text-color); padding:0 10px; font:inherit; }
        .modal input[type="checkbox"] { width:16px; height:16px; min-height:0; padding:0; accent-color:#03c9ff; }
        .modal textarea { min-height:76px; padding:8px 10px; resize:vertical; line-height:1.35; }
        .modal-actions { display:flex; justify-content:flex-end; gap:10px; padding-top:6px; }
        .dialog-history { display:grid; gap:2px; margin-top:6px; }
        .dialog-history-list { margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.10); max-height:min(38vh, 360px); overflow-y:auto; padding-right:4px; }
        .history-modal { width:min(760px, calc(100vw - 40px)); }
        .all-history-list { max-height:min(70vh, 720px); }
        .all-history-list .history-row small { white-space:normal; overflow:visible; text-overflow:clip; line-height:1.35; }
        .dialog-history-list .channel-history-row small { white-space:normal; overflow:visible; text-overflow:clip; line-height:1.35; }
        .primary { min-height:36px; border:1px solid #03c9ff; border-radius:7px; background:#007aa6; color:#fff; font:inherit; padding:0 14px; cursor:pointer; }
        .secondary { min-height:34px; border:1px solid rgba(81,154,190,.45); border-radius:7px; background:rgba(10,18,21,.88); color:var(--primary-text-color); font:inherit; padding:0 12px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; justify-content:center; }
        .secondary ha-icon { color:#ffc400; }
        .calibration-modal { width:min(620px, calc(100vw - 40px)); }
        .debug-modal { width:min(760px, calc(100vw - 40px)); }
        .debug-output { max-height:min(62vh, 620px); overflow:auto; white-space:pre-wrap; word-break:break-word; border:1px solid rgba(255,255,255,.12); border-radius:7px; background:rgba(0,0,0,.42); color:var(--primary-text-color); padding:12px; font:12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .debug-modal.error { border-color:rgba(255,77,79,.75); box-shadow:0 0 0 1px rgba(255,77,79,.32), 0 18px 60px rgba(0,0,0,.45); }
        .debug-modal.error h2 { color:#ff8a8a; }
        .debug-output.error { border-color:rgba(255,77,79,.78); background:rgba(75,0,0,.46); color:#ffd8d8; }
        .calibration-steps { display:grid; gap:10px; }
        .step { border:1px solid rgba(255,255,255,.10); border-radius:7px; padding:10px; background:rgba(0,0,0,.14); display:grid; gap:8px; }
        .active-step { border-color:rgba(3,201,255,.35); background:rgba(3,201,255,.06); }
        .step b { font-size:13px; }
        .step span { color:rgba(255,255,255,.72); line-height:1.35; }
        .sticky-actions { margin-top:12px; border-top:1px solid rgba(255,255,255,.10); }
        @media (max-width: 1300px) { .top-four { grid-template-columns:1fr 1fr; } }
        @media (max-width: 1100px) { .top, .channels, .settings, .config-page, .led-page { grid-template-columns:1fr 1fr; } .channels-1 { grid-template-columns:1fr; } .middle { grid-template-columns:1fr; } }
        @media (max-width: 700px) { .top, .channels, .settings, .config-page, .led-page { grid-template-columns:1fr; } }
      </style>
      <div class="wrap">
        ${this.deviceTabs()}
        ${this.tabContent()}
      </div>
      ${this.dialog()}`;
    this.querySelectorAll("[data-tab]").forEach((el) => {
      el.addEventListener("click", () => this.setTab(el.getAttribute("data-tab")));
    });
    this.querySelectorAll("[data-doser-device]").forEach((el) => {
      el.addEventListener("click", () => this.setDoserDevice(el.getAttribute("data-doser-device")));
    });
    this.querySelectorAll("[data-led-device]").forEach((el) => {
      el.addEventListener("click", () => this.setLedDevice(el.getAttribute("data-led-device")));
    });
    this.querySelectorAll("[data-led-number]").forEach((el) => {
      const save = () => {
        const entity = el.getAttribute("data-led-number");
        const channel = Number(el.getAttribute("data-led-device-channel"));
        if (entity) {
          this.setNumber(entity, el.value);
          return;
        }
        const ledChannel = (this.ledChannels || []).find((item) => item.id === channel);
        if (ledChannel) ledChannel.value = Number(el.value);
        this.render();
      };
      el.addEventListener("change", save);
      el.addEventListener("input", () => {
        const channel = Number(el.getAttribute("data-led-device-channel"));
        const ledChannel = (this.ledChannels || []).find((item) => item.id === channel);
        if (ledChannel && !el.getAttribute("data-led-number")) ledChannel.value = Number(el.value);
      });
    });
    this.querySelectorAll("[data-number]").forEach((el) => {
      el.addEventListener("change", () => this.setNumber(el.getAttribute("data-number"), el.value));
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") this.setNumber(el.getAttribute("data-number"), el.value);
      });
    });
    this.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", async () => {
        const action = el.getAttribute("data-action") || "";
        const [kind, entity, extra] = action.split(":");
        if (kind === "press") this.press(entity);
        if (kind === "manual-blocked") {
          const channel = Number(entity);
          this.dialogState = {
            type: "debug",
            channel,
            output: `FAIL\nUeberdosierungsschutz\nCH${channel}: ${this.tr("manual_blocked")}`,
            running: false,
            level: "error",
          };
          this.render();
        }
        if (kind === "more") this.moreInfo(entity);
        if (kind === "dialog") this.openDialog(entity, Number(extra));
        if (kind === "confirm-reset") {
          this.closeDialog();
          this.callChihirosWithDialog("reset_doser_schedule", { pump: Number(entity), send: true }, { channel: Number(entity) }).then(() => this.refreshHistory());
        }
        if (kind === "calibration-start") await this.callChihirosWithDialog("start_doser_calibration", { pump: Number(entity) }, { channel: Number(entity) });
        if (kind === "calibration-start-next") {
          const channel = Number(entity);
          await this.callChihiros("start_doser_calibration", { pump: channel }, false);
          this.dialogState = { type: "calibration", channel, step: 2 };
          this.render();
        }
        if (kind === "close-dialog") this.closeDialog();
      });
    });
    this.querySelectorAll("[data-copy]").forEach((el) => {
      el.addEventListener("click", () => this.copyCtlCommand(el.getAttribute("data-copy")));
    });
    const ctlDeviceInput = this.querySelector("[data-ctl-device]");
    const ctlDeviceSave = this.querySelector("[data-ctl-device-save]");
    if (ctlDeviceInput) {
      const saveCtlDevice = () => {
        this.ctlDevice = String(ctlDeviceInput.value || "").trim() || "doser_1";
        ctlDeviceInput.value = this.ctlDevice;
      };
      ctlDeviceInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") saveCtlDevice();
      });
      ctlDeviceInput.addEventListener("change", saveCtlDevice);
      if (ctlDeviceSave) ctlDeviceSave.addEventListener("click", saveCtlDevice);
    }
    this.querySelectorAll("[data-dialog-form]").forEach((form) => {
      const kind = form.querySelector("[data-schedule-kind]");
      if (kind) {
        kind.addEventListener("change", () => this.updateScheduleTimeInput(form));
        const time = form.querySelector("[data-schedule-time]");
        const weekdays = form.querySelector("[data-schedule-weekdays]");
        if (time) time.addEventListener("input", () => this.updateScheduleTimeWarning(form));
        if (time) time.addEventListener("change", () => this.updateScheduleTimeWarning(form));
        if (weekdays) weekdays.addEventListener("change", () => this.updateScheduleTimeWarning(form));
        this.updateScheduleTimeInput(form);
      }
      const channel = form.querySelector("[data-dialog-channel-select]");
      if (channel) {
        channel.addEventListener("change", () => {
          this.openDialog(channel.getAttribute("data-dialog-channel-select"), Number(channel.value));
        });
      }
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const type = form.getAttribute("data-dialog-form");
        if (type === "schedule") await this.saveScheduleDialog(form);
        if (type === "container") await this.saveContainerDialog(form);
        if (type === "manual") await this.saveManualDialog(form);
        if (type === "safety") await this.saveSafetyDialog(form);
        if (type === "auto-fill") await this.saveAutoFillDialog(form);
        if (type === "calibration") await this.saveCalibrationDialog(form);
      });
    });
    this.querySelectorAll("[data-press]").forEach((el) => {
      el.addEventListener("click", () => this.press(el.getAttribute("data-press")));
    });
    this.querySelectorAll("[data-ui-setting]").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.getAttribute("data-ui-setting");
        this.uiSettings = this.uiSettings || {};
        if (key === "language") this.uiSettings.language = el.value === "en" ? "en" : "de";
        if (key === "showMac") this.uiSettings.showMac = Boolean(el.checked);
        this.saveUiSettings();
        this.render();
      });
    });
    this.querySelectorAll("[data-channel-name]").forEach((el) => {
      const save = () => {
        const channel = Number(el.getAttribute("data-channel-name"));
        if (!Number.isFinite(channel)) return;
        this.uiSettings = this.uiSettings || {};
        this.uiSettings.channelNames = this.uiSettings.channelNames || {};
        this.uiSettings.channelNames[channel] = String(el.value || "").trim();
        this.saveUiSettings();
        this.applyChannelNames();
        this.render();
      };
      el.addEventListener("change", save);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") save();
      });
    });
  }
}

customElements.define("chihiros-doser-card-v3", ChihirosDoserCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "chihiros-doser-card-v3",
  name: "Chihiros Doser Card V3",
  description: "Compact Chihiros Doser dashboard card",
});
