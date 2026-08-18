/* =========================================================================
   navigation.js — the single source of truth for page order.
   Nothing else in the app is allowed to know what "next page" means.
   ========================================================================= */

const Navigation = (function () {

    /* The canonical order. Swipes, the navbar and the keyboard all use it. */
    const pages = [
        { file: "index.html",    label: "Home" },
        { file: "about.html",    label: "About" },
        { file: "projects.html", label: "Projects" },
        { file: "services.html", label: "Services" },
        { file: "contact.html",  label: "Contact" }
    ];

    /* Wrap around at the ends? Off by default: stopping at Home/Contact is
       more predictable than silently looping. */
    const wrap = false;

    let currentIndex = 0;
    let navigating = false;

    function fileFromPath() {
        let name = window.location.pathname.split("/").pop();
        if (!name) name = "index.html";                 // served as "/"
        if (!name.includes(".")) name += ".html";
        return name.toLowerCase();
    }

    function detectCurrentIndex() {
        const file = fileFromPath();
        const found = pages.findIndex(p => p.file === file);
        currentIndex = found === -1 ? 0 : found;
        return currentIndex;
    }

    /* Highlight the active navbar link from the central page list, so the
       markup never has to be kept in sync by hand. */
    function syncNavbar() {
        const links = document.querySelectorAll("[data-nav-link]");
        const current = pages[currentIndex].file;
        links.forEach(link => {
            const target = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
            const isActive = target === current;
            link.classList.toggle("is-active", isActive);
            if (isActive) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    /* ---------------------------------------------------------------
       Transitions. Slide/fade out, then let the browser load the page.
       The incoming page slides in from the matching side (direction is
       handed over in sessionStorage — one tiny string, no router).
       --------------------------------------------------------------- */
    function go(index, direction) {
        if (navigating) return false;
        if (index === currentIndex) return false;

        navigating = true;
        const url = pages[index].file;

        if (!CONFIG.transition.enabled) {
            window.location.href = url;
            return true;
        }

        try { sessionStorage.setItem("trivron:enter", direction || "none"); } catch (e) { /* private mode */ }

        document.body.classList.add(direction === "next" ? "is-leaving-left" : "is-leaving-right");
        window.setTimeout(() => { window.location.href = url; }, CONFIG.transition.outMs);
        return true;
    }

    function next() {
        let i = currentIndex + 1;
        if (i >= pages.length) {
            if (!wrap) return false;
            i = 0;
        }
        return go(i, "next");
    }

    function prev() {
        let i = currentIndex - 1;
        if (i < 0) {
            if (!wrap) return false;
            i = pages.length - 1;
        }
        return go(i, "prev");
    }

    function hasNext() { return wrap || currentIndex < pages.length - 1; }
    function hasPrev() { return wrap || currentIndex > 0; }

    /* Play the enter animation matching the swipe that got us here. */
    function playEnterTransition() {
        let dir = "none";
        try {
            dir = sessionStorage.getItem("trivron:enter") || "none";
            sessionStorage.removeItem("trivron:enter");
        } catch (e) { /* ignore */ }

        if (dir === "next") document.body.classList.add("is-entering-right");
        else if (dir === "prev") document.body.classList.add("is-entering-left");

        /* One frame later, drop the offset and let CSS transition it home. */
        requestAnimationFrame(() => requestAnimationFrame(() => {
            document.body.classList.add("is-ready");
        }));
    }

    function init() {
        detectCurrentIndex();
        syncNavbar();
        playEnterTransition();

        /* Clicking the navbar should animate too, in the right direction. */
        document.querySelectorAll("[data-nav-link]").forEach(link => {
            link.addEventListener("click", event => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                const target = (link.getAttribute("href") || "").split("/").pop().toLowerCase();
                const i = pages.findIndex(p => p.file === target);
                if (i === -1 || i === currentIndex) return;
                event.preventDefault();
                go(i, i > currentIndex ? "next" : "prev");
            });
        });

        /* A browser restoring this page from bfcache keeps the leave class. */
        window.addEventListener("pageshow", () => {
            navigating = false;
            document.body.classList.remove("is-leaving-left", "is-leaving-right");
        });
    }

    return {
        pages,
        init,
        next,
        prev,
        hasNext,
        hasPrev,
        current: () => currentIndex,
        currentPage: () => pages[currentIndex]
    };
})();
