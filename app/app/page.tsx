"use client";

import { useEffect, useRef, useState } from "react";
import "./styles.css"
const API_KEY = "clr_live_A7c8Jvqho79mPF8Y9347s31mHfkUID3b";
const PROJECT_ID = "958c1226-5bdd-44e0-b200-99deb874abce";

export default function RootPage() {
  const scriptLoaded = useRef(false);
  const [log, setLog] = useState<string[]>([]);

  const push = (msg: string) =>
    setLog((l) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...l]);

  // Load clarity.js once
  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;
    const s = document.createElement("script");
    s.src = "/clarity.js";
    s.setAttribute("data-project-id", PROJECT_ID);
    s.setAttribute("data-api-key", API_KEY);
    s.setAttribute("data-ingest", "http://localhost:4000");
    s.onload = () => push("✅ clarity.js loaded");
    s.onerror = () =>
      push("❌ clarity.js failed to load — is dev server running?");
    document.head.appendChild(s);
  }, []);

  return (
    <App />
  );
}

const Compass = () => <img src={"/logo"} width="34" height="34" alt="" />;

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
);


const Nav = () => (
  <nav><div className="wrap">
    <a className="logo" href="#top"><Compass />Lucida</a>
    <div className="links"><a href="#features">Features</a><a href="#how">How it works</a><a href="#stories">Customers</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></div>
    <div className="nr"><a className="btn s" href="#pricing">Sign in</a><a className="btn p" href="#cta">Start free</a></div>
  </div></nav>
);

