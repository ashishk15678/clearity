"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./styles.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type SpotData = Record<string, [number, number, number][]>;

// ─── Inline SVG assets ────────────────────────────────────────────────────────

/** Compass-rose logo mark */
function CompassLogo() {
  return (
    <svg
      viewBox="0 0 34 34"
      width="34"
      height="34"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <circle cx="17" cy="17" r="14" />
      <circle cx="17" cy="17" r="4" />
      <line x1="17" y1="3" x2="17" y2="7" />
      <line x1="17" y1="27" x2="17" y2="31" />
      <line x1="3" y1="17" x2="7" y2="17" />
      <line x1="27" y1="17" x2="31" y2="17" />
      <polygon
        points="17,7 15,13 17,11 19,13"
        fill="currentColor"
        stroke="none"
      />
      <polygon points="17,27 15,21 17,23 19,21" fill="none" />
    </svg>
  );
}

/** Delft-blue etching illustration for the footer (Mediterranean coastal scene) */
function FooterScene() {
  return (
    <svg
      viewBox="0 0 1440 680"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <filter id="etching" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            seed="2"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.2"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        {/* Cross-hatching pattern */}
        <pattern
          id="hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke="#3050B8"
            strokeWidth="0.5"
            opacity="0.25"
          />
        </pattern>
        <pattern
          id="hatch2"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="6"
            stroke="#3050B8"
            strokeWidth="0.4"
            opacity="0.18"
          />
        </pattern>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dce8f8" />
          <stop offset="100%" stopColor="#f0e9da" />
        </linearGradient>
        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8cfe8" />
          <stop offset="100%" stopColor="#8aade0" />
        </linearGradient>
        <linearGradient id="hillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a8fc0" />
          <stop offset="100%" stopColor="#3050B8" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="1440" height="680" fill="url(#skyGrad)" />

      {/* Sky hatching — light horizontal strokes */}
      {Array.from({ length: 18 }, (_, i) => (
        <line
          key={`sky-${i}`}
          x1="0"
          y1={20 + i * 14}
          x2="1440"
          y2={18 + i * 14}
          stroke="#3050B8"
          strokeWidth={0.3 + i * 0.03}
          opacity={0.12 + i * 0.01}
        />
      ))}

      {/* Cloud group — left */}
      <g filter="url(#etching)" opacity="0.55">
        <ellipse
          cx="220"
          cy="110"
          rx="130"
          ry="55"
          fill="white"
          stroke="#3050B8"
          strokeWidth="0.8"
        />
        <ellipse
          cx="160"
          cy="125"
          rx="80"
          ry="38"
          fill="white"
          stroke="#3050B8"
          strokeWidth="0.6"
        />
        <ellipse
          cx="300"
          cy="120"
          rx="70"
          ry="32"
          fill="white"
          stroke="#3050B8"
          strokeWidth="0.6"
        />
        <ellipse
          cx="380"
          cy="95"
          rx="95"
          ry="42"
          fill="white"
          stroke="#3050B8"
          strokeWidth="0.7"
        />
      </g>

      {/* Cloud group — center-right */}
      <g filter="url(#etching)" opacity="0.4">
        <ellipse
          cx="850"
          cy="80"
          rx="110"
          ry="46"
          fill="white"
          stroke="#3050B8"
          strokeWidth="0.7"
        />
        <ellipse
          cx="780"
          cy="92"
          rx="75"
          ry="32"
          fill="white"
          stroke="#3050B8"
          strokeWidth="0.5"
        />
        <ellipse
          cx="940"
          cy="88"
          rx="85"
          ry="36"
          fill="white"
          stroke="#3050B8"
          strokeWidth="0.6"
        />
      </g>

      {/* Distant mountain range */}
      <path
        d="M 400 340 Q 500 200 600 260 Q 680 180 780 230 Q 850 160 930 220 Q 990 180 1060 240 L 1060 400 L 400 400 Z"
        fill="url(#hillGrad)"
        opacity="0.35"
        filter="url(#etching)"
      />
      {/* Mountain hatching */}
      <path
        d="M 400 340 Q 500 200 600 260 Q 680 180 780 230 Q 850 160 930 220 Q 990 180 1060 240 L 1060 400 L 400 400 Z"
        fill="url(#hatch)"
        opacity="0.5"
      />

      {/* Foreground hillside — right side */}
      <path
        d="M 980 680 L 980 280 Q 1050 240 1120 260 Q 1180 230 1240 260 L 1440 300 L 1440 680 Z"
        fill="#3050B8"
        opacity="0.18"
        filter="url(#etching)"
      />
      <path
        d="M 980 680 L 980 280 Q 1050 240 1120 260 Q 1180 230 1240 260 L 1440 300 L 1440 680 Z"
        fill="url(#hatch)"
      />

      {/* Stone cliff / retaining wall */}
      <path
        d="M 1080 680 L 1080 360 Q 1100 345 1120 350 L 1200 340 Q 1220 330 1250 335 L 1440 380 L 1440 680 Z"
        fill="#3050B8"
        opacity="0.22"
      />
      {/* Wall stones */}
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 12 }, (_, col) => (
          <rect
            key={`stone-${row}-${col}`}
            x={1082 + col * 30 + (row % 2) * 15}
            y={360 + row * 40}
            width="28"
            height="18"
            fill="none"
            stroke="#3050B8"
            strokeWidth="0.5"
            opacity="0.4"
          />
        )),
      )}

      {/* Dome building — far right */}
      <g filter="url(#etching)" opacity="0.8">
        {/* Main body */}
        <rect
          x="1260"
          y="280"
          width="110"
          height="160"
          fill="#f0e9da"
          stroke="#3050B8"
          strokeWidth="1"
        />
        {/* Columns */}
        {[1275, 1295, 1315, 1335, 1355].map((x) => (
          <rect
            key={x}
            x={x}
            y="280"
            width="6"
            height="160"
            fill="#dce4f5"
            stroke="#3050B8"
            strokeWidth="0.5"
          />
        ))}
        {/* Dome */}
        <ellipse
          cx="1315"
          cy="280"
          rx="55"
          ry="30"
          fill="#dce4f5"
          stroke="#3050B8"
          strokeWidth="1"
        />
        <path
          d="M 1260 280 Q 1315 220 1370 280"
          fill="#b8cfe8"
          stroke="#3050B8"
          strokeWidth="1.2"
        />
        {/* Drum */}
        <rect
          x="1280"
          y="254"
          width="70"
          height="26"
          fill="#dce4f5"
          stroke="#3050B8"
          strokeWidth="0.8"
        />
        {/* Cross on dome */}
        <line
          x1="1315"
          y1="218"
          x2="1315"
          y2="235"
          stroke="#3050B8"
          strokeWidth="1.2"
        />
        <line
          x1="1308"
          y1="224"
          x2="1322"
          y2="224"
          stroke="#3050B8"
          strokeWidth="1.2"
        />
        {/* Bell tower */}
        <rect
          x="1370"
          y="220"
          width="36"
          height="120"
          fill="#dce4f5"
          stroke="#3050B8"
          strokeWidth="0.8"
        />
        <path
          d="M 1370 220 L 1388 195 L 1406 220 Z"
          fill="#b8cfe8"
          stroke="#3050B8"
          strokeWidth="0.8"
        />
        <rect
          x="1376"
          y="240"
          width="10"
          height="14"
          fill="#3050B8"
          opacity="0.35"
        />
        <rect
          x="1394"
          y="240"
          width="10"
          height="14"
          fill="#3050B8"
          opacity="0.35"
        />
        {/* Side building */}
        <rect
          x="1190"
          y="310"
          width="75"
          height="130"
          fill="#f0e9da"
          stroke="#3050B8"
          strokeWidth="0.8"
        />
        <path
          d="M 1190 310 L 1227 290 L 1265 310 Z"
          fill="#dce4f5"
          stroke="#3050B8"
          strokeWidth="0.8"
        />
      </g>

      {/* Cypress trees — right hillside */}
      {[1110, 1145, 1175, 1240].map((x, i) => (
        <g key={`cyp-${i}`} filter="url(#etching)" opacity="0.75">
          <ellipse
            cx={x}
            cy={290 + i * 8}
            rx="9"
            ry={35 + i * 5}
            fill="#2a4090"
          />
          {/* Trunk */}
          <rect
            x={x - 2}
            y={325 + i * 8}
            width="4"
            height="15"
            fill="#3050B8"
            opacity="0.6"
          />
        </g>
      ))}

      {/* Large tree — far right foreground */}
      <g filter="url(#etching)" opacity="0.7">
        <path
          d="M 1420 150 Q 1390 100 1360 130 Q 1340 90 1310 120 Q 1290 80 1360 70 Q 1410 50 1450 90 Q 1480 120 1460 160 Z"
          fill="#2a4090"
        />
        <path
          d="M 1400 160 Q 1380 130 1350 150 Q 1330 115 1300 138 Q 1340 100 1380 110 Q 1430 115 1440 155 Z"
          fill="#3050B8"
          opacity="0.5"
        />
      </g>

      {/* Water — bay / sea */}
      <path
        d="M 0 400 Q 300 370 600 390 Q 900 410 1100 380 L 1100 680 L 0 680 Z"
        fill="url(#waterGrad)"
        opacity="0.45"
      />
      {/* Water horizontal lines */}
      {Array.from({ length: 22 }, (_, i) => (
        <line
          key={`wave-${i}`}
          x1={0}
          y1={408 + i * 14}
          x2={1080}
          y2={412 + i * 14}
          stroke="#3050B8"
          strokeWidth={0.4 + i * 0.02}
          opacity={0.18 + i * 0.008}
        />
      ))}
      {/* Wave ripples */}
      {[0.12, 0.25, 0.38, 0.52, 0.65].map((t, i) => (
        <path
          key={`ripple-${i}`}
          d={`M ${t * 1100 - 60} ${430 + i * 30} Q ${t * 1100} ${420 + i * 30} ${t * 1100 + 60} ${430 + i * 30}`}
          fill="none"
          stroke="#3050B8"
          strokeWidth="0.7"
          opacity="0.3"
        />
      ))}

      {/* Sailing vessel */}
      <g filter="url(#etching)" opacity="0.65" transform="translate(120, 360)">
        {/* Hull */}
        <path
          d="M 0 60 Q 50 75 100 60 L 90 75 Q 50 85 10 75 Z"
          fill="#3050B8"
          opacity="0.5"
        />
        <path
          d="M 5 60 L 95 60 L 90 75 L 10 75 Z"
          fill="#2a4090"
          opacity="0.3"
        />
        {/* Mast */}
        <line
          x1="50"
          y1="10"
          x2="50"
          y2="62"
          stroke="#3050B8"
          strokeWidth="1.5"
        />
        {/* Main sail */}
        <path
          d="M 50 12 L 85 45 L 50 58 Z"
          fill="#dce4f5"
          stroke="#3050B8"
          strokeWidth="0.8"
          opacity="0.7"
        />
        {/* Fore sail */}
        <path
          d="M 50 15 L 20 50 L 50 55 Z"
          fill="#dce4f5"
          stroke="#3050B8"
          strokeWidth="0.6"
          opacity="0.5"
        />
        {/* Cabin */}
        <rect
          x="25"
          y="50"
          width="30"
          height="12"
          fill="#dce4f5"
          stroke="#3050B8"
          strokeWidth="0.6"
        />
        {/* Reflection */}
        <path
          d="M 5 75 Q 50 90 95 75"
          fill="none"
          stroke="#3050B8"
          strokeWidth="0.5"
          opacity="0.25"
        />
      </g>

      {/* Foreground vegetation — left */}
      <g filter="url(#etching)" opacity="0.55">
        <path
          d="M 0 500 Q 40 460 70 480 Q 50 440 80 455 Q 60 430 100 450 L 120 680 L 0 680 Z"
          fill="#2a4090"
        />
        <path
          d="M 0 520 Q 30 500 55 510 Q 35 490 65 498 L 80 680 L 0 680 Z"
          fill="#3050B8"
          opacity="0.4"
        />
      </g>
      <g filter="url(#etching)" opacity="0.45">
        <path
          d="M 50 480 Q 90 430 110 460 Q 95 420 130 440 Q 110 410 150 428 L 160 680 L 40 680 Z"
          fill="#3050B8"
          opacity="0.5"
        />
      </g>

      {/* Overall cross-hatch tone overlay */}
      <rect width="1440" height="680" fill="url(#hatch2)" opacity="0.6" />
    </svg>
  );
}

