window.CircuitSimulator = (() => {
  // Simulator configuration and state
  const state = {
    running: false,
    time: 0,
    ledCurrent: 0,
    ledVoltage: 0,
    ledState: "off", // off, glowing, blown
    servoAngle: 0,
    oscilloscopeWave: [],
    serialOutput: [],
    multimeterReadings: { vccGnd: 0, d13Gnd: 0, current: 0 },
    simulationMetrics: { voltage: 0, current: 0, power: 0, sensor: "Idle" },
    
    // Interactive inputs changed by user
    inputs: {
      potentiometerWiper: 0.5, // 0 to 1
      buttonPressed: false,
      ultrasonicDistance: 23,  // cm
      ldrLightLevel: 50,       // %
      dhtTemperature: 24,      // °C
      dhtHumidity: 45          // %
    }
  };

  // Traversal & graph building helper
  // Find all components connected to a starting pin
  function findConnectedPins(startPin, placedParts, wires) {
    const visited = new Set();
    const queue = [startPin];
    const pins = [];

    while (queue.length > 0) {
      const pin = queue.shift();
      const key = `${pin.dataset.part}:${pin.dataset.pin}`;
      if (visited.has(key)) continue;
      visited.add(key);
      pins.push(pin);

      // Find wires connected to this pin
      wires.forEach(wire => {
        if (wire.from === pin) {
          queue.push(wire.to);
        } else if (wire.to === pin) {
          queue.push(wire.from);
        }
      });
    }

    return pins;
  }

  // Check if two specific pins are connected
  function arePinsConnected(pinA, pinB, placedParts, wires) {
    if (!pinA || !pinB) return false;
    const connected = findConnectedPins(pinA, placedParts, wires);
    return connected.includes(pinB);
  }

  // Parse resistor spec to ohm value
  function parseResistorSpec(spec) {
    if (!spec) return 220; // Default
    const match = spec.match(/([\d.]+)\s*(k?)\s*ohm/i);
    if (!match) return 220;
    let val = parseFloat(match[1]);
    if (match[2] && match[2].toLowerCase() === "k") {
      val *= 1000;
    }
    return val;
  }

  // Main simulation tick
  // This is called periodically (e.g. 50ms) to update simulated voltages, currents, and device behaviors
  function update(placedParts, wires, timeStepMs) {
    if (!state.running) {
      state.time = 0;
      state.ledCurrent = 0;
      state.ledVoltage = 0;
      state.ledState = "off";
      state.servoAngle = 0;
      state.multimeterReadings = { vccGnd: 0, d13Gnd: 0, current: 0 };
      state.simulationMetrics = { voltage: 0, current: 0, power: 0, sensor: "Idle" };
      state.oscilloscopeWave = Array(100).fill(25); // flat line
      return;
    }

    state.time += timeStepMs;

    // 1. Resolve Arduino/Board Pins
    // Find placed microcontroller boards
    let board = null;
    let boardId = null;
    for (const [id, part] of placedParts.entries()) {
      if (["arduino", "esp32", "pi"].includes(part.type)) {
        board = part;
        boardId = id;
        break;
      }
    }

    if (!board) {
      // No microcontrollers, simple DC simulation if breadboard + battery exists
      // Let's assume Arduino is default since it loads initially
      return;
    }

    const findBoardPin = (pinName) => {
      return board.element.querySelector(`.pin[data-pin="${pinName}"]`);
    };

    const pin5V = findBoardPin("5V") || findBoardPin("3V3") || findBoardPin("VCC");
    const pinGND = findBoardPin("GND") || findBoardPin("-");
    const pinD13 = findBoardPin("D13") || findBoardPin("GPIO18");
    const pinD9 = findBoardPin("D9");
    const pinA0 = findBoardPin("A0") || findBoardPin("GPIO34");

    // Simulate blink code on Pin D13 (toggles every 1.5 seconds)
    const d13High = (Math.floor(state.time / 1500) % 2) === 0;
    const vD13 = d13High ? 5.0 : 0.0;

    // Simulate PWM signal on D9 (servo sweep or pulse)
    // Dynamic angle sweep between 0 and 180 degrees
    state.servoAngle = 90 + Math.round(90 * Math.sin(state.time / 800));

    // 2. Traversal circuit nodes to find LED pathways
    let led = null;
    let ledId = null;
    for (const [id, part] of placedParts.entries()) {
      if (part.type === "led") {
        led = part;
        ledId = id;
        break;
      }
    }

    let ledPowerSource = null;
    let ledAnodePin = null;
    let ledCathodePin = null;
    let resistorConnectedToAnode = null;
    let resistorSpecValue = 220;

    if (led) {
      ledAnodePin = led.element.querySelector('.pin[data-pin="+"]');
      ledCathodePin = led.element.querySelector('.pin[data-pin="-"]');

      // Check if cathode is connected to GND
      const isCathodeGND = arePinsConnected(ledCathodePin, pinGND, placedParts, wires);
      
      // Let's check where the anode is connected
      // Is anode connected to D13 or 5V?
      const anodeNet = findConnectedPins(ledAnodePin, placedParts, wires);
      
      // Check if there is a resistor in the anode path
      let hasResistor = false;
      let resistorElement = null;

      // Find any resistors in the network
      for (const pin of anodeNet) {
        if (pin.dataset.part !== ledId && placedParts.get(pin.dataset.part)?.type === "resistor") {
          hasResistor = true;
          resistorElement = placedParts.get(pin.dataset.part);
          break;
        }
      }

      if (hasResistor && resistorElement) {
        resistorSpecValue = parseResistorSpec(resistorElement.spec);
        // Check if resistor is connected to D13 or 5V
        const resPinA = resistorElement.element.querySelector('.pin[data-pin="+"]');
        const resPinB = resistorElement.element.querySelector('.pin[data-pin="-"]');
        
        const otherResPin = anodeNet.includes(resPinA) ? resPinB : resPinA;
        const resNet = findConnectedPins(otherResPin, placedParts, wires);

        if (resNet.includes(pinD13)) {
          ledPowerSource = "D13";
        } else if (resNet.includes(pin5V)) {
          ledPowerSource = "5V";
        }
      } else {
        // Direct connections without resistor
        if (anodeNet.includes(pinD13)) {
          ledPowerSource = "D13";
        } else if (anodeNet.includes(pin5V)) {
          ledPowerSource = "5V";
        }
      }

      // Check if circuit is completed
      if (ledPowerSource && isCathodeGND) {
        const vSource = ledPowerSource === "5V" ? 5.0 : vD13;

        if (vSource > 0) {
          if (hasResistor) {
            // Safe current calculation: V_res = V_source - V_led (around 2.0V for red LED)
            // I = V_res / R
            const vRes = Math.max(0, vSource - 2.0);
            state.ledCurrent = (vRes / resistorSpecValue) * 1000; // mA
            state.ledVoltage = 2.0;
            
            if (state.ledCurrent > 100) {
              state.ledState = "blown";
            } else if (state.ledCurrent > 0.5) {
              state.ledState = "glowing";
            } else {
              state.ledState = "off";
            }
          } else {
            // Direct short-circuiting the LED - draws massive current and blows up!
            state.ledVoltage = vSource;
            state.ledCurrent = (vSource / 5) * 1000; // rough internal resistance
            state.ledState = "blown";
          }
        } else {
          // Voltage is 0
          state.ledCurrent = 0;
          state.ledVoltage = 0;
          state.ledState = "off";
        }
      } else {
        state.ledCurrent = 0;
        state.ledVoltage = 0;
        state.ledState = "off";
      }
    }

    // 3. Simulate Potentiometer & wiper voltage
    let potentiometer = null;
    for (const [id, part] of placedParts.entries()) {
      if (part.type === "potentiometer") {
        potentiometer = part;
        break;
      }
    }
    let vWiper = 0;
    if (potentiometer) {
      const potPinPlus = potentiometer.element.querySelector('.pin[data-pin="+"]');
      const potPinMinus = potentiometer.element.querySelector('.pin[data-pin="-"]');
      const potPinSig = potentiometer.element.querySelector('.pin[data-pin="SIG"]');

      const plusConnectedVCC = arePinsConnected(potPinPlus, pin5V, placedParts, wires);
      const minusConnectedGND = arePinsConnected(potPinMinus, pinGND, placedParts, wires);
      const sigConnectedA0 = arePinsConnected(potPinSig, pinA0, placedParts, wires);

      if (plusConnectedVCC && minusConnectedGND) {
        vWiper = 5.0 * state.inputs.potentiometerWiper;
      }
    }

    // 4. Ultrasonic Distance and Serial Output
    let ultrasonic = null;
    for (const [id, part] of placedParts.entries()) {
      if (part.type === "ultrasonic") {
        ultrasonic = part;
        break;
      }
    }

    let isSensorActive = false;
    if (ultrasonic) {
      const usPlus = ultrasonic.element.querySelector('.pin[data-pin="+"]');
      const usMinus = ultrasonic.element.querySelector('.pin[data-pin="-"]');
      const usTrig = ultrasonic.element.querySelector('.pin[data-pin="TRIG"]');
      const usEcho = ultrasonic.element.querySelector('.pin[data-pin="ECHO"]');

      const plusConnected = arePinsConnected(usPlus, pin5V, placedParts, wires);
      const minusConnected = arePinsConnected(usMinus, pinGND, placedParts, wires);
      const trigConnected = arePinsConnected(usTrig, findBoardPin("D9"), placedParts, wires);
      const echoConnected = arePinsConnected(usEcho, findBoardPin("D8"), placedParts, wires);

      if (plusConnected && minusConnected && trigConnected && echoConnected) {
        isSensorActive = true;
        state.simulationMetrics.sensor = `${state.inputs.ultrasonicDistance} cm`;
      }
    }

    // 5. Build Serial Logs (every 1 second)
    const shouldPrintSerial = (Math.floor(state.time / 1000) % 2) === 0 && (Math.floor((state.time - timeStepMs) / 1000) % 2) !== 0;
    if (shouldPrintSerial) {
      if (isSensorActive) {
        state.serialOutput.push(`distance_cm=${state.inputs.ultrasonicDistance}`);
      } else {
        const a0Connected = pinA0 ? findConnectedPins(pinA0, placedParts, wires) : [];
        const ldrFound = a0Connected.some(p => placedParts.get(p.dataset.part)?.type === "ldr");
        if (ldrFound) {
          const ldrRaw = Math.round(1023 * (state.inputs.ldrLightLevel / 100));
          state.serialOutput.push(`ldr_raw_val=${ldrRaw} (${state.inputs.ldrLightLevel}%)`);
        } else if (vWiper > 0) {
          const potRaw = Math.round(1023 * state.inputs.potentiometerWiper);
          state.serialOutput.push(`potentiometer_val=${potRaw}`);
        } else {
          state.serialOutput.push(`led_state=${state.ledState === "glowing" ? "ON" : "OFF"}`);
        }
      }
      
      // Limit serial array size
      if (state.serialOutput.length > 5) {
        state.serialOutput.shift();
      }
    }

    // 6. Draw Oscilloscope wave values (for CH1 - pin D9/PWM or general active signal)
    // Standard frequency base
    const freq = 0.04;
    const wave = [];
    for (let i = 0; i < 100; i++) {
      let val = 25; // center baseline
      
      if (board.type === "arduino") {
        // If we are looking at D9 (PWM)
        const isServoAttached = [...placedParts.values()].some(p => p.type === "servo" && arePinsConnected(findBoardPin("D9"), p.element.querySelector('.pin[data-pin="SIG"]'), placedParts, wires));
        if (isServoAttached) {
          // Render PWM square wave: pulse width increases with servo angle
          const dutyCycle = 0.05 + (state.servoAngle / 180) * 0.05; // 5% to 10% duty cycle for servo PWM
          const period = 20; // 20ms period
          const phase = (i + state.time * 0.1) % period;
          val = phase < (period * dutyCycle) ? 5 : 45;
        } else if (state.ledState === "glowing" && ledPowerSource === "D13") {
          // D13 toggles (slow square wave)
          val = d13High ? 5 : 45;
        } else if (vWiper > 0) {
          // Show potentiometer voltage as flat offset
          val = 45 - (vWiper / 5) * 40;
        } else {
          // idle noise
          val = 25 + Math.sin(i * 0.3 + state.time * 0.005) * 1.5;
        }
      }
      wave.push(val);
    }
    state.oscilloscopeWave = wave;

    // 7. Update Multimeter & Metrics Readings
    const shortCircuted = wires.some(wire => {
      const p1 = wire.from.dataset.pin;
      const p2 = wire.to.dataset.pin;
      return (p1 === "5V" || p1 === "3V3" || p1 === "+") && (p2 === "GND" || p2 === "-");
    });

    if (shortCircuted) {
      state.multimeterReadings = { vccGnd: 0.12, d13Gnd: 0.0, current: 480.0 };
      state.simulationMetrics = { voltage: 0.12, current: 480, power: 57.6, sensor: "SHORT DETECTED" };
    } else {
      state.multimeterReadings = {
        vccGnd: 4.98,
        d13Gnd: d13High ? 4.91 : 0.0,
        current: state.ledCurrent
      };
      const totalCurrent = 15.0 + (state.ledState === "glowing" ? state.ledCurrent : 0) + (isSensorActive ? 12 : 0); // mA
      state.simulationMetrics = {
        voltage: 4.98,
        current: Math.round(totalCurrent),
        power: Math.round(4.98 * totalCurrent),
        sensor: isSensorActive ? `${state.inputs.ultrasonicDistance} cm` : "Idle"
      };
    }
  }

  return {
    state,
    update,
    parseResistorSpec,
    arePinsConnected,
    findConnectedPins
  };
})();
