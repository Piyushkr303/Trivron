# Build a Complete Lightweight Hands-Free Gesture-Controlled Multi-Page Website

You are an expert frontend engineer and browser-based computer-vision developer.

Build a **complete, polished, lightweight local website** that can be navigated normally with a mouse/keyboard, but also supports **hands-free navigation using hand gestures detected through the user's webcam**.

The most important requirements are:

> **LIGHTWEIGHT + LOW LATENCY + SMOOTH GESTURES + RELIABLE DETECTION + POLISHED UI**

Do not over-engineer the project.

---

# 1. PROJECT OBJECTIVE

Create a modern multi-page website with a top navigation bar such as:

```text
Home | About | Projects | Services | Contact
```

The user should normally be able to navigate using:

* Mouse
* Keyboard
* Touchpad

Additionally, there should be a floating button:

```text
✋ Hands-Free Mode
```

When the user enables Hands-Free Mode, the webcam detects their hand and allows them to:

### Vertical hand movement

```text
↑ Hand movement → Scroll Up
↓ Hand movement → Scroll Down
```

### Horizontal hand swipe

```text
← Swipe Left  → Previous Page
→ Swipe Right → Next Page
```

For example:

```text
Home
  ↓ swipe right
About
  ↓ swipe right
Projects
  ↓ swipe right
Services
  ↓ swipe right
Contact
```

And:

```text
Contact
  ↓ swipe left
Services
  ↓ swipe left
Projects
  ↓ swipe left
About
  ↓ swipe left
Home
```

The interaction should feel smooth and natural.

---

# 2. VERY IMPORTANT: KEEP IT LIGHTWEIGHT

Do NOT build a heavy application.

Avoid unnecessary frameworks and dependencies.

Prefer:

* HTML5
* CSS3
* Vanilla JavaScript
* Lightweight browser-based hand tracking

Use **MediaPipe Hands / MediaPipe Tasks Vision**, or another lightweight browser-compatible hand-landmark model if there is a clearly better option.

Do NOT use:

* LLMs
* Large AI models
* Cloud AI APIs
* Python backend
* Node backend
* Database
* React unless absolutely necessary
* Angular
* Next.js
* Large UI frameworks
* Heavy computer vision libraries
* Server-side gesture processing

The application should perform gesture detection **locally in the browser**.

---

# 3. HIGH-LEVEL ARCHITECTURE

Use this architecture:

```text
                 WEBCAM
                    │
                    ▼
          Lightweight Hand Tracking
                    │
                    ▼
              Hand Landmarks
                    │
                    ▼
          Gesture Recognition Logic
                    │
           ┌────────┴────────┐
           │                 │
      Vertical Motion    Horizontal Motion
           │                 │
       ┌───┴───┐         ┌───┴───┐
       │       │         │       │
       ↑       ↓         ←       →
       │       │         │       │
    Scroll   Scroll   Previous   Next
      Up      Down      Page     Page
```

Do not use another machine-learning model for gesture classification.

Once hand landmarks are available, use **simple mathematical calculations and JavaScript logic** to classify gestures.

---

# 4. WEBSITE PAGES

Create at least these pages:

```text
index.html
about.html
projects.html
services.html
contact.html
```

Each page should contain enough realistic content to demonstrate scrolling.

For example:

## Home

* Hero section
* Introduction
* Features
* Call-to-action
* Some cards/content

## About

* About section
* Mission
* Values
* Timeline

## Projects

* Project cards
* Technology cards
* Project descriptions

## Services

* Service cards
* Process
* Benefits

## Contact

* Contact information
* Contact form
* Social links
* Footer

The pages should look like a real modern website rather than placeholder/demo pages.

---

# 5. GLOBAL NAVIGATION

Every page must contain the same navigation bar.

Example:

```text
┌───────────────────────────────────────────────┐
│ LOGO   Home  About  Projects  Services Contact│
└───────────────────────────────────────────────┘
```

The current page should be visually highlighted.

Navigation must work normally with mouse clicks.

The gesture system should use the same navigation order.

Define the navigation order centrally:

```javascript
const pages = [
    "index.html",
    "about.html",
    "projects.html",
    "services.html",
    "contact.html"
];
```

Do not hard-code navigation logic separately on every page.

---

# 6. HANDS-FREE MODE

Add a floating control in the bottom-right corner.

Default state:

```text
✋ Hands-Free Mode
OFF
```

When clicked:

```text
✋ Hands-Free Mode
ON
```

When enabled:

1. Request webcam permission.
2. Initialize the hand-tracking model.
3. Start webcam capture.
4. Start gesture detection.
5. Display a small camera preview.
6. Display a small status indicator.

