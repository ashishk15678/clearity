/**
 * Clarity Analytics SDK
 * Drop this script on any page to capture:
 *   - Page views (URL, referrer, time-on-page)
 *   - Custom events
 *   - Session recordings (lightweight DOM snapshot + interaction stream)
 *   - Errors (with stack traces, breadcrumbs, and the session recording attached)
 *
 * Usage:
 *   <script
 *     src="https://your-app.com/clarity.js"
 *     data-project-id="YOUR_PROJECT_ID"
 *     data-api-key="clr_live_…"
 *     data-ingest="http://localhost:4000"
 *   ></script>
 */
(function (window, document) {
  "use strict";

  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  var PROJECT_ID = script.getAttribute("data-project-id") || "";
  var API_KEY = script.getAttribute("data-api-key") || "";
  var INGEST = (
    script.getAttribute("data-ingest") || "http://localhost:4000"
  ).replace(/\/$/, "");

  if (!PROJECT_ID || !API_KEY) {
    console.warn("[Clarity] Missing data-project-id or data-api-key.");
    return;
  }

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      },
    );
  }

  var VISITOR_KEY = "_clr_vid";
  var SESSION_KEY = "_clr_sid";

  function getOrCreate(key, ttlMs) {
    try {
      var raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (!ttlMs || Date.now() - parsed.ts < ttlMs) return parsed.id;
      }
    } catch (_) {}
    var id = uuid();
    var val = JSON.stringify({ id: id, ts: Date.now() });
    try {
      localStorage.setItem(key, val);
    } catch (_) {}
    try {
      sessionStorage.setItem(key, val);
    } catch (_) {}
    return id;
  }

  var VISITOR_ID = getOrCreate(VISITOR_KEY, null);
  var SESSION_ID = getOrCreate(SESSION_KEY, 30 * 60 * 1000); // 30 min TTL

  function post(path, body) {
    try {
      var blob =
        typeof Blob !== "undefined"
          ? new Blob([JSON.stringify(body)], { type: "application/json" })
          : null;
      if (navigator.sendBeacon && blob) {
        // sendBeacon doesn't support custom headers — fall back to fetch for
        // beacon calls so we can attach the API key.
      }
      if (typeof fetch !== "undefined") {
        fetch(INGEST + path, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(function () {});
      }
    } catch (_) {}
  }

  // ── Breadcrumb ring-buffer ─────────────────────────────────────────────────
  var MAX_BREADCRUMBS = 30;
  var breadcrumbs = [];

  function addBreadcrumb(type, message, data) {
    breadcrumbs.push({
      type: type,
      message: message,
      data: data,
      ts: Date.now(),
    });
    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
  }

  // Capture console.log / warn / error as breadcrumbs
  ["log", "warn", "error", "info"].forEach(function (method) {
    var orig = console[method].bind(console);
    console[method] = function () {
      var args = Array.prototype.slice.call(arguments);
      addBreadcrumb(
        "console." + method,
        args
          .map(function (a) {
            try {
              return typeof a === "object" ? JSON.stringify(a) : String(a);
            } catch (_) {
              return String(a);
            }
          })
          .join(" "),
      );
      orig.apply(console, arguments);
    };
  });

  // Capture clicks as breadcrumbs
  document.addEventListener(
    "click",
    function (e) {
      var el = e.target;
      var tag = el.tagName ? el.tagName.toLowerCase() : "unknown";
      var text = (el.textContent || "").trim().slice(0, 60);
      var id = el.id ? "#" + el.id : "";
      var cls =
        el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      addBreadcrumb("click", tag + id + cls, { text: text });
    },
    true,
  );

  // ── DOM Snapshot helper ────────────────────────────────────────────────────
  /**
   * Produces a *lightweight* structural snapshot of the current page.
   * Not full rrweb — just enough for replay: tag, attrs, textContent (truncated), children.
   * Capped at depth 8 and skips script/style/svg internals.
   */
  function snapshotNode(node, depth) {
    if (depth === undefined) depth = 0;
    if (!node || depth > 8) return null;

    if (node.nodeType === 3 /* TEXT_NODE */) {
      var t = (node.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      return t ? { t: "text", v: t } : null;
    }

    if (node.nodeType !== 1 /* ELEMENT_NODE */) return null;

    var tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "noscript") return null;

    var attrs = {};
    for (var i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i];
      // Skip src/href for privacy — just record presence
      if (a.name === "src" || a.name === "href") {
        attrs[a.name] = a.value.startsWith("data:")
          ? "[data-url]"
          : a.value.slice(0, 120);
      } else if (a.name === "style") {
        attrs["style"] = a.value.slice(0, 200);
      } else {
        attrs[a.name] = a.value.slice(0, 200);
      }
    }

    var children = [];
    if (tag !== "svg") {
      for (var j = 0; j < node.childNodes.length; j++) {
        var child = snapshotNode(node.childNodes[j], depth + 1);
        if (child) children.push(child);
      }
    }

    return { t: tag, a: attrs, c: children };
  }

  function captureSnapshot() {
    try {
      return snapshotNode(document.documentElement);
    } catch (_) {
      return null;
    }
  }

  // ── Recording frames ───────────────────────────────────────────────────────
  var recordingId = null;
  var frames = [];
  var PAGE_START = Date.now();

  var FRAME_TYPES = {
    SNAPSHOT: "snapshot", // full DOM snapshot
    MOUSE: "mouse", // mousemove
    CLICK: "click", // click with target descriptor
    SCROLL: "scroll", // scrollX/Y
    INPUT: "input", // input value change (value masked by default)
    RESIZE: "resize", // viewport size change
    NAV: "nav", // URL change (SPA)
    CUSTOM: "custom", // custom event
  };

  function pushFrame(type, data) {
    frames.push({ type: type, ts: Date.now() - PAGE_START, d: data });
  }

  // Mouse tracking — throttled to 1 per 50ms
  var lastMouseTs = 0;
  document.addEventListener(
    "mousemove",
    function (e) {
      var now = Date.now();
      if (now - lastMouseTs < 50) return;
      lastMouseTs = now;
      pushFrame(FRAME_TYPES.MOUSE, { x: e.clientX, y: e.clientY });
    },
    { passive: true },
  );

  document.addEventListener(
    "click",
    function (e) {
      var el = e.target;
      pushFrame(FRAME_TYPES.CLICK, {
        x: e.clientX,
        y: e.clientY,
        target: targetDescriptor(el),
      });
    },
    true,
  );

  var lastScrollTs = 0;
  document.addEventListener(
    "scroll",
    function () {
      var now = Date.now();
      if (now - lastScrollTs < 100) return;
      lastScrollTs = now;
      pushFrame(FRAME_TYPES.SCROLL, { x: window.scrollX, y: window.scrollY });
    },
    { passive: true },
  );

  window.addEventListener("resize", function () {
    pushFrame(FRAME_TYPES.RESIZE, {
      w: window.innerWidth,
      h: window.innerHeight,
    });
  });

  document.addEventListener(
    "input",
    function (e) {
      var el = e.target;
      // Never record password fields
      if (el.type === "password") return;
      pushFrame(FRAME_TYPES.INPUT, {
        target: targetDescriptor(el),
        value:
          el.type === "email" || el.type === "search" ? el.value : "[masked]",
      });
    },
    true,
  );

  function targetDescriptor(el) {
    if (!el || !el.tagName) return "unknown";
    var tag = el.tagName.toLowerCase();
    var id = el.id ? "#" + el.id : "";
    var cls =
      el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
        : "";
    return tag + id + cls;
  }

  // ── Start recording ────────────────────────────────────────────────────────
  function startRecording() {
    var snapshot = captureSnapshot();
    pushFrame(FRAME_TYPES.SNAPSHOT, snapshot);

    post("/session/start", {
      project_id: PROJECT_ID,
      visitor_id: VISITOR_ID,
      start_url: window.location.href,
      user_agent: navigator.userAgent,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
    });
  }

  // ── Flush frames to server ─────────────────────────────────────────────────
  function flushFrames(isFinal) {
    if (frames.length === 0 && !isFinal) return;
    var toSend = frames.splice(0, frames.length);
    post("/session/frames", {
      project_id: PROJECT_ID,
      visitor_id: VISITOR_ID,
      frames: toSend,
      duration: Date.now() - PAGE_START,
      is_final: !!isFinal,
    });
  }

  // Flush every 5 seconds and on page unload
  var flushInterval = setInterval(function () {
    flushFrames(false);
  }, 5000);

  window.addEventListener("pagehide", function () {
    flushFrames(true);
  });
  window.addEventListener("beforeunload", function () {
    flushFrames(true);
  });

  // ── Page view tracking ─────────────────────────────────────────────────────
  var pageViewStart = Date.now();

  function trackPageView(url, referrer) {
    post("/track/pageview", {
      project_id: PROJECT_ID,
      url: url,
      referrer: referrer || document.referrer || null,
      visitor_id: VISITOR_ID,
    });
  }

  // Track initial page view
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      trackPageView(window.location.href);
      startRecording();
    });
  } else {
    trackPageView(window.location.href);
    startRecording();
  }

  // SPA navigation detection (History API)
  (function () {
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    function onNav() {
      flushFrames(false);
      pushFrame(FRAME_TYPES.NAV, { url: window.location.href });
      trackPageView(window.location.href);
    }
    history.pushState = function () {
      origPush.apply(history, arguments);
      onNav();
    };
    history.replaceState = function () {
      origReplace.apply(history, arguments);
      onNav();
    };
    window.addEventListener("popstate", onNav);
  })();

  // ── Error tracking ─────────────────────────────────────────────────────────
  function sendError(message, stack, type, url, line, col) {
    // Flush current frames so the recording is up-to-date
    flushFrames(false);

    post("/track/error", {
      project_id: PROJECT_ID,
      message: message,
      stack: stack || null,
      type: type || "error",
      url: url || window.location.href,
      line: line || null,
      col: col || null,
      visitor_id: VISITOR_ID,
      user_agent: navigator.userAgent,
      breadcrumbs: breadcrumbs.slice(),
    });
  }

  window.addEventListener("error", function (e) {
    var stack = e.error && e.error.stack ? e.error.stack : null;
    addBreadcrumb("error", e.message);
    sendError(e.message, stack, "error", e.filename, e.lineno, e.colno);
  });

  window.addEventListener("unhandledrejection", function (e) {
    var msg = e.reason
      ? e.reason.message || String(e.reason)
      : "Unhandled Promise rejection";
    var stack = e.reason && e.reason.stack ? e.reason.stack : null;
    addBreadcrumb("unhandledrejection", msg);
    sendError(msg, stack, "unhandledrejection");
  });

  // ── Custom event API ───────────────────────────────────────────────────────
  window.clarity = window.clarity || {};

  /**
   * Track a custom event.
   * clarity.track("purchase", { amount: 99, currency: "USD" })
   */
  window.clarity.track = function (name, properties) {
    pushFrame(FRAME_TYPES.CUSTOM, { name: name, props: properties || {} });
    post("/track/event", {
      project_id: PROJECT_ID,
      type: "custom",
      name: name,
      properties: properties || {},
      url: window.location.href,
      visitor_id: VISITOR_ID,
    });
  };

  /**
   * Identify the current visitor.
   * clarity.identify("user_123", { email: "user@example.com" })
   */
  window.clarity.identify = function (userId, traits) {
    post("/track/identify", {
      project_id: PROJECT_ID,
      user_id: userId,
      visitor_id: VISITOR_ID,
      session_id: SESSION_ID,
      traits: traits || {},
    });
  };
})(window, document);
