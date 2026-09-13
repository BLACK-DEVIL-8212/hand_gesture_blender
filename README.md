# HandControl Blender

> **A gesture-controlled 3D modeling application** — Sculpt, transform, and create 3D scenes using only your hands via webcam.

[![Build](https://img.shields.io/badge/build-passing-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()
[![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron&logoColor=white)]()
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)]()
[![Three.js](https://img.shields.io/badge/Three.js-r182-000000?logo=three.js&logoColor=white)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)]()

---

## Overview

HandControl Blender is a **desktop 3D modeling application** that lets you interact with 3D scenes using natural hand gestures captured through your webcam. Built with **Electron**, **React**, **Three.js (via React Three Fiber)**, and **MediaPipe Hands**, it brings gesture-based 3D creation to your desktop — no controllers, no VR headset, just your hands.

### Key Capabilities

| Category | Features |
|----------|----------|
| **Hand Tracking** | Real-time 21-landmark detection (MediaPipe), dual-hand support, smoothing (One-Euro filter), calibration |
| **Gestures** | Pinch, grab, fist, point, open palm, two-hand scale — mapped to intuitive 3D operations |
| **Interaction Modes** | Select, Move, Rotate, Scale, Create, Camera, Edit, Sculpt, Cut, Boolean |
| **Mesh Editing** | Vertex/edge/face selection, extrusion, sculpting (grab/push/pull/smooth), knife cut, boolean ops |
| **Scene Management** | Primitives (cube, sphere, cylinder, cone, torus, plane, capsule, monkey), lights, cameras, groups |
| **Project I/O** | Save/load `.my3d` project files with full scene hierarchy |
| **Developer Tools** | Debug overlay, pipeline visualization, gesture state inspector, performance metrics |

---

## Demo

> **Coming soon** — GIFs and video demonstrations will be added here.

---

## Architecture

```
hand_gesture_blender/
├── electron/           # Electron main & preload (desktop shell)
├── src/
│   ├── main.tsx        # React entry point
│   ├── ui/             # React components (App, panels, toolbars, overlays)
│   ├── scene/          # Scene graph, objects, lights, cameras, selection, history
│   ├── modeling/       # Mesh editing: EditableMesh, MeshEditor, tools (cut, sculpt, deform)
│   ├── vision/         # Hand tracking pipeline (MediaPipe), gesture recognition, state machine
│   ├── interaction/    # 3D interaction: raycasting, hand-world mapping, transform controllers
│   ├── store/          # Zustand global state (editor, selection, mode, gestures, debug)
│   ├── rendering/      # Three.js scene renderer, materials, lighting, grid
│   ├── core/           # EventBus, Logger utilities
│   └── hand/           # 3D hand visualization (Hand3DController)
├── public/             # Static assets (icons, favicon)
└── dist/wasm/          # MediaPipe WASM models (hand landmarkers, palm detection)
```

### Data Flow

```
Webcam → MediaPipe Hands → HandTrackingEngine (smoothing)
                    ↓
         GestureRecognitionEngine (21 landmarks → gesture + confidence)
                    ↓
         GestureStateMachine (hysteresis + mode transitions)
                    ↓
         FingerCursorManager / TransformController (3D interaction)
                    ↓
         React Three Fiber Scene (objects, gizmos, selection, editing)
```

---

## Gesture Reference

| Gesture | Hands | Action |
|---------|-------|--------|
| **Pinch** (thumb + index) | 1 | Grab / select / start transform |
| **Grab** (all fingers curled) | 1 | Strong grab / sculpt |
| **Fist** | 1 | Alternate grab / create confirm |
| **Point** (index extended) | 1 | Hover / raycast / camera pan |
| **Open Palm** | 1 | Camera pan (in CAMERA mode) |
| **Two-hand Pinch** | 2 | Uniform scale (distance-based) |
| **Two-hand Open Palm** | 2 | Orbit / dolly camera |

> Gestures are processed through a **hysteresis-enabled state machine** (`GestureStateMachine`) to prevent flickering and provide stable interactions.

---

## Interaction Modes

| Mode | Keyboard | Description |
|------|----------|-------------|
| **SELECT** | `1` | Hover to highlight, pinch to select |
| **MOVE** | `G` | Pinch + drag to translate (axis lock: `X`/`Y`/`Z`) |
| **ROTATE** | `R` | Pinch + drag to rotate |
| **SCALE** | `S` | Pinch + drag to scale (or two-hand pinch) |
| **CREATE** | `Ctrl+A` | Pinch in empty space to spawn primitive (radial menu) |
| **CAMERA** | — | Open palm to pan, two-hand pinch to zoom/dolly |
| **EDIT** | `Tab` | Enter mesh edit mode (vertex/edge/face) |
| **SCULPT** | — | Brush-based deformation (grab/push/pull/smooth) |
| **CUT** | — | Knife tool (draw cut path) / Boolean operations |
| **BOOLEAN** | — | Union / difference / intersect meshes |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` / `R` / `S` | Switch to Move / Rotate / Scale mode |
| `X` / `Y` / `Z` | Toggle axis lock |
| `F` | Frame all objects |
| `Shift+F` | Frame selected |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl+A` | Enter Create mode (opens radial menu) |
| `Tab` | Toggle Edit mode |

---

## Installation & Running

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x (or pnpm/yarn)
- A working **webcam**

### Development

```bash
# Clone the repository
git clone https://github.com/BLACK-DEVIL-8212/hand_gesture_blender.git
cd hand_gesture_blender

# Install dependencies
npm install

# Start dev server (Vite) + Electron in parallel
npm run electron:dev
```

### Build for Production

```bash
# Build all platforms (output in dist/)
npm run electron:build

# Platform-specific
# Windows (NSIS installer)
# macOS (DMG)
# Linux (AppImage)
```

### Project Structure Output

```
dist/
├── win-unpacked/          # Windows portable
├── HandControl Blender Setup x.x.x.exe  # Windows installer
├── mac/                   # macOS .app
├── HandControl Blender-x.x.x.dmg       # macOS installer
└── linux-unpacked/        # Linux AppImage
```

---

## Configuration

### Hand Tracking Settings

Adjust in `src/vision/HandTrackingEngine.ts` or via the **Settings** panel (planned):

```typescript
const engine = new HandTrackingEngine({
  maxHands: 2,                    // Track up to 2 hands
  minDetectionConfidence: 0.7,    // Minimum detection confidence
  minTrackingConfidence: 0.7,     // Minimum tracking confidence
  smoothingMethod: 'one-euro',    // 'one-euro' | 'kalman' | 'none'
  smoothingFactor: 0.5,           // Smoothing strength (0-1)
});
```

### Camera & Rendering

- **Background color**: Stored in editor state (`#1a1a2e` default)
- **Grid / Axes**: Toggle via TopBar or `store.setGridVisible()`
- **Wireframe**: `store.setWireframeMode(true)`
- **Shadows**: Enabled by default for directional/spot lights

---

## Project File Format (`.my3d`)

Projects are saved as JSON with the following structure:

```json
{
  "metadata": {
    "name": "My Project",
    "version": "1.0.0",
    "createdAt": 1699999999999,
    "updatedAt": 1699999999999
  },
  "scene": {
    "id": "scene-uuid",
    "name": "Scene",
    "objects": { "obj-uuid": { ...SceneObject... } },
    "rootIds": ["obj-uuid-1", "obj-uuid-2"],
    "cameraId": "camera-uuid",
    "environment": { "backgroundColor": "#1a1a2e", "fogEnabled": false, ... }
  },
  "settings": {}
}
```

**Supported object types**: `cube`, `sphere`, `cylinder`, `cone`, `torus`, `plane`, `capsule`, `monkey`, `empty`, `light`, `camera`, `group`

---

## Development Guide

### Adding a New Primitive

1. Add type to `ObjectType` in `src/scene/types.ts`
2. Add geometry creation in `src/modeling/GeometryFactory.ts`
3. Register in `ObjectManager.createObject()` (`src/scene/ObjectManager.ts`)
4. Add icon/button in `LeftToolbar.tsx` and `RadialMenu.tsx`

### Adding a New Gesture

1. Extend `GestureType` in `src/vision/types.ts`
2. Add recognition logic in `GestureRecognitionEngine.recognize()`
3. Add state transitions in `GestureStateMachine.TRANSITIONS`
4. Handle in `App.tsx` → `handleHandFrame()` for mode-specific behavior

### Adding a New Edit Tool

1. Add to `EditTool` type in `src/modeling/EditableMesh.ts`
2. Implement in `MeshEditor` (`src/modeling/MeshEditor.ts`)
3. Add UI in `EditModeControls.tsx` and `LeftToolbar.tsx`
4. Wire up in `FingerCursorManager` for gesture-driven usage

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Desktop Shell** | Electron 33, electron-builder |
| **UI Framework** | React 19, TypeScript, Zustand (state) |
| **3D Rendering** | Three.js r182, React Three Fiber 9, Drei 10 |
| **Hand Tracking** | MediaPipe Hands 0.4 / Tasks Vision 1.0 (WASM) |
| **Animation** | React Spring (UI transitions) |
| **Build** | Vite 8, TypeScript 6 |
| **Icons** | Lucide React |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Camera not starting** | Ensure no other app is using the webcam. Check browser permissions if running in dev mode. |
| **Hand tracking jittery** | Increase `smoothingFactor` (0.5–0.8), ensure good lighting, avoid busy backgrounds. |
| **Gestures not recognized** | Run calibration (planned), ensure hand is fully visible, check `minDetectionConfidence`. |
| **WASM errors** | Ensure `dist/wasm/` files are present (copied during build). Run `npm run build` first. |
| **Electron won't launch** | Delete `node_modules`, `package-lock.json`, reinstall. Check Node version compatibility. |

---

## Roadmap

- [ ] **Hand Calibration Wizard** — Personalize landmark mapping
- [ ] **Gesture Recording/Playback** — Record macros, replay for automation
- [ ] **Multi-user Collaboration** — Shared sessions via WebRTC
- [ ] **Python Scripting API** — Headless batch processing, procedural generation
- [ ] **GLTF/USDZ Export** — Interchange with Blender, Unity, Unreal
- [ ] **Physics Simulation** — Cloth, soft bodies, rigid bodies via Rapier
- [ ] **Plugin System** — Community extensions for tools, importers, exporters

---

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) (to be added) before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **TypeScript** strict mode enabled
- **ESLint** + **Prettier** (configured in `package.json` / `.eslintrc`)
- Run `npm run lint` before committing

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## Acknowledgments

- **MediaPipe** team for the excellent hand tracking models
- **React Three Fiber** / **Drei** for making Three.js delightful in React
- **Electron** for the cross-platform desktop framework
- **Blender** for inspiration on 3D modeling UX patterns

---

## Links

- **Repository**: https://github.com/BLACK-DEVIL-8212/hand_gesture_blender
- **Issues**: https://github.com/BLACK-DEVIL-8212/hand_gesture_blender/issues
- **Discussions**: https://github.com/BLACK-DEVIL-8212/hand_gesture_blender/discussions

---

<p align="center">
  Made with ❤️ for the 3D creator community
</p>
