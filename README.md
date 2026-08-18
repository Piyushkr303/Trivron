# Trivron — Hands-Free Gesture-Controlled Website

A lightweight, multi-page website that works normally with a mouse and keyboard, and
optionally supports **hands-free navigation using hand gestures** detected locally in
your browser via the webcam. No backend, no build step, no cloud AI.

The gesture engine itself ([`js/hand-gesture-utility.js`](js/hand-gesture-utility.js)) is a
standalone, drop-in utility — copy that one file into any web project to add the same
webcam gesture control. See [Using it in your own project](#using-it-in-your-own-project).

## Features

- Five-page responsive website (Home, About, Projects, Services, Contact) sharing one navbar
- ✋ **Hands-Free Mode** — a floating toggle that enables webcam gesture control
- On-device hand tracking (MediaPipe Tasks Vision `HandLandmarker`) — nothing leaves your browser
- A deliberate vertical hand gesture smoothly auto-scrolls the page to the top/bottom; a
  deliberate horizontal swipe changes pages — both judged the same reliable way (see below)
- Hands-Free Mode survives page navigation (a swipe or click to the next page keeps it ON,
  automatically restarting the camera on the new page) — turning it off explicitly is what sticks
- Smooth CSS-only page transitions
- Full camera lifecycle management (starts only when enabled, stops immediately when disabled)
- Friendly error handling for denied/missing/busy cameras
- Optional debug overlay for tuning gesture thresholds
- Fully usable with keyboard and mouse alone — gestures are an enhancement, not a requirement

## Requirements

- A modern browser with `getUserMedia` and WebAssembly support (recent Chrome, Edge, or Firefox)
- A webcam, only if you want to use Hands-Free Mode
- An internet connection the first time Hands-Free Mode loads (the hand-tracking model and
  MediaPipe runtime are fetched from a CDN on demand — normal browsing needs no network beyond
  loading the page)

## Installation

This is a static site — no npm install, no build step. You only need a local HTTP server,
because browsers restrict camera access (`getUserMedia`) on pages opened directly via
`file://`.

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Any other static server (e.g. `npx serve`, VS Code's Live Server) works the same way.

## Usage

```text
Click "Hands-Free Mode"
        ↓
Allow camera access when prompted
        ↓
Show your hand to the camera
        ↓
Move your hand up/down    → Page smoothly auto-scrolls to the top/bottom
Swipe your hand left/right → Change page
```

A small camera preview and status panel appear in the bottom-right corner while
Hands-Free Mode is active. Click the "–" button on the preview to minimize it, or click the
Hands-Free Mode button again to turn it off — the camera is released immediately.

## Gesture Controls

| Gesture              | Action                          |
| --------------------- | -------------------------------- |
| ↑ Hand moves up       | Smoothly auto-scroll to the top    |
| ↓ Hand moves down     | Smoothly auto-scroll to the bottom |
| ← Swipe left          | Previous Page                    |
| → Swipe right         | Next Page                        |

An in-progress auto-scroll can be stopped early by: scrolling manually (mouse wheel, touch,
or arrow/Page/Home/End keys), moving your hand the opposite direction, or letting the hand
leave the camera frame.

Keyboard equivalents (`←` / `→` arrow keys) work at any time, with or without Hands-Free Mode.

## Project Structure

```text
gesture-website/
├── index.html / about.html / projects.html / services.html / contact.html
├── css/
│   └── style.css               Shared styles: navbar, cards, footer, Hands-Free widget, transitions
├── js/
│   ├── hand-gesture-utility.js  Standalone gesture engine (camera + tracking + classification +
│   │                            state machine + built-in auto-scroll) — reusable in any project
│   ├── config.js                Site-specific settings: debug mode, page transitions, and any
│   │                            overrides passed into HandGestureNav
│   ├── navigation.js            Page order, navbar highlighting, page transitions
│   └── app.js                   Wires HandGestureNav's events to this site's UI and navigation
├── assets/
│   ├── images/
│   └── icons/
└── README.md
```

## How Gesture Detection Works

1. **Hand tracking** — MediaPipe's `HandLandmarker` runs entirely in the browser and returns
   21 hand landmarks per frame, with a confidence score.
2. **Reference point** — instead of a single, jittery fingertip, the average of the wrist and
   two knuckle landmarks is used as a stable palm-center point.
3. **Smoothing** — an exponential moving average (`smoothed = α·current + (1-α)·previous`)
   removes frame-to-frame jitter.
4. **Axis classification** — movement over a short rolling time window (`windowMs`) is compared
   on both axes; `|Δx| > |Δy| × axisRatio` means the movement is horizontal, otherwise vertical.
   This stops diagonal hand movement from firing both scroll and swipe.
5. **Symmetric thresholds** — scroll and swipe are judged the *same* way: a deliberate
   displacement past a threshold, over the rolling window, triggers once and enters a cooldown.
   Earlier versions judged scroll from a single video frame's tiny, noisy delta, which is why it
   used to feel unreliable — it's now held to the same standard as swipe.
6. **Vertical → auto-scroll** — a `SCROLL_UP`/`SCROLL_DOWN` gesture smoothly animates the page
   to the top/bottom over real elapsed time (eased, not linear), rather than trying to track the
   hand's position 1:1 — deliberately simple and predictable.
7. **Horizontal → swipe** — a deliberate horizontal displacement past a threshold changes pages,
   followed by a cooldown (~900ms) so one long sweep cannot skip multiple pages.
8. **State machine** — `IDLE → HAND_DETECTED → TRACKING → ACTION → COOLDOWN → IDLE` ensures a
   gesture only fires once per intentional movement, and hand loss resets everything safely.

All thresholds live in `HandGestureNav.DEFAULTS` inside
[`js/hand-gesture-utility.js`](js/hand-gesture-utility.js); site-specific overrides go in
[`js/config.js`](js/config.js)'s `gestureNav` object.

## Using it in your own project

`js/hand-gesture-utility.js` has no dependency on this site's markup or navigation model — it
only needs a `<video>` element (or it creates a hidden one for you) and emits events. Drop the
single file into any project:

```html
<script src="hand-gesture-utility.js"></script>
<script>
    const nav = new HandGestureNav();   // zero config needed to get started

    nav.on("gesture", ({ type }) => {
        // SCROLL_UP / SCROLL_DOWN are already handled for you (smooth auto-scroll
        // to the top/bottom). Handle SWIPE_LEFT / SWIPE_RIGHT however fits your app —
        // e.g. change a slide, navigate a route, advance a carousel.
        if (type === "SWIPE_RIGHT") showNextSlide();
        if (type === "SWIPE_LEFT") showPreviousSlide();
    });

    document.getElementById("enable-btn").addEventListener("click", async () => {
        try {
            await nav.enable();   // requests the camera and starts detection
        } catch (err) {
            console.warn(err.message);   // a friendly, user-facing message
        }
    });

    // nav.disable();  // stops and releases the camera immediately
</script>
```

Works equally as a CommonJS/AMD module (`const HandGestureNav = require("./hand-gesture-utility.js")`)
for bundler-based projects.

**Public API**

| Method | Description |
| --- | --- |
| `new HandGestureNav(options)` | Construct; `options` deep-merges over `HandGestureNav.DEFAULTS` (camera, tracking, gesture, and scroll settings) |
| `nav.enable()` | Requests the camera, loads the tracking model, and starts detection. Returns a Promise; rejects with a friendly `Error` on failure |
| `nav.disable()` | Stops detection and releases the camera immediately |
| `nav.isActive()` | Whether gesture detection is currently running |
| `nav.updateConfig(partial)` | Merge in config changes at runtime |
| `nav.getVideoElement()` | The `<video>` element in use (yours, or the hidden one created for you) |
| `nav.on(event, handler)` / `nav.off(...)` | Subscribe/unsubscribe to events (chainable) |
| `nav.destroy()` | Fully tears down: disables, closes the tracking model, removes any owned `<video>` |
| `HandGestureNav.isSupported()` | Static feature check (no instance needed) |

**Events** (also available as constructor callbacks, e.g. `onGesture`, `onError`):

| Event | Payload | When |
| --- | --- | --- |
| `gesture` | `{ type }` — `SWIPE_LEFT` / `SWIPE_RIGHT` / `SCROLL_UP` / `SCROLL_DOWN` | A deliberate gesture is detected |
| `handLost` | `{}` | The hand has been absent long enough to reset tracking |
| `stateChange` | state string | The internal state machine transitions |
| `autoScrollStart` / `autoScrollEnd` | `{ direction, from, to }` / `{ direction, reason, completed }` | The built-in scroll-to-edge animation starts/stops |
| `error` | `{ code, message }` | Camera or model-loading failure, with a message safe to show users |
| `frame` | debug payload (landmarks, confidence, x/y, Δx/Δy, state, cooldown) | Every processed frame — cheap to emit, ignore it unless you're building a debug view |

Set `scroll: { enabled: false }` in the config if you'd rather handle `SCROLL_UP`/`SCROLL_DOWN`
yourself instead of the built-in auto-scroll-to-edge behavior.

## Troubleshooting

**Camera permission denied**
The site shows: *"Camera access is required for Hands-Free Mode. You can continue using the
website normally without it."* Re-enable camera permission for the site in your browser's
address-bar padlock menu, then click Hands-Free Mode again.

**No camera detected**
The site shows: *"No compatible camera was detected. Hands-Free Mode is unavailable."*
Normal mouse/keyboard navigation is unaffected.

**Gesture detection feels unreliable**
- Make sure your hand is well-lit and fully inside the camera frame.
- Open the debug overlay (`Shift+D`, or add `?debug=1` to the URL) to see live confidence,
  X/Y, deltas, and gesture state — useful for adjusting thresholds.
- Increase `gesture.minConfidence` or `gesture.horizontalThreshold` (via `CONFIG.gestureNav` in
  `config.js`) if gestures fire too easily.

**Browser compatibility**
Hands-Free Mode requires WebAssembly and `getUserMedia`. If either is unsupported, the site
falls back automatically to normal navigation — nothing else on the page is affected.

**Running through localhost**
Opening the HTML files directly (`file://...`) will block camera access in most browsers for
security reasons. Always serve the folder over HTTP, e.g. `python -m http.server 8000`.

## Privacy

The webcam is only accessed after you explicitly enable Hands-Free Mode. All video processing
happens locally, in your browser — no frames are ever uploaded, sent to an API, or stored.
Turning Hands-Free Mode off stops the camera immediately.
