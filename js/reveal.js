/*==================================================================
  Maylaa — scroll-reveal for figma-design/

  Deliberately dependency-free: no GSAP, no ScrollTrigger, no WOW.js.
  Those are exactly the libraries flagged as dead/heavy weight during
  the site's performance pass (134KB+ for the GSAP suite alone, plus a
  library that hijacks scroll via transform). This file is the cheap
  alternative that gets the same "content settles in as you scroll"
  feel from a single IntersectionObserver and CSS transitions.

  Progressive enhancement, not a requirement: elements only get hidden
  once this script has confirmed motion is wanted and the browser can
  observe them. If JS fails to load, errors, or the visitor has
  prefers-reduced-motion set, nothing is ever hidden — there is no
  "flash of invisible content" failure mode to guard against.

  Cost per element: one class add at init, one more on reveal, then
  unobserve(). No listener runs after that element has settled.
==================================================================*/
(function () {
    "use strict";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    // Deliberately excludes anything Swiper manages (.mg-bcard, the
    // testimonial/brand sliders themselves) — those already animate via
    // the carousel, and Swiper's own transform on the track would fight
    // a second transform applied here for no visual benefit.
    var SELECTOR = [
        ".mg-phero__inner",
        ".mg-hero__content",
        ".mg-stat",
        ".mg-card",
        ".mg-about__inner",
        ".mg-split",
        ".mg-value",
        ".mg-vcard",
        ".mg-brandcard",
        ".mg-event",
        ".mg-infocard",
        ".mg-trusted__head",
        ".mg-testimonial__media",
        ".mg-filters",
        ".mg-logogrid__cell",
        ".mg-team .mg-head",
        ".mg-feature",
        ".mg-post",
        ".mg-presence .mg-head",
        ".mg-insights__head",
        ".mg-footer__nl-copy"
    ].join(", ");

    // querySelectorAll returns a static NodeList, which has no .slice() —
    // convert once so `pending` below can safely splice out elements as
    // they reveal.
    var els = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
    if (!els.length) return;

    var STAGGER_MS = 70;
    var STAGGER_MAX = 5;   // caps the delay so a long grid doesn't crawl in

    // Stagger by position within each shared parent, not by document
    // order, so unrelated sections (e.g. a page banner vs. a card grid
    // lower down) don't inherit each other's delay count.
    var counters = new WeakMap();

    els.forEach(function (el) {
        var parent = el.parentElement;
        var n = counters.get(parent) || 0;
        counters.set(parent, n + 1);

        el.classList.add("mg-reveal");
        el.style.setProperty(
            "--mg-reveal-delay",
            (Math.min(n, STAGGER_MAX) * STAGGER_MS) + "ms"
        );
    });

    // IntersectionObserver is the primary trigger, plus a cheap geometric
    // fallback on scroll/resize — the same belt-and-suspenders pattern
    // js/perf.js uses for deferred video, for the same reason: IO callbacks
    // are suspended while a tab is not actively rendering, so relying on it
    // alone risks content that stays opacity:0 forever. Unlike perf.js this
    // does not need a setInterval poll — scroll/resize already fire on every
    // real interaction that could bring a new element into view, and there
    // is nothing here that must reveal itself with the tab merely idle.
    var pending = els.slice();

    function nearViewport(el) {
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return false;
        return r.top < window.innerHeight * 1.1 && r.bottom > -window.innerHeight * 0.1;
    }

    function sweep() {
        for (var i = pending.length - 1; i >= 0; i--) {
            if (nearViewport(pending[i])) {
                pending[i].classList.add("is-visible");
                pending.splice(i, 1);
            }
        }
    }

    var io = new IntersectionObserver(
        function (entries, observer) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
                var idx = pending.indexOf(entry.target);
                if (idx > -1) pending.splice(idx, 1);
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    els.forEach(function (el) { io.observe(el); });

    sweep();
    ["scroll", "resize", "orientationchange"].forEach(function (evt) {
        window.addEventListener(evt, sweep, { passive: true });
    });
})();
