/*==================================================================
  Maylaa — universal lazy loading + performance guard

  Deliberately generic: it works off the DOM, not off a hardcoded list,
  so swapping, adding or renaming assets needs no change here.

  1. Images   every <img> gets loading="lazy" + decoding="async" unless it
              is in the first viewport (or opts out with data-eager).
  2. Video    <video> only downloads once it is close to the viewport.
              Autoplay behaviour is preserved, it just happens later.
  3. Iframes  same treatment as images.
  4. New DOM  a MutationObserver applies the same rules to anything added
              later, so slider clones and injected markup are covered too.

  Load this BEFORE the other scripts so nothing has started fetching yet.
==================================================================*/
(function () {
    "use strict";

    var EAGER_ATTR = "data-eager";       // opt out: keep this asset eager
    var ROOT_MARGIN = "400px";           // start fetching this far ahead

    /* ------------------------------------------------------------------
       Images and iframes
    ------------------------------------------------------------------ */
    function tuneImage(el) {
        if (el.hasAttribute(EAGER_ATTR)) return;
        if (el.dataset.mgTuned) return;
        el.dataset.mgTuned = "1";

        // Anything already in the first screen stays eager: lazily loading
        // something the user is looking at makes the page feel slower, not
        // faster, and costs LCP.
        var box = el.getBoundingClientRect();
        var inFirstScreen = box.top < window.innerHeight && box.bottom > 0 &&
                            box.width > 0 && box.height > 0;

        if (!el.hasAttribute("loading")) {
            el.setAttribute("loading", inFirstScreen ? "eager" : "lazy");
        }
        if (!el.hasAttribute("decoding")) {
            el.setAttribute("decoding", "async");
        }
        if (inFirstScreen && !el.hasAttribute("fetchpriority")) {
            el.setAttribute("fetchpriority", "high");
        }
    }

    /* ------------------------------------------------------------------
       Video — the expensive one. A single autoplay hero video on this site
       is ~8 MB, and the testimonial videos another ~13 MB, all fetched up
       front. Holding the src back until the element is near the viewport
       is the single biggest win available.
    ------------------------------------------------------------------ */
    function deferVideo(v) {
        if (v.dataset.mgDeferred) return;
        v.dataset.mgDeferred = "1";

        // Never let the browser preload the whole file.
        v.setAttribute("preload", "none");

        var src = v.getAttribute("src");
        if (src) {
            v.dataset.mgSrc = src;
            v.removeAttribute("src");
        }
        Array.prototype.forEach.call(v.querySelectorAll("source"), function (s) {
            var ss = s.getAttribute("src");
            if (ss) {
                s.dataset.mgSrc = ss;
                s.removeAttribute("src");
            }
        });
    }

    function loadVideo(v) {
        if (v.dataset.mgLoaded) return;
        v.dataset.mgLoaded = "1";

        if (v.dataset.mgSrc) v.setAttribute("src", v.dataset.mgSrc);
        Array.prototype.forEach.call(v.querySelectorAll("source"), function (s) {
            if (s.dataset.mgSrc) s.setAttribute("src", s.dataset.mgSrc);
        });

        v.setAttribute("preload", "metadata");
        v.load();

        // Only autoplay the ones that asked for it, and never fight the
        // browser if it refuses.
        if (v.hasAttribute("autoplay")) {
            var p = v.play();
            if (p && typeof p.catch === "function") p.catch(function () {});
        }
    }

    /* ------------------------------------------------------------------
       Observer wiring

       IntersectionObserver is the primary trigger, but it is not enough on
       its own here. This site runs GSAP ScrollSmoother, which moves content
       with a transform inside a fixed, overflow:hidden wrapper instead of
       scrolling the document. Between that and the fact that IO callbacks
       are suspended entirely while a tab is not rendering, there are real
       situations where the observer never fires — and a deferred video that
       never loads is simply missing content.

       So every deferred video is also checked geometrically. getBoundingClientRect
       keeps working in all of those cases, and the poll stops itself as soon
       as everything has loaded, so it costs nothing once the page settles.
    ------------------------------------------------------------------ */
    var deferred = [];          // videos still waiting
    var pollTimer = null;

    function nearViewport(el) {
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return false;      // not laid out yet
        var margin = parseInt(ROOT_MARGIN, 10) || 0;
        return r.top < (window.innerHeight + margin) && r.bottom > -margin;
    }

    function sweep() {
        for (var i = deferred.length - 1; i >= 0; i--) {
            var v = deferred[i];
            if (v.dataset.mgLoaded) {
                deferred.splice(i, 1);
                continue;
            }
            if (nearViewport(v)) {
                loadVideo(v);
                deferred.splice(i, 1);
            }
        }
        if (!deferred.length && pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function startPolling() {
        if (pollTimer || !deferred.length) return;
        pollTimer = setInterval(sweep, 500);
    }

    var videoObserver = null;

    if ("IntersectionObserver" in window) {
        videoObserver = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                loadVideo(entry.target);
                obs.unobserve(entry.target);
            });
        }, { rootMargin: ROOT_MARGIN });
    }

    function processVideo(v) {
        if (v.hasAttribute(EAGER_ATTR)) return;
        deferVideo(v);
        if (videoObserver) {
            videoObserver.observe(v);
            deferred.push(v);
            startPolling();
        } else {
            loadVideo(v);   // no IO support: behave exactly as before
        }
    }

    // Cheap extra triggers for the common cases.
    ["scroll", "resize", "orientationchange"].forEach(function (evt) {
        window.addEventListener(evt, sweep, { passive: true });
    });

    function scan(root) {
        if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
        var imgs = root.querySelectorAll ? root.querySelectorAll("img, iframe") : [];
        Array.prototype.forEach.call(imgs, tuneImage);
        var vids = root.querySelectorAll ? root.querySelectorAll("video") : [];
        Array.prototype.forEach.call(vids, processVideo);
        if (root.matches) {
            if (root.matches("img, iframe")) tuneImage(root);
            if (root.matches("video")) processVideo(root);
        }
    }

    // Run as early as possible so we beat the preload scanner where we can.
    scan(document);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { scan(document); });
    }

    /* ------------------------------------------------------------------
       Anything added later — slider clones, injected sections, CMS output
    ------------------------------------------------------------------ */
    if ("MutationObserver" in window) {
        new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) scan(added[j]);
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    }
})();
