<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HandControl Blender · gesture‑controlled 3D modeling</title>
  <!-- Font & icons -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #0b0d15;
      color: #e4e6f0;
      line-height: 1.6;
      padding: 2rem 1rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: rgba(18, 21, 33, 0.8);
      backdrop-filter: blur(8px);
      border: 1px solid #2a2e45;
      border-radius: 2rem;
      padding: 2.5rem 2.8rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(120, 130, 255, 0.1) inset;
    }

    /* glow accent */
    .container::before {
      content: '';
      position: absolute;
      top: -2px;
      left: 10%;
      width: 80%;
      height: 3px;
      background: linear-gradient(90deg, transparent, #5f7cff, #b48aff, #5f7cff, transparent);
      border-radius: 100%;
      filter: blur(2px);
    }

    h1, h2, h3, h4 {
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    h1 {
      font-size: 2.6rem;
      font-weight: 700;
      background: linear-gradient(135deg, #ffffff 0%, #b9c8ff 80%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.4rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    h1 i {
      background: linear-gradient(145deg, #2d3b6e, #11162b);
      padding: 0.8rem;
      border-radius: 1.2rem;
      font-size: 1.8rem;
      color: #7d9aff;
      -webkit-text-fill-color: #7d9aff;
      box-shadow: 0 8px 18px -6px #1f2a4a;
      border: 1px solid #3e4a6e;
    }

    .subhead {
      font-size: 1.2rem;
      color: #9aa3c0;
      margin-bottom: 2rem;
      border-left: 3px solid #5f7cff;
      padding-left: 1.2rem;
      font-weight: 400;
      background: linear-gradient(90deg, #1a1e30, transparent);
      border-radius: 0 100px 100px 0;
      padding: 0.8rem 1.2rem;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem 0.8rem;
      margin: 1.5rem 0 2rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #181d2e;
      border: 1px solid #303754;
      padding: 0.35rem 0.9rem;
      border-radius: 40px;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.01em;
      color: #b8c2e0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }

    .badge i {
      font-size: 0.8rem;
      color: #6d8aff;
    }

    .badge.green i { color: #5fd97a; }
    .badge.blue i { color: #5f9eff; }
    .badge.purple i { color: #b48aff; }

    hr {
      border: none;
      height: 1px;
      background: linear-gradient(90deg, transparent, #2f3654, #5f7cff40, #2f3654, transparent);
      margin: 2.5rem 0;
    }

    /* section headers */
    .section-title {
      font-size: 1.7rem;
      font-weight: 600;
      margin: 2.5rem 0 1.2rem;
      display: flex;
      align-items: center;
      gap: 0.7rem;
      color: #f0f3ff;
      letter-spacing: -0.01em;
    }

    .section-title i {
      color: #5f7cff;
      font-size: 1.5rem;
      background: #1b2138;
      padding: 0.45rem;
      border-radius: 12px;
      border: 1px solid #2e3759;
    }

    /* tables */
    .table-wrap {
      overflow-x: auto;
      border-radius: 18px;
      border: 1px solid #262e48;
      background: #10141f;
      margin: 1.5rem 0;
      box-shadow: 0 10px 20px -10px #00000080;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    th {
      text-align: left;
      padding: 1rem 1.2rem;
      background: #161d2e;
      font-weight: 600;
      color: #ccd6ff;
      border-bottom: 1px solid #2f3857;
      font-size: 0.85rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    td {
      padding: 0.9rem 1.2rem;
      border-bottom: 1px solid #1e2438;
      color: #cbd0e6;
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: #181f33;
    }

    /* code & pre */
    code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
      background: #1a1f30;
      padding: 0.2rem 0.5rem;
      border-radius: 8px;
      font-size: 0.85rem;
      color: #c5d0ff;
      border: 1px solid #2b3450;
    }

    pre {
      background: #0d101a;
      border: 1px solid #252d45;
      border-radius: 18px;
      padding: 1.5rem 1.8rem;
      overflow-x: auto;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.85rem;
      line-height: 1.7;
      color: #d3dbf5;
      box-shadow: inset 0 0 20px #00000030, 0 12px 20px -12px black;
      margin: 1.5rem 0;
      position: relative;
    }

    pre::before {
      content: '';
      position: absolute;
      top: 12px;
      left: 18px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ff5f6d;
      box-shadow: 16px 0 #ffb347, 32px 0 #5fd97a;
      opacity: 0.7;
    }

    pre code {
      background: none;
      border: none;
      padding: 0;
      color: inherit;
      font-size: inherit;
    }

    /* bash / shell comment syntax */
    .bash-token {
      color: #7e8aa8;
    }

    .bash-command {
      color: #b4c8ff;
    }

    /* inline code in list */
    li code {
      background: #1a1f30;
      border-radius: 6px;
      padding: 0.15rem 0.5rem;
    }

    /* gesture grid / cards */
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.2rem;
      margin: 1.8rem 0;
    }

    .feature-card {
      background: #12182a;
      border: 1px solid #2a3252;
      border-radius: 20px;
      padding: 1.4rem 1.6rem;
      transition: all 0.2s ease;
      box-shadow: 0 8px 16px -8px #00000080;
    }

    .feature-card:hover {
      border-color: #4f66b0;
      background: #151e36;
      transform: translateY(-3px);
    }

    .feature-card h4 {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1.05rem;
      color: #eaeefb;
      margin-bottom: 0.6rem;
    }

    .feature-card h4 i {
      color: #6d8aff;
    }

    .feature-card p {
      font-size: 0.9rem;
      color: #9fa9c9;
    }

    /* lists */
    ul, ol {
      padding-left: 1.6rem;
      margin: 1rem 0;
      color: #c3cbe8;
    }

    li {
      margin: 0.5rem 0;
    }

    li strong {
      color: #eef2ff;
    }

    a {
      color: #8ba6ff;
      text-decoration: none;
      border-bottom: 1px dotted #3f4e7a;
    }

    a:hover {
      color: #b6c8ff;
      border-bottom-color: #8ba6ff;
    }

    /* keyboard shortcut badge */
    .kbd {
      background: #1e243b;
      border: 1px solid #3a4263;
      border-radius: 8px;
      padding: 0.2rem 0.7rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      font-weight: 500;
      color: #bac8ff;
      box-shadow: 0 2px 0 #0b0e16;
      display: inline-block;
      margin: 0 0.15rem;
    }

    .footer-note {
      text-align: center;
      margin-top: 3.5rem;
      padding-top: 2rem;
      border-top: 1px solid #252e48;
      color: #8a94b8;
      font-size: 0.9rem;
    }

    .footer-note i {
      color: #ff7b9c;
    }

    /* roadmap */
    .roadmap-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem 1rem;
      list-style: none;
      padding-left: 0;
    }

    .roadmap-list li {
      background: #151c30;
      border: 1px solid #2b3456;
      border-radius: 40px;
      padding: 0.5rem 1.2rem;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.9rem;
      color: #b6c0e0;
    }

    .roadmap-list li i {
      color: #5f7cff;
      font-size: 0.8rem;
    }

    .roadmap-list li.unchecked i {
      color: #5f7cff;
    }

    .roadmap-list li.checked i {
      color: #5fd97a;
    }

    /* architecture ascii */
    .arch-pre {
      background: #0b0f1a;
      border-left: 4px solid #5f7cff;
      padding: 1.4rem 2rem;
      border-radius: 14px;
      font-size: 0.8rem;
      white-space: pre;
      overflow-x: auto;
    }

    /* responsive */
    @media (max-width: 650px) {
      .container {
        padding: 1.5rem;
      }

      h1 {
        font-size: 1.9rem;
        flex-direction: column;
        align-items: flex-start;
      }

      .section-title {
        font-size: 1.4rem;
      }
    }

    /* bash script highlight */
    .bash-script {
      background: #0f131f;
      border-left: 4px solid #5fd97a;
    }

    .bash-script .comment {
      color: #6a7a9e;
    }

    .bash-script .cmd {
      color: #b8cbff;
    }

    .bash-script .prompt {
      color: #5fd97a;
      font-weight: 600;
      margin-right: 8px;
    }

    /* decorative */
    .glow-text {
      color: #cdd9ff;
    }
  </style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <h1>
    <i class="fas fa-hand-peace"></i> HandControl Blender
  </h1>
  <div class="subhead">
    <i class="fas fa-cube" style="margin-right: 10px; color: #6d8aff;"></i>
    Gesture‑controlled 3D modeling — sculpt, transform, and create with your hands via webcam.
  </div>

  <!-- Badges -->
  <div class="badge-row">
    <span class="badge green"><i class="fas fa-check-circle"></i> build passing</span>
    <span class="badge blue"><i class="fas fa-balance-scale"></i> MIT</span>
    <span class="badge"><i class="fab fa-windows"></i> <i class="fab fa-apple"></i> <i class="fab fa-linux"></i> Win / macOS / Linux</span>
    <span class="badge purple"><i class="fas fa-atom"></i> Electron 33</span>
    <span class="badge blue"><i class="fab fa-react"></i> React 19</span>
    <span class="badge"><i class="fas fa-cubes"></i> Three.js r182</span>
    <span class="badge purple"><i class="fas fa-code"></i> TypeScript 5</span>
  </div>

  <!-- Overview -->
  <div class="section-title">
    <i class="fas fa-globe"></i> Overview
  </div>
  <p style="color: #bcc6e6; margin-bottom: 0.5rem;">
    HandControl Blender is a <strong>desktop 3D modeling application</strong> that lets you interact with 3D scenes using natural hand gestures captured through your webcam. Built with <strong>Electron</strong>, <strong>React</strong>, <strong>Three.js (via React Three Fiber)</strong>, and <strong>MediaPipe Hands</strong>, it brings gesture‑based 3D creation to your desktop — no controllers, no VR headset, just your hands.
  </p>

  <!-- Key capabilities table -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th style="width: 22%;">Category</th><th>Features</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Hand Tracking</strong></td><td>Real-time 21-landmark detection (MediaPipe), dual-hand support, smoothing (One-Euro filter), calibration</td></tr>
        <tr><td><strong>Gestures</strong></td><td>Pinch, grab, fist, point, open palm, two-hand scale — mapped to intuitive 3D operations</td></tr>
        <tr><td><strong>Interaction Modes</strong></td><td>Select, Move, Rotate, Scale, Create, Camera, Edit, Sculpt, Cut, Boolean</td></tr>
        <tr><td><strong>Mesh Editing</strong></td><td>Vertex/edge/face selection, extrusion, sculpting (grab/push/pull/smooth), knife cut, boolean ops</td></tr>
        <tr><td><strong>Scene Management</strong></td><td>Primitives (cube, sphere, cylinder, cone, torus, plane, capsule, monkey), lights, cameras, groups</td></tr>
        <tr><td><strong>Project I/O</strong></td><td>Save/load <code>.my3d</code> project files with full scene hierarchy</td></tr>
        <tr><td><strong>Developer Tools</strong></td><td>Debug overlay, pipeline visualization, gesture state inspector, performance metrics</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Demo placeholder -->
  <div class="section-title" style="margin-top: 2.5rem;">
    <i class="fas fa-video"></i> Demo
  </div>
  <div style="background: #101624; border-radius: 20px; padding: 2rem; text-align: center; border: 1px dashed #3a4468; color: #8f9bc2;">
    <i class="fas fa-film" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; color: #5f7cff;"></i>
    <strong>Coming soon</strong> — GIFs and video demonstrations will be added here.
  </div>

  <!-- Architecture -->
  <div class="section-title">
    <i class="fas fa-sitemap"></i> Architecture
  </div>
  <pre class="arch-pre"><code>hand_gesture_blender/
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
└── dist/wasm/          # MediaPipe WASM models (hand landmarkers, palm detection)</code></pre>

  <h4 style="color: #d0d9ff; margin: 1.8rem 0 0.8rem; font-weight: 500;">Data Flow</h4>
  <pre style="background: #0e121e; border-left: 4px solid #b48aff;"><code>Webcam → MediaPipe Hands → HandTrackingEngine (smoothing)
                    ↓
         GestureRecognitionEngine (21 landmarks → gesture + confidence)
                    ↓
         GestureStateMachine (hysteresis + mode transitions)
                    ↓
         FingerCursorManager / TransformController (3D interaction)
                    ↓
         React Three Fiber Scene (objects, gizmos, selection, editing)</code></pre>

  <!-- Gesture reference -->
  <div class="section-title">
    <i class="fas fa-hand-sparkles"></i> Gesture Reference
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Gesture</th><th>Hands</th><th>Action</th></tr></thead>
      <tbody>
        <tr><td><strong>Pinch</strong> (thumb + index)</td><td>1</td><td>Grab / select / start transform</td></tr>
        <tr><td><strong>Grab</strong> (all fingers curled)</td><td>1</td><td>Strong grab / sculpt</td></tr>
        <tr><td><strong>Fist</strong></td><td>1</td><td>Alternate grab / create confirm</td></tr>
        <tr><td><strong>Point</strong> (index extended)</td><td>1</td><td>Hover / raycast / camera pan</td></tr>
        <tr><td><strong>Open Palm</strong></td><td>1</td><td>Camera pan (in CAMERA mode)</td></tr>
        <tr><td><strong>Two-hand Pinch</strong></td><td>2</td><td>Uniform scale (distance-based)</td></tr>
        <tr><td><strong>Two-hand Open Palm</strong></td><td>2</td><td>Orbit / dolly camera</td></tr>
      </tbody>
    </table>
  </div>
  <p style="color: #8e99bd; font-size: 0.9rem; margin-top: -0.5rem;"><i class="fas fa-info-circle" style="margin-right: 6px;"></i>Gestures are processed through a hysteresis-enabled state machine to prevent flickering.</p>

  <!-- Interaction modes -->
  <div class="section-title">
    <i class="fas fa-sliders-h"></i> Interaction Modes
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Mode</th><th>Keyboard</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><strong>SELECT</strong></td><td><span class="kbd">1</span></td><td>Hover to highlight, pinch to select</td></tr>
        <tr><td><strong>MOVE</strong></td><td><span class="kbd">G</span></td><td>Pinch + drag to translate (axis lock: <span class="kbd">X</span>/<span class="kbd">Y</span>/<span class="kbd">Z</span>)</td></tr>
        <tr><td><strong>ROTATE</strong></td><td><span class="kbd">R</span></td><td>Pinch + drag to rotate</td></tr>
        <tr><td><strong>SCALE</strong></td><td><span class="kbd">S</span></td><td>Pinch + drag to scale (or two-hand pinch)</td></tr>
        <tr><td><strong>CREATE</strong></td><td><span class="kbd">Ctrl+A</span></td><td>Pinch in empty space to spawn primitive (radial menu)</td></tr>
        <tr><td><strong>CAMERA</strong></td><td>—</td><td>Open palm to pan, two-hand pinch to zoom/dolly</td></tr>
        <tr><td><strong>EDIT</strong></td><td><span class="kbd">Tab</span></td><td>Enter mesh edit mode (vertex/edge/face)</td></tr>
        <tr><td><strong>SCULPT</strong></td><td>—</td><td>Brush-based deformation (grab/push/pull/smooth)</td></tr>
        <tr><td><strong>CUT</strong></td><td>—</td><td>Knife tool (draw cut path) / Boolean operations</td></tr>
        <tr><td><strong>BOOLEAN</strong></td><td>—</td><td>Union / difference / intersect meshes</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Keyboard shortcuts -->
  <div class="section-title">
    <i class="fas fa-keyboard"></i> Keyboard Shortcuts
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Key</th><th>Action</th></tr></thead>
      <tbody>
        <tr><td><span class="kbd">G</span> / <span class="kbd">R</span> / <span class="kbd">S</span></td><td>Switch to Move / Rotate / Scale mode</td></tr>
        <tr><td><span class="kbd">X</span> / <span class="kbd">Y</span> / <span class="kbd">Z</span></td><td>Toggle axis lock</td></tr>
        <tr><td><span class="kbd">F</span></td><td>Frame all objects</td></tr>
        <tr><td><span class="kbd">Shift+F</span></td><td>Frame selected</td></tr>
        <tr><td><span class="kbd">Ctrl+Z</span></td><td>Undo</td></tr>
        <tr><td><span class="kbd">Ctrl+Shift+Z</span></td><td>Redo</td></tr>
        <tr><td><span class="kbd">Delete</span> / <span class="kbd">Backspace</span></td><td>Delete selected</td></tr>
        <tr><td><span class="kbd">Ctrl+A</span></td><td>Enter Create mode (opens radial menu)</td></tr>
        <tr><td><span class="kbd">Tab</span></td><td>Toggle Edit mode</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Installation & bash scripts -->
  <div class="section-title">
    <i class="fas fa-terminal"></i> Installation & Running
  </div>
  <h4 style="font-weight: 500; margin: 1rem 0 0.5rem; color: #cdd6ff;">Prerequisites</h4>
  <ul>
    <li><strong>Node.js</strong> ≥ 18.x</li>
    <li><strong>npm</strong> ≥ 9.x (or pnpm/yarn)</li>
    <li>A working <strong>webcam</strong></li>
  </ul>

  <h4 style="font-weight: 500; margin: 1.5rem 0 0.5rem; color: #cdd6ff;">Development</h4>
  <pre class="bash-script"><code><span class="comment"># Clone the repository</span>
git clone https://github.com/BLACK-DEVIL-8212/hand_gesture_blender.git
cd hand_gesture_blender

<span class="comment"># Install dependencies</span>
npm install

<span class="comment"># Start dev server (Vite) + Electron in parallel</span>
npm run electron:dev</code></pre>

  <h4 style="font-weight: 500; margin: 1.5rem 0 0.5rem; color: #cdd6ff;">Build for Production</h4>
  <pre class="bash-script"><code><span class="comment"># Build all platforms (output in dist/)</span>
npm run electron:build

<span class="comment"># Platform-specific</span>
<span class="comment"># Windows (NSIS installer)</span>
<span class="comment"># macOS (DMG)</span>
<span class="comment"># Linux (AppImage)</span></code></pre>

  <h4 style="font-weight: 500; margin: 1.5rem 0 0.5rem; color: #cdd6ff;">Project Structure Output</h4>
  <pre><code>dist/
├── win-unpacked/          # Windows portable
├── HandControl Blender Setup x.x.x.exe  # Windows installer
├── mac/                   # macOS .app
├── HandControl Blender-x.x.x.dmg       # macOS installer
└── linux-unpacked/        # Linux AppImage</code></pre>

  <!-- Configuration -->
  <div class="section-title">
    <i class="fas fa-cog"></i> Configuration
  </div>
  <h4 style="font-weight: 500; margin: 1rem 0 0.5rem; color: #cdd6ff;">Hand Tracking Settings</h4>
  <pre><code>const engine = new HandTrackingEngine({
  maxHands: 2,                    // Track up to 2 hands
  minDetectionConfidence: 0.7,    // Minimum detection confidence
  minTrackingConfidence: 0.7,     // Minimum tracking confidence
  smoothingMethod: 'one-euro',    // 'one-euro' | 'kalman' | 'none'
  smoothingFactor: 0.5,           // Smoothing strength (0-1)
});</code></pre>

  <h4 style="font-weight: 500; margin: 1.2rem 0 0.5rem; color: #cdd6ff;">Camera & Rendering</h4>
  <ul>
    <li><strong>Background color</strong>: Stored in editor state (<code>#1a1a2e</code> default)</li>
    <li><strong>Grid / Axes</strong>: Toggle via TopBar or <code>store.setGridVisible()</code></li>
    <li><strong>Wireframe</strong>: <code>store.setWireframeMode(true)</code></li>
    <li><strong>Shadows</strong>: Enabled by default for directional/spot lights</li>
  </ul>

  <!-- Project file format -->
  <div class="section-title">
    <i class="fas fa-file-code"></i> Project File Format (<code>.my3d</code>)
  </div>
  <p style="color: #b0bbdd;">Projects are saved as JSON with the following structure:</p>
  <pre><code>{
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
}</code></pre>
  <p><strong>Supported object types:</strong> <code>cube</code>, <code>sphere</code>, <code>cylinder</code>, <code>cone</code>, <code>torus</code>, <code>plane</code>, <code>capsule</code>, <code>monkey</code>, <code>empty</code>, <code>light</code>, <code>camera</code>, <code>group</code></p>

  <!-- Development guide -->
  <div class="section-title">
    <i class="fas fa-code-branch"></i> Development Guide
  </div>
  <div class="feature-grid">
    <div class="feature-card">
      <h4><i class="fas fa-cube"></i> Adding a New Primitive</h4>
      <ol style="font-size: 0.88rem; padding-left: 1.2rem;">
        <li>Add type to <code>ObjectType</code> in <code>src/scene/types.ts</code></li>
        <li>Add geometry creation in <code>src/modeling/GeometryFactory.ts</code></li>
        <li>Register in <code>ObjectManager.createObject()</code></li>
        <li>Add icon/button in <code>LeftToolbar.tsx</code> and <code>RadialMenu.tsx</code></li>
      </ol>
    </div>
    <div class="feature-card">
      <h4><i class="fas fa-hand-pointer"></i> Adding a New Gesture</h4>
      <ol style="font-size: 0.88rem; padding-left: 1.2rem;">
        <li>Extend <code>GestureType</code> in <code>src/vision/types.ts</code></li>
        <li>Add recognition logic in <code>GestureRecognitionEngine.recognize()</code></li>
        <li>Add state transitions in <code>GestureStateMachine.TRANSITIONS</code></li>
        <li>Handle in <code>App.tsx</code> → <code>handleHandFrame()</code></li>
      </ol>
    </div>
    <div class="feature-card">
      <h4><i class="fas fa-paint-brush"></i> Adding a New Edit Tool</h4>
      <ol style="font-size: 0.88rem; padding-left: 1.2rem;">
        <li>Add to <code>EditTool</code> type in <code>src/modeling/EditableMesh.ts</code></li>
        <li>Implement in <code>MeshEditor</code></li>
        <li>Add UI in <code>EditModeControls.tsx</code> and <code>LeftToolbar.tsx</code></li>
        <li>Wire up in <code>FingerCursorManager</code></li>
      </ol>
    </div>
  </div>

  <!-- Tech stack -->
  <div class="section-title">
    <i class="fas fa-layer-group"></i> Tech Stack
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Layer</th><th>Technology</th></tr></thead>
      <tbody>
        <tr><td><strong>Desktop Shell</strong></td><td>Electron 33, electron-builder</td></tr>
        <tr><td><strong>UI Framework</strong></td><td>React 19, TypeScript, Zustand (state)</td></tr>
        <tr><td><strong>3D Rendering</strong></td><td>Three.js r182, React Three Fiber 9, Drei 10</td></tr>
        <tr><td><strong>Hand Tracking</strong></td><td>MediaPipe Hands 0.4 / Tasks Vision 1.0 (WASM)</td></tr>
        <tr><td><strong>Animation</strong></td><td>React Spring (UI transitions)</td></tr>
        <tr><td><strong>Build</strong></td><td>Vite 8, TypeScript 6</td></tr>
        <tr><td><strong>Icons</strong></td><td>Lucide React</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Troubleshooting -->
  <div class="section-title">
    <i class="fas fa-wrench"></i> Troubleshooting
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Issue</th><th>Solution</th></tr></thead>
      <tbody>
        <tr><td><strong>Camera not starting</strong></td><td>Ensure no other app is using the webcam. Check browser permissions if running in dev mode.</td></tr>
        <tr><td><strong>Hand tracking jittery</strong></td><td>Increase <code>smoothingFactor</code> (0.5–0.8), ensure good lighting, avoid busy backgrounds.</td></tr>
        <tr><td><strong>Gestures not recognized</strong></td><td>Run calibration (planned), ensure hand is fully visible, check <code>minDetectionConfidence</code>.</td></tr>
        <tr><td><strong>WASM errors</strong></td><td>Ensure <code>dist/wasm/</code> files are present (copied during build). Run <code>npm run build</code> first.</td></tr>
        <tr><td><strong>Electron won't launch</strong></td><td>Delete <code>node_modules</code>, <code>package-lock.json</code>, reinstall. Check Node version compatibility.</td></tr>
      </tbody>
    </table>
  </div>

  <!-- Roadmap -->
  <div class="section-title">
    <i class="fas fa-road"></i> Roadmap
  </div>
  <ul class="roadmap-list">
    <li class="unchecked"><i class="far fa-circle"></i> Hand Calibration Wizard</li>
    <li class="unchecked"><i class="far fa-circle"></i> Gesture Recording/Playback</li>
    <li class="unchecked"><i class="far fa-circle"></i> Multi-user Collaboration (WebRTC)</li>
    <li class="unchecked"><i class="far fa-circle"></i> Python Scripting API</li>
    <li class="unchecked"><i class="far fa-circle"></i> GLTF/USDZ Export</li>
    <li class="unchecked"><i class="far fa-circle"></i> Physics Simulation (Rapier)</li>
    <li class="unchecked"><i class="far fa-circle"></i> Plugin System</li>
  </ul>

  <!-- Contributing -->
  <div class="section-title">
    <i class="fas fa-users"></i> Contributing
  </div>
  <p>Contributions are welcome! Please read the <a href="#">Contributing Guide</a> (to be added) before submitting PRs.</p>
  <ol>
    <li>Fork the repository</li>
    <li>Create a feature branch (<code>git checkout -b feature/amazing-feature</code>)</li>
    <li>Commit your changes (<code>git commit -m 'Add amazing feature'</code>)</li>
    <li>Push to the branch (<code>git push origin feature/amazing-feature</code>)</li>
    <li>Open a Pull Request</li>
  </ol>
  <h4 style="font-weight: 500; margin: 1.2rem 0 0.5rem; color: #cdd6ff;">Code Style</h4>
  <ul>
    <li><strong>TypeScript</strong> strict mode enabled</li>
    <li><strong>ESLint</strong> + <strong>Prettier</strong> (configured in <code>package.json</code> / <code>.eslintrc</code>)</li>
    <li>Run <code>npm run lint</code> before committing</li>
  </ul>

  <!-- License -->
  <div class="section-title">
    <i class="fas fa-balance-scale"></i> License
  </div>
  <p>Distributed under the <strong>MIT License</strong>. See <code>LICENSE</code> for more information.</p>

  <!-- Acknowledgments -->
  <div class="section-title">
    <i class="fas fa-heart"></i> Acknowledgments
  </div>
  <ul>
    <li><strong>MediaPipe</strong> team for the excellent hand tracking models</li>
    <li><strong>React Three Fiber</strong> / <strong>Drei</strong> for making Three.js delightful in React</li>
    <li><strong>Electron</strong> for the cross-platform desktop framework</li>
    <li><strong>Blender</strong> for inspiration on 3D modeling UX patterns</li>
  </ul>

  <!-- Links -->
  <div class="section-title">
    <i class="fas fa-link"></i> Links
  </div>
  <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; margin: 1rem 0 0.5rem;">
    <a href="https://github.com/BLACK-DEVIL-8212/hand_gesture_blender"><i class="fab fa-github"></i> Repository</a>
    <a href="https://github.com/BLACK-DEVIL-8212/hand_gesture_blender/issues"><i class="fas fa-exclamation-circle"></i> Issues</a>
    <a href="https://github.com/BLACK-DEVIL-8212/hand_gesture_blender/discussions"><i class="fas fa-comments"></i> Discussions</a>
  </div>

  <div class="footer-note">
    <i class="fas fa-heart"></i> Made with love for the 3D creator community
  </div>
</div>
</body>
</html>
