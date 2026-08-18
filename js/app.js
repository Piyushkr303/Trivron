/* =========================================================================
   app.js -- application bootstrap. Owns the Hands-Free Mode toggle and
   wires HandGestureNav + Navigation + UI together. No other file touches
   the DOM outside of its own widget.
   ========================================================================= */

(function () {
    "use strict";

    /* ---- cached DOM (queried once, per section 29 performance rules) ---- */
    let elements = null;
    let gestureNav = null;

    function cacheElements() {
        elements = {
            navToggle: document.getElementById("nav-toggle"),
            navLinks: document.getElementById("nav-links"),
            toggleBtn: document.getElementById("hf-toggle"),
            toggleLabel: document.getElementById("hf-toggle-label"),
            panel: document.getElementById("hf-panel"),
            video: document.getElementById("hf-video"),
            minimizeBtn: document.getElementById("hf-minimize"),
            statusDot: document.getElementById("hf-status-dot"),
            statusText: document.getElementById("hf-status-text"),
            gestureText: document.getElementById("hf-gesture-text"),
            errorBox: document.getElementById("hf-error"),
            errorText: document.getElementById("hf-error-text"),
            errorDismiss: document.getElementById("hf-error-dismiss"),
            debugBox: document.getElementById("hf-debug"),
            debugContent: document.getElementById("hf-debug-content")
        };
    }

    /* ---- Hands-Free Mode UI state (HandGestureNav owns the actual camera/
       gesture state; this is only the "starting..." gap and preview toggle) ---- */
    let starting = false;
    let minimized = false;
    let feedbackTimer = null;

    /* A swipe navigates to a brand-new page, which reloads all JS from
       scratch. Without this, Hands-Free Mode would silently drop back to
       OFF after every single swipe. We stash "the user wants this on"
       right before the page unloads, and the next page's init() picks it
       back up and re-enables automatically. Only an explicit click on the
       toggle (disable()) leaves this unset, so turning it off sticks. */
    const RESUME_KEY = "trivron:hf-active";

    const GESTURE_LABEL = {
        SCROLL_UP: "Scrolling to top",
        SCROLL_DOWN: "Scrolling to bottom",
        SWIPE_LEFT: "Swipe Left → Previous Page",
        SWIPE_RIGHT: "Swipe Right → Next Page",
        HAND_LOST: "Hand lost"
    };

    function setStatus(text, dotClass) {
        if (!elements.statusText) return;
        elements.statusText.textContent = text;
        elements.statusDot.className = "hf-dot " + (dotClass || "");
    }

    function setGestureFeedback(gesture) {
        if (!elements.gestureText) return;
        const label = GESTURE_LABEL[gesture];
        if (!label) return;
        elements.gestureText.textContent = label;
        elements.gestureText.classList.add("is-visible");
        window.clearTimeout(feedbackTimer);
        feedbackTimer = window.setTimeout(() => {
            elements.gestureText.classList.remove("is-visible");
        }, 1200);
    }

    function showError(message) {
        elements.errorText.textContent = message;
        elements.errorBox.hidden = false;
    }

    function hideError() {
        elements.errorBox.hidden = true;
    }

    /* =====================================================================
       Turning Hands-Free Mode on / off
       ===================================================================== */
    async function enable() {
        if (gestureNav.isActive() || starting) return;
        starting = true;
        hideError();
        setButtonState("starting");
        setStatus("Starting camera...", "");

        try {
            await gestureNav.enable();
        } catch (err) {
            /* The utility already emitted "error" with a friendly message,
               which showError() below has already displayed. */
            starting = false;
            setButtonState("off");
            return;
        }

        starting = false;
        setButtonState("on");
        elements.panel.hidden = false;
        setStatus("Waiting for hand...", "hf-dot--waiting");
    }

    function disable() {
        gestureNav.disable();
        starting = false;
        setButtonState("off");
        elements.panel.hidden = true;
        elements.debugBox.hidden = true;
        hideError();
    }

    function setButtonState(mode) {
        elements.toggleBtn.classList.toggle("is-on", mode === "on");
        elements.toggleBtn.classList.toggle("is-starting", mode === "starting");
        elements.toggleBtn.setAttribute("aria-pressed", mode === "on" ? "true" : "false");
        elements.toggleLabel.textContent =
            mode === "on" ? "ON" : mode === "starting" ? "Starting..." : "OFF";
    }

    /* =====================================================================
       Debug overlay (section 22)
       ===================================================================== */
    function renderDebug(frame) {
        if (!CONFIG.debug) return;
        elements.debugBox.hidden = false;
        const fmt = n => (typeof n === "number" ? n.toFixed(3) : "--");
        elements.debugContent.textContent =
            "Hand: " + (frame.landmarks ? "Detected" : "Not detected") + "\n" +
            "Confidence: " + fmt(frame.confidence) + "\n\n" +
            "X: " + fmt(frame.x) + "   Y: " + fmt(frame.y) + "\n" +
            "ΔX: " + fmt(frame.dx) + "  ΔY: " + fmt(frame.dy) + "\n\n" +
            "State: " + frame.state + "\n" +
            "Cooldown: " + frame.cooldownLeft + "ms";
    }

    /* =====================================================================
       Wiring HandGestureNav's events to this page's UI and navigation.
       Registered once; the same listeners cover every enable/disable cycle.
       ===================================================================== */
    function bindGestureEvents() {
        gestureNav
            .on("gesture", ({ type }) => {
                if (type === "SWIPE_RIGHT") Navigation.next();
                else if (type === "SWIPE_LEFT") Navigation.prev();
                setGestureFeedback(type);
            })
            .on("handLost", () => setGestureFeedback("HAND_LOST"))
            .on("stateChange", state => {
                if (state === HandGestureNav.STATE.IDLE) setStatus("Waiting for hand...", "hf-dot--waiting");
                else if (state === HandGestureNav.STATE.COOLDOWN) setStatus("Cooldown", "hf-dot--cooldown");
                else setStatus("Hand detected", "hf-dot--active");
            })
            .on("frame", renderDebug)
            .on("error", info => showError(info.message));
    }

    /* =====================================================================
       Wiring
       ===================================================================== */
    function bindEvents() {
        if (elements.navToggle) {
            elements.navToggle.addEventListener("click", () => {
                const open = elements.navLinks.classList.toggle("is-open");
                elements.navToggle.setAttribute("aria-expanded", String(open));
            });
        }

        elements.toggleBtn.addEventListener("click", () => {
            if (gestureNav.isActive()) disable(); else enable();
        });

        elements.minimizeBtn.addEventListener("click", () => {
            minimized = !minimized;
            elements.panel.classList.toggle("is-minimized", minimized);
            elements.minimizeBtn.setAttribute("aria-expanded", String(!minimized));
        });

        elements.errorDismiss.addEventListener("click", hideError);

        /* Keyboard equivalents of a swipe, so the feature never gates access. */
        document.addEventListener("keydown", event => {
            if (event.target && /input|textarea|select/i.test(event.target.tagName)) return;

            if (event.key === "ArrowRight") { Navigation.next(); }
            else if (event.key === "ArrowLeft") { Navigation.prev(); }
            else if (event.key.toLowerCase() === "d" && event.shiftKey) {
                CONFIG.debug = !CONFIG.debug;
                elements.debugBox.hidden = !CONFIG.debug;
            }
        });

        /* Never let a background tab keep the camera running. This also
           fires when a swipe/navbar click navigates to the next page, but
           beforeunload (below) always runs first and has already saved the
           "resume" flag by the time this stops the camera. */
        document.addEventListener("visibilitychange", () => {
            if (document.hidden && gestureNav.isActive()) disable();
        });

        window.addEventListener("beforeunload", () => {
            if (gestureNav.isActive()) {
                try { sessionStorage.setItem(RESUME_KEY, "1"); } catch (e) { /* private mode */ }
                gestureNav.disable();
            }
        });
    }

    function init() {
        cacheElements();

        gestureNav = new HandGestureNav(Object.assign(
            { videoElement: elements.video },
            CONFIG.gestureNav
        ));
        bindGestureEvents();

        Navigation.init();
        bindEvents();
        if (CONFIG.debug) elements.debugBox.hidden = false;

        let shouldResume = false;
        try {
            shouldResume = sessionStorage.getItem(RESUME_KEY) === "1";
            sessionStorage.removeItem(RESUME_KEY);
        } catch (e) { /* private mode: Hands-Free Mode simply won't auto-resume */ }

        if (shouldResume) enable();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
