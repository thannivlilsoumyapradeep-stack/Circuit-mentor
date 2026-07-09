window.CircuitMentor = (() => {
  
  // Runs circuit-wide safety and design checks
  function runConnectionChecks(placedParts, wires) {
    const checks = [];
    const sim = window.CircuitSimulator;
    if (!sim) return checks;

    // 1. Check for short circuits
    let hasShort = false;
    let board = null;
    for (const [id, part] of placedParts.entries()) {
      if (["arduino", "esp32", "pi"].includes(part.type)) {
        board = part;
        break;
      }
    }

    if (board) {
      const pin5V = board.element.querySelector('.pin[data-pin="5V"]') || board.element.querySelector('.pin[data-pin="3V3"]') || board.element.querySelector('.pin[data-pin="VCC"]');
      const pinGND = board.element.querySelector('.pin[data-pin="GND"]') || board.element.querySelector('.pin[data-pin="-"]');
      
      if (pin5V && pinGND && sim.arePinsConnected(pin5V, pinGND, placedParts, wires)) {
        hasShort = true;
      }
    }

    // Secondary short check: any component '+' directly connected to '-' with no resistance
    wires.forEach(wire => {
      const p1 = wire.from.dataset.pin;
      const p2 = wire.to.dataset.pin;
      if ((p1 === "5V" || p1 === "3V3" || p1 === "+") && (p2 === "GND" || p2 === "-")) {
        hasShort = true;
      }
    });

    if (hasShort) {
      checks.push({
        level: "danger",
        title: "Power short detected",
        text: "VCC is connected directly to GND. This will draw excessive current, causing the board regulator to shut down or damage components. Remove the shorting wire."
      });
    }

    // 2. LED Resistor Check
    const ledPart = [...placedParts.values()].find(part => part.type === "led");
    const resistorPart = [...placedParts.values()].find(part => part.type === "resistor");
    
    if (ledPart) {
      const ledAnode = ledPart.element.querySelector('.pin[data-pin="+"]');
      const ledCathode = ledPart.element.querySelector('.pin[data-pin="-"]');
      
      // Is LED cathode connected to GND?
      let hasGnd = false;
      if (board) {
        const pinGND = board.element.querySelector('.pin[data-pin="GND"]');
        hasGnd = sim.arePinsConnected(ledCathode, pinGND, placedParts, wires);
      }

      if (ledAnode) {
        const anodeNet = sim.findConnectedPins(ledAnode, placedParts, wires);
        let hasPower = false;
        if (board) {
          const pin5V = board.element.querySelector('.pin[data-pin="5V"]');
          const pinD13 = board.element.querySelector('.pin[data-pin="D13"]');
          hasPower = anodeNet.includes(pin5V) || anodeNet.includes(pinD13);
        }

        if (hasPower && hasGnd) {
          // Connected. Is there a resistor?
          let hasRes = false;
          anodeNet.forEach(pin => {
            const parent = placedParts.get(pin.dataset.part);
            if (parent && parent.type === "resistor") {
              hasRes = true;
            }
          });

          if (!hasRes) {
            checks.push({
              level: "warn",
              title: "LED Resistor Missing",
              text: "The LED is powered but lacks a current-limiting resistor. It will draw too much current and burn out in a real circuit. Place a 220 or 330 ohm resistor in series."
            });
          }
        }
      }
    }

    // 3. Servo Power Note
    const hasServo = [...placedParts.values()].some(part => part.type === "servo");
    if (hasServo) {
      checks.push({
        level: "warn",
        title: "Servo Power Warning",
        text: "Servos contain DC motors that draw high surge currents. Powering them directly from an Arduino 5V regulator can cause board resets. In real circuits, use an external 5V source with shared GND."
      });
    }

    // 4. Pin capability check
    // If a sensor is connected, make sure it is connected to appropriate pins
    let sensorMismatch = false;
    let sensorMismatchMsg = "";
    for (const [id, part] of placedParts.entries()) {
      if (part.type === "ldr") {
        const ldrSig = part.element.querySelector('.pin[data-pin="SIG"]');
        if (ldrSig) {
          const net = sim.findConnectedPins(ldrSig, placedParts, wires);
          // A0 is analog, D0-D13 are digital
          const digitalPins = net.filter(p => /^D\d+$/.test(p.dataset.pin));
          if (digitalPins.length > 0) {
            sensorMismatch = true;
            sensorMismatchMsg = "Light sensor (LDR) outputs an analog voltage. It should be connected to A0-A5, not a digital pin.";
            break;
          }
        }
      }
    }

    if (sensorMismatch) {
      checks.push({
        level: "warn",
        title: "Pin Capability Mismatch",
        text: sensorMismatchMsg
      });
    }

    // 5. Open Circuit check (any component completely disconnected)
    const disconnectedParts = [];
    placedParts.forEach((part, id) => {
      const pins = part.element.querySelectorAll(".pin");
      let isConnected = false;
      pins.forEach(pin => {
        const wired = wires.some(w => w.from === pin || w.to === pin);
        if (wired) isConnected = true;
      });
      if (!isConnected && placedParts.size > 1) {
        disconnectedParts.push(part.name);
      }
    });

    if (disconnectedParts.length > 0) {
      checks.push({
        level: "ok",
        title: "Floating components",
        text: `The following parts are not connected to anything: ${disconnectedParts.join(", ")}. Use the WIRE tool to tie them into your design.`
      });
    }

    // Default safe check
    if (checks.length === 0) {
      checks.push({
        level: "ok",
        title: "Ready to simulate",
        text: "No obvious wiring problems found in the current circuit. Press 'Run Simulation' to power on the board."
      });
    } else if (!checks.some(c => c.level === "danger")) {
      checks.unshift({
        level: "ok",
        title: "No dangerous shorts",
        text: "No power-to-ground shorts detected. You can safely simulate, but review warnings for circuit longevity."
      });
    }

    return checks;
  }

  // Conversational response engine
  function generateResponse(question, placedParts, wires) {
    const q = question.toLowerCase();
    const sim = window.CircuitSimulator;
    
    // Analyze active circuit issues first
    const activeChecks = runConnectionChecks(placedParts, wires);
    const hasDanger = activeChecks.find(c => c.level === "danger");
    const hasWarn = activeChecks.find(c => c.level === "warn");

    // Contextual responses based on state
    if (q.includes("wrong") || q.includes("debug") || q.includes("help") || q.includes("why")) {
      if (hasDanger) {
        return `⚠️ **Critical Danger Detected**: There is currently a short circuit! **${hasDanger.title}** - ${hasDanger.text} You should delete the shorting wires before proceeding.`;
      }
      if (hasWarn) {
        return `💡 **Design Notice**: I reviewed your schematic and found a potential issue: **${hasWarn.title}**. ${hasWarn.text}`;
      }
      return `Everything looks electronically sound! The power rails are clean, and there are no immediate assembly errors. If you're having logic issues, check if your microcontroller code (like the pin mappings) matches the physical wire connections!`;
    }

    if (q.includes("led")) {
      let ledAdvice = "To build a working LED circuit, connect a digital pin (like D13) to a resistor, connect the other end of the resistor to the LED anode (+), and connect the LED cathode (-) to GND.";
      
      const ledPart = [...placedParts.values()].find(part => part.type === "led");
      if (ledPart) {
        const hasResistor = [...placedParts.values()].some(p => p.type === "resistor");
        const ledCathode = ledPart.element.querySelector('.pin[data-pin="-"]');
        let cathodeGnd = false;
        if (sim) {
          const board = [...placedParts.values()].find(p => ["arduino", "esp32"].includes(p.type));
          const pinGND = board ? board.element.querySelector('.pin[data-pin="GND"]') : null;
          cathodeGnd = sim.arePinsConnected(ledCathode, pinGND, placedParts, wires);
        }

        if (!hasResistor) {
          ledAdvice += "<br><br>⚠️ **Note**: Your workspace contains an LED but no resistor. Adding a 220 ohm resistor is essential to limit current and protect the LED.";
        } else if (!cathodeGnd) {
          ledAdvice += "<br><br>🔌 **Note**: Your LED cathode (-) is currently not returned to Ground (GND). Completing the ground path is required for current to flow.";
        } else {
          ledAdvice += "<br><br>✅ **Status**: Your LED wiring looks correct. Start the simulation to see it pulse!";
        }
      }
      return ledAdvice;
    }

    if (q.includes("resistor")) {
      return `⚡ **Resistors** limit current. Without a resistor in series with an LED, the diode acts as a near short-circuit. It draws massive current ($I = V/R$) which will instantly destroy the LED and potentially burn out the microcontroller output pin. 
      <br><br>Common values:
      - **220 / 330 ohm**: Best for standard LEDs at 5V logic.
      - **10 kohm**: Best for pull-up or pull-down resistors (like buttons or LDR voltage dividers).`;
    }

    if (q.includes("ultrasonic") || q.includes("distance")) {
      return `📏 **HC-SR04 Ultrasonic Distance Sensor**:
      - **How it works**: Sends a 40 kHz sound pulse from the transmitter. If it hits an object, the sound bounces back and is received by the receiver. The sensor calculates distance by measuring the time of flight:
        $$\\text{Distance (cm)} = \\frac{\\text{Time (us)} \\times 0.034}{2}$$
      - **Connections**: 
        - **+** to 5V power.
        - **-** to GND.
        - **TRIG** (Trigger) to output pin (sends trigger pulse).
        - **ECHO** to input pin (receives echo width).`;
    }

    if (q.includes("servo") || q.includes("motor")) {
      return `⚙️ **Servo Motor**:
      - Servos are geared motors controlled by a pulse-width modulated (PWM) signal. The width of the pulse (usually between 1ms and 2ms) maps to an angle between 0° and 180°.
      - **Connections**:
        - **+** connects to 5V supply.
        - **-** connects to GND.
        - **SIG** connects to a PWM-capable digital pin (such as **D9** on the Arduino Uno).`;
    }

    if (q.includes("lcd") || q.includes("display")) {
      return `📺 **I2C LCD Display**:
      - Uses the **I2C serial protocol**, which reduces the number of connections from 12+ wires to just 4!
      - **Connections**:
        - **+** (VCC) to 5V.
        - **-** (GND) to Ground.
        - **SDA** (Serial Data) to matching board SDA pin.
        - **SCL** (Serial Clock) to matching board SCL pin.`;
    }

    if (q.includes("potentiometer") || q.includes("pot")) {
      return `🎛️ **Potentiometer**:
      - A potentiometer is an adjustable three-terminal resistor. The outer terminals connect to VCC and GND, establishing a voltage gradient. The center terminal (**SIG**, the wiper) taps off a portion of that voltage, which varies between 0V and 5V as you rotate the dial. Connect the wiper pin to an analog pin like **A0** to read the dial position.`;
    }

    if (q.includes("short")) {
      return `💥 **Short Circuits**:
      A short circuit occurs when a power supply line has a direct path to ground with almost zero resistance. In $I = V / R$, when $R$ is close to 0, current $I$ spikes extremely high. This releases thermal energy, melts wires, blows board fuses, or destroys microcontrollers. Always verify that VCC and GND lines do not touch directly.`;
    }

    // Default Fallback
    return `🤖 **Mentor**: Hello! I am your Virtual Circuit Mentor. I monitor your wiring in real time. 
    <br><br>You can ask me questions about:
    - LED current calculations.
    - How to wire specific components (Ultrasonic, Servo, LCD, LDR).
    - What is currently wrong with your circuit schematic (type **"what is wrong"**).
    - Troubleshooting short circuits.`;
  }

  return {
    runConnectionChecks,
    generateResponse
  };
})();
