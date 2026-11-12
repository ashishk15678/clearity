
```
  Clarity Analytics SDK  
  Captures: page views (time-on-page = visible time, scroll depth), custom
  events, rage/dead clicks, session recordings (privacy-masked DOM snapshot +
  interaction stream), and errors (stack + breadcrumbs).
 
  <script
    src="https://${window.location.hostname}/clarity.js"
    data-project-id="YOUR_PROJECT_ID"
    data-api-key="clr_live_…"
    data-ingest="http://localhost:4000"
    data-sample-rate="1"        (optional, 0-1: share of sessions recorded)
    data-mask-text="false"      (optional, "true" masks ALL page text in replays)
  ></script>
 
  Privacy attributes (put on any element):
    data-clarity-mask   → text inside is replaced with •••• in replays
    data-clarity-block  → element is replaced by an empty box in replays
 
  API: clarity.track(name, props) · clarity.identify(id, traits)
       clarity.optOut() · clarity.optIn() · clarity.flush()
 
```
(function (window, document) {
  "use strict";

  if (window.__clarityLoaded) return;
  window.__clarityLoaded = true;

  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  var PROJECT_ID = script.getAttribute("data-project-id") || "";
  var API_KEY = script.getAttribute("data-api-key") || "";
  var INGEST = (
    script.getAttribute("data-ingest") || "http://localhost:4000"
  ).replace(/\/$/, "");
  var SAMPLE = parseFloat(script.getAttribute("data-sample-rate"));
  var MASK_TEXT = script.getAttribute("data-mask-text") === "true";
  if (isNaN(SAMPLE)) SAMPLE = 1;

  if (!PROJECT_ID || !API_KEY) {
    console.warn("[Clarity] Missing data-project-id or data-api-key.");
    return;
  }

  // Respect Do-Not-Track / Global Privacy Control
  if (
    navigator.doNotTrack === "1" ||
    window.doNotTrack === "1" ||
    navigator.globalPrivacyControl
  )
    return;

  var OPT_KEY = "_clr_optout";
  if (lsGet(OPT_KEY) === "1") return;
  // Visitor: long-lived (localStorage)
  var visitor = parse(lsGet("_clr_vid"));
  if (!visitor || !visitor.id) {
    visitor = { id: uuid(), ts: Date.now() };
    lsSet("_clr_vid", JSON.stringify(visitor));
  }
  var VISITOR_ID = visitor.id;

  // Session: per-tab, rolls over after 30 min of inactivity
  var SESSION_TTL = 30 * 60 * 1000;
  var SKEY = "_clr_sid";
  var session = parse(ssGet(SKEY));
  if (!session || !session.id || Date.now() - session.ts > SESSION_TTL) {
    session = {
      id: uuid(),
      ts: Date.now(),
      sampled: Math.random() < SAMPLE,
      isNew: true,
    };
  } else {
    session.isNew = false;
  }
  ssSet(
    SKEY,
    JSON.stringify({
      id: session.id,
      ts: Date.now(),
      sampled: session.sampled,
    }),
  );

  var lastTouch = 0;
 
  var RECORD = session.sampled;

  // ── Network ─────────────────────────────────────────────────────────────────

  var MAX_BODY = 60000; // fetch keepalive hard limit is 64 KB

  var optedOut = false;


  // ── Breadcrumbs (ring buffer) ───────────────────────────────────────────────

  var MAX_BREADCRUMBS = 30;
  var breadcrumbs = [];

  
  ["log", "warn", "error", "info"].forEach(function (method) {
    if (typeof console[method] !== "function") return;
    var orig = console[method];
    console[method] = function () {
      try {
        var parts = [];
        for (var i = 0; i < arguments.length && i < 5; i++) {
          var a = arguments[i];
          parts.push(a && typeof a === "object" ? "[object]" : String(a)); // no deep stringify: cheap + no PII/circulars
        }
        addBreadcrumb("console." + method, parts.join(" "));
      } catch (_) {}
      return orig.apply(console, arguments);
    };
  });

  // ── DOM snapshot (privacy-aware, size-capped) ───────────────────────────────

  var MAX_NODES = 1500;
  var MAX_DEPTH = 12;

  // ── Recording frames ────────────────────────────────────────────────────────

  var FRAME = {
    SNAPSHOT: "snapshot",
    MOUSE: "mouse",
    CLICK: "click",
    SCROLL: "scroll",
    INPUT: "input",
    RESIZE: "resize",
    NAV: "nav",
    CUSTOM: "custom",
  };

  var PAGE_START = now();
  var MAX_FRAMES = 2000; // memory cap if the network is down
  var FLUSH_EVERY = 5000;
  var frames = [];
  var flushTimer = null;

  // ── Visible-time tracking (so a background tab doesn't count as "time on page")

  var visibleSince = document.visibilityState === "hidden" ? null : now();
  var visibleAccum = 0;
  // ── Scroll (single listener, rAF-throttled) ─────────────────────────────────

  var maxScrollPct = 0;
  var scrollQueued = false;
  var lastScrollFrame = 0;


  document.addEventListener(
    "scroll",
    function () {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(function () {
        scrollQueued = false;
        sampleScroll(true);
        touch();
      });
    },
    { passive: true },
  );

  // ── Mouse / resize / input ──────────────────────────────────────────────────

  var lastMouse = 0;
  document.addEventListener(
    "mousemove",
    function (e) {
      var t = now();
      if (t - lastMouse < 50) return;
      lastMouse = t;
      pushFrame(FRAME.MOUSE, { x: e.clientX, y: e.clientY });
    },
    { passive: true },
  );

  var resizeTimer = null;
  window.addEventListener(
    "resize",
    function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        pushFrame(FRAME.RESIZE, {
          w: window.innerWidth,
          h: window.innerHeight,
        });
      }, 150);
    },
    { passive: true },
  );

  // Values are NEVER recorded (emails, searches, etc. are PII) — only length.
  document.addEventListener(
    "input",
    function (e) {
      var el = e.target;
      if (!el || el.type === "password") return;
      pushFrame(FRAME.INPUT, {
        target: describe(el),
        len: (el.value || "").length,
      });
    },
    true,
  );

  // ── Click handling: breadcrumb + replay + rage + dead (single listener) ─────

  var RAGE_WINDOW_MS = 600;
  var RAGE_MIN_COUNT = 3;
  var RAGE_RADIUS_PX = 30;
  var clickHistory = [];

  var INTERACTIVE_SEL =
    "a[href],button,input,select,textarea,label,summary,[role=button],[role=link],[role=tab]," +
    "[role=menuitem],[role=checkbox],[role=switch],[onclick],[data-action],[tabindex]";

  document.addEventListener(
    "click",
    function (e) {
      var el = e.target;
      if (!el || el.nodeType !== 1) return;
      var t = now();
      var descriptor = describe(el);
      touch();

      addBreadcrumb("click", descriptor); // no textContent: it can contain names/emails
      pushFrame(FRAME.CLICK, {
        x: e.clientX,
        y: e.clientY,
        target: descriptor,
      });

      // Rage: ≥3 clicks within 600 ms inside a 30 px radius (robust to re-rendering elements)
      clickHistory.push({ x: e.clientX, y: e.clientY, ts: t });
      clickHistory = clickHistory.filter(function (c) {
        return t - c.ts <= RAGE_WINDOW_MS;
      });
      var near = clickHistory.filter(function (c) {
        return (
          Math.abs(c.x - e.clientX) <= RAGE_RADIUS_PX &&
          Math.abs(c.y - e.clientY) <= RAGE_RADIUS_PX
        );
      });

      if (near.length >= RAGE_MIN_COUNT) {
        if (near.length === RAGE_MIN_COUNT) {
          // once per burst
          post("/track/event", {
            project_id: PROJECT_ID,
            type: "rage_click",
            name: "rage_click",
            properties: { selector: descriptor, count: near.length },
            url: location.href,
            x: e.clientX,
            y: e.clientY,
            selector: descriptor,
            visitor_id: VISITOR_ID,
          });
        }
        return;
      }

      if (!isInteractive(el)) watchForDeadClick(el, e, descriptor);
    },
    true,
  );

  // ── Page views ──────────────────────────────────────────────────────────────

  var pageviewId = uuid();
  var pageviewUrl = "";
  var lastSentDuration = -1;
  var lastSentScroll = -1;
  // ── SPA navigation (only on real URL changes) ───────────────────────────────

  (function () {
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    var currentUrl = location.href;

    function onNav() {
      var next = location.href;
      if (next === currentUrl) return; // replaceState is often called with the same URL (routers, analytics libs)
      finalizePageView();
      flushFrames(false);
      var prev = currentUrl;
      currentUrl = next;
      pushFrame(FRAME.NAV, { url: next });
      trackPageView(next, prev);
      setTimeout(takeSnapshot, 500); // new view → new snapshot, otherwise replay shows the old page
    }

    history.pushState = function () {
      var r = origPush.apply(this, arguments);
      onNav();
      return r;
    };
    history.replaceState = function () {
      var r = origReplace.apply(this, arguments);
      onNav();
      return r;
    };
    window.addEventListener("popstate", onNav);
  })();

  // ── Lifecycle: ONE exit path ────────────────────────────────────────────────

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      if (visibleSince) {
        visibleAccum += now() - visibleSince;
        visibleSince = null;
      }
      finalizePageView();
      flushFrames(false);
    } else {
      visibleSince = now();
      touch();
    }
  });
  window.addEventListener("pagehide", function () {
    finalizePageView();
    flushFrames(true);
  });
  // (beforeunload removed: pagehide + visibilitychange cover it and avoid duplicate sends / bfcache issues)

  // ── Errors (deduped + rate-limited) ─────────────────────────────────────────

  var MAX_ERRORS_PER_PAGE = 20;
  var errorCount = 0;
  var seenErrors = {};

  window.addEventListener("error", function (e) {
    if (!e.message) return; // resource load errors (img/script 404) bubble differently; ignore here
    addBreadcrumb("error", e.message);
    sendError(
      e.message,
      e.error && e.error.stack,
      "error",
      e.filename,
      e.lineno,
      e.colno,
    );
  });

  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    var msg = r ? r.message || String(r) : "Unhandled Promise rejection";
    addBreadcrumb("unhandledrejection", msg);
    sendError(msg, r && r.stack, "unhandledrejection");
  });

  // ── Public API ──────────────────────────────────────────────────────────────

  var api = (window.clarity = window.clarity || {});

  api.track = function (name, properties) {
    pushFrame(FRAME.CUSTOM, { name: name, props: properties || {} });
    post("/track/event", {
      project_id: PROJECT_ID,
      type: "custom",
      name: name,
      properties: properties || {},
      url: location.href,
      visitor_id: VISITOR_ID,
    });
  };

  api.identify = function (userId, traits) {
    post("/track/identify", {
      project_id: PROJECT_ID,
      user_id: userId,
      visitor_id: VISITOR_ID,
      traits: traits || {},
    });
  };

  api.flush = function () {
    finalizePageView();
    flushFrames(false);
  };

  // Consent hooks: call clarity.optOut() from your cookie banner
  api.optOut = function () {
    lsSet(OPT_KEY, "1");
    optedOut = true;
    RECORD = false;
    frames = [];
  };
  api.optIn = function () {
    try {
      localStorage.removeItem(OPT_KEY);
    } catch (_) {}
  };

  // ── Tour engine ─────────────────────────────────────────────────────────────
  //
  // Renders a multi-step product tour on top of the page.
  // Dims everything, highlights the target element, shows a card with next/back.
  //
  // Usage:
  //   clarity.tour([
  //     { target: "#signup-btn",  title: "Get started",   body: "Click here to create your account.", placement: "bottom" },
  //     { target: ".pricing",     title: "Choose a plan", body: "Pick the one that fits your team.",  placement: "right"  },
  //     { title: "You're all set!", body: "Let's go 🎉",  placement: "center" },
  //   ], { onComplete: () => console.log("tour done") });
  //
  // Options:
  //   onComplete  – called when the user finishes or skips all steps
  //   onSkip      – called when the user clicks "Skip tour"
  //   storageKey  – localStorage key used to remember completion (default: "clarity_tour")
  //   forceShow   – if true, shows even if already completed

  api.tour = (function () {
    var PREFIX = "_clr_tour_";

    // ── Styles injected once ───────────────────────────────────────────────────
    var stylesInjected = false;
    function ensureStyles() {
      if (stylesInjected) return;
      stylesInjected = true;
      var css = [
        ".__clr-overlay{position:fixed;inset:0;z-index:2147483640;pointer-events:none;}",
        ".__clr-dim{background:rgba(0,0,0,0.55);position:fixed;transition:opacity .25s;pointer-events:all;}",
        ".__clr-spotlight{position:fixed;border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,0.55);pointer-events:none;transition:all .3s cubic-bezier(.4,0,.2,1);}",
        ".__clr-card{position:fixed;z-index:2147483646;background:#fff;color:#18181b;border-radius:14px;padding:22px 24px 18px;max-width:320px;min-width:240px;box-shadow:0 8px 40px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.06);font-family:system-ui,sans-serif;transition:all .3s cubic-bezier(.4,0,.2,1);}",
        "@media(prefers-color-scheme:dark){.__clr-card{background:#1c1c1e;color:#f4f4f5;box-shadow:0 8px 40px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.08);}}",
        ".__clr-card h3{margin:0 0 8px;font-size:15px;font-weight:700;line-height:1.3;}",
        ".__clr-card p{margin:0 0 18px;font-size:13px;line-height:1.6;color:#52525b;}",
        "@media(prefers-color-scheme:dark){.__clr-card p{color:#a1a1aa;}}",
        ".__clr-step-dots{display:flex;align-items:center;gap:5px;flex:1;}",
        ".__clr-dot{width:6px;height:6px;border-radius:50%;background:#d4d4d8;transition:background .2s,width .2s;}",
        ".__clr-dot.__clr-dot-active{background:#6366f1;width:18px;border-radius:99px;}",
        ".__clr-btn-row{display:flex;align-items:center;gap:8px;margin-top:6px;}",
        ".__clr-btn{border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .15s;}",
        ".__clr-btn-primary{background:#6366f1;color:#fff;}",
        ".__clr-btn-primary:hover{opacity:.88;}",
        ".__clr-btn-secondary{background:#f4f4f5;color:#3f3f46;}",
        ".__clr-btn-secondary:hover{background:#e4e4e7;}",
        "@media(prefers-color-scheme:dark){.__clr-btn-secondary{background:#27272a;color:#d4d4d8;}.__clr-btn-secondary:hover{background:#3f3f46;}}",
        ".__clr-skip{margin-left:auto;font-size:11px;color:#a1a1aa;background:none;border:none;cursor:pointer;padding:4px;}",
        ".__clr-skip:hover{color:#6366f1;}",
        ".__clr-arrow{position:absolute;width:10px;height:10px;background:inherit;transform:rotate(45deg);}",
        ".__clr-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#6366f1;margin-bottom:8px;}",
        ".__clr-badge-dot{width:6px;height:6px;border-radius:50%;background:#6366f1;}",
      ].join("");
      var st = document.createElement("style");
      st.textContent = css;
      document.head.appendChild(st);
    }

    // ── DOM helpers ────────────────────────────────────────────────────────────
    var PAD = 10; // px padding around spotlight


    var CARD_W = 320;
    var CARD_H = 160; // estimated

    function cardPosition(r, placement, vpW, vpH) {
      // placement: top | bottom | left | right | center | auto
      var cx, cy, arrowClass;

      if (!r || placement === "center") {
        return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
      }

      var GAP = 18;
      var pl = placement;

      // auto-resolve if not enough room
      if (pl === "auto" || !pl) {
        pl = r.top > vpH / 2 ? "top" : "bottom";
        if (r.left > vpW * 0.6) pl = "left";
        if (r.left < vpW * 0.25) pl = "right";
      }

      if (pl === "bottom") {
        cx = r.left + r.width / 2 - CARD_W / 2;
        cy = r.top + r.height + PAD + GAP;
      } else if (pl === "top") {
        cx = r.left + r.width / 2 - CARD_W / 2;
        cy = r.top - PAD - GAP - CARD_H;
      } else if (pl === "right") {
        cx = r.left + r.width + PAD + GAP;
        cy = r.top + r.height / 2 - CARD_H / 2;
      } else { // left
        cx = r.left - PAD - GAP - CARD_W;
        cy = r.top + r.height / 2 - CARD_H / 2;
      }

      // clamp inside viewport
      cx = Math.max(8, Math.min(cx, vpW - CARD_W - 8));
      cy = Math.max(8, Math.min(cy, vpH - CARD_H - 8));

      return { top: cy + "px", left: cx + "px" };
    }

    // ── Core tour runner ───────────────────────────────────────────────────────
    function run(steps, opts) {
      opts = opts || {};
      var storageKey = PREFIX + (opts.storageKey || "default");

      if (!opts.forceShow) {
        try { if (localStorage.getItem(storageKey) === "1") { if (opts.onComplete) opts.onComplete(); return; } } catch (_) {}
      }

      if (!steps || !steps.length) return;
      ensureStyles();

      var idx = 0;
      var overlay, spotlight, card, dimEl;

      // ── Build skeleton ───────────────────────────────────────────────────────
      overlay = el("div", "__clr-overlay");

      dimEl = el("div", "__clr-dim");
      dimEl.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483641;";
      overlay.appendChild(dimEl);

      spotlight = el("div", "__clr-spotlight");
      spotlight.style.position = "fixed";
      spotlight.style.zIndex = "2147483643";
      overlay.appendChild(spotlight);

      card = el("div", "__clr-card");
      card.style.zIndex = "2147483646";
      overlay.appendChild(card);

      document.body.appendChild(overlay);

      function getTarget(step) {
        if (!step.target) return null;
        try { return document.querySelector(step.target); } catch (_) { return null; }
      }

      function renderStep() {
        var step    = steps[idx];
        var target  = getTarget(step);
        var vpW     = window.innerWidth;
        var vpH     = window.innerHeight;

        // Scroll target into view
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }

        // Re-measure after scroll (small delay)
        setTimeout(function () {
          var r = rect(target);

          // Spotlight
          var ss = spotlightStyle(r);
          Object.assign(spotlight.style, ss);
          spotlight.style.transition = "all .3s cubic-bezier(.4,0,.2,1)";

          if (!r) {
            // No target → no spotlight, full dim
            spotlight.style.boxShadow = "none";
            dimEl.style.opacity = "1";
          } else {
            spotlight.style.boxShadow = "0 0 0 9999px rgba(0,0,0,0.55)";
            dimEl.style.opacity = "0"; // spotlight handles the dim
          }

          // Card position
          var pos = cardPosition(r, step.placement, vpW, vpH);
          Object.assign(card.style, pos);

          // Card content
          var stepNum   = idx + 1;
          var stepTotal = steps.length;
          var isLast    = idx === stepTotal - 1;
          var isFirst   = idx === 0;

          var dots = steps.map(function (_, i) {
            return '<span class="__clr-dot' + (i === idx ? " __clr-dot-active" : "") + '"></span>';
          }).join("");

          card.innerHTML =
            '<div class="__clr-badge"><span class="__clr-badge-dot"></span>Step ' + stepNum + ' of ' + stepTotal + '</div>' +
            '<h3>' + (step.title || "") + '</h3>' +
            '<p>'  + (step.body  || "") + '</p>' +
            '<div class="__clr-step-dots">' + dots + '</div>' +
            '<div class="__clr-btn-row">' +
              (!isFirst ? '<button class="__clr-btn __clr-btn-secondary" id="__clr-back">← Back</button>' : '') +
              '<button class="__clr-btn __clr-btn-primary" id="__clr-next">' + (isLast ? "Done ✓" : "Next →") + '</button>' +
              '<button class="__clr-skip" id="__clr-skip">Skip tour</button>' +
            '</div>';

          // Wire buttons
          var nextBtn = document.getElementById("__clr-next");
          var backBtn = document.getElementById("__clr-back");
          var skipBtn = document.getElementById("__clr-skip");

          if (nextBtn) nextBtn.onclick = function () {
            if (isLast) { finish(false); } else { idx++; renderStep(); }
          };
          if (backBtn) backBtn.onclick = function () { idx--; renderStep(); };
          if (skipBtn) skipBtn.onclick = function () { finish(true); };
        }, target ? 300 : 0);
      }

      function finish(skipped) {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        try { localStorage.setItem(storageKey, "1"); } catch (_) {}
        if (skipped && opts.onSkip)     opts.onSkip();
        if (!skipped && opts.onComplete) opts.onComplete();
      }

      // Escape key exits
      function onKey(e) {
        if (e.key === "Escape") { finish(true); document.removeEventListener("keydown", onKey); }
      }
      document.addEventListener("keydown", onKey);

      renderStep();
    }

    return run;
  })();

})(window, document);
