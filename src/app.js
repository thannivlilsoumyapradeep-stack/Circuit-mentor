(() => {
  const sim = window.CircuitSimulator;
  const mentor = window.CircuitMentor;

  // DOM Elements
  const workspace = document.querySelector("#workspace");
  const wireLayer = document.querySelector("#wireLayer");
  const library = document.querySelector("#componentLibrary");
  const template = document.querySelector("#componentTemplate");
  const pinDetails = document.querySelector("#pinDetails");
  const checksList = document.querySelector("#checksList");
  const mentorLog = document.querySelector("#mentorLog");
  const mentorForm = document.querySelector("#mentorForm");
  const mentorQuestion = document.querySelector("#mentorQuestion");
  const instrumentReadout = document.querySelector("#instrumentReadout");
  const runButton = document.querySelector("#runSimulation");
  const projectMeta = document.querySelector("#projectMeta");
  const benchHint = document.querySelector("#benchHint");
  const zoomValue = document.querySelector("#zoomValue");
  const metricVoltage = document.querySelector("#metricVoltage");
  const metricCurrent = document.querySelector("#metricCurrent");
  const metricPower = document.querySelector("#metricPower");
  const metricSensor = document.querySelector("#metricSensor");
  const removeTool = document.querySelector("#removeTool");
  const aiAutoModal = document.querySelector("#aiAutoModal");
  const aiAutoMessage = document.querySelector("#aiAutoMessage");
  const aiExplainOnly = document.querySelector("#aiExplainOnly");
  const aiAutoConnect = document.querySelector("#aiAutoConnect");
  const componentModal = document.querySelector("#componentModal");
  const componentModalTitle = document.querySelector("#componentModalTitle");
  const componentModalKind = document.querySelector("#componentModalKind");
  const componentOptions = document.querySelector("#componentOptions");
  const customSpecInput = document.querySelector("#customSpecInput");
  const componentCancel = document.querySelector("#componentCancel");
  const componentAdd = document.querySelector("#componentAdd");
  const pwaInstallBtn = document.querySelector("#pwaInstallBtn");
  
  // Interactive Slider DOMs
  const rangeDistance = document.querySelector("#rangeDistance");
  const rangeLight = document.querySelector("#rangeLight");
  const valDistance = document.querySelector("#valDistance");
  const valLight = document.querySelector("#valLight");

  // State Variables
  let selectedPart = null;
  let activeTool = "select";
  let activePin = null;
  let zoom = 1.0;
  let dragState = null;
  let partCounter = 0;
  let pendingAiQuestion = "";
  let currentWireColor = "#ff4a5a";
  let selectedWireIndex = null;
  let pendingComponentType = null;
  let selectedComponentSpec = "";
  let simInterval = null;
  let deferredPrompt = null; // PWA installation prompt
  const placedParts = new Map();
  const wires = [];

  // Component definition groups matching the original application specs
  const componentGroups = [
    {
      title: "Boards",
      items: [
        { type: "arduino", name: "Arduino Uno", hint: "5V microcontroller", icon: "UNO" },
        { type: "esp32", name: "ESP32", hint: "Wi-Fi and Bluetooth board", icon: "32" },
        { type: "pi", name: "Raspberry Pi", hint: "Linux single-board computer", icon: "PI" }
      ]
    },
    {
      title: "Basic Components",
      items: [
        { type: "led", name: "LED", hint: "Polarity-sensitive output", icon: "LED" },
        { type: "resistor", name: "Resistor", hint: "Current limiter", icon: "R" },
        { type: "capacitor", name: "Capacitor", hint: "Stores electrical charge", icon: "CAP" },
        { type: "inductor", name: "Inductor", hint: "Stores magnetic energy", icon: "L" },
        { type: "diode", name: "Diode", hint: "One-way current path", icon: "D" },
        { type: "transistor", name: "Transistor", hint: "Signal switch or amplifier", icon: "Q" },
        { type: "potentiometer", name: "Potentiometer", hint: "Adjustable resistance", icon: "POT" },
        { type: "button", name: "Push Button", hint: "Momentary switch", icon: "BTN" },
        { type: "breadboard", name: "Breadboard", hint: "Solderless prototyping", icon: "BB" }
      ]
    },
    {
      title: "Integrated Circuits",
      items: [
        { type: "ic555", name: "555 Timer IC", hint: "Timer and oscillator", icon: "555" },
        { type: "opamp", name: "Op-Amp IC", hint: "Signal amplifier", icon: "OP" },
        { type: "logicic", name: "Logic Gate IC", hint: "AND, OR, NOT gates", icon: "IC" },
        { type: "motordriver", name: "Motor Driver IC", hint: "Drive DC motors", icon: "DRV" },
        { type: "shiftregister", name: "Shift Register IC", hint: "Expand digital outputs", icon: "SR" }
      ]
    },
    {
      title: "Sensors",
      items: [
        { type: "ultrasonic", name: "Ultrasonic Sensor", hint: "Distance input", icon: "US" },
        { type: "dht11", name: "DHT11", hint: "Temperature and humidity", icon: "DHT" },
        { type: "ldr", name: "LDR", hint: "Light sensor", icon: "LDR" }
      ]
    },
    {
      title: "Output Devices",
      items: [
        { type: "servo", name: "Servo Motor", hint: "PWM position control", icon: "SRV" },
        { type: "buzzer", name: "Buzzer", hint: "Simple sound output", icon: "BUZ" },
        { type: "lcd", name: "LCD Display", hint: "I2C text display", icon: "LCD" }
      ]
    }
  ];

  const pinProfiles = {
    "5V": { voltage: "5 V", io: "Power", pwm: "No", analog: "No", i2c: "No", spi: "No", uart: "No", description: "Regulated 5 volt supply for low-current modules.", uses: ["Sensors", "Breadboard power rail", "LCD modules"] },
    "3V3": { voltage: "3.3 V", io: "Power", pwm: "No", analog: "No", i2c: "No", spi: "No", uart: "No", description: "Low-voltage supply used by ESP32, Raspberry Pi GPIO, and many sensors.", uses: ["ESP32 modules", "Raspberry Pi logic", "Low-power sensors"] },
    "GND": { voltage: "0 V", io: "Reference", pwm: "No", analog: "No", i2c: "No", spi: "No", uart: "No", description: "Common electrical reference. Most circuits need shared ground.", uses: ["Return path", "Power rails", "Signal reference"] },
    "D13": { voltage: "0 or 5 V", io: "Digital output", pwm: "No", analog: "No", i2c: "No", spi: "SCK", uart: "No", description: "Arduino digital pin often connected to the built-in LED.", uses: ["External LED", "Relay module", "Digital signal"] },
    "D9": { voltage: "0 or 5 V", io: "Digital PWM", pwm: "Yes", analog: "No", i2c: "No", spi: "No", uart: "No", description: "PWM-capable Arduino pin for dimming and servo signals.", uses: ["Servo signal", "LED dimming", "Motor driver input"] },
    "A0": { voltage: "0 to 5 V", io: "Analog input", pwm: "No", analog: "Yes", i2c: "No", spi: "No", uart: "No", description: "Analog input for reading variable voltage.", uses: ["Potentiometer", "LDR divider", "Soil sensor"] },
    "RESET": { voltage: "Logic level", io: "Reset", pwm: "No", analog: "No", i2c: "No", spi: "No", uart: "No", description: "Pulling reset low restarts the microcontroller.", uses: ["Manual reset", "Programmer reset"] },
    "AREF": { voltage: "Reference", io: "Analog reference", pwm: "No", analog: "Reference", i2c: "No", spi: "No", uart: "No", description: "External reference voltage for analog readings.", uses: ["Precise analog sensors", "ADC reference"] },
    "GPIO18": { voltage: "0 or 3.3 V", io: "Digital/PWM", pwm: "Yes", analog: "No", i2c: "No", spi: "SCK", uart: "No", description: "ESP32 GPIO that can output PWM and SPI clock.", uses: ["Servo signal", "LED PWM", "SPI clock"] },
    "GPIO34": { voltage: "0 to 3.3 V", io: "Input only", pwm: "No", analog: "Yes", i2c: "No", spi: "No", uart: "No", description: "ESP32 analog input. It cannot drive an output.", uses: ["Sensor readings", "LDR divider", "Analog voltage"] },
    "SDA": { voltage: "Logic level", io: "I2C data", pwm: "No", analog: "No", i2c: "Yes", spi: "No", uart: "No", description: "I2C data line used with matching clock line.", uses: ["LCD display", "OLED display", "I2C sensors"] },
    "SCL": { voltage: "Logic level", io: "I2C clock", pwm: "No", analog: "No", i2c: "Yes", spi: "No", uart: "No", description: "I2C clock line used with matching data line.", uses: ["LCD display", "OLED display", "I2C sensors"] },
    "+": { voltage: "Supply", io: "Power input", pwm: "No", analog: "No", i2c: "No", spi: "No", uart: "No", description: "Positive side of a component. Check required voltage before connecting.", uses: ["LED anode", "Sensor VCC", "Servo VCC"] },
    "-": { voltage: "0 V", io: "Ground", pwm: "No", analog: "No", i2c: "No", spi: "No", uart: "No", description: "Negative side of a component. Usually returns to ground.", uses: ["LED cathode", "Sensor GND", "Servo GND"] },
    "SIG": { voltage: "Signal", io: "Input/Output", pwm: "Depends", analog: "Depends", i2c: "No", spi: "No", uart: "No", description: "Signal pin. Match it to a board pin that supports the needed function.", uses: ["Servo control", "Sensor output", "Button input"] },
    "TRIG": { voltage: "Digital", io: "Input", pwm: "No", analog: "No", i2c: "No", spi: "No", uart: "No", description: "Trigger pin for an ultrasonic distance pulse.", uses: ["Distance start pulse"] },
    "ECHO": { voltage: "Digital", io: "Output", pwm: "No", analog: "No", i2c: "No", spi: "No", uart: "No", description: "Echo pulse from an ultrasonic sensor.", uses: ["Distance timing"] }
  };

  const arduinoPins = [
    ["RESET", "left", 18], ["3V3", "left", 42], ["5V", "left", 66], ["GND", "left", 90], ["GND", "left", 114], ["VIN", "left", 138],
    ["D0", "right", 14], ["D1", "right", 26], ["D2", "right", 38], ["D3", "right", 50], ["D4", "right", 62], ["D5", "right", 74], ["D6", "right", 86],
    ["D7", "right", 98], ["D8", "right", 110], ["D9", "right", 122], ["D10", "right", 134], ["D11", "right", 146], ["D12", "right", 158], ["D13", "right", 170],
    ["A0", "bottom", 48], ["A1", "bottom", 74], ["A2", "bottom", 100], ["A3", "bottom", 126], ["A4", "bottom", 152], ["A5", "bottom", 178],
    ["AREF", "top", 146], ["SDA", "top", 178], ["SCL", "top", 210]
  ];

  const componentSpecs = {
    resistor: {
      title: "Choose Resistor",
      unit: "ohm",
      options: ["5 ohm", "220 ohm", "330 ohm", "1 kohm", "10 kohm"],
      defaultSpec: "220 ohm"
    },
    capacitor: {
      title: "Choose Capacitor",
      unit: "capacitance",
      options: ["100 nF ceramic", "1 uF electrolytic", "10 uF electrolytic", "100 uF electrolytic"],
      defaultSpec: "100 nF ceramic"
    },
    inductor: {
      title: "Choose Inductor",
      unit: "inductance",
      options: ["10 uH", "100 uH", "1 mH", "10 mH"],
      defaultSpec: "100 uH"
    },
    diode: {
      title: "Choose Diode",
      unit: "type",
      options: ["1N4148 signal", "1N4007 rectifier", "Schottky diode", "Zener 5.1V"],
      defaultSpec: "1N4148 signal"
    },
    transistor: {
      title: "Choose Transistor",
      unit: "type",
      options: ["2N2222 NPN", "BC547 NPN", "2N3906 PNP", "MOSFET IRLZ44N"],
      defaultSpec: "2N2222 NPN"
    },
    potentiometer: {
      title: "Choose Potentiometer",
      unit: "resistance",
      options: ["1 kohm", "10 kohm", "50 kohm", "100 kohm"],
      defaultSpec: "10 kohm"
    },
    ic555: {
      title: "Choose 555 Timer IC",
      unit: "package",
      options: ["NE555 DIP-8", "LM555 DIP-8", "TLC555 CMOS"],
      defaultSpec: "NE555 DIP-8"
    },
    opamp: {
      title: "Choose Op-Amp IC",
      unit: "package",
      options: ["LM358 dual op-amp", "LM741 single op-amp", "MCP6002 rail-to-rail"],
      defaultSpec: "LM358 dual op-amp"
    },
    logicic: {
      title: "Choose Logic Gate IC",
      unit: "logic",
      options: ["74HC00 NAND", "74HC04 NOT", "74HC08 AND", "74HC32 OR"],
      defaultSpec: "74HC00 NAND"
    },
    motordriver: {
      title: "Choose Motor Driver IC",
      unit: "driver",
      options: ["L293D dual H-bridge", "L298N driver", "TB6612FNG driver"],
      defaultSpec: "L293D dual H-bridge"
    },
    shiftregister: {
      title: "Choose Shift Register IC",
      unit: "type",
      options: ["74HC595 output", "74HC165 input", "CD4017 decade counter"],
      defaultSpec: "74HC595 output"
    }
  };

  const componentBlueprints = {
    arduino: { className: "board", pins: arduinoPins, visual: "board", defaultX: 60, defaultY: 80 },
    esp32: { className: "esp", pins: [["3V3", "left", 24], ["GND", "left", 54], ["GPIO18", "right", 24], ["GPIO34", "right", 54], ["SDA", "bottom", 56], ["SCL", "bottom", 102]], visual: "board", defaultX: 145, defaultY: 130 },
    pi: { className: "pi", pins: [["3V3", "left", 24], ["5V", "left", 54], ["GND", "left", 84], ["GPIO18", "right", 34], ["SDA", "right", 64], ["SCL", "right", 94]], visual: "board", defaultX: 150, defaultY: 145 },
    breadboard: { className: "breadboard", pins: [["+", "top", 42], ["-", "top", 84], ["SIG", "bottom", 132], ["+", "bottom", 198], ["-", "bottom", 236]], visual: "breadboard", defaultX: 350, defaultY: 280 },
    led: { className: "basic", pins: [["+", "left", 44], ["-", "right", 44]], visual: "led", defaultX: 470, defaultY: 110 },
    resistor: { className: "basic", pins: [["+", "left", 44], ["-", "right", 44]], visual: "resistor", defaultX: 340, defaultY: 125 },
    capacitor: { className: "basic", pins: [["+", "left", 44], ["-", "right", 44]], visual: "capacitor", defaultX: 385, defaultY: 250 },
    inductor: { className: "basic", pins: [["+", "left", 44], ["-", "right", 44]], visual: "inductor", defaultX: 410, defaultY: 270 },
    diode: { className: "basic", pins: [["+", "left", 44], ["-", "right", 44]], visual: "diode", defaultX: 430, defaultY: 290 },
    transistor: { className: "basic", pins: [["B", "left", 24], ["C", "right", 34], ["E", "right", 62]], visual: "transistor", defaultX: 455, defaultY: 310 },
    potentiometer: { className: "basic", pins: [["+", "left", 28], ["SIG", "top", 58], ["-", "right", 58]], visual: "potentiometer", defaultX: 480, defaultY: 330 },
    button: { className: "basic", pins: [["+", "left", 34], ["SIG", "right", 34], ["-", "right", 60]], visual: "sensor", defaultX: 520, defaultY: 310 },
    ultrasonic: { className: "sensor", pins: [["+", "left", 20], ["TRIG", "left", 48], ["ECHO", "right", 48], ["-", "right", 72]], visual: "sensor", defaultX: 585, defaultY: 110 },
    dht11: { className: "sensor", pins: [["+", "left", 24], ["SIG", "right", 44], ["-", "left", 66]], visual: "sensor", defaultX: 558, defaultY: 245 },
    ldr: { className: "sensor", pins: [["+", "left", 44], ["SIG", "right", 44]], visual: "sensor", defaultX: 520, defaultY: 220 },
    servo: { className: "output", pins: [["+", "left", 20], ["SIG", "left", 48], ["-", "left", 76]], visual: "output", defaultX: 680, defaultY: 300 },
    buzzer: { className: "output", pins: [["+", "left", 44], ["-", "right", 44]], visual: "output", defaultX: 650, defaultY: 210 },
    lcd: { className: "output", pins: [["+", "left", 18], ["-", "left", 42], ["SDA", "right", 30], ["SCL", "right", 58]], visual: "output", defaultX: 650, defaultY: 110 },
    ic555: { className: "ic", pins: [["GND", "left", 16], ["TRIG", "left", 38], ["OUT", "left", 60], ["RESET", "left", 82], ["VCC", "right", 16], ["DIS", "right", 38], ["THR", "right", 60], ["CTRL", "right", 82]], visual: "ic", defaultX: 530, defaultY: 190 },
    opamp: { className: "ic", pins: [["IN+", "left", 22], ["IN-", "left", 52], ["V-", "left", 82], ["OUT", "right", 34], ["V+", "right", 70]], visual: "ic", defaultX: 545, defaultY: 215 },
    logicic: { className: "ic", pins: [["A", "left", 20], ["B", "left", 48], ["Y", "right", 34], ["VCC", "right", 62], ["GND", "bottom", 56]], visual: "ic", defaultX: 560, defaultY: 240 },
    motordriver: { className: "ic", pins: [["IN1", "left", 18], ["IN2", "left", 42], ["EN", "left", 66], ["VCC", "right", 18], ["OUT1", "right", 42], ["OUT2", "right", 66], ["GND", "bottom", 56]], visual: "ic", defaultX: 575, defaultY: 265 },
    shiftregister: { className: "ic", pins: [["DATA", "left", 18], ["CLK", "left", 42], ["LATCH", "left", 66], ["VCC", "right", 18], ["Q0", "right", 42], ["Q1", "right", 66], ["GND", "bottom", 56]], visual: "ic", defaultX: 590, defaultY: 290 }
  };

  // Render Component Catalog Library
  function renderLibrary(filter = "") {
    library.innerHTML = "";
    const query = filter.trim().toLowerCase();
    componentGroups.forEach(group => {
      const matches = group.items.filter(item => `${item.name} ${item.hint}`.toLowerCase().includes(query));
      if (!matches.length) return;

      const category = document.createElement("section");
      category.className = "category";
      category.innerHTML = `<h3>${group.title}</h3>`;

      matches.forEach(item => {
        // Clone from template or build node directly to guarantee class styling
        const node = document.createElement("button");
        node.className = "component-item";
        node.type = "button";
        node.draggable = true;
        node.dataset.type = item.type;
        
        node.innerHTML = `
          <span class="part-icon">${item.icon}</span>
          <span class="part-copy">
            <strong>${item.name}</strong>
            <small>${item.hint}</small>
          </span>
        `;
        
        node.addEventListener("dragstart", event => {
          event.dataTransfer.setData("text/plain", item.type);
        });
        node.addEventListener("click", () => {
          if (componentSpecs[item.type]) {
            openComponentModal(item.type);
          } else {
            addPart(item.type);
          }
        });
        category.appendChild(node);
      });

      library.appendChild(category);
    });
  }

  // Add component to workspace
  function addPart(type, x, y, spec = "") {
    const source = componentGroups.flatMap(group => group.items).find(item => item.type === type);
    const blueprint = componentBlueprints[type];
    if (!source || !blueprint) return null;

    partCounter += 1;
    const part = document.createElement("article");
    part.className = `part ${blueprint.className}`;
    part.dataset.id = `part-${partCounter}`;
    part.dataset.type = type;
    part.dataset.spec = spec || componentSpecs[type]?.defaultSpec || "";
    
    // Position coordinates
    part.style.left = `${x ?? blueprint.defaultX + (partCounter % 3) * 20}px`;
    part.style.top = `${y ?? blueprint.defaultY + (partCounter % 4) * 15}px`;
    
    part.innerHTML = `
      <div class="part-header"><span>${source.name}</span><span>${source.icon}</span></div>
      <div class="part-body">${renderVisual(blueprint.visual, type, part.dataset.id)}</div>
      ${part.dataset.spec ? `<div class="part-spec">${part.dataset.spec}</div>` : ""}
    `;

    // Render component pins
    blueprint.pins.forEach(([name, side, offset]) => {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "pin";
      pin.dataset.pin = name;
      pin.dataset.side = side;
      pin.dataset.part = part.dataset.id;
      if (side === "left" || side === "right") pin.style.top = `${offset}px`;
      if (side === "top" || side === "bottom") pin.style.left = `${offset}px`;
      
      pin.addEventListener("click", event => {
        event.stopPropagation();
        inspectPin(pin);
        if (activeTool === "wire") connectPin(pin);
      });
      part.appendChild(pin);
      part.appendChild(renderPinLabel(name, side, offset));
    });

    part.addEventListener("pointerdown", startDrag);
    part.addEventListener("click", () => selectPart(part));
    workspace.appendChild(part);
    
    placedParts.set(part.dataset.id, { 
      type, 
      element: part, 
      name: source.name, 
      spec: part.dataset.spec 
    });
    
    // Bind specific component interactions
    bindComponentEvents(part, type);

    selectPart(part);
    refreshWires();
    evaluateCircuit();
    return part;
  }

  // HTML visual renderer for specific elements
  function renderVisual(kind, type, id) {
    if (kind === "board") {
      let overlayText = "UNO";
      if (type === "esp32") overlayText = "32";
      if (type === "pi") overlayText = "PI";
      return `<div class="usb"></div><div class="chip"></div><span class="label-dark" style="position:absolute; bottom:14px; right:16px; font-weight:800; font-size:12px; color:rgba(255,255,255,0.15)">${overlayText}</span>`;
    }
    if (kind === "led") return '<div class="led-visual"></div>';
    if (kind === "resistor") return '<div class="resistor-visual"></div>';
    if (kind === "capacitor") return '<div class="capacitor-visual"></div>';
    if (kind === "inductor") return '<div class="inductor-visual"></div>';
    if (kind === "diode") return '<div class="diode-visual"></div>';
    if (kind === "transistor") return '<div class="transistor-visual"></div>';
    if (kind === "potentiometer") {
      return `<div class="potentiometer-visual" id="pot-knob-${id}"></div>`;
    }
    if (kind === "ic") return '<div class="ic-visual"></div>';
    if (kind === "breadboard") {
      return '<div style="color:rgba(255,255,255,0.06); font-weight:900; font-size:24px; position:absolute; inset:0; display:grid; place-items:center; letter-spacing:4px">BREADBOARD</div>';
    }
    if (kind === "output") {
      if (type === "servo") {
        return `
          <div class="output-visual" style="position:relative">
            <!-- Servo horn arm -->
            <div class="servo-horn" style="position:absolute; width:45px; height:12px; background:#fff; border-radius:6px; top:19px; left:10px; transform-origin:39px 6px; box-shadow:0 2px 4px rgba(0,0,0,0.4)">
              <div style="width:6px; height:6px; background:#49535f; border-radius:50%; margin:3px 3px 3px auto"></div>
            </div>
          </div>
        `;
      }
      if (type === "lcd") {
        return `
          <div class="output-visual" style="width:104px; height:80px; padding:6px; display:flex; flex-direction:column; justify-content:space-between">
            <div class="lcd-screen" style="flex:1; background:#040c06; border:1px solid #142a1f; border-radius:4px; padding:4px; font-family:'JetBrains Mono', monospace; font-size:8px; color:#52d38e; line-height:1.2; overflow:hidden">
              LCD 16x2 I2C<br>Awaiting signal
            </div>
          </div>
        `;
      }
      return '<div class="output-visual"></div>';
    }
    
    // Sensor visuals
    if (type === "ultrasonic") {
      return `
        <div class="sensor-visual" style="display:flex; justify-content:space-around; align-items:center; padding:0 6px">
          <div class="us-eye" style="width:24px; height:24px; border-radius:50%; background:#1c2128; border:2px solid #56616d; display:grid; place-items:center; font-size:7px; color:#56616d">T</div>
          <div class="us-eye" style="width:24px; height:24px; border-radius:50%; background:#1c2128; border:2px solid #56616d; display:grid; place-items:center; font-size:7px; color:#56616d">R</div>
        </div>
      `;
    }
    if (type === "ldr") {
      return `
        <div class="sensor-visual" style="display:grid; place-items:center">
          <div style="width:26px; height:26px; border-radius:50%; background:#d1a153; border:2.5px solid #ff4a5a; position:relative">
            <div style="position:absolute; inset:4px; border:1.5px solid #1c2128; border-radius:50%"></div>
          </div>
        </div>
      `;
    }
    return '<div class="sensor-visual"></div>';
  }

  // Bind specialized interactions like dragging potentiometer dial, clicking buttons
  function bindComponentEvents(part, type) {
    if (type === "potentiometer") {
      const knob = part.querySelector(".potentiometer-visual");
      if (knob) {
        let isDragging = false;
        
        knob.addEventListener("pointerdown", event => {
          event.stopPropagation();
          isDragging = true;
          knob.setPointerCapture(event.pointerId);
        });

        knob.addEventListener("pointermove", event => {
          if (!isDragging) return;
          event.stopPropagation();
          
          // Calculate angle relative to knob center
          const rect = knob.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = event.clientX - cx;
          const dy = event.clientY - cy;
          let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90; // offset
          if (angle < 0) angle += 360;
          
          // Clamp wiper between 0 and 270 degrees
          const clampedAngle = Math.min(270, Math.max(0, angle));
          const value = clampedAngle / 270;
          
          // Update knob rotation
          const needle = knob.style;
          needle.setProperty("--rotation", `${clampedAngle}deg`);
          knob.setAttribute("style", `transform: rotate(${clampedAngle}deg)`);
          
          // Set wiper value
          sim.state.inputs.potentiometerWiper = value;
          evaluateCircuit();
        });

        const stopKnobDrag = () => { isDragging = false; };
        knob.addEventListener("pointerup", stopKnobDrag);
        knob.addEventListener("pointercancel", stopKnobDrag);
      }
    }
    
    if (type === "button") {
      const body = part.querySelector(".part-body");
      if (body) {
        body.style.cursor = "pointer";
        body.innerHTML = `
          <div class="btn-visual" style="width:36px; height:36px; border-radius:6px; background:#ff4a5a; border:3px solid #21262d; box-shadow:0 3px 0 #21262d, 0 5px 10px rgba(0,0,0,0.5); transition:all 0.1s ease"></div>
        `;
        const visual = body.querySelector(".btn-visual");
        
        body.addEventListener("pointerdown", event => {
          event.stopPropagation();
          sim.state.inputs.buttonPressed = true;
          visual.style.transform = "translateY(3px)";
          visual.style.boxShadow = "none";
          evaluateCircuit();
        });

        const releaseButton = () => {
          sim.state.inputs.buttonPressed = false;
          visual.style.transform = "none";
          visual.style.boxShadow = "0 3px 0 #21262d, 0 5px 10px rgba(0,0,0,0.5)";
          evaluateCircuit();
        };

        body.addEventListener("pointerup", releaseButton);
        body.addEventListener("pointerleave", releaseButton);
        body.addEventListener("pointercancel", releaseButton);
      }
    }
  }

  function renderPinLabel(name, side, offset) {
    const label = document.createElement("span");
    label.className = "pin-label";
    label.dataset.side = side;
    label.textContent = name;
    if (side === "left" || side === "right") label.style.top = `${offset}px`;
    if (side === "top" || side === "bottom") label.style.left = `${offset}px`;
    
    // Add special coloring class for power rails to make diagram reading easy
    if (name === "5V" || name === "3V3" || name === "+") {
      label.style.color = "var(--danger)";
    } else if (name === "GND" || name === "-") {
      label.style.color = "rgba(139, 148, 158, 0.9)";
    }
    
    return label;
  }

  // Pointer dragging handler for parts
  function startDrag(event) {
    if (event.target.classList.contains("pin") || event.target.closest(".potentiometer-visual")) return;
    selectPart(event.currentTarget);
    dragState = {
      part: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      left: parseFloat(event.currentTarget.style.left),
      top: parseFloat(event.currentTarget.style.top)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  workspace.addEventListener("pointermove", event => {
    if (!dragState) return;
    const dx = (event.clientX - dragState.startX) / zoom;
    const dy = (event.clientY - dragState.startY) / zoom;
    
    // Math clamping to ensure parts don't go off canvas bounds
    const gridX = Math.round((dragState.left + dx) / 12) * 12; // Grid snap to 12px
    const gridY = Math.round((dragState.top + dy) / 12) * 12;
    
    dragState.part.style.left = `${Math.max(0, Math.min(900, gridX))}px`;
    dragState.part.style.top = `${Math.max(0, Math.min(500, gridY))}px`;
    refreshWires();
  });

  workspace.addEventListener("pointerup", () => {
    dragState = null;
  });

  workspace.addEventListener("dragover", event => event.preventDefault());
  workspace.addEventListener("drop", event => {
    event.preventDefault();
    const type = event.dataTransfer.getData("text/plain");
    const rect = workspace.getBoundingClientRect();
    addPart(type, (event.clientX - rect.left) / zoom - 60, (event.clientY - rect.top) / zoom - 30);
  });

  function selectPart(part) {
    document.querySelectorAll(".part.selected").forEach(node => node.classList.remove("selected"));
    selectedPart = part;
    if (part) part.classList.add("selected");
  }

  function removeSelectedPart() {
    if (!selectedPart) {
      benchHint.textContent = "Select a component first, then choose DEL.";
      return;
    }

    const removedId = selectedPart.dataset.id;
    wires.forEach((wire, index) => {
      if (wire.from.dataset.part === removedId || wire.to.dataset.part === removedId) wires[index] = null;
    });
    for (let index = wires.length - 1; index >= 0; index -= 1) {
      if (wires[index] === null) wires.splice(index, 1);
    }
    selectedWireIndex = null;

    if (activePin?.dataset.part === removedId) activePin = null;
    placedParts.delete(removedId);
    selectedPart.remove();
    selectedPart = null;
    
    pinDetails.innerHTML = "Click a pin or port to inspect voltage, protocol support, and common uses.";
    pinDetails.className = "empty-state";
    benchHint.textContent = "Component removed.";
    refreshWires();
    evaluateCircuit();
  }

  function getPinProfile(pinName) {
    if (pinProfiles[pinName]) return pinProfiles[pinName];

    if (/^D\d+$/.test(pinName)) {
      const pinNumber = Number(pinName.slice(1));
      const pwmPins = [3, 5, 6, 9, 10, 11];
      const uart = pinNumber === 0 ? "RX" : pinNumber === 1 ? "TX" : "No";
      const spi = pinNumber === 10 ? "SS" : pinNumber === 11 ? "MOSI" : pinNumber === 12 ? "MISO" : pinNumber === 13 ? "SCK" : "No";
      return {
        voltage: "0 or 5 V",
        io: pinNumber <= 1 ? "Serial digital" : "Digital I/O",
        pwm: pwmPins.includes(pinNumber) ? "Yes" : "No",
        analog: "No",
        i2c: "No",
        spi,
        uart,
        description: `${pinName} is an Arduino Uno digital pin for HIGH/LOW signals${pwmPins.includes(pinNumber) ? " and PWM output" : ""}.`,
        uses: ["LED output", "Button input", "Module signal"]
      };
    }

    if (/^A\d+$/.test(pinName)) {
      return {
        voltage: "0 to 5 V",
        io: "Analog input",
        pwm: "No",
        analog: "Yes",
        i2c: pinName === "A4" ? "SDA" : pinName === "A5" ? "SCL" : "No",
        spi: "No",
        uart: "No",
        description: `${pinName} reads changing voltage from analog sensors on the Arduino Uno.`,
        uses: ["Potentiometer", "LDR divider", "Analog sensor"]
      };
    }

    if (pinName === "VIN") {
      return {
        voltage: "7-12 V input",
        io: "External power",
        pwm: "No",
        analog: "No",
        i2c: "No",
        spi: "No",
        uart: "No",
        description: "VIN accepts external power through the Arduino regulator.",
        uses: ["Battery input", "External adapter"]
      };
    }

    return pinProfiles.SIG;
  }

  // Smart pin assistant sidebar updating
  function inspectPin(pin) {
    document.querySelectorAll(".pin.active").forEach(node => node.classList.remove("active"));
    pin.classList.add("active");
    const part = placedParts.get(pin.dataset.part);
    const profile = getPinProfile(pin.dataset.pin);

    pinDetails.className = "";
    pinDetails.innerHTML = `
      <div class="pin-card">
        <h4>${part.name}${part.spec ? ` (${part.spec})` : ""} - Pin ${pin.dataset.pin}</h4>
        <p>${profile.description}</p>
        <div class="pin-grid">
          <div><span>Voltage</span><strong>${profile.voltage}</strong></div>
          <div><span>Direction</span><strong>${profile.io}</strong></div>
          <div><span>PWM</span><strong>${profile.pwm}</strong></div>
          <div><span>Analog</span><strong>${profile.analog}</strong></div>
          <div><span>I2C</span><strong>${profile.i2c}</strong></div>
          <div><span>SPI / UART</span><strong>${profile.spi} / ${profile.uart}</strong></div>
        </div>
        <strong>Common uses:</strong>
        <ul>${profile.uses.map(use => `<li>${use}</li>`).join("")}</ul>
      </div>
    `;
  }

  // Draw wire paths
  function connectPin(pin) {
    if (!activePin) {
      activePin = pin;
      pin.classList.add("active");
      benchHint.textContent = `Wire starting at pin ${pin.dataset.pin}. Choose a second pin.`;
      return;
    }

    if (activePin === pin) {
      activePin = null;
      pin.classList.remove("active");
      benchHint.textContent = "Wire cancelled.";
      return;
    }

    // Add wire connection
    wires.push({ 
      from: activePin, 
      to: pin, 
      color: currentWireColor 
    });
    
    selectedWireIndex = wires.length - 1;
    activePin.classList.remove("active");
    activePin = null;
    benchHint.textContent = "Connection made.";
    refreshWires();
    evaluateCircuit();
  }

  // Redraw SVG wires on workspace
  function refreshWires() {
    wireLayer.innerHTML = "";
    updateOccupiedPins();
    
    wires.forEach((wire, index) => {
      const start = pinCenter(wire.from);
      const end = pinCenter(wire.to);
      
      // Calculate realistic sagging bezier wire coordinates
      const dx = Math.abs(end.x - start.x);
      const dy = Math.abs(end.y - start.y);
      const midX = dx * 0.45;
      
      // Add sagging droop based on distance
      const droopY = Math.max(30, dx * 0.15 + dy * 0.1);
      const ctrl1Y = start.y + (end.y > start.y ? droopY : -droopY * 0.2);
      const ctrl2Y = end.y + (start.y > end.y ? droopY : -droopY * 0.2);

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.dataset.wireIndex = String(index);
      path.classList.toggle("selected-wire", index === selectedWireIndex);
      path.setAttribute("d", `M ${start.x} ${start.y} C ${start.x + midX} ${ctrl1Y}, ${end.x - midX} ${ctrl2Y}, ${end.x} ${end.y}`);
      
      // Choose color
      const strokeColor = wire.color || wireColor(wire);
      path.setAttribute("stroke", strokeColor);
      
      // Allow clicking SVG path to select/recolor wire
      path.addEventListener("click", event => {
        event.stopPropagation();
        selectedWireIndex = index;
        currentWireColor = wire.color || wireColor(wire);
        syncActiveWireSwatch();
        refreshWires();
        benchHint.textContent = "Wire selected. Choose a color to swap.";
      });

      wireLayer.appendChild(path);
    });
  }

  function updateOccupiedPins() {
    document.querySelectorAll(".pin.wired").forEach(pin => pin.classList.remove("wired"));
    wires.forEach(wire => {
      wire.from.classList.add("wired");
      wire.to.classList.add("wired");
    });
  }

  function pinCenter(pin) {
    const pinRect = pin.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    return {
      x: (pinRect.left - workspaceRect.left + pinRect.width / 2) / zoom,
      y: (pinRect.top - workspaceRect.top + pinRect.height / 2) / zoom
    };
  }

  // Resolves wire coloring based on node types
  function wireColor(wire) {
    const names = [wire.from.dataset.pin, wire.to.dataset.pin];
    if (names.includes("5V") || names.includes("3V3") || names.includes("+")) return "#ff4a5a";
    if (names.includes("GND") || names.includes("-")) return "#8b949e";
    if (names.includes("SDA") || names.includes("SCL")) return "#00f2fe";
    return "#ffc837";
  }

  function getPartByType(type) {
    return [...placedParts.values()].find(part => part.type === type) || null;
  }

  function ensurePart(type, x, y) {
    const existing = getPartByType(type);
    if (existing) return existing.element;
    return addPart(type, x, y);
  }

  function findPin(part, pinName) {
    return part?.querySelector(`.pin[data-pin="${pinName}"]`) || null;
  }

  function hasWire(pinA, pinB) {
    return wires.some(wire => (wire.from === pinA && wire.to === pinB) || (wire.from === pinB && wire.to === pinA));
  }

  function connectPins(partA, pinAName, partB, pinBName) {
    const pinA = findPin(partA, pinAName);
    const pinB = findPin(partB, pinBName);
    if (!pinA || !pinB || hasWire(pinA, pinB)) return false;
    wires.push({ from: pinA, to: pinB, color: wireColor({ from: pinA, to: pinB }) });
    selectedWireIndex = wires.length - 1;
    return true;
  }

  // Auto connect wiring animations
  function autoConnectFromQuestion(question) {
    const q = question.toLowerCase();
    const arduino = ensurePart("arduino", 60, 80);
    let added = 0;
    let summary = "I set up the schematic around the Arduino Uno.";

    if (q.includes("ultrasonic") || q.includes("distance")) {
      const sensor = ensurePart("ultrasonic", 585, 110);
      added += connectPins(arduino, "5V", sensor, "+") ? 1 : 0;
      added += connectPins(arduino, "GND", sensor, "-") ? 1 : 0;
      added += connectPins(arduino, "D9", sensor, "TRIG") ? 1 : 0;
      added += connectPins(arduino, "D8", sensor, "ECHO") ? 1 : 0;
      summary = "Auto connected an ultrasonic range sensor: VCC to 5V, GND to GND, trigger pin to D9, and echo pin to D8.";
    } else if (q.includes("servo")) {
      const servo = ensurePart("servo", 680, 300);
      added += connectPins(arduino, "5V", servo, "+") ? 1 : 0;
      added += connectPins(arduino, "GND", servo, "-") ? 1 : 0;
      added += connectPins(arduino, "D9", servo, "SIG") ? 1 : 0;
      summary = "Auto connected a PWM servo motor: signal pin to D9, power pin to 5V, and ground return to GND.";
    } else if (q.includes("lcd") || q.includes("display") || q.includes("i2c")) {
      const lcd = ensurePart("lcd", 650, 110);
      added += connectPins(arduino, "5V", lcd, "+") ? 1 : 0;
      added += connectPins(arduino, "GND", lcd, "-") ? 1 : 0;
      added += connectPins(arduino, "SDA", lcd, "SDA") ? 1 : 0;
      added += connectPins(arduino, "SCL", lcd, "SCL") ? 1 : 0;
      summary = "Auto connected an I2C character display: VCC, GND, SDA, and SCL data/clock rails.";
    } else {
      // Standard LED safe circuit
      const resistor = ensurePart("resistor", 340, 125);
      const led = ensurePart("led", 470, 110);
      added += connectPins(arduino, "D13", resistor, "+") ? 1 : 0;
      added += connectPins(resistor, "-", led, "+") ? 1 : 0;
      added += connectPins(led, "-", arduino, "GND") ? 1 : 0;
      summary = "Auto connected an LED series circuit: digital output D13 to resistor, resistor in series to LED anode, LED cathode to GND.";
    }

    activePin = null;
    document.querySelectorAll(".pin.active").forEach(node => node.classList.remove("active"));
    
    // Animate drawing wires
    refreshWires();
    evaluateCircuit();
    
    benchHint.textContent = `${summary} Created ${added} new wire connections.`;
    appendChatMessage("assistant", `**Auto-wiring complete**: ${summary}`);
  }

  // Update check results panel
  function evaluateCircuit() {
    const checks = mentor.runConnectionChecks(placedParts, wires);
    
    checksList.innerHTML = checks.map(check => `
      <div class="check ${check.level}">
        <strong>${check.title}</strong>
        <p>${check.text}</p>
      </div>
    `).join("");

    projectMeta.textContent = `Arduino starter project - ${placedParts.size} components - ${checks.length} checks`;
  }

  function setTool(tool) {
    activeTool = tool;
    document.querySelectorAll(".toolbar .icon-button").forEach(button => button.classList.remove("active"));
    if (tool === "select") document.querySelector("#selectTool").classList.add("active");
    if (tool === "wire") document.querySelector("#wireTool").classList.add("active");
    benchHint.textContent = tool === "wire" ? "Click a pin to start. Select a wire to recolor it." : "Drag components or click to select.";
  }

  function setZoom(nextZoom) {
    zoom = Math.min(1.3, Math.max(0.75, nextZoom));
    workspace.style.transform = `scale(${zoom})`;
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    refreshWires();
  }

  // Toggles continuous execution clock (30fps)
  function runSimulation() {
    const isRunning = !sim.state.running;
    sim.state.running = isRunning;
    
    runButton.textContent = isRunning ? "Stop Simulation" : "Run Simulation";
    runButton.classList.toggle("running", isRunning);
    workspace.classList.toggle("sim-glow", isRunning);
    
    // Add animations to output servos
    document.querySelectorAll('[data-type="servo"]').forEach(part => {
      part.classList.toggle("servo-running", isRunning);
    });

    if (isRunning) {
      // Start simulator clock at 30 fps
      simInterval = setInterval(() => {
        sim.update(placedParts, wires, 33); // 33ms step
        updateUIValues();
      }, 33);
      benchHint.textContent = "Simulation running. Voltages and waveforms updating.";
    } else {
      clearInterval(simInterval);
      simInterval = null;
      sim.update(placedParts, wires, 0); // resets
      updateUIValues();
      benchHint.textContent = "Simulation stopped.";
    }
  }

  // Write readings into digital readout and screen widgets
  function updateUIValues() {
    const state = sim.state;
    
    // Set metric badges
    metricVoltage.textContent = `${state.simulationMetrics.voltage.toFixed(2)} V`;
    metricCurrent.textContent = `${state.simulationMetrics.current} mA`;
    metricPower.textContent = `${state.simulationMetrics.power} mW`;
    metricSensor.textContent = state.simulationMetrics.sensor;

    // Toggle LED light glows
    const ledNode = document.querySelector('[data-type="led"] .led-visual');
    if (ledNode) {
      ledNode.classList.remove("glow");
      if (state.ledState === "glowing") {
        ledNode.classList.add("glow");
        ledNode.style.background = `radial-gradient(circle at 35% 28%, #fff, #ff4a5a 40%, #c01828 80%, #730f0f 100%)`;
      } else if (state.ledState === "blown") {
        // Charred/burnt out look
        ledNode.style.background = `radial-gradient(circle at 35% 28%, #4e4a4a, #1a1515 80%)`;
        ledNode.style.boxShadow = "none";
      } else {
        // Off
        ledNode.style.background = `radial-gradient(circle at 35% 28%, #ffb3b3, #b81d1d 60%, #730f0f 100%)`;
      }
    }

    // Rotate Servo horns
    const servoHorns = document.querySelectorAll(".servo-horn");
    servoHorns.forEach(horn => {
      horn.style.transform = `rotate(${state.servoAngle - 90}deg)`;
    });

    // Write text to LCD screens
    const lcdScreen = document.querySelector(".lcd-screen");
    if (lcdScreen) {
      if (state.running) {
        const usVal = state.simulationMetrics.sensor;
        if (usVal !== "Idle" && usVal !== "SHORT DETECTED") {
          lcdScreen.innerHTML = `HC-SR04 Display:<br>Distance: ${usVal}`;
        } else {
          lcdScreen.innerHTML = `Circuit Mentor:<br>Sim Active`;
        }
      } else {
        lcdScreen.innerHTML = `LCD 16x2 I2C<br>Awaiting signal`;
      }
    }

    // Instrument tabs updates
    const activeTab = document.querySelector("#instrumentTabs .active").dataset.tab;
    renderInstrumentContent(activeTab);
  }

  // Draw multimeter texts or oscilloscope waves
  function renderInstrumentContent(tab) {
    const state = sim.state;
    const isRunning = state.running;

    if (tab === "scope") {
      // Draw actual SVG waveform lines dynamically
      const points = state.oscilloscopeWave.map((y, x) => `${x * 3.5},${y}`).join(" ");
      instrumentReadout.innerHTML = `
        <div style="font-size:11px; margin-bottom:4px; color:var(--accent)">CH1 Oscilloscope (D9 PWM/Output Signal)</div>
        <svg class="scope-canvas" viewBox="0 0 350 50">
          <g class="scope-grid">
            <line x1="0" y1="12.5" x2="350" y2="12.5" stroke-dasharray="2 4"/>
            <line x1="0" y1="25" x2="350" y2="25" stroke-dasharray="2 4"/>
            <line x1="0" y1="37.5" x2="350" y2="37.5" stroke-dasharray="2 4"/>
            <line x1="87.5" y1="0" x2="87.5" y2="50" stroke-dasharray="2 4"/>
            <line x1="175" y1="0" x2="175" y2="50" stroke-dasharray="2 4"/>
            <line x1="262.5" y1="0" x2="262.5" y2="50" stroke-dasharray="2 4"/>
          </g>
          <polyline class="scope-wave" points="${points}"/>
        </svg>
        <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:4px; color:var(--muted)">
          <span>Volts/Div: 2V</span>
          <span>Timebase: 5ms</span>
        </div>
      `;
      return;
    }

    // Default text readouts
    const rows = {
      multimeter: isRunning ? [
        `VCC to GND: ${state.multimeterReadings.vccGnd.toFixed(2)} V`,
        `D13 output: ${state.multimeterReadings.d13Gnd.toFixed(2)} V`,
        `LED Current: ${state.multimeterReadings.current.toFixed(1)} mA`
      ] : [
        "VCC to GND: 0.00 V",
        "Continuity: Open",
        "Current: 0.0 mA"
      ],
      serial: isRunning ? [
        "--- Serial Monitor (9600 Baud) ---",
        ...state.serialOutput
      ] : [
        "Serial Monitor Closed",
        "Power on board to read output..."
      ],
      power: isRunning ? [
        "Bench Power Supply: Enabled",
        `Load voltage: ${state.simulationMetrics.voltage.toFixed(2)} V`,
        `Current limit: 500 mA`,
        `Total load: ${(state.simulationMetrics.power / 1000).toFixed(3)} W`
      ] : [
        "Bench Power Supply: Offline",
        "Voltage output: 0.00 V",
        "Load power: 0.00 W"
      ]
    };

    instrumentReadout.innerHTML = rows[tab].join("<br>");
  }

  // Conversation logs UI builder
  function appendChatMessage(sender, text) {
    const bubble = document.createElement("div");
    bubble.className = `mentor-msg ${sender}`;
    bubble.innerHTML = text;
    mentorLog.appendChild(bubble);
    mentorLog.scrollTop = mentorLog.scrollHeight;
  }

  function submitMentorQuestion() {
    const question = mentorQuestion.value.trim();
    if (!question) return;
    
    appendChatMessage("user", escapeHtml(question));
    pendingAiQuestion = question;
    mentorQuestion.value = "";

    // Show Auto-Connect proposal modal if matching keyword trigger
    const qLower = question.toLowerCase();
    const isAutoConnectable = qLower.includes("connect") || qLower.includes("wire") || qLower.includes("setup") || qLower.includes("circuit") || qLower.includes("led") || qLower.includes("ultrasonic") || qLower.includes("servo") || qLower.includes("lcd");
    
    if (isAutoConnectable) {
      showAiAutoModal(question);
    } else {
      const response = mentor.generateResponse(question, placedParts, wires);
      setTimeout(() => appendChatMessage("assistant", response), 300);
    }
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function showAiAutoModal(question) {
    aiAutoMessage.textContent = `The AI Mentor can either explain "${question}" conceptually, or automatically draw the recommended connections for you in the workspace.`;
    aiAutoModal.classList.remove("hidden");
    aiAutoConnect.focus();
  }

  function closeAiAutoModal() {
    aiAutoModal.classList.add("hidden");
  }

  function openComponentModal(type) {
    const spec = componentSpecs[type];
    if (!spec) return;
    pendingComponentType = type;
    selectedComponentSpec = spec.defaultSpec;
    componentModalTitle.textContent = spec.title;
    componentModalKind.textContent = spec.unit;
    customSpecInput.value = "";
    
    componentOptions.innerHTML = spec.options.map((option, index) => `
      <button class="spec-option ${index === 0 ? "active" : ""}" data-spec="${escapeHtml(option)}" type="button">
        ${escapeHtml(option)}
      </button>
    `).join("");
    
    componentModal.classList.remove("hidden");
    componentOptions.querySelector(".spec-option")?.focus();
  }

  function closeComponentModal() {
    componentModal.classList.add("hidden");
    pendingComponentType = null;
    selectedComponentSpec = "";
  }

  function addConfiguredComponent() {
    if (!pendingComponentType) return;
    const custom = customSpecInput.value.trim();
    const spec = custom || selectedComponentSpec || componentSpecs[pendingComponentType].defaultSpec;
    addPart(pendingComponentType, undefined, undefined, spec);
    benchHint.textContent = `Added component with value: ${spec}.`;
    closeComponentModal();
  }

  // Synchronize wire palette active indicator
  function syncActiveWireSwatch() {
    document.querySelectorAll(".wire-swatch").forEach(node => {
      node.classList.toggle("active", node.dataset.wireColor === currentWireColor);
    });
  }

  // --- Bind DOM UI Event Listeners ---
  
  // Library Search Filter
  document.querySelector("#componentSearch").addEventListener("input", event => {
    renderLibrary(event.target.value);
  });
  
  // Toolbar buttons
  document.querySelector("#selectTool").addEventListener("click", () => setTool("select"));
  document.querySelector("#wireTool").addEventListener("click", () => setTool("wire"));
  removeTool.addEventListener("click", removeSelectedPart);
  
  document.querySelector("#rotateTool").addEventListener("click", () => {
    if (!selectedPart) return;
    const current = Number(selectedPart.dataset.rotation || 0);
    const nextRot = (current + 90) % 360;
    selectedPart.dataset.rotation = String(nextRot);
    selectedPart.style.transform = `rotate(${nextRot}deg)`;
    
    // Correct offsets for wires when rotated
    refreshWires();
  });
  
  document.querySelector("#zoomOut").addEventListener("click", () => setZoom(zoom - 0.1));
  document.querySelector("#zoomIn").addEventListener("click", () => setZoom(zoom + 0.1));
  runButton.addEventListener("click", runSimulation);

  // Wire swatches
  document.querySelectorAll(".wire-swatch").forEach(button => {
    button.style.setProperty("--swatch", button.dataset.wireColor);
    button.addEventListener("click", () => {
      currentWireColor = button.dataset.wireColor;
      if (selectedWireIndex !== null && wires[selectedWireIndex]) {
        wires[selectedWireIndex].color = currentWireColor;
        benchHint.textContent = "Swapped wire color.";
        refreshWires();
      } else {
        benchHint.textContent = "Color selected. Click a pin to start wiring.";
      }
      syncActiveWireSwatch();
    });
  });

  // Instrument Tabs Click
  document.querySelector("#instrumentTabs").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    document.querySelectorAll("#instrumentTabs button").forEach(node => node.classList.remove("active"));
    button.classList.add("active");
    renderInstrumentContent(button.dataset.tab);
  });

  // AI Chat Submit handlers
  mentorForm.addEventListener("submit", event => {
    event.preventDefault();
    submitMentorQuestion();
  });

  mentorQuestion.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitMentorQuestion();
    }
  });

  // Modal actions
  aiExplainOnly.addEventListener("click", () => {
    closeAiAutoModal();
    const response = mentor.generateResponse(pendingAiQuestion, placedParts, wires);
    appendChatMessage("assistant", response);
  });

  aiAutoConnect.addEventListener("click", () => {
    closeAiAutoModal();
    const response = mentor.generateResponse(pendingAiQuestion, placedParts, wires);
    appendChatMessage("assistant", response);
    autoConnectFromQuestion(pendingAiQuestion);
  });

  aiAutoModal.addEventListener("click", event => {
    if (event.target === aiAutoModal) {
      closeAiAutoModal();
      const response = mentor.generateResponse(pendingAiQuestion, placedParts, wires);
      appendChatMessage("assistant", response);
    }
  });

  componentOptions.addEventListener("click", event => {
    const button = event.target.closest(".spec-option");
    if (!button) return;
    selectedComponentSpec = button.dataset.spec;
    customSpecInput.value = "";
    componentOptions.querySelectorAll(".spec-option").forEach(node => node.classList.remove("active"));
    button.classList.add("active");
  });

  customSpecInput.addEventListener("input", () => {
    componentOptions.querySelectorAll(".spec-option").forEach(node => node.classList.remove("active"));
  });

  componentCancel.addEventListener("click", closeComponentModal);
  componentAdd.addEventListener("click", addConfiguredComponent);
  componentModal.addEventListener("click", event => {
    if (event.target === componentModal) closeComponentModal();
  });

  // Keyboard Shortcuts (Delete to remove, Esc to cancel action/modals)
  document.addEventListener("keydown", event => {
    if (event.key === "Delete" || event.key === "Backspace") {
      if (document.activeElement === mentorQuestion || document.activeElement === document.querySelector("#componentSearch") || document.activeElement === customSpecInput) return;
      removeSelectedPart();
    }

    if (event.key === "Escape") {
      if (!componentModal.classList.contains("hidden")) {
        closeComponentModal();
        return;
      }
      if (!aiAutoModal.classList.contains("hidden")) {
        closeAiAutoModal();
        const response = mentor.generateResponse(pendingAiQuestion, placedParts, wires);
        appendChatMessage("assistant", response);
        return;
      }
      activePin = null;
      selectedWireIndex = null;
      document.querySelectorAll(".pin.active").forEach(node => node.classList.remove("active"));
      refreshWires();
      benchHint.textContent = "Action cancelled.";
    }
  });

  // Bind Interactive Sliders (Ultrasonic Range & LDR ambient light)
  if (rangeDistance) {
    rangeDistance.addEventListener("input", event => {
      const val = Number(event.target.value);
      valDistance.textContent = `${val}cm`;
      sim.state.inputs.ultrasonicDistance = val;
      if (sim.state.running) evaluateCircuit();
    });
  }

  if (rangeLight) {
    rangeLight.addEventListener("input", event => {
      const val = Number(event.target.value);
      valLight.textContent = `${val}%`;
      sim.state.inputs.ldrLightLevel = val;
      if (sim.state.running) evaluateCircuit();
    });
  }

  // --- Progressive Web App Installer Binding ---
  window.addEventListener("beforeinstallprompt", event => {
    // Prevent default browser install banner from appearing
    event.preventDefault();
    deferredPrompt = event;
    // Show custom Install App button
    if (pwaInstallBtn) {
      pwaInstallBtn.classList.add("visible");
    }
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener("click", () => {
      if (!deferredPrompt) return;
      // Prompt user
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choiceResult => {
        if (choiceResult.outcome === "accepted") {
          console.log("PWA Installation accepted.");
        }
        deferredPrompt = null;
        pwaInstallBtn.classList.remove("visible");
      });
    });
  }

  window.addEventListener("appinstalled", () => {
    console.log("Circuit Mentor PWA installed successfully.");
    if (pwaInstallBtn) pwaInstallBtn.classList.remove("visible");
  });

  // --- Register Offline Service Worker ---
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .then(reg => console.log("Service Worker registered successfully.", reg.scope))
        .catch(err => console.log("Service Worker registration failed.", err));
    });
  }

  // Initialize Library & Starter Circuit
  renderLibrary();
  
  // Places initial board, resistor, LED, and ultrasonic distance sensor
  addPart("arduino", 60, 80);
  addPart("resistor", 340, 125);
  addPart("led", 470, 110);
  addPart("ultrasonic", 585, 110);
  
  setTool("wire");
  renderInstrumentContent("multimeter");
  evaluateCircuit();
  
  appendChatMessage("assistant", "🤖 **Mentor**: Welcome to Circuit Mentor! Drag components from the left shelf onto the workspace. Use the **WIRE** tool to link pins. Run the simulation to see voltages and waveforms update.");
})();
