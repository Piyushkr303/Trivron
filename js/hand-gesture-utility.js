/* =========================================================================
   hand-gesture-utility.js -- HandGestureNav

   A standalone, drop-in utility that adds webcam-based hand-gesture
   scrolling and swipe detection to ANY web page. No frameworks, no build
   step, one file. Works as a plain <script> (attaches window.HandGestureNav)
   or as a CommonJS/AMD module.

   Quick start:

       const nav = new HandGestureNav();
       nav.on("gesture", ({ type }) => {
           if (type === "SWIPE_LEFT")  showPreviousSlide();
           if (type === "SWIPE_RIGHT") showNextSlide();
           // SCROLL_UP / SCROLL_DOWN are handled for you automatically --
           // the page smoothly auto-scrolls to the top/bottom. Set
           // `scroll: { enabled: false }` in the config to opt out and
           // handle scrolling yourself instead.
       });
       await nav.enable();   // requests the camera and starts detection
       // ...
       nav.disable();        // stops and releases the camera immediately

   Everything is optional: pass a config object to override any default in
   HandGestureNav.DEFAULTS, or a `videoElement` if you want a visible
   preview (otherwise a hidden one is created for you automatically).
   ========================================================================= */

(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else if (typeof define === "function" && define.amd) {
        define([], factory);
    } else {
        root.HandGestureNav = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    const STATE = {
        IDLE: "IDLE",
        HAND_DETECTED: "HAND_DETECTED",
        TRACKING: "TRACKING",
        ACTION: "ACTION",
        COOLDOWN: "COOLDOWN"
    };

    /* MediaPipe hand-landmark indices used for a stable palm reference point. */
    const WRIST = 0, INDEX_MCP = 5, PINKY_MCP = 17;

    const DEFAULTS = {
        camera: {
            width: 640,
            height: 480,
            fps: 24,
            facingMode: "user",
            /* Mirror X so "move your hand right" reads as "swipe right",
               matching what the user sees in a selfie-style preview. */
            mirror: true
        },
        tracking: {
            wasmPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
            modelPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            moduleUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            delegate: "GPU"
        },
        gesture: {
            /* Both thresholds are minimum travel across `windowMs`, in
               normalised (0..1) frame units -- resolution independent.
               Vertical and horizontal are deliberately symmetric: a scroll
               gesture is held to the same "deliberate, thresholded,
               cooled-down" standard as a page swipe, which is what makes
               both feel equally reliable. */
            horizontalThreshold: 0.16,
            verticalThreshold: 0.10,
            /* |dx| must exceed |dy| * axisRatio to count as horizontal (and
               vice versa), so a diagonal movement can't trigger both. */
            axisRatio: 1.4,
            windowMs: 320,
            /* Lock-out after any gesture fires, so one long movement can't
               retrigger repeatedly. */
            cooldown: 900,
            smoothingFactor: 0.35,
            minConfidence: 0.60,
            lostFrames: 6,
            warmupFrames: 4
        },
        /* Built-in convenience behavior: a SCROLL_UP/SCROLL_DOWN gesture
           smoothly animates the page to the top/bottom, instead of you
           having to wire up scrolling yourself. Set enabled:false to only
           receive the raw gesture events. */
        scroll: {
            enabled: true,
            speed: 500,       // px/second -- slow and smooth by default
            minDistance: 40   // px; skip the animation for tiny distances
        },
        /* Provide your own <video> (e.g. for a visible preview) or leave
           null and one is created for you, hidden off-screen. */
        videoElement: null
    };

    function isPlainObject(v) {
        return v && typeof v === "object" && !Array.isArray(v);
    }

    function mergeDeep(base, override) {
        const out = Object.assign({}, base);
        if (!override) return out;
        Object.keys(override).forEach(key => {
            const value = override[key];
            out[key] = isPlainObject(value) && isPlainObject(base[key])
                ? mergeDeep(base[key], value)
                : value;
        });
        return out;
    }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    class HandGestureNav {

        constructor(options) {
            this.config = mergeDeep(DEFAULTS, options || {});
            this._listeners = {};

            this._videoEl = this.config.videoElement || null;
            this._ownsVideoEl = false;
            this._stream = null;
            this._landmarker = null;
            this._loadingModel = null;

            this._active = false;
            this._starting = false;
            this._rafId = null;

            this._state = STATE.IDLE;
            this._smoothX = null;
            this._smoothY = null;
            this._history = [];
            this._lostCounter = 0;
            this._seenFrames = 0;
            this._cooldownUntil = 0;
            this._lastVideoTime = -1;
            this._lastFrameAt = 0;
            this._lastLandmarks = null;
            this._lastConfidence = 0;

            this._autoScrollRaf = null;
            this._autoScrollActive = false;
            this._manualScrollHandler = null;
            this._keydownScrollHandler = null;
        }

        /* =================================================================
           Public: feature detection & config
           ================================================================= */
        static isSupported() {
            return typeof navigator !== "undefined" &&
                !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        }

        isSupported() { return HandGestureNav.isSupported(); }

        updateConfig(partial) {
            this.config = mergeDeep(this.config, partial || {});
        }

        isActive() { return this._active; }

        getVideoElement() { return this._videoEl; }

        /* =================================================================
           Public: event API. Supports .on()/.off() AND constructor-time
           `onGesture` / `onError` / etc. callbacks -- use whichever fits
           your codebase.
           ================================================================= */
        on(event, handler) {
            (this._listeners[event] || (this._listeners[event] = [])).push(handler);
            return this;
        }

        off(event, handler) {
            const list = this._listeners[event];
            if (!list) return this;
            this._listeners[event] = list.filter(h => h !== handler);
            return this;
        }

        _emit(event, detail) {
            (this._listeners[event] || []).forEach(handler => {
                try { handler(detail); } catch (err) { /* one bad listener should not break the loop */ }
            });
            const callbackName = "on" + event[0].toUpperCase() + event.slice(1);
            const cb = this.config[callbackName];
            if (typeof cb === "function") {
                try { cb(detail); } catch (err) { /* same guarantee for the shortcut form */ }
            }
        }

        /* =================================================================
           Public: lifecycle
           ================================================================= */
        async enable() {
            if (this._active || this._starting) return;
            this._starting = true;

            if (!this._videoEl) {
                this._videoEl = document.createElement("video");
                this._videoEl.setAttribute("playsinline", "");
                this._videoEl.muted = true;
                this._videoEl.style.cssText =
                    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
                document.body.appendChild(this._videoEl);
                this._ownsVideoEl = true;
            }

            try {
                await this._startCamera();
            } catch (err) {
                this._starting = false;
                const info = this._describeCameraError(err);
                this._emit("error", info);
                throw new Error(info.message);
            }

            try {
                await this._loadModel();
            } catch (err) {
                this._stopCamera();
                this._starting = false;
                const info = {
                    code: "model-load-error",
                    message: "Hand tracking could not be loaded (check your internet connection). Normal navigation still works."
                };
                this._emit("error", info);
                throw new Error(info.message);
            }

            this._active = true;
            this._starting = false;
            this._resetTracking();
            this._bindManualScrollWatchers();
            this._lastFrameAt = 0;
            this._rafId = requestAnimationFrame(now => this._loop(now));
        }

        disable() {
            if (this._rafId !== null) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }
            this._stopCamera();
            this._cancelAutoScroll("disabled");
            this._unbindManualScrollWatchers();
            this._active = false;
            this._starting = false;
            this._resetTracking();
        }

        destroy() {
            this.disable();
            if (this._landmarker) {
                this._landmarker.close();
                this._landmarker = null;
            }
            this._loadingModel = null;
            if (this._ownsVideoEl && this._videoEl && this._videoEl.parentNode) {
                this._videoEl.parentNode.removeChild(this._videoEl);
            }
            this._videoEl = null;
            this._listeners = {};
        }

        /* =================================================================
           Internal: camera lifecycle
           ================================================================= */
        async _startCamera() {
            if (!HandGestureNav.isSupported()) {
                throw Object.assign(new Error("getUserMedia unavailable"), { name: "NotFoundError" });
            }
            if (this._stream) return this._stream;

            this._stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    width: { ideal: this.config.camera.width },
                    height: { ideal: this.config.camera.height },
                    frameRate: { ideal: this.config.camera.fps },
                    facingMode: this.config.camera.facingMode
                }
            });

            this._videoEl.srcObject = this._stream;

            await new Promise((resolve, reject) => {
                const ok = () => { cleanup(); resolve(); };
                const fail = () => { cleanup(); reject(new Error("Video failed to load")); };
                const cleanup = () => {
                    this._videoEl.removeEventListener("loadeddata", ok);
                    this._videoEl.removeEventListener("error", fail);
                };
                if (this._videoEl.readyState >= 2) return resolve();
                this._videoEl.addEventListener("loadeddata", ok);
                this._videoEl.addEventListener("error", fail);
            });

            await this._videoEl.play();
            return this._stream;
        }

        _stopCamera() {
            if (this._stream) {
                this._stream.getTracks().forEach(track => track.stop());
                this._stream = null;
            }
            if (this._videoEl) {
                this._videoEl.pause();
                this._videoEl.srcObject = null;
            }
        }

        _describeCameraError(err) {
            const name = err && err.name ? err.name : "Error";
            switch (name) {
                case "NotAllowedError":
                case "SecurityError":
                    return {
                        code: "permission-denied",
                        message: "Camera access is required for Hands-Free Mode. You can continue using the website normally without it."
                    };
                case "NotFoundError":
                case "OverconstrainedError":
                    return {
                        code: "no-camera",
                        message: "No compatible camera was detected. Hands-Free Mode is unavailable."
                    };
                case "NotReadableError":
                case "AbortError":
                    return {
                        code: "camera-busy",
                        message: "Your camera could not be started -- another app may be using it. Normal navigation still works."
                    };
                default:
                    return {
                        code: "camera-error",
                        message: "Something went wrong while starting the camera. You can keep browsing normally."
                    };
            }
        }

        /* =================================================================
           Internal: model loading (dynamic import, fetched only once used)
           ================================================================= */
        _loadModel() {
            if (this._landmarker) return Promise.resolve(this._landmarker);
            if (this._loadingModel) return this._loadingModel;

            this._loadingModel = (async () => {
                const vision = await import(this.config.tracking.moduleUrl);
                const fileset = await vision.FilesetResolver.forVisionTasks(this.config.tracking.wasmPath);

                const options = {
                    baseOptions: {
                        modelAssetPath: this.config.tracking.modelPath,
                        delegate: this.config.tracking.delegate
                    },
                    runningMode: "VIDEO",
                    numHands: this.config.tracking.numHands,
                    minHandDetectionConfidence: this.config.tracking.minHandDetectionConfidence,
                    minHandPresenceConfidence: this.config.tracking.minHandPresenceConfidence,
                    minTrackingConfidence: this.config.tracking.minTrackingConfidence
                };

                try {
                    this._landmarker = await vision.HandLandmarker.createFromOptions(fileset, options);
                } catch (err) {
                    options.baseOptions.delegate = "CPU";   // no WebGL / blocked GPU: retry on CPU
                    this._landmarker = await vision.HandLandmarker.createFromOptions(fileset, options);
                }
                return this._landmarker;
            })();

            this._loadingModel.catch(() => { this._loadingModel = null; });   // allow a later retry
            return this._loadingModel;
        }

        /* =================================================================
           Internal: tracking session
           ================================================================= */
        _resetTracking() {
            this._state = STATE.IDLE;
            this._smoothX = this._smoothY = null;
            this._history = [];
            this._lostCounter = 0;
            this._seenFrames = 0;
            this._lastVideoTime = -1;
            this._lastLandmarks = null;
            this._lastConfidence = 0;
        }

        _setState(next) {
            if (this._state === next) return;
            this._state = next;
            this._emit("stateChange", next);
        }

        /* =================================================================
           Internal: main detection loop
           ================================================================= */
        _loop(now) {
            if (!this._active) return;
            this._rafId = requestAnimationFrame(t => this._loop(t));

            if (!this._videoEl || this._videoEl.readyState < 2) return;
            const minFrameGap = 1000 / this.config.camera.fps;
            if (now - this._lastFrameAt < minFrameGap) return;
            if (this._videoEl.currentTime === this._lastVideoTime) return;
            this._lastFrameAt = now;
            this._lastVideoTime = this._videoEl.currentTime;

            let result;
            try {
                result = this._landmarker.detectForVideo(this._videoEl, now);
            } catch (err) {
                return;   // transient decode hiccup
            }

            const hands = result && result.landmarks ? result.landmarks : [];
            if (hands.length === 0) {
                this._onHandMissing();
            } else {
                const confidence = result.handednesses && result.handednesses[0] && result.handednesses[0][0]
                    ? result.handednesses[0][0].score
                    : 1;
                if (confidence < this.config.gesture.minConfidence) this._onHandMissing();
                else this._onHandFrame(hands[0], confidence, now);
            }

            this._emitFrame();
        }

        _onHandMissing() {
            this._lastLandmarks = null;
            this._lastConfidence = 0;
            this._lostCounter++;
            if (this._lostCounter > this.config.gesture.lostFrames && this._state !== STATE.IDLE) {
                this._resetTracking();
                this._setState(STATE.IDLE);
                this._cancelAutoScroll("hand-lost");
                this._emit("handLost", {});
            }
        }

        _onHandFrame(landmarks, confidence, now) {
            this._lostCounter = 0;
            this._lastLandmarks = landmarks;
            this._lastConfidence = confidence;

            /* Palm centre: averaging three knuckle-level points is far
               steadier than tracking any single fingertip. */
            let x = (landmarks[WRIST].x + landmarks[INDEX_MCP].x + landmarks[PINKY_MCP].x) / 3;
            let y = (landmarks[WRIST].y + landmarks[INDEX_MCP].y + landmarks[PINKY_MCP].y) / 3;
            if (this.config.camera.mirror) x = 1 - x;

            const a = this.config.gesture.smoothingFactor;
            if (this._smoothX === null) { this._smoothX = x; this._smoothY = y; }
            else {
                this._smoothX = a * x + (1 - a) * this._smoothX;
                this._smoothY = a * y + (1 - a) * this._smoothY;
            }

            if (this._state === STATE.IDLE) {
                this._setState(STATE.HAND_DETECTED);
                this._seenFrames = 0;
            }
            this._seenFrames++;

            this._history.push({ x: this._smoothX, y: this._smoothY, t: now });
            const cutoff = now - this.config.gesture.windowMs;
            while (this._history.length > 2 && this._history[0].t < cutoff) this._history.shift();

            if (now < this._cooldownUntil) {
                this._setState(STATE.COOLDOWN);
                return;
            }
            if (this._state === STATE.COOLDOWN) this._setState(STATE.TRACKING);

            /* A hand that just entered the frame must settle before it can act. */
            if (this._seenFrames < this.config.gesture.warmupFrames) return;
            if (this._state === STATE.HAND_DETECTED) this._setState(STATE.TRACKING);

            this._classify(now);
        }

        /* =================================================================
           Classification: dominant axis, then a symmetric threshold check.
           Vertical and horizontal use the identical rolling-window
           displacement, so scroll and swipe feel equally deliberate and
           reliable -- neither is judged from a single noisy frame.
           ================================================================= */
        _classify(now) {
            const oldest = this._history[0];
            const dx = this._smoothX - oldest.x;
            const dy = this._smoothY - oldest.y;

            const horizontal = Math.abs(dx) > Math.abs(dy) * this.config.gesture.axisRatio;

            if (horizontal) {
                if (Math.abs(dx) >= this.config.gesture.horizontalThreshold) {
                    this._trigger(dx > 0 ? "SWIPE_RIGHT" : "SWIPE_LEFT", now);
                }
            } else {
                if (Math.abs(dy) >= this.config.gesture.verticalThreshold) {
                    this._trigger(dy > 0 ? "SCROLL_DOWN" : "SCROLL_UP", now);
                }
            }
        }

        _trigger(type, now) {
            this._setState(STATE.ACTION);
            this._emit("gesture", { type });

            if (type === "SCROLL_DOWN" || type === "SCROLL_UP") {
                if (this.config.scroll.enabled) {
                    this._startAutoScroll(type === "SCROLL_DOWN" ? "down" : "up");
                }
            } else {
                this._cancelAutoScroll("navigating");
            }

            this._cooldownUntil = now + this.config.gesture.cooldown;
            this._history = [];   // a fresh trail, so the same sweep cannot re-fire
            this._seenFrames = 0;
            this._setState(STATE.COOLDOWN);
        }

        /* =================================================================
           Built-in convenience: smooth, slow auto-scroll to the top/bottom
           of the page, triggered once per deliberate gesture -- not a
           continuous per-frame follow, which is what made scrolling feel
           inconsistent. Cancelled by an opposite gesture, manual scroll
           input, losing the hand, or a swipe navigating away.
           ================================================================= */
        _startAutoScroll(direction) {
            this._cancelAutoScroll();   // replaces any in-flight animation, including a reversal

            const doc = document.documentElement;
            const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
            const targetY = direction === "down" ? maxScroll : 0;
            const startY = window.scrollY;
            const distance = targetY - startY;
            if (Math.abs(distance) < this.config.scroll.minDistance) return;

            const speed = Math.max(50, this.config.scroll.speed);
            const durationMs = Math.max(400, Math.abs(distance) / speed * 1000);
            const startTime = performance.now();

            this._autoScrollActive = true;
            this._emit("autoScrollStart", { direction, from: startY, to: targetY });

            const step = now => {
                if (!this._autoScrollActive) return;
                const elapsed = now - startTime;
                const t = Math.min(1, elapsed / durationMs);
                /* behavior: "instant" is required here -- without it, a host
                   page with CSS `scroll-behavior: smooth` (common, and true
                   of this very site) makes EVERY one of these per-frame
                   calls kick off its own native smooth-scroll animation,
                   which fights our easing and produces exactly the janky,
                   unpredictable motion this feature exists to avoid. */
                window.scrollTo({ top: startY + distance * easeInOutCubic(t), left: 0, behavior: "instant" });
                if (t < 1) {
                    this._autoScrollRaf = requestAnimationFrame(step);
                } else {
                    this._autoScrollActive = false;
                    this._emit("autoScrollEnd", { direction, reason: "completed", completed: true });
                }
            };
            this._autoScrollRaf = requestAnimationFrame(step);
        }

        _cancelAutoScroll(reason) {
            if (this._autoScrollRaf !== null) {
                cancelAnimationFrame(this._autoScrollRaf);
                this._autoScrollRaf = null;
            }
            if (this._autoScrollActive) {
                this._autoScrollActive = false;
                this._emit("autoScrollEnd", { reason: reason || "cancelled", completed: false });
            }
        }

        _bindManualScrollWatchers() {
            this._manualScrollHandler = () => {
                if (this._autoScrollActive) this._cancelAutoScroll("user-input");
            };
            this._keydownScrollHandler = event => {
                if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
                    this._manualScrollHandler();
                }
            };
            window.addEventListener("wheel", this._manualScrollHandler, { passive: true });
            window.addEventListener("touchstart", this._manualScrollHandler, { passive: true });
            window.addEventListener("keydown", this._keydownScrollHandler);
        }

        _unbindManualScrollWatchers() {
            window.removeEventListener("wheel", this._manualScrollHandler);
            window.removeEventListener("touchstart", this._manualScrollHandler);
            window.removeEventListener("keydown", this._keydownScrollHandler);
        }

        /* =================================================================
           Debug feed -- always emitted (cheap); consumers decide whether to
           render it.
           ================================================================= */
        _emitFrame() {
            if (!this._listeners.frame && !this.config.onFrame) return;
            const oldest = this._history.length ? this._history[0] : null;
            this._emit("frame", {
                landmarks: this._lastLandmarks,
                confidence: this._lastConfidence,
                x: this._smoothX,
                y: this._smoothY,
                dx: oldest && this._smoothX !== null ? this._smoothX - oldest.x : 0,
                dy: oldest && this._smoothY !== null ? this._smoothY - oldest.y : 0,
                state: this._state,
                cooldownLeft: Math.max(0, Math.round(this._cooldownUntil - performance.now()))
            });
        }
    }

    HandGestureNav.STATE = STATE;
    HandGestureNav.DEFAULTS = DEFAULTS;

    return HandGestureNav;
});
