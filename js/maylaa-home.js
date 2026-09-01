/*==================================================================
  Maylaa International — Home page behaviour
  Implemented from Figma: Maylaa--Devlops / "Home" (node 1:9158)

  Depends on: swiper-bundle.min.js (already vendored in /js)
==================================================================*/
(function () {
  "use strict";

  /*----------------------------------------------------------------
    Sticky navbar shadow
  ----------------------------------------------------------------*/
  var nav = document.getElementById("mgNav");

  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("is-stuck", window.scrollY > 8);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /*----------------------------------------------------------------
    Mobile menu
  ----------------------------------------------------------------*/
  var navToggle = document.getElementById("mgNavToggle");
  var navMenu = document.getElementById("mgNavMenu");

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      var open = navMenu.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });

    // Below 991px the dropdowns are accordions rather than hover panels.
    navMenu.querySelectorAll(".mg-nav__item").forEach(function (item) {
      var link = item.querySelector(".mg-nav__link");
      var drop = item.querySelector(".mg-nav__drop");

      if (!link || !drop) return;

      link.addEventListener("click", function (event) {
        if (window.matchMedia("(max-width: 991px)").matches) {
          event.preventDefault();
          item.classList.toggle("is-open");
        }
      });
    });

    // Close the panel after picking a link.
    navMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (!link.parentElement.classList.contains("mg-nav__item") || !link.nextElementSibling) {
          navMenu.classList.remove("is-open");
          navToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  /*----------------------------------------------------------------
    Brand carousel — Figma 1:9789
    Slides are a fixed 288px with a 20px gutter, matching the design's
    288px columns; the offset columns are handled in CSS.
  ----------------------------------------------------------------*/
  if (typeof Swiper !== "undefined" && document.getElementById("mgBrands")) {
    new Swiper("#mgBrands", {
      slidesPerView: "auto",
      spaceBetween: 20,
      grabCursor: true,
      loop: true,
      speed: 700,
      autoplay: {
        delay: 3200,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
      },
      breakpoints: {
        0: { spaceBetween: 12 },
        768: { spaceBetween: 20 }
      }
    });
  }

  /*----------------------------------------------------------------
    Testimonial slider — Figma 1:13354
    One quote ships in the design; the slider is wired so more can be
    added as extra .swiper-slide blocks without touching this file.
  ----------------------------------------------------------------*/
  if (typeof Swiper !== "undefined" && document.getElementById("mgQuotes")) {
    new Swiper("#mgQuotes", {
      slidesPerView: 1,
      spaceBetween: 32,
      speed: 500,
      autoHeight: true,
      navigation: {
        prevEl: "#mgQuotePrev",
        nextEl: "#mgQuoteNext",
        disabledClass: "swiper-button-disabled"
      }
    });
  }

  /*----------------------------------------------------------------
    Brand logo filter — Figma 1:13421
    Categories follow the footer taxonomy in the same design
    (Retail / Distribution Brands / Private Labels).
  ----------------------------------------------------------------*/
  var filters = document.querySelectorAll(".mg-filter");
  var grid = document.getElementById("mgLogoGrid");

  if (filters.length && grid) {
    var cells = grid.querySelectorAll(".mg-logogrid__cell");

    filters.forEach(function (button) {
      button.addEventListener("click", function () {
        var want = button.dataset.filter;

        filters.forEach(function (other) {
          other.classList.toggle("is-active", other === button);
        });

        cells.forEach(function (cell) {
          var cat = cell.dataset.cat;
          var show = want === "all" || cat === want || cat === "all";
          cell.classList.toggle("is-hidden", !show);
        });
      });
    });
  }

  /*----------------------------------------------------------------
    Team strip — Figma 1:13494
    The artwork is 2249px wide inside a 1280px frame, so it opens
    centred rather than hard against the left edge.
  ----------------------------------------------------------------*/
  var stage = document.getElementById("mgTeamStage");

  if (stage) {
    var centreStage = function () {
      stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
    };

    if (document.readyState === "complete") {
      centreStage();
    } else {
      window.addEventListener("load", centreStage);
    }

    // Drag-to-pan for mouse users; touch scrolling is native.
    var down = false;
    var startX = 0;
    var startScroll = 0;

    stage.addEventListener("mousedown", function (event) {
      down = true;
      startX = event.pageX;
      startScroll = stage.scrollLeft;
      stage.style.cursor = "grabbing";
    });

    window.addEventListener("mouseup", function () {
      down = false;
      stage.style.cursor = "";
    });

    stage.addEventListener("mousemove", function (event) {
      if (!down) return;
      event.preventDefault();
      stage.scrollLeft = startScroll - (event.pageX - startX);
    });
  }

  /*----------------------------------------------------------------
    Newsletter — Figma 1:13567
    No endpoint exists yet, so this validates and reports locally
    instead of silently doing nothing.
  ----------------------------------------------------------------*/
  var subscribe = document.getElementById("mgSubscribe");

  if (subscribe) {
    subscribe.addEventListener("submit", function (event) {
      event.preventDefault();

      var input = subscribe.querySelector("input[type='email']");
      var button = subscribe.querySelector("button");

      if (!input.value || !input.checkValidity()) {
        input.focus();
        return;
      }

      // TODO: POST input.value to the real subscription endpoint.
      var original = button.textContent;
      button.textContent = "Subscribed";
      button.disabled = true;
      input.value = "";

      window.setTimeout(function () {
        button.textContent = original;
        button.disabled = false;
      }, 2600);
    });
  }

  /*----------------------------------------------------------------
    Contact form (contact.html)
    Validates in-page and reports via the live region. No endpoint is
    wired yet, so nothing is transmitted anywhere.
  ----------------------------------------------------------------*/
  var contact = document.getElementById("mgContactForm");

  if (contact) {
    var status = document.getElementById("mgContactStatus");

    contact.addEventListener("submit", function (event) {
      event.preventDefault();

      var required = contact.querySelectorAll("[required]");
      var firstBad = null;

      required.forEach(function (field) {
        if (!field.checkValidity() && !firstBad) firstBad = field;
      });

      if (firstBad) {
        status.textContent = "Please complete the highlighted fields before sending.";
        firstBad.focus();
        return;
      }

      // TODO: POST new FormData(contact) to the real enquiry endpoint.
      var button = contact.querySelector("button[type='submit']");
      button.disabled = true;
      status.textContent = "Thank you — your message has been recorded. We'll be in touch shortly.";
      contact.reset();

      window.setTimeout(function () {
        button.disabled = false;
      }, 2600);
    });
  }
})();