const spots = {
  Heatmap: [[18, 22, 130], [52, 58, 170], [30, 72, 90]],
  Clicks: [[62, 66, 60], [20, 30, 50], [70, 30, 40]],
  Scroll: [[10, 10, 110], [40, 30, 150], [70, 60, 70]],
};
const Hero = () => {
  const [tab, setTab] = useState("Heatmap");
  const [pos, setPos] = useState([20, 30]);
  useEffect(() => {
    const t = setInterval(() => setPos([Math.random() * 60 + 10, Math.random() * 55 + 15]), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <header className="hero" id="top">
      <img className="art" src={"/sceneHero"} alt="" />
      <div className="wrap">
        <h1>See your site<br />through your<br /><em>visitors’ eyes.</em></h1>
        <p className="lead">Lucida records every session, maps every click, and flags every moment of frustration, so you fix what hurts instead of guessing. Free for unlimited traffic.</p>
        <div className="cta"><a className="btn p" href="#cta">Start free in 2 minutes</a><a className="btn s" href="#how">Watch a session</a></div>
        <small>No credit card. Works with any site, store or app.</small>
        <div className="frame">
          <div className="bar"><i /><i /><i /><span>shop.example.com/checkout</span>
            <div className="tabs" role="tablist">{Object.keys(spots).map(k => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{k}</button>)}</div></div>
          <div className="demo">
            <div className="page">
              <div className="sk h" /><div className="sk" style={{ width: "85%" }} /><div className="sk" style={{ width: "70%" }} /><div className="sk" style={{ width: "78%" }} />
              <div className="sk b" />
              {spots[tab].map(([x, y, s], i) => <div key={tab + i} className="blob" style={{ left: x + "%", top: y + "%", width: s, height: s }} />)}
              <div className="cursor" style={{ left: pos[0] + "%", top: pos[1] + "%" }} />
            </div>
            <div className="side">
              <h4>What Lucida found</h4>
              <div className="row"><span>Rage clicks on “Pay now”</span><b>312</b></div>
              <div className="row"><span>Dead clicks on promo code</span><b>188</b></div>
              <div className="row"><span>Quick backs from cart</span><b>9.4%</b></div>
              <div className="row"><span>Scroll depth reached</span><b>61%</b></div>
              <div className="row"><span>Slowest element (LCP)</span><b>3.2s</b></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const Logos = () => (
  <div className="logos wrap"><span>Trusted by product teams at</span>
    <div><span>Harbor&amp;Co</span><span>Pellucid</span><span>Northwind</span><span>Orvieto</span><span>Tessera</span><span>Almond Bank</span></div></div>
);

const feats = [
  ["Session replay", "Watch real visits as they happened, with every tap, scroll and hesitation.", "M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  ["Heatmaps", "See where people click, move and stop reading, on desktop and mobile.", "M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z"],
  ["Frustration signals", "Rage clicks, dead clicks and excessive scrolling are flagged for you automatically.", "M12 3l9 16H3zM12 10v4M12 17v.5"],
  ["Smart filters", "Find the sessions that matter by page, device, country, error or any custom tag.", "M3 5h18l-7 8v6l-4 2v-8z"],
  ["Privacy by default", "Sensitive fields are masked before data leaves the browser. GDPR and CCPA ready.", "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"],
  ["Integrations", "Send insights to Slack, Jira, Google Analytics, Shopify, WordPress and more.", "M9 3v6H3M15 21v-6h6M3 15h6v6M21 9h-6V3"],
];
const Features = () => (
  <section id="features"><div className="wrap">
    <h2>Everything you need to understand behavior</h2>
    <p className="lead" style={{ marginTop: 20 }}>One lightweight script, six ways to see what visitors actually do.</p>
    <div className="fgrid">{feats.map(([t, d, p]) => (
      <div key={t}><Icon d={p} /><h3>{t}</h3><p>{d}</p></div>))}</div>
  </div></section>
);

const How = () => (
  <section id="how" className="rule"><div className="wrap">
    <h2>Live in minutes, useful the same day</h2>
    <div className="steps">
      <div><h3>Add one line</h3><p>Paste the snippet into your site, or install it through Shopify, WordPress or Google Tag Manager.</p></div>
      <div><h3>Let visits roll in</h3><p>Recordings and heatmaps appear within minutes. Nothing slows your pages down.</p></div>
      <div><h3>Fix what hurts</h3><p>Open the sessions with frustration signals, share a clip with your team and ship the fix.</p></div>
    </div>
    <pre>{`<script>
  (function(l,u,c,i,d,a){ /* Lucida tag */ })(window,document,"script","a1b2c3d4");
</script>`}</pre>
  </div></section>
);

const Stats = () => (
  <div className="stats"><section><div className="wrap">
    {[["2.1B", "sessions recorded every month"], ["<1ms", "impact on page load"], ["38%", "average drop in rage clicks"], ["99.99%", "uptime over the past year"]].map(([n, l]) => (
      <div key={l}><b>{n}</b><span>{l}</span></div>))}
  </div></section></div>
);

const Stories = () => (
  <section id="stories"><div className="wrap">
    <h2>Teams who stopped guessing</h2>
    <div className="q">
      {[["We found a broken coupon field in ten minutes. Fixing it lifted checkout conversion by 11%.", "Maya Rossi, Head of Growth, Harbor&Co"],
      ["Designers and engineers finally argue about the same recording instead of opinions.", "Daniel Okafor, Design Lead, Pellucid"],
      ["Masking is on by default, so legal signed off in a day. That never happens.", "Priya Nair, Privacy Counsel, Almond Bank"]].map(([q, c]) => (
        <figure key={c}><blockquote>“{q}”</blockquote><figcaption>{c}</figcaption></figure>))}
    </div>
  </div></section>
);

const plans = [
  ["Free", "₹0", "forever", ["Unlimited sessions", "30-day data retention", "Heatmaps and replays", "Frustration signals"], "Start free", false],
  ["Team", "₹4,999", "per month", ["Everything in Free", "12-month retention", "Custom filters and tags", "Slack and Jira alerts", "Shared clip library"], "Try Team free", true],
  ["Scale", "Talk to us", "", ["Everything in Team", "SSO and audit logs", "Data residency in India or EU", "Dedicated success manager"], "Contact sales", false],
];
const Pricing = () => (
  <section id="pricing" className="rule"><div className="wrap">
    <h2>Simple pricing that starts at free</h2>
    <div className="price">{plans.map(([n, p, u, l, b, f]) => (
      <div key={n} className={"plan" + (f ? " f" : "")}><h3>{n}</h3><div className="n">{p} <small>{u}</small></div>
        <ul>{l.map(x => <li key={x}>{x}</li>)}</ul><a className={"btn " + (f ? "p" : "s")} href="#cta" style={{ textAlign: "center" }}>{b}</a></div>))}</div>
  </div></section>
);

const FAQ = () => (
  <section id="faq"><div className="wrap">
    <h2>Questions, answered</h2>
    <div className="faq">{[
      ["Will Lucida slow my site down?", "No. The script loads asynchronously and sends data in small batches, adding under a millisecond to page load."],
      ["Do you record passwords or card numbers?", "Never. Inputs are masked in the browser before anything is sent, and you can mask any other element with one attribute."],
      ["Is it really free?", "Yes. The Free plan has no traffic cap. Paid plans add longer retention, team features and compliance tools."],
      ["Does it work on mobile apps?", "Yes. Web, mobile web and native iOS and Android apps are supported with the same dashboard."],
      ["Can I delete a visitor’s data?", "Yes. Search by visitor ID and delete from the dashboard or the API to honor any privacy request."],
    ].map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
  </div></section>
);

const CTA = () => (
  <section id="cta" className="rule closing"><div className="wrap">
    <h2>Your visitors are already telling you what’s wrong.</h2>
    <p className="lead">Install Lucida today and watch your first session before lunch.</p>
    <a className="btn p" href="#top">Start free</a>
  </div></section>
);

const cols = {
  Navigation: ["Features", "Testimonials", "FAQ", "Pricing", "Integrations"],
  Solutions: ["Ecommerce", "Product teams", "Marketing", "SaaS", "Media and publishing", "Agencies", "Online training"],
  Resources: ["Community", "Customer stories", "Blog", "Help center", "Developer hub", "Webinars", "Glossary", "Newsletter", "System status"],
  Company: ["Terms of service", "Privacy policy", "Data processing agreement"],
};
const Footer = () => (
  <footer>
    <img className="art" src={"/sceneFooter"} alt="" />
    <div className="wrap">
      <div><a className="logo" href="#top"><Compass />Lucida</a>
        <div className="soc"><a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zM17.3 6a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" /></svg></a><a href="#" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M4.5 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3 9h3v12H3zM9 9h3v1.7C12.6 9.6 14 8.8 15.7 8.8 19 8.8 20 11 20 14v7h-3v-6.2c0-1.5-.3-2.8-2-2.8s-2.5 1.2-2.5 2.9V21H9z" /></svg></a><a href="#" aria-label="X"><svg viewBox="0 0 24 24"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.300-8.300L2 3h6.400l4.400 5.900zm-1.100 16.200h1.700L7.400 4.700H5.600z" /></svg></a></div></div>
      {Object.entries(cols).map(([h, l]) => <div key={h}><h5>{h}</h5>{l.map(x => <a key={x} href="#">{x}</a>)}</div>)}
    </div>
    <p className="legal">© 2026 Lucida Analytics. All rights reserved.</p>
  </footer>
);

const App = () => (<><Nav /><Hero /><Logos /><Features /><How /><Stats /><Stories /><Pricing /><FAQ /><CTA /><Footer /></>);