Example:

```text
┌────────────────────────┐
│                        │
│      Camera Feed       │
│                        │
└────────────────────────┘

● Hands-Free Mode ON
```

When disabled:

1. Stop gesture detection.
2. Stop webcam processing.
3. Stop the camera stream.
4. Release the camera.
5. Remove/hide the preview.
6. Restore normal mode.

Do not keep the webcam running when Hands-Free Mode is disabled.

---

# 7. CAMERA REQUIREMENTS

Use the browser's webcam API:

```javascript
navigator.mediaDevices.getUserMedia()
```

Use a reasonable resolution.

Prefer approximately:

```text
640 × 480
```

or lower if tracking quality remains acceptable.

Do NOT request unnecessarily high-resolution video.

The camera preview should be small and unobtrusive.

Allow the user to minimize/hide the preview.

---

# 8. CAMERA ERROR HANDLING

Handle all common situations gracefully.

### Permission denied

Display:

> Camera access is required for Hands-Free Mode. You can continue using the website normally without it.

### No camera

Display:

> No compatible camera was detected. Hands-Free Mode is unavailable.

### Camera error

Display a friendly error and allow the user to continue using normal navigation.

Never crash the website because camera access fails.

---

# 9. GESTURE DETECTION

Use hand landmarks to track hand movement.

Track a stable landmark such as:

* Wrist
* Palm center
* Index finger MCP

Prefer using a **stable palm/wrist reference point** for movement detection rather than relying only on fingertips.

Track the position over multiple frames.

Example:

```javascript
previousX
currentX
previousY
currentY
```

Calculate:

```javascript
deltaX = currentX - previousX
deltaY = currentY - previousY
```

But do NOT trigger gestures from a single frame.

Maintain a short movement history.

For example:

```text
P1
P2
P3
P4
P5
```

Calculate movement over the recent history.

---

# 10. SMOOTHING

Raw hand landmarks can jitter.

Implement lightweight smoothing.

Possible approach:

```javascript
smoothedX =
    alpha * currentX +
    (1 - alpha) * previousSmoothedX;
```

Do the same for Y.

Use a small configurable smoothing factor.

Keep the implementation lightweight.

Do not introduce a heavy filtering library.

---

# 11. VERTICAL SCROLL

When Hands-Free Mode is enabled:

If the detected movement is primarily vertical:

```text
ΔY > threshold
```

scroll down.

If:

```text
ΔY < -threshold
```

scroll up.

Use:

```javascript
window.scrollBy({
    top: scrollAmount,
    behavior: "smooth"
});
```

or an equivalent efficient approach.

Do not trigger scrolling for tiny movements.

---

# 12. HORIZONTAL PAGE SWIPE

If the detected movement is clearly horizontal:

```text
ΔX > horizontalThreshold
```

→ swipe right

Navigate to the next page.

If:

```text
ΔX < -horizontalThreshold
```

→ swipe left

Navigate to the previous page.

The gesture must be deliberate.

Do not interpret normal hand movement as page navigation.

---

# 13. HORIZONTAL VS VERTICAL CLASSIFICATION

This is extremely important.

A movement should first be classified as either:

```text
VERTICAL
```

or:

```text
HORIZONTAL
```

Use a ratio or dominant-axis calculation.

For example:

```javascript
if (Math.abs(deltaX) > Math.abs(deltaY) * ratio) {
    // horizontal
}
```

Otherwise:

```javascript
// vertical
```

Make the ratio configurable.

This prevents diagonal movements from accidentally triggering page navigation.

---

# 14. GESTURE THRESHOLDS

Create a configuration object:

```javascript
const GESTURE_CONFIG = {
    horizontalThreshold: ...,
    verticalThreshold: ...,
    axisRatio: ...,
    cooldown: ...,
    smoothingFactor: ...,
    minConfidence: ...,
    scrollAmount: ...
};
```

Do not scatter magic numbers throughout the code.

Make all gesture parameters easy to tune.

---

# 15. GESTURE COOLDOWN

This is mandatory.

After a horizontal swipe changes the page, do not allow another page change immediately.

Example:

```text
Swipe Right
     ↓
Page Change
     ↓
Cooldown ~800ms
     ↓
Ready
```

Use approximately:

```text
700–1200ms
```

as the initial range.

Make it configurable.

This prevents one long movement from changing several pages.

---

# 16. GESTURE STATE MACHINE

Implement a simple gesture state machine.

Example:

