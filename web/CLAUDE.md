# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VOID.RUNNER is a retro-futuristic web application combining a dosage calculator with psychedelic visualizers and local audio playback. Built entirely with vanilla HTML/CSS/JavaScript (no build tools required).

## Architecture

### Main Application (`index.html` + `app.js` + `style.css`)
- **HUD Shell**: Cyberpunk-themed UI with dark panel aesthetic
- **Calculator**: Loads compound profiles from JSON (URL or local file), computes dosages based on dry/wet mass, body weight, and target dose
- **Audio Player**: Local file playback with Web Audio API beat detection that sends `audio-beat` messages to visualizers via `postMessage`
- **Visualizer Frame**: Embeds visualizer HTML files in an iframe, supports cycling and auto-rotation

### Visualizer Files (standalone HTML)
Each visualizer is a self-contained Three.js scene loaded into the main app's iframe:
- `shooter/index.html` - Freelancer-style shooter with abstract Nomad ship and 11 psychedelic targets
- `sparkling-boxes.html` - Instanced mesh particle system
- `particle-supernova.html`, `magma.html`, `reflecting.html`, `motion-blur.html` - Additional visual effects

### Shooter Game Episodes
- **FUNGI FOREST** - Cubensis, Liberty Cap, Amanita, Azurescens, Blue Meanie
- **DESERT VISIONS** - Peyote, San Pedro cactus
- **JUNGLE SPIRITS** - Ayahuasca vine, Chacruna
- **SACRED CREATURES** - Kambo frog, Bufo toad
Each episode has 5 color themes. Press SPACE to change theme, E to change episode.

### Inter-Component Communication
- Parent (`app.js`) sends `{ type: "audio-beat", energy }` to visualizer iframe on detected beats
- Visualizers send commands back via `postMessage`: `"vis-next"`, `"vis-prev"`, `"audio-toggle"`, `"toggle-ui"`
- Visualizers accept `?speed=` URL parameter for animation speed control

## Key Code Patterns

### State Management
Single `state` object in `app.js` holds all application state (profiles, audio, visualizer index, settings).

### Calculator Flow
1. Load profiles JSON via `parseLib()`
2. User selects profile, enters mass/body weight
3. `compute()` calculates total actives and per-compound doses
4. Results rendered as HTML table in log display

### Beat Detection
Uses Web Audio API `AnalyserNode` with frequency data, z-score threshold detection, and minimum beat interval to trigger theme/visual changes.

## Styling Conventions
- CSS custom properties in `:root` for theming (accent colors, fonts)
- Three font families: Antonio (display), Rajdhani (UI), Roboto Mono (data/code)
- Panel-based layout with glassmorphism effects