/** Light hero illustration — abstract browser window with heatmap dots */
function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 1440 500"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute",
        inset: "auto 0 0 0",
        width: "100%",
        height: "78%",
        opacity: 0.5,
        pointerEvents: "none",
      }}
      aria-hidden="true"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4EBDA" stopOpacity="0" />
          <stop offset="100%" stopColor="#F4EBDA" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="dot1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3050B8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#3050B8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dot2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6F8AD4" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#6F8AD4" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Faint grid lines */}
      {Array.from({ length: 16 }, (_, i) => (
        <line
          key={`hg-${i}`}
          x1="0"
          y1={i * 32}
          x2="1440"
          y2={i * 32}
          stroke="#3050B8"
          strokeWidth="0.3"
          opacity="0.08"
        />
      ))}
      {Array.from({ length: 30 }, (_, i) => (
        <line
          key={`vg-${i}`}
          x1={i * 50}
          y1="0"
          x2={i * 50}
          y2="500"
          stroke="#3050B8"
          strokeWidth="0.3"
          opacity="0.08"
        />
      ))}
      {/* Fade overlay */}
      <rect width="1440" height="500" fill="url(#heroFade)" />
    </svg>
  );
}

// ─── SDK auto-load ─────────────────────────────────────────────────────────────

const API_KEY = "clr_live_kmLHlJCx01U4NAlvz7tvbqQsDLTKTU7l";
const PROJECT_ID = "d4e9e17f-129d-4f7f-8498-ab3717ad5f88";