```text
IDLE
  ↓
HAND_DETECTED
  ↓
TRACKING
  ↓
MOVEMENT_DETECTED
  ↓
GESTURE_CLASSIFIED
  ↓
ACTION
  ↓
COOLDOWN
  ↓
IDLE
```

This should prevent repeated triggers.

Do not continuously trigger an action while the hand remains in the same position.

---

# 17. HAND LOST HANDLING

If the hand disappears from the camera:

* Reset movement history.
* Reset gesture state.
* Do not trigger any action.
* Wait for the hand to be detected again.

Do not interpret:

```text
hand disappeared
```

as:

```text
swipe
```

---

# 18. GESTURE CONFIDENCE

Only process gestures when hand-tracking confidence is sufficiently high.

Use the confidence values provided by the selected tracking library where available.

Make the threshold configurable.

For example:

```javascript
minConfidence: 0.6
```

Do not process unreliable landmark data.

---

# 19. PAGE TRANSITIONS

When navigating between pages through a horizontal swipe, make the transition smooth.

For example:

```text
Current Page
     ↓
Fade / Slide Out
     ↓
Load Next Page
     ↓
Fade / Slide In
```

Avoid an abrupt visual jump.

However, do not use heavy animation libraries.

Use lightweight CSS transitions.

---

# 20. PRESERVE PERFORMANCE DURING PAGE CHANGES

Do not reload unnecessary resources.

Keep CSS and JavaScript files small.

Avoid loading large assets on every page.

Where possible, use:

* Shared CSS
* Shared JS
* SVG icons
* Optimized images

Do not use huge images or video backgrounds.

---

# 21. VISUAL GESTURE FEEDBACK

While Hands-Free Mode is active, display a small floating status panel.

Example:

```text
┌──────────────────────────┐
│ ✋ Hands-Free Mode       │
│ ● Active                │
│                         │
│ Gesture: Scroll Down    │
└──────────────────────────┘
```

Possible states:

```text
Waiting for hand...
Hand detected
Scrolling Up
Scrolling Down
Swipe Left
Swipe Right
Cooldown
```

Keep it subtle.

It should not cover important website content.

---

# 22. DEBUG MODE

Implement an optional debug mode.

Default:

```text
DEBUG = false
```

When enabled, show:

* Hand landmarks
* Current X/Y
* Delta X/Y
* Current gesture
* Confidence
* Gesture state
* Cooldown timer

Example:

```text
Hand: Detected
Confidence: 0.87

X: 0.52
Y: 0.41

ΔX: 0.13
ΔY: 0.02

Gesture: SWIPE_RIGHT
State: COOLDOWN
```

This is useful for tuning the gesture thresholds.

Do not show this information in production mode.

---

# 23. ACCESSIBILITY

The website must remain usable without gestures.

Provide:

* Normal navigation
* Keyboard navigation
* Accessible buttons
* Proper semantic HTML
* Visible focus states
* ARIA labels where appropriate

Hands-Free Mode is an enhancement, not a requirement.

---

# 24. RESPONSIVE DESIGN

The website should work well on:

* Desktop
* Laptop
* Different resolutions

The main target is desktop/laptop because webcam gesture control is the primary feature.

Do not compromise desktop performance for unnecessary mobile functionality.

---

# 25. UI DESIGN

Create a modern, professional visual design.

Use:

* Clean typography
* Responsive cards
* Good spacing
* Subtle shadows
* Lightweight transitions
* Modern navbar
* Professional footer
* Consistent spacing
* Accessible contrast

Avoid:

* Excessive gradients
* Heavy 3D effects
* WebGL
* Huge animations
* Video backgrounds
* Large asset bundles

The site should look like a real production website.

---

# 26. PROJECT STRUCTURE

Use a clean structure such as:

```text
gesture-website/
│
├── index.html
├── about.html
├── projects.html
├── services.html
├── contact.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js
│   ├── camera.js
│   ├── gestures.js
│   ├── navigation.js
│   └── config.js
│
├── assets/
│   ├── images/
│   └── icons/
│
└── README.md
```

Keep responsibilities separated.

### `camera.js`

Responsible for:

* Webcam permission
* Starting camera
* Stopping camera
* Camera stream
* Camera errors

### `gestures.js`

Responsible for:

* Hand tracking
* Landmark extraction
* Smoothing
* Movement calculation
* Gesture classification
* Gesture state machine

### `navigation.js`

Responsible for:

* Current page
* Next page
* Previous page
* Navbar state
* Page transitions

### `config.js`

Responsible for:

* Gesture thresholds
* Camera configuration
* Confidence threshold
* Cooldown
* Scroll amount

