/**
 * Clarity Analytics SDK  v3.0.0
 * ─────────────────────────────
 * Self-contained IIFE. No dependencies. Drop onto any page.
 *
 * <script
 *   src="/clarity.js"
 *   data-project-id="YOUR_PROJECT_ID"
 *   data-api-key="clr_live_…"
 *   data-ingest="http://localhost:4000"
 *   data-sample-rate="1"      0–1 fraction of sessions to record
 *   data-mask-text="false"    "true" masks all text in recordings
 * ></script>
 *
 * Privacy element attributes:
 *   data-clarity-mask   replace text with ●●● in recordings
 *   data-clarity-block  replace element with grey box in recordings
 *
 * Public API:
 *   clarity.track(name, props?)       custom event
 *   clarity.identify(userId, traits?) link visitor to known user
 *   clarity.flush()                   force-send pending data
 *   clarity.optOut()                  stop all tracking (persisted)
 *   clarity.optIn()                   remove opt-out flag
 *   clarity.tour(steps, opts?)        product tour overlay
 *
 * Source: packages/sdk/src/  — build: pnpm sdk:build
 * Generated output: apps/web/public/clarity.js
 */
(function (window, document) {
  "use strict";

  // ── Guard: never double-init (HMR, duplicate snippets) ──────────────────────
  if (window.__clarityLoaded) return;
  window.__clarityLoaded = true;

  // ── Config from script attributes ────────────────────────────────────────────
  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();

  var PROJECT_ID  = script.getAttribute("data-project-id")  || "";
  var API_KEY     = script.getAttribute("data-api-key")      || "";
  var INGEST      = (script.getAttribute("data-ingest") || "http://localhost:4000").replace(/\/$/, "");
  var SAMPLE      = parseFloat(script.getAttribute("data-sample-rate") || "1");
  var MASK_TEXT   = script.getAttribute("data-mask-text") === "true";
  if (isNaN(SAMPLE) || SAMPLE < 0 || SAMPLE > 1) SAMPLE = 1;

  if (!PROJECT_ID || !API_KEY) {
    console.warn("[Clarity] Missing data-project-id or data-api-key.");
    return;
  }

  // ── Respect Do-Not-Track / Global Privacy Control ────────────────────────────
  if (navigator.doNotTrack === "1" || (window.navigator && window.navigator.globalPrivacyControl))
    return;

  // ── Opt-out key ───────────────────────────────────────────────────────────────
  var OPT_KEY = "_clr_optout";
  var optedOut = false;

  // ── Storage helpers ───────────────────────────────────────────────────────────
  function lsGet(k)   { try { return localStorage.getItem(k); }   catch (_) { return null; } }
  function lsSet(k,v) { try { localStorage.setItem(k, v); }       catch (_) {} }
  function ssGet(k)   { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
  function ssSet(k,v) { try { sessionStorage.setItem(k, v); }     catch (_) {} }

  function parse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  if (lsGet(OPT_KEY) === "1") { optedOut = true; }

  // ── Visitor ID (long-lived, localStorage) ────────────────────────────────────
  var visitorData = parse(lsGet("_clr_vid"));
  if (!visitorData || !visitorData.id) {
    visitorData = { id: uuid(), ts: Date.now() };
    lsSet("_clr_vid", JSON.stringify(visitorData));
  }
  var VISITOR_ID = visitorData.id;

  // ── Session (per-tab, 30-min inactivity TTL) ─────────────────────────────────
  var SESSION_TTL = 30 * 60 * 1000;
  var SKEY = "_clr_sid";
  var sessionData = parse(ssGet(SKEY));
  var isNewSession = !sessionData || !sessionData.id || (Date.now() - sessionData.ts > SESSION_TTL);
  if (isNewSession) {
    sessionData = { id: uuid(), ts: Date.now(), sampled: Math.random() < SAMPLE, isNew: true };
  } else {
    sessionData.isNew = false;
  }
  ssSet(SKEY, JSON.stringify({ id: sessionData.id, ts: Date.now(), sampled: sessionData.sampled }));

  var RECORD = !optedOut && sessionData.sampled;
  var lastTouch = 0;

  function touch() {
    var n = Date.now();
    if (n - lastTouch < 10000) return;
    lastTouch = n;
    ssSet(SKEY, JSON.stringify({ id: sessionData.id, ts: n, sampled: sessionData.sampled }));
  }

  // ── UUID ──────────────────────────────────────────────────────────────────────
  function uuid() {
    try {
      var c = window.crypto;
      if (c && c.randomUUID) return c.randomUUID();
      var b = new Uint8Array(16);
      c.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      var h = [], i;
      for (i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
      return h[0]+h[1]+h[2]+h[3]+"-"+h[4]+h[5]+"-"+h[6]+h[7]+"-"+h[8]+h[9]+"-"+h[10]+h[11]+h[12]+h[13]+h[14]+h[15];
    } catch (_) {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      });
    }
  }

  // ── String helpers ────────────────────────────────────────────────────────────
  function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + "…" : s; }

  function describe(el) {
    if (!el || !el.tagName) return "unknown";
    var tag = el.tagName.toLowerCase();
    var id  = el.id ? "#" + el.id : "";
    var cls = el.getAttribute && el.getAttribute("class");
    cls = cls ? "." + cls.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return (tag + id + cls).slice(0, 120);
  }

  // ── Network ───────────────────────────────────────────────────────────────────
  var MAX_BODY = 60000;

  function post(path, body) {
    if (optedOut) return null;
    try {
      return fetch(INGEST + path, {
        method:      "POST",
        headers:     { "Content-Type": "application/json", "X-API-Key": API_KEY },
        body:        JSON.stringify(body),
        keepalive:   true,
        credentials: "omit",
      });
    } catch (_) { return null; }
  }

  // ── Breadcrumb ring-buffer ────────────────────────────────────────────────────
  var MAX_BREADCRUMBS = 30;
  var breadcrumbs = [];

  function addBreadcrumb(type, message, data) {
    breadcrumbs.push({ type: type, message: clip(message, 200), data: data, ts: Date.now() });
    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
  }

  // Wrap console methods to capture as breadcrumbs
  ["log", "warn", "error", "info"].forEach(function (m) {
    if (typeof console[m] !== "function") return;
    var orig = console[m];
    console[m] = function () {
      try {
        var parts = [], i;
        for (i = 0; i < arguments.length && i < 5; i++) {
          var a = arguments[i];
          parts.push(a && typeof a === "object" ? "[object]" : String(a));
        }
        addBreadcrumb("console." + m, parts.join(" "));
      } catch (_) {}
      return orig.apply(console, arguments);
    };
  });

  // ── DOM Snapshot (privacy-aware, size-capped) ─────────────────────────────────
  var MAX_NODES = 1500;
  var MAX_DEPTH = 12;

  function snapshotNode(node, depth, mask, ctx) {
    if (!node || depth > MAX_DEPTH || ctx.count > MAX_NODES) return null;

    if (node.nodeType === 3) {
      var t = (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
      if (!t) return null;
      ctx.count++;
      return { t: "text", v: mask ? t.replace(/\S/g, "●") : t };
    }
    if (node.nodeType !== 1) return null;

    var tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "noscript" || tag === "template" || tag === "style") return null;
    ctx.count++;

    if (node.hasAttribute("data-clarity-block")) {
      var r = node.getBoundingClientRect();
      return { t: "div", a: { style: "width:" + Math.round(r.width) + "px;height:" + Math.round(r.height) + "px;background:#ccc" }, c: [] };
    }

    var attrs = {}, i, a, n;
    for (i = 0; i < node.attributes.length; i++) {
      a = node.attributes[i]; n = a.name;
      if (n === "value" || n.indexOf("on") === 0) continue;
      attrs[n] = (n === "src" || n === "href")
        ? (a.value.indexOf("data:") === 0 ? "[data-url]" : a.value.slice(0, 120))
        : a.value.slice(0, 200);
    }

    var childMask = mask || node.hasAttribute("data-clarity-mask");
    var children = [];
    if (tag !== "svg" && tag !== "textarea") {
      for (i = 0; i < node.childNodes.length; i++) {
        var child = snapshotNode(node.childNodes[i], depth + 1, childMask, ctx);
        if (child) children.push(child);
      }
    }
    return { t: tag, a: attrs, c: children };
  }

  function captureSnapshot() {
    try {
      return {
        url: location.href,
        w:   window.innerWidth,
        h:   window.innerHeight,
        dom: snapshotNode(document.documentElement, 0, MASK_TEXT, { count: 0 }),
      };
    } catch (_) { return null; }
  }

  // ── Recording frames ───────────────────────────────────────────────────────────
  var FRAME = { SNAPSHOT:"snapshot", MOUSE:"mouse", CLICK:"click", SCROLL:"scroll",
                INPUT:"input", RESIZE:"resize", NAV:"nav", CUSTOM:"custom" };

  var PAGE_START  = Date.now();
  var MAX_FRAMES  = 2000;
  var FLUSH_EVERY = 5000;
  var frames      = [];
  var flushTimer  = null;

  function pushFrame(type, data) {
    if (!RECORD) return;
    frames.push({ type: type, ts: Date.now() - PAGE_START, d: data });
    if (frames.length > MAX_FRAMES) frames.shift();
    if (frames.length >= 200) { flushFrames(false); return; }
    if (!flushTimer) flushTimer = setTimeout(function () { flushTimer = null; flushFrames(false); }, FLUSH_EVERY);
  }

  function sendFrames(batch, isFinal) {
    if (!batch.length) return;
    var payload = {
      project_id:  PROJECT_ID,
      visitor_id:  VISITOR_ID,
      frames:      batch,
      duration:    Date.now() - PAGE_START,
      is_final:    !!isFinal,
    };
    if (JSON.stringify(payload).length > MAX_BODY && batch.length > 1) {
      var mid = batch.length >> 1;
      sendFrames(batch.slice(0, mid), false);
      sendFrames(batch.slice(mid), isFinal);
      return;
    }
    var p = post("/session/frames", payload);
    if (!isFinal && p && p.then) {
      p.then(function (res) { if (res && !res.ok && res.status >= 500) requeue(batch); })
       .catch(function () { requeue(batch); });
    }
  }

  function requeue(batch) {
    frames = batch.concat(frames).slice(-MAX_FRAMES);
  }

  function flushFrames(isFinal) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!frames.length && !isFinal) return;
    sendFrames(frames.splice(0, frames.length), isFinal);
  }

  // ── Visible-time tracking ─────────────────────────────────────────────────────
  var visibleSince = document.visibilityState === "hidden" ? null : Date.now();
  var visibleAccum = 0;

  function visibleTime() { return visibleAccum + (visibleSince ? Date.now() - visibleSince : 0); }
  function resetVisibleTime() {
    visibleAccum = 0;
    visibleSince = document.visibilityState === "hidden" ? null : Date.now();
  }

  // ── Scroll depth ──────────────────────────────────────────────────────────────
  var maxScrollPct  = 0;
  var lastScrollFrame = 0;

  function sampleScroll(emitFrame) {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var h = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement.scrollHeight, 1);
    var pct = Math.min(100, Math.round(((y + window.innerHeight) / h) * 100));
    if (pct > maxScrollPct) maxScrollPct = pct;
    if (emitFrame && Date.now() - lastScrollFrame >= 100) {
      lastScrollFrame = Date.now();
      pushFrame(FRAME.SCROLL, { x: window.pageXOffset || 0, y: y });
    }
  }

  var scrollQueued = false;
  document.addEventListener("scroll", function () {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      sampleScroll(true);
      touch();
    });
  }, { passive: true });

  // ── Mouse tracking (throttled 50 ms) ─────────────────────────────────────────
  var lastMouse = 0;
  document.addEventListener("mousemove", function (e) {
    var t = Date.now();
    if (t - lastMouse < 50) return;
    lastMouse = t;
    pushFrame(FRAME.MOUSE, { x: e.clientX, y: e.clientY });
  }, { passive: true });

  // ── Resize (debounced 150 ms) ─────────────────────────────────────────────────
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      pushFrame(FRAME.RESIZE, { w: window.innerWidth, h: window.innerHeight });
    }, 150);
  }, { passive: true });

  // ── Input (record length only, never value — except search/email) ─────────────
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (!el || el.type === "password") return;
    pushFrame(FRAME.INPUT, { target: describe(el), len: (el.value || "").length });
  }, true);

  // ── Clicks: breadcrumb + replay frame + rage-click + dead-click ───────────────
  var RAGE_WINDOW_MS  = 600;
  var RAGE_MIN_COUNT  = 3;
  var RAGE_RADIUS_PX  = 30;
  var clickHistory    = [];

  var INTERACTIVE_SEL =
    "a[href],button,input,select,textarea,label,summary," +
    "[role=button],[role=link],[role=tab],[role=menuitem]," +
    "[role=checkbox],[role=switch],[onclick],[data-action],[tabindex]";

  function isInteractive(el) {
    try {
      if (el.closest && el.closest(INTERACTIVE_SEL)) return true;
      return window.getComputedStyle(el).cursor === "pointer";
    } catch (_) { return true; }
  }

  document.addEventListener("click", function (e) {
    var el = e.target;
    if (!el || el.nodeType !== 1) return;
    var t = Date.now();
    var d = describe(el);
    touch();
    addBreadcrumb("click", d);
    pushFrame(FRAME.CLICK, { x: e.clientX, y: e.clientY, target: d });

    // Rage-click detection
    clickHistory.push({ x: e.clientX, y: e.clientY, ts: t });
    clickHistory = clickHistory.filter(function (c) { return t - c.ts <= RAGE_WINDOW_MS; });
    var near = clickHistory.filter(function (c) {
      return Math.abs(c.x - e.clientX) <= RAGE_RADIUS_PX &&
             Math.abs(c.y - e.clientY) <= RAGE_RADIUS_PX;
    });
    if (near.length >= RAGE_MIN_COUNT) {
      if (near.length === RAGE_MIN_COUNT) {
        post("/track/event", {
          project_id: PROJECT_ID, type: "rage_click", name: "rage_click",
          properties: { selector: d, count: near.length },
          url: location.href, x: e.clientX, y: e.clientY,
          selector: d, visitor_id: VISITOR_ID,
        });
      }
      return;
    }

    // Dead-click detection (MutationObserver approach — far fewer false positives)
    if (!isInteractive(el)) {
      var urlBefore = location.href;
      var changed = false;
      var mo = null;
      try {
        mo = new MutationObserver(function () { changed = true; });
        mo.observe(document.documentElement, { childList: true, attributes: true, subtree: true, characterData: true });
      } catch (_) {}
      setTimeout(function () {
        if (mo) mo.disconnect();
        var sel = window.getSelection && window.getSelection();
        var selecting = sel && String(sel).length > 0;
        if (!changed && !selecting && location.href === urlBefore) {
          post("/track/event", {
            project_id: PROJECT_ID, type: "dead_click", name: "dead_click",
            properties: { selector: d }, url: location.href,
            x: e.clientX, y: e.clientY, selector: d, visitor_id: VISITOR_ID,
          });
        }
      }, 300);
    }
  }, true);

  // ── Page view tracking ────────────────────────────────────────────────────────
  var pageviewId       = uuid();
  var pageviewUrl      = "";
  var lastSentDuration = -1;
  var lastSentScroll   = -1;

  function trackPageView(url, referrer) {
    pageviewId       = uuid();
    pageviewUrl      = url;
    lastSentDuration = lastSentScroll = -1;
    maxScrollPct     = 0;
    resetVisibleTime();
    sampleScroll(false);

    post("/track/pageview", {
      project_id:  PROJECT_ID,
      pageview_id: pageviewId,
      url:         url,
      referrer:    referrer || document.referrer || null,
      title:       clip(document.title || "", 200),
      visitor_id:  VISITOR_ID,
    });
  }

  // Idempotent finalization: only sends if duration or scroll changed.
  function finalizePageView() {
    if (!pageviewUrl) return;
    sampleScroll(false);
    var dur = visibleTime();
    if (dur === lastSentDuration && maxScrollPct === lastSentScroll) return;
    lastSentDuration = dur;
    lastSentScroll   = maxScrollPct;
    post("/track/pageview", {
      project_id:  PROJECT_ID,
      pageview_id: pageviewId,
      url:         pageviewUrl,
      referrer:    null,
      visitor_id:  VISITOR_ID,
      duration:    dur,
      max_scroll_y: maxScrollPct,
      _update:     true,
    });
  }

  // ── SPA navigation detection ──────────────────────────────────────────────────
  (function () {
    var origPush    = history.pushState;
    var origReplace = history.replaceState;
    var currentUrl  = location.href;

    function onNav() {
      var next = location.href;
      if (next === currentUrl) return;
      finalizePageView();
      flushFrames(false);
      var prev = currentUrl;
      currentUrl = next;
      pushFrame(FRAME.NAV, { url: next });
      trackPageView(next, prev);
      setTimeout(takeSnapshot, 500);
    }

    history.pushState    = function () { var r = origPush.apply(this, arguments);    onNav(); return r; };
    history.replaceState = function () { var r = origReplace.apply(this, arguments); onNav(); return r; };
    window.addEventListener("popstate", onNav);
  })();

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      if (visibleSince) { visibleAccum += Date.now() - visibleSince; visibleSince = null; }
      finalizePageView();
      flushFrames(false);
    } else {
      visibleSince = Date.now();
      touch();
    }
  });

  // pagehide covers bfcache + mobile background kill; use is_final so ingest knows
  window.addEventListener("pagehide", function () {
    finalizePageView();
    flushFrames(true);
  });

  // ── Error tracking ────────────────────────────────────────────────────────────
  var MAX_ERRORS_PER_PAGE = 20;
  var errorCount = 0;
  var seenErrors = {};

  function sendError(message, stack, type, url, line, col) {
    message = clip(message || "Unknown error", 500);
    if (/ResizeObserver loop/.test(message)) return;
    var key = message + "|" + (line || "") + "|" + (col || "");
    if (seenErrors[key] || errorCount >= MAX_ERRORS_PER_PAGE) return;
    seenErrors[key] = true;
    errorCount++;
    flushFrames(false);
    post("/track/error", {
      project_id:  PROJECT_ID,
      message:     message,
      stack:       stack ? clip(stack, 4000) : null,
      type:        type || "error",
      url:         url || location.href,
      line:        line || null,
      col:         col || null,
      visitor_id:  VISITOR_ID,
      user_agent:  navigator.userAgent,
      breadcrumbs: breadcrumbs.slice(),
    });
  }

  window.addEventListener("error", function (e) {
    if (!e.message) return;
    addBreadcrumb("error", e.message);
    sendError(e.message, e.error && e.error.stack, "error", e.filename, e.lineno, e.colno);
  });

  window.addEventListener("unhandledrejection", function (e) {
    var r   = e.reason;
    var msg = r ? (r.message || String(r)) : "Unhandled Promise rejection";
    addBreadcrumb("unhandledrejection", msg);
    sendError(msg, r && r.stack, "unhandledrejection");
  });

  // ── Session recording start ───────────────────────────────────────────────────
  function idle(fn, timeout) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: timeout || 2000 });
    else setTimeout(fn, 200);
  }

  function takeSnapshot() {
    if (!RECORD) return;
    idle(function () {
      var snap = captureSnapshot();
      if (snap) pushFrame(FRAME.SNAPSHOT, snap);
    });
  }

  function start() {
    trackPageView(location.href);
    if (sessionData.isNew) {
      post("/session/start", {
        project_id:  PROJECT_ID,
        visitor_id:  VISITOR_ID,
        start_url:   location.href,
        user_agent:  navigator.userAgent,
        viewport_w:  window.innerWidth,
        viewport_h:  window.innerHeight,
        sampled:     RECORD,
      });
    }
    if (document.readyState === "complete") takeSnapshot();
    else window.addEventListener("load", function () { setTimeout(takeSnapshot, 300); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // ── Public API ────────────────────────────────────────────────────────────────
  var api = (window.clarity = window.clarity || {});

  api.track = function (name, properties) {
    pushFrame(FRAME.CUSTOM, { name: name, props: properties || {} });
    post("/track/event", {
      project_id:  PROJECT_ID,
      type:        "custom",
      name:        name,
      properties:  properties || {},
      url:         location.href,
      visitor_id:  VISITOR_ID,
    });
  };

  api.identify = function (userId, traits) {
    post("/track/identify", {
      project_id:  PROJECT_ID,
      user_id:     userId,
      visitor_id:  VISITOR_ID,
      traits:      traits || {},
    });
  };

  api.flush = function () { finalizePageView(); flushFrames(false); };

  api.optOut = function () {
    lsSet(OPT_KEY, "1");
    optedOut = true;
    RECORD   = false;
    frames   = [];
  };

  api.optIn = function () {
    try { localStorage.removeItem(OPT_KEY); } catch (_) {}
    optedOut = false;
  };

  // ── Tour engine ───────────────────────────────────────────────────────────────
  api.tour = (function () {
    var PREFIX = "_clr_tour_";
    var stylesInjected = false;

    function ensureStyles() {
      if (stylesInjected) return;
      stylesInjected = true;
      var css = [
        ".__clr-ov{position:fixed;inset:0;z-index:2147483640;}",
        ".__clr-dim{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483641;transition:opacity .25s;}",
        ".__clr-sp{position:fixed;border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,.55);pointer-events:none;z-index:2147483643;transition:all .3s cubic-bezier(.4,0,.2,1);}",
        ".__clr-card{position:fixed;z-index:2147483646;background:#fff;color:#18181b;border-radius:14px;padding:22px 24px 18px;max-width:320px;min-width:240px;box-shadow:0 8px 40px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.06);font-family:system-ui,sans-serif;transition:all .3s cubic-bezier(.4,0,.2,1);}",
        "@media(prefers-color-scheme:dark){.__clr-card{background:#1c1c1e;color:#f4f4f5;box-shadow:0 8px 40px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.08);}}",
        ".__clr-card h3{margin:0 0 8px;font-size:15px;font-weight:700;line-height:1.3;}",
        ".__clr-card p{margin:0 0 16px;font-size:13px;line-height:1.6;color:#52525b;}",
        "@media(prefers-color-scheme:dark){.__clr-card p{color:#a1a1aa;}}",
        ".__clr-dots{display:flex;align-items:center;gap:5px;flex:1;}",
        ".__clr-dot{width:6px;height:6px;border-radius:50%;background:#d4d4d8;transition:background .2s,width .2s;}",
        ".__clr-dot.__clr-da{background:#6366f1;width:18px;border-radius:99px;}",
        ".__clr-btns{display:flex;align-items:center;gap:8px;margin-top:14px;}",
        ".__clr-btn{border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .15s;}",
        ".__clr-p{background:#6366f1;color:#fff;}.__clr-p:hover{opacity:.88;}",
        ".__clr-s{background:#f4f4f5;color:#3f3f46;}.__clr-s:hover{background:#e4e4e7;}",
        "@media(prefers-color-scheme:dark){.__clr-s{background:#27272a;color:#d4d4d8;}.__clr-s:hover{background:#3f3f46;}}",
        ".__clr-skip{margin-left:auto;font-size:11px;color:#a1a1aa;background:none;border:none;cursor:pointer;padding:4px;}.__clr-skip:hover{color:#6366f1;}",
        ".__clr-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#6366f1;margin-bottom:8px;}",
        ".__clr-bdot{width:6px;height:6px;border-radius:50%;background:#6366f1;}",
      ].join("");
      var st = document.createElement("style");
      st.textContent = css;
      document.head.appendChild(st);
    }

    function el(tag, cls) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      return e;
    }

    var PAD = 10, CARD_W = 320, CARD_H = 180;

    function spotStyle(r) {
      if (!r) return "top:50%;left:50%;width:0;height:0;opacity:0";
      return "top:"+(r.top-PAD)+"px;left:"+(r.left-PAD)+"px;width:"+(r.width+PAD*2)+"px;height:"+(r.height+PAD*2)+"px";
    }

    function cardPos(r, pl, vpW, vpH) {
      if (!r || pl === "center") return { top:"50%", left:"50%", transform:"translate(-50%,-50%)" };
      var GAP = 18, cx, cy;
      if (!pl || pl === "auto") {
        pl = r.top > vpH / 2 ? "top" : "bottom";
        if (r.left > vpW * 0.6) pl = "left";
        if (r.left < vpW * 0.25) pl = "right";
      }
      if (pl === "bottom") { cx = r.left + r.width/2 - CARD_W/2; cy = r.top + r.height + PAD + GAP; }
      else if (pl === "top") { cx = r.left + r.width/2 - CARD_W/2; cy = r.top - PAD - GAP - CARD_H; }
      else if (pl === "right") { cx = r.left + r.width + PAD + GAP; cy = r.top + r.height/2 - CARD_H/2; }
      else { cx = r.left - PAD - GAP - CARD_W; cy = r.top + r.height/2 - CARD_H/2; }
      cx = Math.max(8, Math.min(cx, vpW - CARD_W - 8));
      cy = Math.max(8, Math.min(cy, vpH - CARD_H - 8));
      return { top: cy+"px", left: cx+"px" };
    }

    return function run(steps, opts) {
      opts = opts || {};
      var key = PREFIX + (opts.storageKey || "default");
      if (!opts.forceShow) {
        try { if (localStorage.getItem(key) === "1") { opts.onComplete && opts.onComplete(); return; } } catch (_) {}
      }
      if (!steps || !steps.length) return;
      ensureStyles();

      var idx = 0;
      var ov  = el("div", "__clr-ov");
      var dim = el("div", "__clr-dim");
      var sp  = el("div", "__clr-sp");
      var card = el("div", "__clr-card");
      ov.appendChild(dim); ov.appendChild(sp); ov.appendChild(card);
      document.body.appendChild(ov);

      function getTarget(step) {
        if (!step.target) return null;
        try { return document.querySelector(step.target); } catch (_) { return null; }
      }

      function render() {
        var step   = steps[idx];
        var target = getTarget(step);
        var vpW    = window.innerWidth, vpH = window.innerHeight;
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(function () {
          var r = target ? (function () { var b = target.getBoundingClientRect(); return { top:b.top, left:b.left, width:b.width, height:b.height }; })() : null;
          sp.setAttribute("style", spotStyle(r));
          if (r) { sp.style.boxShadow = "0 0 0 9999px rgba(0,0,0,.55)"; dim.style.opacity = "0"; }
          else   { sp.style.boxShadow = "none"; dim.style.opacity = "1"; }
          var pos = cardPos(r, step.placement, vpW, vpH);
          Object.keys(pos).forEach(function (k) { card.style[k] = pos[k]; });
          var n = idx + 1, tot = steps.length, last = idx === tot - 1, first = idx === 0;
          var dots = steps.map(function (_,i) { return '<span class="__clr-dot'+(i===idx?' __clr-da':'')+'"></span>'; }).join("");
          card.innerHTML =
            '<div class="__clr-badge"><span class="__clr-bdot"></span>Step '+n+' of '+tot+'</div>'+
            '<h3>'+(step.title||"")+'</h3>'+
            '<p>'+(step.body||"")+'</p>'+
            '<div class="__clr-dots">'+dots+'</div>'+
            '<div class="__clr-btns">'+
              (!first?'<button class="__clr-btn __clr-s" id="__cb">← Back</button>':'')+
              '<button class="__clr-btn __clr-p" id="__cn">'+(last?"Done ✓":"Next →")+'</button>'+
              '<button class="__clr-skip" id="__cs">Skip</button>'+
            '</div>';
          var nb = document.getElementById("__cn");
          var bb = document.getElementById("__cb");
          var sb = document.getElementById("__cs");
          if (nb) nb.onclick = function () { last ? done(false) : (idx++, render()); };
          if (bb) bb.onclick = function () { idx--; render(); };
          if (sb) sb.onclick = function () { done(true); };
        }, target ? 300 : 0);
      }

      function done(skipped) {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        try { localStorage.setItem(key, "1"); } catch (_) {}
        if (skipped && opts.onSkip)     opts.onSkip();
        if (!skipped && opts.onComplete) opts.onComplete();
      }

      function onKey(e) {
        if (e.key === "Escape") { done(true); document.removeEventListener("keydown", onKey); }
      }
      document.addEventListener("keydown", onKey);
      render();
    };
  })();

})(window, document);