export default function RootPage() {
  const scriptLoaded = useRef(false);

  useLayoutEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;
    const s = document.createElement("script");
    s.src = "/clarity.js";
    s.setAttribute("data-project-id", PROJECT_ID);
    s.setAttribute("data-api-key", API_KEY);
    s.setAttribute(
      "data-ingest",
      process.env.NEXT_PUBLIC_INGEST_URL ?? "http://localhost:4000",
    );
    document.head.appendChild(s);
  }, []);

  return <App />;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const Nav = () => (
  <nav>
    <div className="wrap">
      <a className="logo" href="#top">
        <CompassLogo />
        Clarity
      </a>
      <div className="links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#stories">Customers</a>
        <a href="#pricing">Pricing</a>
        <a href="#faq">FAQ</a>
      </div>
      <div className="nr">
        <a className="btn s" href="/login">
          Sign in
        </a>
        <a className="btn p" href="/signup">
          Start free
        </a>
      </div>
    </div>
  </nav>
);

// ─── Hero ─────────────────────────────────────────────────────────────────────

const SPOTS: SpotData = {
  Heatmap: [
    [18, 22, 130],
    [52, 58, 170],
    [30, 72, 90],
  ],
  Clicks: [
    [62, 66, 60],
    [20, 30, 50],
    [70, 30, 40],
  ],
  Scroll: [
    [10, 10, 110],
    [40, 30, 150],
    [70, 60, 70],
  ],
};

