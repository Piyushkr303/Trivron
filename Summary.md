# How the Gesture System Works

## Tech Stack

The gesture system uses exactly three technologies, no more:

| Layer | Technology | File |
|---|---|---|
| Hand detection | **MediaPipe Tasks Vision — `HandLandmarker`** (Google's on-device ML model, run via WebAssembly + WebGL) | fetched from CDN, driven by `js/hand-gesture-utility.js` |
| Camera capture | **`navigator.mediaDevices.getUserMedia`** — a native browser API | `js/hand-gesture-utility.js` (`_startCamera`) |
| Gesture logic | **Plain vanilla JavaScript** — arithmetic only, no ML | `js/hand-gesture-utility.js` (`_classify`) |

No React, no OpenCV, no server, no GPU cloud API — MediaPipe is the *only* external dependency, and even that's loaded lazily (only once you click "Hands-Free Mode").

## How Data Flows

```
getUserMedia (webcam)
    → <video> element
    → HandLandmarker.detectForVideo()   [WASM + GPU/WebGL, ~24 fps]
    → 21 hand landmarks + confidence score
    → palm-center point (avg of wrist + 2 knuckles)
    → exponential smoothing (kills jitter)
    → dominant-axis check + threshold
    → gesture event: SWIPE_LEFT/RIGHT, SCROLL_UP/DOWN
```

Only the first step (landmark detection) is machine learning. Everything after that —
smoothing, "is this horizontal or vertical," "did it cross the threshold" — is a handful of
`Math.abs()`/comparison lines. No second model classifies gestures.

## Why It's Lightweight

1. **One small model, loaded once.** The `hand_landmarker` model is a float16 quantized model
   a few MB in size — tiny compared to a full pose/body model, and the browser caches it after
   first load.
2. **No gesture-classification ML.** Turning landmarks into "swipe right" is pure arithmetic —
   dominant-axis comparison and a threshold check, nothing a GPU needs to do.
3. **Low camera resolution.** 640×480 by default — hand landmarks don't need HD.
4. **Frame-rate throttling.** The detection loop explicitly skips frames faster than the
   configured camera fps, so it's not burning CPU on every possible `requestAnimationFrame` tick.
5. **No framework overhead.** Plain HTML/CSS/JS — no React runtime, no virtual DOM, no build
   step, no bundle to download.
6. **One file, zero dependencies to install.** The whole engine is a single `.js` file with no
   `npm install`.

## Why It's Browser-Only

- **`getUserMedia` is a browser API.** Camera access is fundamentally tied to a page's browser
  security context — there's no way to call it from a server or a Node script; it only exists
  where a user can grant permission to a specific origin.
- **WebAssembly runs in the browser's sandbox.** MediaPipe's model executes via WASM (with a
  WebGL/GPU fallback path) — this is the browser's own execution engine, not something requiring
  a separate runtime.
- **It's a deliberate privacy design**, not just a technical default: since video frames are
  never uploaded anywhere, the *only* place processing can happen is right where the camera
  lives — inside your browser tab. If it went through a server, that server would have to
  receive your webcam feed, which is exactly what this design avoids.

So "browser-only" isn't a limitation here — it's the point: everything (camera, model, math)
runs on-device, nothing leaves your machine.