### `app.js`

Responsible for:

* Application initialization
* Hands-Free Mode state
* Connecting camera + gestures + navigation
* UI updates

---

# 27. NO BACKEND

The application should be completely client-side.

Preferred architecture:

```text
┌───────────────────────────────┐
│          Browser              │
│                               │
│ HTML + CSS + JavaScript       │
│                               │
│        ↓                      │
│ Webcam API                    │
│        ↓                      │
│ MediaPipe Hand Tracking       │
│        ↓                      │
│ Gesture Recognition           │
│        ↓                      │
│ Website Actions               │
│                               │
└───────────────────────────────┘
```

No backend should be required.

---

# 28. LOCAL RUNNING

The website should be easy to run locally.

Provide instructions such as:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Explain why a local HTTP server may be necessary for webcam permissions instead of opening:

```text
file://...
```

directly.

Do not require a complex build system unless absolutely necessary.

---

# 29. PERFORMANCE OPTIMIZATION

Optimize the application carefully.

### Camera

Use approximately:

```text
640 × 480
```

or lower.

### Processing

Do not perform expensive calculations unnecessarily.

### Gesture detection

Use simple arithmetic after obtaining landmarks.

### Rendering

Do not redraw unnecessary UI elements every frame.

### DOM

Avoid repeatedly querying the DOM.

Cache important DOM elements.

### Event listeners

Do not attach duplicate listeners.

### Camera lifecycle

When Hands-Free Mode is OFF:

```text
STOP CAMERA
STOP PROCESSING
RELEASE RESOURCES
```

### Memory

Ensure camera streams and animation loops are properly cleaned up.

---

# 30. IMPORTANT: DO NOT OVER-ENGINEER

The first implementation should be simple.

Do NOT introduce:

* Redux
* State-management libraries
* Complex routing libraries
* Large component systems
* WebSockets
* Backend APIs
* Databases
* Docker
* Kubernetes
* LLMs
* Python services

unless there is a genuine requirement.

The entire project should ideally be understandable by a frontend developer reading the code.

---

# 31. FALLBACK BEHAVIOR

If gesture detection becomes unreliable:

The user must still be able to:

```text
click navbar
scroll normally
use keyboard
```

The gesture system must never break the normal website.

If Hands-Free Mode fails, display an error and automatically fall back to normal navigation.

---

# 32. SECURITY & PRIVACY

The webcam should only be accessed after the user explicitly enables Hands-Free Mode.

Do not upload camera frames anywhere.

Do not send images to external APIs.

Do not store camera frames.

All processing should happen locally in the browser.

Clearly indicate when the camera is active.

---

# 33. README

Create a comprehensive but concise `README.md` containing:

## Features

* Multi-page website
* Hands-Free Mode
* Webcam hand tracking
* Gesture scrolling
* Swipe navigation
* Smooth transitions

## Requirements

Explain:

* Browser requirements
* Webcam requirements

## Installation

Explain how to run locally.

Example:

```bash
python -m http.server 8000
```

## Usage

Explain:

```text
Click Hands-Free Mode
        ↓
Allow camera
        ↓
Show hand
        ↓
Move hand vertically → Scroll
Swipe horizontally → Change page
```

## Gesture Controls

Provide a table:

| Gesture | Action        |
| ------- | ------------- |
| ↑       | Scroll Up     |
| ↓       | Scroll Down   |
| ←       | Previous Page |
| →       | Next Page     |

## Troubleshooting

Explain:

* Camera permission denied
* Camera unavailable
* Gesture detection problems
* Browser compatibility
* Running through localhost

---

# 34. TESTING REQUIREMENTS

Before considering the project complete, test:

### Normal navigation

* Navbar works.
* Links work.
* Keyboard works.
* Scrolling works.

### Camera

* Camera permission works.
* Camera starts.
* Camera stops.
* Camera errors are handled.

### Gestures

Test:

```text
↑
↓
←
→
```

Also test:

* Small movements
* Diagonal movements
* Hand entering camera
* Hand leaving camera
* Holding hand still
* Repeated swipes
* Fast swipes
* Slow swipes

### Performance

Check that:

* UI remains responsive.
* Scrolling remains smooth.
* Page navigation remains smooth.
* CPU usage is reasonable.
* Camera is not running when Hands-Free Mode is OFF.

---

# 35. IMPORTANT GESTURE EDGE CASES

Handle these carefully.

### Case 1

User moves hand slightly.

Expected:

```text
NO ACTION
```

### Case 2

User moves hand vertically.

Expected:

```text
SCROLL
```

### Case 3

