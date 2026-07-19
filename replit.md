# Circuit Mentor — Virtual Electronics Workbench

A progressive web app (PWA) for designing, simulating, and understanding electronics circuits with real-time AI mentoring.

## Stack

- Pure HTML / CSS / JavaScript — no build step, no npm
- Served by `npx serve . -p 5000`
- Service worker for offline PWA support

## Running

The **Start application** workflow runs `npx --yes serve . -p 5000 -s`.  
Open the preview pane to see the app live.

## File layout

| File | Purpose |
|---|---|
| `index.html` | App shell, all panels and modals |
| `src/app.js` | All UI logic, drag/drop, wire drawing, event bindings |
| `src/simulator.js` | Circuit simulation engine (voltages, currents, waveforms) |
| `src/mentor.js` | Connection checks and AI chat response generator |
| `src/styles.css` | All styles |
| `src/icon.svg` | PWA icon |
| `manifest.json` | PWA manifest |
| `service-worker.js` | Offline caching service worker |

## Features

- Drag-and-drop component library (boards, passives, ICs, sensors, outputs)
- Wire tool with bezier routing and color picker
- Circuit simulation at 30 fps (LED glow, servo sweep, oscilloscope, serial monitor)
- Smart Pin Assistant — click any pin for protocol/voltage info
- Connection Checks — short circuit and floating component warnings
- AI Circuit Mentor chat with auto-wiring suggestions
- **Arduino Code Editor** — paste or write Arduino C code when an Arduino Uno is on the workspace; presets included; code is parsed and drives the simulation loop timing and serial output
- PWA installable on desktop/mobile

## User preferences

- Keep existing project structure and stack (no migrations or bundler changes)