const Hero = () => {
  const [tab, setTab] = useState<keyof SpotData>("Heatmap");
  const [pos, setPos] = useState([20, 30]);

  useEffect(() => {
    const t = setInterval(
      () => setPos([Math.random() * 60 + 10, Math.random() * 55 + 15]),
      2400,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <header className="hero" id="top">
      <HeroIllustration />
      <div className="wrap">
        <h1>
          See your site
          <br />
          through your
          <br />
          <em>visitors' eyes.</em>
        </h1>
        <p className="lead">
          Clarity records every session, maps every click, and flags every
          moment of frustration — so you fix what hurts instead of guessing.
          Free for unlimited traffic.
        </p>
        <div className="cta">
          <a className="btn p" href="/signup">
            Start free in 2 minutes
          </a>
          <a className="btn s" href="#how">
            See how it works
          </a>
        </div>
        <small>No credit card. Works with any site, store or app.</small>

        <div className="frame">
          <div className="bar">
            <i />
            <i />
            <i />
            <span>shop.example.com/checkout</span>
            <div className="tabs" role="tablist">
              {(Object.keys(SPOTS) as Array<keyof SpotData>).map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  className={tab === k ? "on" : ""}
                  onClick={() => setTab(k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="demo">
            <div className="page">
              <div className="sk h" />
              <div className="sk" style={{ width: "85%" }} />
              <div className="sk" style={{ width: "70%" }} />
              <div className="sk" style={{ width: "78%" }} />
              <div className="sk b" />
              {SPOTS[tab].map(
                ([x, y, s]: [number, number, number], i: number) => (
                  <div
                    key={`${tab}-${i}`}
                    className="blob"
                    style={{ left: x + "%", top: y + "%", width: s, height: s }}
                  />
                ),
              )}
              <div
                className="cursor"
                style={{ left: pos[0] + "%", top: pos[1] + "%" }}
              />
            </div>
            <div className="side">
              <h4>What Clarity found</h4>
              <div className="row">
                <span>Rage clicks on "Pay now"</span>
                <b>312</b>
              </div>
              <div className="row">
                <span>Dead clicks on promo code</span>
                <b>188</b>
              </div>
              <div className="row">
                <span>Quick backs from cart</span>
                <b>9.4%</b>
              </div>
              <div className="row">
                <span>Scroll depth reached</span>
                <b>61%</b>
              </div>
              <div className="row">
                <span>Slowest element (LCP)</span>
                <b>3.2s</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

// ─── Logos ────────────────────────────────────────────────────────────────────

const Logos = () => (
  <div className="logos wrap">
    <span>Trusted by product teams at</span>
    <div>
      <span>Harbor&amp;Co</span>
      <span>Pellucid</span>
      <span>Northwind</span>
      <span>Orvieto</span>
      <span>Tessera</span>
      <span>Almond Bank</span>
    </div>
  </div>
);

// ─── Features ─────────────────────────────────────────────────────────────────

type FeatTuple = [string, string, string];

const feats: FeatTuple[] = [
  [
    "Session replay",
    "Watch real visits as they happened, with every tap, scroll and hesitation.",
    "M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  ],
  [
    "Heatmaps",
    "See where people click, move and stop reading — on desktop and mobile.",
    "M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z",
  ],
  [
    "Frustration signals",
    "Rage clicks, dead clicks and excessive scrolling are flagged automatically.",
    "M12 3l9 16H3zM12 10v4M12 17v.5",
  ],
  [
    "Smart filters",
    "Find sessions by page, device, country, error or any custom tag.",
    "M3 5h18l-7 8v6l-4 2v-8z",
  ],
  [
    "Privacy by default",
    "Sensitive fields masked in browser before data leaves. GDPR & CCPA ready.",
    "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  ],
  [
    "Integrations",
    "Push insights to Slack, Jira, Google Analytics, Shopify, and more.",
    "M9 3v6H3M15 21v-6h6M3 15h6v6M21 9h-6V3",
  ],
];

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
  </svg>
);

const Features = () => (
  <section id="features">
    <div className="wrap">
      <h2>Everything you need to understand behavior</h2>
      <p className="lead" style={{ marginTop: 20 }}>
        One lightweight script, six ways to see what visitors actually do.
      </p>
      <div className="fgrid">
        {feats.map(([t, d, p]) => (
          <div key={t}>
            <Icon d={p} />
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── How it works ─────────────────────────────────────────────────────────────

const How = () => (
  <section id="how" className="rule">
    <div className="wrap">
      <h2>Live in minutes, useful the same day</h2>
      <div className="steps">
        <div>
          <h3>Add one line</h3>
          <p>
            Paste the snippet into your site, or install via Shopify, WordPress
            or Google Tag Manager.
          </p>
        </div>
        <div>
          <h3>Let visits roll in</h3>
          <p>
            Recordings and heatmaps appear within minutes. Nothing slows your
            pages down.
          </p>
        </div>
        <div>
          <h3>Fix what hurts</h3>
          <p>
            Open sessions with frustration signals, share a clip with your team,
            ship the fix.
          </p>
        </div>
      </div>
      <pre>{`<script
  src="https://cdn.clarity.app/sdk.js"
  data-project-id="YOUR_PROJECT_ID"
  data-api-key="clr_live_…">
</script>`}</pre>
    </div>
  </section>
);

// ─── Stats ────────────────────────────────────────────────────────────────────

type StatTuple = [string, string];

const statRows: StatTuple[] = [
  ["2.1B", "sessions recorded every month"],
  ["<1ms", "impact on page load"],
  ["38%", "average drop in rage clicks"],
  ["99.99%", "uptime over the past year"],
];

const Stats = () => (
  <div className="stats">
    <section>
      <div className="wrap">
        {statRows.map(([n, l]) => (
          <div key={l}>
            <b>{n}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </section>
  </div>
);

// ─── Stories ──────────────────────────────────────────────────────────────────

type QuoteTuple = [string, string];

const quotes: QuoteTuple[] = [
  [
    "We found a broken coupon field in ten minutes. Fixing it lifted checkout conversion by 11%.",
    "Maya Rossi, Head of Growth, Harbor&Co",
  ],
  [
    "Designers and engineers finally argue about the same recording instead of opinions.",
    "Daniel Okafor, Design Lead, Pellucid",
  ],
  [
    "Masking is on by default, so legal signed off in a day. That never happens.",
    "Priya Nair, Privacy Counsel, Almond Bank",
  ],
];

const Stories = () => (
  <section id="stories">
    <div className="wrap">
      <h2>Teams who stopped guessing</h2>
      <div className="q">
        {quotes.map(([q, c]) => (
          <figure key={c}>
            <blockquote>"{q}"</blockquote>
            <figcaption>{c}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);

// ─── Pricing ──────────────────────────────────────────────────────────────────

type PlanTuple = [string, string, string, string[], string, boolean];

const plans: PlanTuple[] = [
  [
    "Free",
    "₹0",
    "forever",
    [
      "Unlimited sessions",
      "30-day data retention",
      "Heatmaps and replays",
      "Frustration signals",
    ],
    "Start free",
    false,
  ],
  [
    "Team",
    "₹4,999",
    "per month",
    [
      "Everything in Free",
      "12-month retention",
      "Custom filters and tags",
      "Slack and Jira alerts",
      "Shared clip library",
    ],
    "Try Team free",
    true,
  ],
  [
    "Scale",
    "Custom",
    "",
    [
      "Everything in Team",
      "SSO and audit logs",
      "Data residency",
      "Dedicated success manager",
    ],
    "Contact sales",
    false,
  ],
];

const Pricing = () => (
  <section id="pricing" className="rule">
    <div className="wrap">
      <h2>Simple pricing that starts at free</h2>
      <div className="price">
        {plans.map(([n, p, u, l, b, f]: PlanTuple) => (
          <div key={n} className={"plan" + (f ? " f" : "")}>
            <h3>{n}</h3>
            <div className="n">
              {p} <small>{u}</small>
            </div>
            <ul>
              {l.map((x: string) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <a
              className={"btn " + (f ? "p" : "s")}
              href="/signup"
              style={{ textAlign: "center" as const }}
            >
              {b}
            </a>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── FAQ ──────────────────────────────────────────────────────────────────────

type FaqTuple = [string, string];

const faqs: FaqTuple[] = [
  [
    "Will Clarity slow my site down?",
    "No. The script loads asynchronously and sends data in small batches, adding under a millisecond to page load.",
  ],
  [
    "Do you record passwords or cards?",
    "Never. Inputs are masked in the browser before anything is sent, and you can mask any element with one attribute.",
  ],
  [
    "Is it really free?",
    "Yes. The Free plan has no traffic cap. Paid plans add longer retention, team features and compliance tools.",
  ],
  [
    "Does it work on mobile apps?",
    "Yes. Web, mobile web and native iOS and Android apps are supported with the same dashboard.",
  ],
  [
    "Can I delete a visitor's data?",
    "Yes. Search by visitor ID and delete from the dashboard or API to honor any privacy request.",
  ],
];

const FAQ = () => (
  <section id="faq">
    <div className="wrap">
      <h2>Questions, answered</h2>
      <div className="faq">
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

// ─── CTA ──────────────────────────────────────────────────────────────────────

const CTA = () => (
  <section id="cta" className="rule closing">
    <div className="wrap">
      <h2>Your visitors are already telling you what&apos;s wrong.</h2>
      <p className="lead">
        Install Clarity today and watch your first session before lunch.
      </p>
      <a className="btn p" href="/signup">
        Start free
      </a>
    </div>
  </section>
);

// ─── Footer ───────────────────────────────────────────────────────────────────

const footerCols: Record<string, string[]> = {
  Navigation: ["Features", "Testimonials", "FAQ", "Pricing", "Integrations"],
  Solutions: [
    "Customer self-service",
    "Ideation & feedback",
    "Customer engagement",
    "Support & success",
    "Product",
    "Marketing",
    "SaaS",
    "Consumer products",
    "Online training",
  ],
  Resources: [
    "Community",
    "Customer stories",
    "Blog",
    "Help center",
    "Developer hub",
    "Webinars",
    "Glossary",
    "Books",
    "Newsletter",
    "System status",
  ],
  Company: ["Terms of service", "Privacy policy", "Data processing agreement"],
};

const Footer = () => (
  <footer>
    {/* The Delft-blue etching illustration fills the footer background */}
    <FooterScene />

    <div className="wrap">
      {/* Logo + socials column */}
      <div>
        <a className="logo" href="#top">
          <CompassLogo />
          Clarity
        </a>
        <div className="soc">
          {/* Instagram */}
          <a href="#" aria-label="Instagram">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5.5A4.5 4.5 0 1 0 12 16.5 4.5 4.5 0 0 0 12 7.5zm0 2A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5zM17.3 6a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" />
            </svg>
          </a>
          {/* LinkedIn */}
          <a href="#" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3 9h3v12H3zM9 9h3v1.7C12.6 9.6 14 8.8 15.7 8.8 19 8.8 20 11 20 14v7h-3v-6.2c0-1.5-.3-2.8-2-2.8s-2.5 1.2-2.5 2.9V21H9z" />
            </svg>
          </a>
          {/* X / Twitter */}
          <a href="#" aria-label="X (Twitter)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.6z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Link columns */}
      {Object.entries(footerCols).map(([heading, links]) => (
        <div key={heading}>
          <h5>{heading}</h5>
          {links.map((x) => (
            <a key={x} href="#">
              {x}
            </a>
          ))}
        </div>
      ))}
    </div>

    <p className="legal">© 2026 Clarity Analytics. All rights reserved.</p>
  </footer>
);

// ─── App ──────────────────────────────────────────────────────────────────────

const App = () => (
  <>
    <Nav />
    <Hero />
    <Logos />
    <Features />
    <How />
    <Stats />
    <Stories />
    <Pricing />
    <FAQ />
    <CTA />
    <Footer />
  </>
);
