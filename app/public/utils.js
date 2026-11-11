function lsGet(k) {
  try {
    return localStorage.getItem(k);
  } catch (_) {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (_) { }
}
function ssGet(k) {
  try {
    return sessionStorage.getItem(k);
  } catch (_) {
    return null;
  }
}
function ssSet(k, v) {
  try {
    sessionStorage.setItem(k, v);
  } catch (_) { }
}
function parse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}


function uuid() {
  try {
    var c = window.crypto;
    if (c && c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    var h = [];
    for (var i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
    return (
      h.slice(0, 4).join("") +
      "-" +
      h.slice(4, 6).join("") +
      "-" +
      h.slice(6, 8).join("") +
      "-" +
      h.slice(8, 10).join("") +
      "-" +
      h.slice(10).join("")
    );
  } catch (_) {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (ch) {
        var r = (Math.random() * 16) | 0;
        return (ch === "x" ? r : (r & 3) | 8).toString(16);
      },
    );
  }
}

function touch() {
  var n = Date.now();
  if (n - lastTouch < 10000) return;
  lastTouch = n;
  ssSet(
    SKEY,
    JSON.stringify({ id: session.id, ts: n, sampled: session.sampled }),
  );
}


function post(path, body) {
  if (optedOut) return null;
  body.session_id = session.id;
  try {
    return fetch(INGEST + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "omit",
    });
  } catch (_) {
    return null;
  }
}

function now() {
  return Date.now();
}

function describe(el) {
  if (!el || !el.tagName) return "unknown";
  var tag = el.tagName.toLowerCase();
  var id = el.id ? "#" + el.id : "";
  var cls = el.getAttribute && el.getAttribute("class");
  cls = cls ? "." + cls.trim().split(/\s+/).slice(0, 2).join(".") : "";
  return (tag + id + cls).slice(0, 120);
}

