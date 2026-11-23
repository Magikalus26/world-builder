# Workd Builder

A tactile 3D mobile web game built with vanilla JavaScript (ES6 modules), HTML5, CSS3, and Three.js — optimized specifically for **Mobile Safari / WebKit on iPhone 16e (390×844 viewport, 60 FPS, touch-first controls)**.

## Gameplay — Level 1: *La Petite Pyramide (5 Étages)*

Launches directly into a sunlit stylized Egyptian desert diorama featuring 4 connected production stations:

1. **La Carrière (North-West)** — Tap or hold any of the 3 limestone rock nodes to chip stone with dust bursts and spawn rough **Raw Stone Blocks**.
2. **Le Transport (West & Center)** — Load up to 3 blocks onto **Sled A** (Quarry → Stonecutter) or **Sled B** (Stonecutter → Pyramid staging), then drag the sled along its timber plank track or tap its wooden pull-lever to glide it smoothly with sand trails.
3. **L'Atelier de Taille (South-West)** — Drop a Raw Stone Block onto the shaded stonecutter anvil, then tap or swipe across it 3 times to carve it visually through 3 stages into a finished beveled **Pyramid Block** (with subtle hieroglyphic trim).
4. **Le Chantier de la Pyramide (East)** — Drag and drop finished blocks onto the glowing translucent blueprint ghost slots unlocked progressively layer by layer (`5×5 → 4×4 → 3×3 → 2×2 → 1×1`, 55 blocks total), crowned by the gleaming **55th Golden Pyramidion Capstone**, triggering a golden sunbeam celebration and cinematic orbit.

## Touch & Camera Controls

- **1-finger tap / hold / drag on objects**: Mine rock nodes, drag blocks with hover lift & ground drop-shadow, carve on the workbench (tap or swipe), drag sleds or flip pull-levers.
- **1-finger drag on empty sand**: Smooth 1:1 isometric diorama pan with damped inertia.
- **2-finger pinch**: Smooth zoom in/out.
- **2-finger twist**: Smooth orbital rotation with damped inertia.
- *(Desktop convenience: mouse wheel zooms; right-drag or Shift+drag rotates.)*

## Repository Architecture

```text
├── index.html                  # Semantic entry point, iOS viewport lock, Three.js CDN importmap, minimal HUD
├── style.css                   # Mobile-first CSS3, safe-area insets, touch-action lock, tactile feedback
├── README.md
└── src/
    ├── main.js                 # WebGLRenderer, desert lighting rig, 60 FPS loop, HUD & level orchestration
    ├── camera.js               # ~55° diorama camera controller (pan, pinch zoom, twist rotation, victory orbit)
    ├── audio.js                # Procedural Web Audio API SFX synthesizer (zero external audio files)
    ├── textures.js             # Procedural HTML5 Canvas textures & tactile PBR materials
    ├── dragDrop.js             # Precision touch raycasting, hover lift, drop-shadow indicator & magnetic snap
    └── levels/
        └── level1_pyramid.js   # Self-contained Level 1 module (5-tier, 55-block pyramid + pooled particle FX)
```

## Running Locally

Serve the repository root with any static HTTP server (required for ES6 modules):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser (or on iPhone via your local network IP).

## Adding Future Levels

Create a new ES6 module in `src/levels/` (for example `src/levels/level2_medieval_village.js`) implementing the same interface as `Level1Pyramid` (`static meta`, `update`, `getHitTargets`, `evaluateDropZones`, `clearDropHighlights`, `onBlockDragStart`, `onBlockDrop`, `onBlockDragCancel`, `dispose`) and register it in `LEVEL_REGISTRY` inside `src/main.js`.