User moves hand horizontally.

Expected:

```text
PAGE CHANGE
```

### Case 4

User moves hand diagonally.

Expected:

```text
Classify using dominant axis.
Do not randomly trigger both actions.
```

### Case 5

User keeps hand moving after a swipe.

Expected:

```text
Only ONE page change.
Then cooldown.
```

### Case 6

User removes hand from camera.

Expected:

```text
Reset gesture state.
```

### Case 7

User turns Hands-Free Mode OFF.

Expected:

```text
Camera stops immediately.
Gesture processing stops.
```

---

# 36. CONFIGURABILITY

Put all important parameters in one configuration file.

Example:

```javascript
const CONFIG = {
    camera: {
        width: 640,
        height: 480,
        fps: 24
    },

    gesture: {
        horizontalThreshold: 0.15,
        verticalThreshold: 0.10,
        axisRatio: 1.3,
        cooldown: 900,
        smoothingFactor: 0.35,
        minConfidence: 0.60
    },

    scroll: {
        amount: 300
    }
};
```

These are initial values only.

Tune them based on testing.

---

# 37. FINAL USER EXPERIENCE

The final experience should look approximately like this:

```text
┌─────────────────────────────────────────────────────────┐
│ LOGO      Home   About   Projects   Services   Contact │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│                  WEBSITE CONTENT                        │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                                         │
│                                      ┌───────────────┐  │
│                                      │ ✋ Hands-Free │  │
│                                      │     OFF      │  │
│                                      └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

After enabling:

```text
┌─────────────────────────────────────────────────────────┐
│ LOGO      Home   About   Projects   Services   Contact │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                   WEBSITE CONTENT                       │
│                                                         │
│                                                         │
│                                                         │
│                         ↑                               │
│                    Hand Movement                       │
│                                                         │
│                                                         │
│                              ┌────────────────────┐    │
│                              │  Camera Preview    │    │
│                              │                    │    │
│                              └────────────────────┘    │
│                              ● Hands-Free ON           │
└─────────────────────────────────────────────────────────┘
```

---

# 38. DEVELOPMENT APPROACH

Build the project in this order:

### Phase 1

Create the complete multi-page website.

### Phase 2

Implement navbar and page navigation.

### Phase 3

Implement Hands-Free Mode UI.

### Phase 4

Implement webcam access.

### Phase 5

Integrate lightweight hand tracking.

### Phase 6

Implement landmark smoothing.

### Phase 7

Implement vertical scrolling.

### Phase 8

Implement horizontal swipe navigation.

### Phase 9

Implement cooldown and gesture state machine.

### Phase 10

Add visual feedback.

### Phase 11

Optimize performance.

### Phase 12

Test edge cases.

### Phase 13

Clean the code and create README.

---

# 39. OUTPUT REQUIREMENTS

Do not only provide a conceptual explanation.

Actually create the **complete working project**.

Provide:

1. All HTML files.
2. Complete CSS.
3. Complete JavaScript.
4. Hand tracking integration.
5. Gesture recognition.
6. Camera handling.
7. Navigation.
8. Hands-Free Mode.
9. Smooth scrolling.
10. Swipe navigation.
11. Error handling.
12. Debug mode.
13. Responsive UI.
14. README.
15. Local execution instructions.

Every file must contain complete working code.

Do not leave:

```text
TODO
implement this later
...
placeholder code
```

for any core functionality.

---

# 40. FINAL QUALITY BAR

Before finishing, verify the following:

```text
✓ Website works without camera
✓ Hands-Free Mode can be enabled/disabled
✓ Camera starts only when required
✓ Camera stops when disabled
✓ Hand tracking works locally
✓ Vertical movement scrolls
✓ Horizontal swipe changes pages
✓ Left/right direction is correct
✓ Small movements do nothing
✓ Diagonal movements are handled
✓ Repeated gestures are prevented
✓ Cooldown works
✓ Hand loss resets state
✓ Page transitions are smooth
✓ UI remains responsive
✓ CPU usage is reasonable
✓ No unnecessary backend
✓ No unnecessary dependencies
✓ No cloud processing
✓ No camera data uploaded
✓ Project runs locally
✓ README explains setup
```

## MOST IMPORTANT INSTRUCTION

**Prioritize simplicity and performance over adding features.**

If there is a choice between a sophisticated solution and a lightweight solution that provides the same user experience, always choose the lightweight solution.

The final application should feel like:

> **A normal modern website that happens to have an extremely smooth hands-free gesture-control mode.**

It should NOT feel like:

> **A heavy AI/computer-vision application with a website attached to it.**