function clip(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function addBreadcrumb(type, message, data) {
  breadcrumbs.push({
    type: type,
    message: clip(message, 200),
    data: data,
    ts: now(),
  });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

function maskStr(s) {
  return s.replace(/\S/g, "•");
}

function snapshotNode(node, depth, mask, ctx) {
  if (!node || depth > MAX_DEPTH || ctx.count > MAX_NODES) return null;

  if (node.nodeType === 3) {
    var t = (node.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    if (!t) return null;
    ctx.count++;
    return { t: "text", v: mask ? maskStr(t) : t };
  }
  if (node.nodeType !== 1) return null;

  var tag = node.tagName.toLowerCase();
  if (
    tag === "script" ||
    tag === "noscript" ||
    tag === "template" ||
    tag === "style"
  )
    return null;
  ctx.count++;

  // Blocked element -> empty placeholder with real dimensions
  if (node.hasAttribute("data-clarity-block")) {
    var r = node.getBoundingClientRect();
    return {
      t: "div",
      a: {
        style:
          "width:" +
          Math.round(r.width) +
          "px;height:" +
          Math.round(r.height) +
          "px;background:#ccc",
      },
      c: [],
    };
  }

  var attrs = {};
  for (var i = 0; i < node.attributes.length; i++) {
    var a = node.attributes[i];
    var n = a.name;
    if (n === "value" || n.indexOf("on") === 0) continue; // never ship input values or inline handlers
    if (n === "src" || n === "href") {
      attrs[n] =
        a.value.indexOf("data:") === 0 ? "[data-url]" : a.value.slice(0, 120);
    } else {
      attrs[n] = a.value.slice(0, 200);
    }
  }

  var childMask = mask || node.hasAttribute("data-clarity-mask");
  var children = [];
  if (tag !== "svg" && tag !== "textarea") {
    for (var j = 0; j < node.childNodes.length; j++) {
      var child = snapshotNode(node.childNodes[j], depth + 1, childMask, ctx);
      if (child) children.push(child);
    }
  }
  return { t: tag, a: attrs, c: children };
}

function captureSnapshot() {
  try {
    return {
      url: location.href,
      w: window.innerWidth,
      h: window.innerHeight,
      dom: snapshotNode(document.documentElement, 0, MASK_TEXT, { count: 0 }),
    };
  } catch (_) {
    return null;
  }
}

// Run heavy work when the browser is idle so it never blocks interaction
function idle(fn, timeout) {
  if (window.requestIdleCallback)
    window.requestIdleCallback(fn, { timeout: timeout || 2000 });
  else setTimeout(fn, 200);
}
function pushFrame(type, data) {
  if (!RECORD) return;
  frames.push({ type: type, ts: now() - PAGE_START, d: data });
  if (frames.length > MAX_FRAMES) frames.shift();
  if (frames.length >= 200) {
    flushFrames(false);
    return;
  }
  if (!flushTimer)
    flushTimer = setTimeout(function () {
      flushTimer = null;
      flushFrames(false);
    }, FLUSH_EVERY);
}

// Sends a batch; splits in half if it would exceed the keepalive body limit.
function sendFrames(batch, isFinal) {
  if (!batch.length) return;
  var payload = {
    project_id: PROJECT_ID,
    visitor_id: VISITOR_ID,
    pageview_id: pageviewId,
    page_start: PAGE_START,
    frames: batch,
    duration: now() - PAGE_START,
    is_final: !!isFinal,
  };
  var size = JSON.stringify(payload).length;
  if (size > MAX_BODY && batch.length > 1) {
    var mid = batch.length >> 1;
    sendFrames(batch.slice(0, mid), false);
    sendFrames(batch.slice(mid), isFinal);
    return;
  }
  var p = post("/session/frames", payload);
  if (!isFinal && p && p.then) {
    p.then(function (res) {
      if (!res.ok && res.status >= 500) requeue(batch);
    }).catch(function () {
      requeue(batch);
    });
  }
}

function requeue(batch) {
  frames = batch.concat(frames).slice(-MAX_FRAMES); // retry on next flush, never grow unbounded
}

function flushFrames(isFinal) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!frames.length && !isFinal) return;
  sendFrames(frames.splice(0, frames.length), isFinal);
}


function visibleTime() {
  return visibleAccum + (visibleSince ? now() - visibleSince : 0);
}
function resetVisibleTime() {
  visibleAccum = 0;
  visibleSince = document.visibilityState === "hidden" ? null : now();
}


function sampleScroll(emitFrame) {
  var y = window.pageYOffset || document.documentElement.scrollTop || 0;
  var h = Math.max(
    document.body ? document.body.scrollHeight : 0,
    document.documentElement.scrollHeight,
    1,
  );
  var pct = Math.min(100, Math.round(((y + window.innerHeight) / h) * 100));
  if (pct > maxScrollPct) maxScrollPct = pct;
  if (emitFrame && now() - lastScrollFrame >= 100) {
    lastScrollFrame = now();
    pushFrame(FRAME.SCROLL, { x: window.pageXOffset || 0, y: y });
  }
}

function isInteractive(el) {
  try {
    if (el.closest && el.closest(INTERACTIVE_SEL)) return true; // click on a <span> inside a <button> is NOT dead
    return window.getComputedStyle(el).cursor === "pointer"; // framework-attached handlers usually set this
  } catch (_) {
    return true;
  }
}

function watchForDeadClick(el, e, descriptor) {
  var urlBefore = location.href;
  var changed = false;
  var mo = null;
  try {
    mo = new MutationObserver(function () {
      changed = true;
    });
    mo.observe(document.documentElement, {
      childList: true,
      attributes: true,
      subtree: true,
      characterData: true,
    });
  } catch (_) { }
  setTimeout(function () {
    if (mo) mo.disconnect();
    var sel = window.getSelection && window.getSelection();
    var selecting = sel && String(sel).length > 0; // user was selecting text, not "clicking a dead element"
    if (!changed && !selecting && location.href === urlBefore) {
      post("/track/event", {
        project_id: PROJECT_ID,
        type: "dead_click",
        name: "dead_click",
        properties: { selector: descriptor },
        url: location.href,
        x: e.clientX,
        y: e.clientY,
        selector: descriptor,
        visitor_id: VISITOR_ID,
      });
    }
  }, 300);
}



function trackPageView(url, referrer) {
  pageviewId = uuid();
  pageviewUrl = url;
  lastSentDuration = lastSentScroll = -1;
  maxScrollPct = 0;
  resetVisibleTime();
  sampleScroll(false);

  post("/track/pageview", {
    project_id: PROJECT_ID,
    pageview_id: pageviewId,
    url: url,
    referrer: referrer || document.referrer || null,
    title: clip(document.title || "", 200),
    visitor_id: VISITOR_ID,
  });
}

// Idempotent: keyed by pageview_id and skipped when nothing changed,
// so hidden → pagehide → beforeunload sends ONE update, not three.
function finalizePageView() {
  if (!pageviewUrl) return;
  sampleScroll(false);
  var duration = visibleTime();
  if (duration === lastSentDuration && maxScrollPct === lastSentScroll)
    return;
  lastSentDuration = duration;
  lastSentScroll = maxScrollPct;
  post("/track/pageview", {
    project_id: PROJECT_ID,
    pageview_id: pageviewId,
    url: pageviewUrl,
    referrer: null,
    visitor_id: VISITOR_ID,
    duration: duration,
    max_scroll_y: maxScrollPct,
    _update: true,
  });
}

// ── Recording start ─────────────────────────────────────────────────────────

function takeSnapshot() {
  if (!RECORD) return;
  idle(function () {
    var snap = captureSnapshot();
    if (snap) pushFrame(FRAME.SNAPSHOT, snap);
  });
}

function start() {
  trackPageView(location.href);
  if (session.isNew) {
    post("/session/start", {
      project_id: PROJECT_ID,
      visitor_id: VISITOR_ID,
      start_url: location.href,
      user_agent: navigator.userAgent,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      sampled: RECORD,
    });
  }
  // Wait for load so JS-rendered content is actually in the snapshot
  if (document.readyState === "complete") takeSnapshot();
  else
    window.addEventListener("load", function () {
      setTimeout(takeSnapshot, 300);
    });
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", start);
else start();


  function sendError(message, stack, type, url, line, col) {
    message = clip(message || "Unknown error", 500);
    if (/ResizeObserver loop/.test(message)) return; // benign browser noise
    var key = message + "|" + line + "|" + col;
    if (seenErrors[key] || errorCount >= MAX_ERRORS_PER_PAGE) return; // a render loop must not DDoS your ingest
    seenErrors[key] = true;
    errorCount++;

    flushFrames(false);
    post("/track/error", {
      project_id: PROJECT_ID,
      message: message,
      stack: stack ? clip(stack, 4000) : null,
      type: type || "error",
      url: url || location.href,
      line: line || null,
      col: col || null,
      visitor_id: VISITOR_ID,
      user_agent: navigator.userAgent,
      breadcrumbs: breadcrumbs.slice(),
    });
  }

    function el(tag, cls, html) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html) e.innerHTML = html;
      return e;
    }

    function rect(target) {
      if (!target) return null;
      var r = target.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }

    function spotlightStyle(r) {
      if (!r) return { top: "50%", left: "50%", width: "0", height: "0", opacity: "0" };
      return {
        top:    (r.top    - PAD) + "px",
        left:   (r.left   - PAD) + "px",
        width:  (r.width  + PAD * 2) + "px",
        height: (r.height + PAD * 2) + "px",
      };
    }
