"use client";
import "./landing.css";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  FlaskConical,
  Menu,
  MousePointer2,
  Play,
  Send,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

type DashboardView = "Overview" | "Sessions" | "Experiments";

const viewContent: Record<
  DashboardView,
  { title: string; first: string; second: string; third: string; note: string }
> = {
  Overview: {
    title: "Activation overview",
    first: "18,492",
    second: "42.6%",
    third: "4.8 min",
    note: "Activation lifted after the new workspace tour.",
  },
  Sessions: {
    title: "Session activity",
    first: "2,480",
    second: "68.4%",
    third: "6.2 min",
    note: "People pause most often during workspace setup.",
  },
  Experiments: {
    title: "Experiment results",
    first: "6 active",
    second: "+12.4%",
    third: "95%",
    note: "The shorter onboarding flow is leading this week.",
  },
};

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      className={
        footer ? "clarity-brand clarity-brand-footer" : "clarity-brand"
      }
      href="#top"
      aria-label="Clarity home"
    >
      <span className="clarity-brand-symbol">
        <Activity size={18} strokeWidth={2.6} />
      </span>
      <span>
        clarity<span className="clarity-brand-dot">.</span>
      </span>
    </a>
  );
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="clarity-header">
      <div className="clarity-header-inner">
        <Brand />
        <nav
          className={menuOpen ? "clarity-nav clarity-nav-open" : "clarity-nav"}
          aria-label="Main navigation"
        >
          <a href="#platform" onClick={() => setMenuOpen(false)}>
            Platform
          </a>
          <a href="#stories" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#privacy" onClick={() => setMenuOpen(false)}>
            Privacy
          </a>
          <a href="#faqs" onClick={() => setMenuOpen(false)}>
            FAQs
          </a>
        </nav>
        <a className="clarity-header-cta" href="#platform">
          Explore platform <ArrowUpRight size={15} />
        </a>
        <button
          className="clarity-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}

function ProductPreview() {
  const [activeView, setActiveView] = useState<DashboardView>("Overview");
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(false);
  const current = viewContent[activeView];
  const views: { name: DashboardView; icon: typeof BarChart3 }[] = [
    { name: "Overview", icon: BarChart3 },
    { name: "Sessions", icon: Play },
    { name: "Experiments", icon: FlaskConical },
  ];

  function askClarity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question.trim()) setAsked(true);
  }

  return (
    <div className="clarity-product-shell" id="platform">
      <div className="clarity-product-topbar">
        <div className="clarity-product-dots">
          <i />
          <i />
          <i />
        </div>
        <span className="clarity-product-name">
          <span className="clarity-mini-mark">
            <Activity size={12} />
          </span>{" "}
          Clarity workspace
        </span>
        <span className="clarity-product-status">
          <i /> Live data
        </span>
      </div>
      <div className="clarity-product-layout">
        <aside className="clarity-product-sidebar" aria-label="Analytics views">
          <span className="clarity-sidebar-label">WORKSPACE</span>
          <span className="clarity-workspace-name">
            <span className="clarity-workspace-icon">N</span> Northstar{" "}
            <ChevronDown size={12} />
          </span>
          <span className="clarity-sidebar-label clarity-sidebar-label-spaced">
            PRODUCT
          </span>
          <div
            className="clarity-view-list"
            role="tablist"
            aria-label="Product analytics views"
          >
            {views.map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={
                  activeView === name
                    ? "clarity-view-tab clarity-view-tab-active"
                    : "clarity-view-tab"
                }
                type="button"
                role="tab"
                aria-selected={activeView === name}
                onClick={() => setActiveView(name)}
              >
                <Icon size={15} /> {name}
              </button>
            ))}
          </div>
          <div className="clarity-sidebar-foot">
            <span className="clarity-avatar">A</span>
            <span>
              Alex Morgan<small>Product team</small>
            </span>
            <ChevronDown size={12} />
          </div>
        </aside>
        <div className="clarity-dashboard-main">
          <div className="clarity-dashboard-crumb">
            <span>Product</span>
            <b>/</b>
            <strong>{current.title}</strong>
            <button type="button">
              Last 30 days <ChevronDown size={12} />
            </button>
          </div>
          <div className="clarity-dashboard-heading">
            <div>
              <span className="clarity-dashboard-eyebrow">PRODUCT HEALTH</span>
              <h2>{current.title}</h2>
              <p>A clearer view of what your customers are doing.</p>
            </div>
            <button className="clarity-export" type="button">
              <ArrowUpRight size={14} /> Share report
            </button>
          </div>
          <div className="clarity-metric-row">
            <article className="clarity-metric">
              <span>Trial signups</span>
              <strong>{current.first}</strong>
              <small>
                <span>↑ 14.8%</span> vs. last period
              </small>
            </article>
            <article className="clarity-metric">
              <span>Activation rate</span>
              <strong>{current.second}</strong>
              <small>
                <span>↑ 6.2%</span> vs. last period
              </small>
            </article>
            <article className="clarity-metric">
              <span>Time to value</span>
              <strong>{current.third}</strong>
              <small>
                <span>↓ 12.4%</span> vs. last period
              </small>
            </article>
          </div>
          <div className="clarity-chart-panel">
            <div className="clarity-chart-header">
              <div>
                <strong>Activation over time</strong>
                <span>New users reaching their first key action</span>
              </div>
              <div className="clarity-chart-legend">
                <i /> This period <i className="clarity-legend-muted" />{" "}
                Previous
              </div>
            </div>
            <div className="clarity-chart-area">
              <div className="clarity-chart-y">
                <span>60%</span>
                <span>40%</span>
                <span>20%</span>
                <span>0%</span>
              </div>
              <svg
                viewBox="0 0 720 180"
                preserveAspectRatio="none"
                role="img"
                aria-label="Activation rate trending upward over the last month"
              >
                <defs>
                  <linearGradient
                    id="clarityChartFill"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#4d68d8" stopOpacity=".23" />
                    <stop offset="100%" stopColor="#4d68d8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 143 C45 135 62 148 100 126 S154 117 190 129 S244 96 282 108 S335 77 377 93 S425 67 462 82 S510 45 548 63 S601 34 642 46 S685 25 720 20 L720 180 L0 180Z"
                  fill="url(#clarityChartFill)"
                />
                <path
                  d="M0 143 C45 135 62 148 100 126 S154 117 190 129 S244 96 282 108 S335 77 377 93 S425 67 462 82 S510 45 548 63 S601 34 642 46 S685 25 720 20"
                  fill="none"
                  stroke="#5269d4"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M0 151 C55 140 72 151 110 140 S162 131 203 137 S260 123 300 127 S355 106 400 115 S449 97 487 105 S542 86 578 95 S626 73 667 82 S698 69 720 66"
                  fill="none"
                  stroke="#c9d0df"
                  strokeWidth="2"
                  strokeDasharray="5 6"
                />
              </svg>
              <div className="clarity-chart-labels">
                <span>May 01</span>
                <span>May 06</span>
                <span>May 11</span>
                <span>May 16</span>
                <span>May 21</span>
                <span>May 26</span>
                <span>May 31</span>
              </div>
            </div>
          </div>
          <div className="clarity-dashboard-insight">
            <span className="clarity-insight-icon">
              <Sparkles size={15} />
            </span>
            <span>
              <small>CLARITY AI NOTICED</small>
              <strong>{current.note}</strong>
            </span>
            <ArrowRight size={15} />
          </div>
        </div>
      </div>
      <div className="clarity-product-caption">
        <span>
          <Check size={13} /> Every signal, in context
        </span>
        <span>
          Analytics <b>·</b> Sessions <b>·</b> Experiments
        </span>
      </div>
      <aside className="clarity-floating-insight" aria-label="Ask Clarity AI">
        <div className="clarity-floating-head">
          <span className="clarity-floating-icon">
            <Sparkles size={15} />
          </span>
          <span>
            <strong>Clarity AI</strong>
            <small>Your product copilot</small>
          </span>
          <i />
        </div>
        <p>
          {asked
            ? `I’m looking into “${question.trim()}” across your product data. Here are the patterns worth exploring.`
            : "I found an 18% drop in trial activation. Want to see what changed?"}
        </p>
        <form className="clarity-ask-form" onSubmit={askClarity}>
          <label className="sr-only" htmlFor="clarity-question">
            Ask Clarity a question
          </label>
          <input
            id="clarity-question"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setAsked(false);
            }}
            placeholder="Ask why a metric changed"
          />
          <button type="submit" aria-label="Send question">
            <Send size={15} />
          </button>
        </form>
      </aside>
    </div>
  );
}

function StorySection() {
  return (
    <section className="clarity-story-section" id="stories">
      <div className="clarity-section-heading">
        <span className="clarity-kicker">FROM SIGNAL TO CLARITY</span>
        <h2>
          Understand the moment.
          <br />
          <em>Know what to do next.</em>
        </h2>
      </div>
      <div className="clarity-story-grid">
        <article className="clarity-story-card clarity-story-card-blue">
          <span className="clarity-story-label">
            <Activity size={14} /> THE SIGNAL
          </span>
          <h3>Clarity follows the customer journey.</h3>
          <p>
            See where people pause, what they try, and the moments that move
            them forward.
          </p>
          <div
            className="clarity-journey-demo"
            aria-label="Customer journey from signup to activation"
          >
            <div>
              <span className="clarity-journey-node">01</span>
              <b>Sign up</b>
              <small>100%</small>
              <i style={{ width: "100%" }} />
            </div>
            <ArrowRight size={15} />
            <div>
              <span className="clarity-journey-node">02</span>
              <b>Set up</b>
              <small>68%</small>
              <i style={{ width: "68%" }} />
            </div>
            <ArrowRight size={15} />
            <div>
              <span className="clarity-journey-node">03</span>
              <b>Activate</b>
              <small>42%</small>
              <i style={{ width: "42%" }} />
            </div>
          </div>
        </article>
        <article className="clarity-story-card clarity-story-card-ice">
          <span className="clarity-story-label">
            <Sparkles size={14} /> THE WHY
          </span>
          <h3>When something changes, find the reason.</h3>
          <p>
            Move from a metric shift to the sessions, segments, and experiments
            that explain it.
          </p>
          <div className="clarity-insight-demo">
            <div className="clarity-insight-demo-top">
              <span className="clarity-insight-icon">
                <WandSparkles size={15} />
              </span>
              <span>
                <strong>Clarity found a pattern</strong>
                <small>Based on 2,480 sessions</small>
              </span>
              <span className="clarity-demo-live">
                <i /> Live
              </span>
            </div>
            <p>
              New users who skip the workspace tour are <b>2.3× more likely</b>{" "}
              to leave before activation.
            </p>
            <button type="button">
              Explore these sessions <ArrowRight size={13} />
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function NotesSection() {
  return (
    <section className="clarity-notes-section">
      <div className="clarity-section-heading clarity-section-heading-centered">
        <span className="clarity-kicker">
          A CLEARER KIND OF PRODUCT INTELLIGENCE
        </span>
        <h2>
          Every insight, ready
          <br />
          to <em>move your team forward.</em>
        </h2>
        <p>Turn a trail of events into a story your whole team can act on.</p>
      </div>
      <div className="clarity-report-stage">
        <div className="clarity-report-window">
          <div className="clarity-report-top">
            <div className="clarity-product-dots">
              <i />
              <i />
              <i />
            </div>
            <span>Clarity / Insights</span>
            <span className="clarity-report-date">
              This week <ChevronDown size={12} />
            </span>
          </div>
          <div className="clarity-report-content">
            <div className="clarity-report-aside">
              <span className="clarity-kicker">WEEKLY PRODUCT BRIEF</span>
              <h3>
                Activation is up.
                <br />
                Here&apos;s what changed.
              </h3>
              <p>
                Across 2,480 sessions, new customers are reaching value sooner
                than last week.
              </p>
              <div className="clarity-report-owner">
                <span className="clarity-avatar">C</span>
                <span>
                  Clarity AI<small>Generated moments ago</small>
                </span>
              </div>
            </div>
            <div className="clarity-report-findings">
              <article>
                <span className="clarity-finding-number">01</span>
                <div>
                  <strong>The new workspace tour is working</strong>
                  <p>People who finish the tour activate 31% more often.</p>
                </div>
                <span className="clarity-finding-change">+31%</span>
              </article>
              <article>
                <span className="clarity-finding-number">02</span>
                <div>
                  <strong>One setup step creates friction</strong>
                  <p>Session replays show a pause at team invitations.</p>
                </div>
                <span className="clarity-finding-change clarity-finding-neutral">
                  <ArrowDownRight size={14} /> 18%
                </span>
              </article>
              <article>
                <span className="clarity-finding-number">03</span>
                <div>
                  <strong>Try a guided invite flow</strong>
                  <p>A small experiment could help more teams get started.</p>
                </div>
                <span className="clarity-finding-action">
                  <ArrowUpRight size={14} />
                </span>
              </article>
            </div>
          </div>
        </div>
        <div className="clarity-report-glow" aria-hidden="true" />
      </div>
    </section>
  );
}

function PrivacySection() {
  const benefits = [
    {
      icon: Users,
      title: "Built for every team",
      text: "Give product, design, and engineering one shared view of the customer journey.",
    },
    {
      icon: MousePointer2,
      title: "Respectful by design",
      text: "Understand real behavior with thoughtful controls for privacy and data governance.",
    },
    {
      icon: FlaskConical,
      title: "Confident experiments",
      text: "Test meaningful changes, learn from the outcome, and keep the customer experience in focus.",
    },
  ];

  return (
    <section className="clarity-privacy-section" id="privacy">
      <div className="clarity-section-heading">
        <span className="clarity-kicker">MADE FOR PEOPLE WHO BUILD</span>
        <h2>
          Better product decisions,
          <br />
          <em>with people in mind.</em>
        </h2>
      </div>
      <div className="clarity-benefit-grid">
        {benefits.map(({ icon: Icon, title, text }, index) => (
          <article className="clarity-benefit-card" key={title}>
            <div
              className={`clarity-benefit-art clarity-benefit-art-${index + 1}`}
              aria-hidden="true"
            >
              {index === 0 && (
                <div className="clarity-team-art">
                  <span>A</span>
                  <span>M</span>
                  <span>J</span>
                  <b>One shared view</b>
                </div>
              )}
              {index === 1 && (
                <div className="clarity-shield-art">
                  <span>
                    <Check size={24} />
                  </span>
                  <i />
                  <i />
                  <i />
                </div>
              )}
              {index === 2 && (
                <div className="clarity-experiment-art">
                  <span>Control</span>
                  <b>+12.4%</b>
                  <span>Variant B</span>
                  <i />
                </div>
              )}
            </div>
            <div className="clarity-benefit-icon">
              <Icon size={17} />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
  const questions = [
    [
      "What is Clarity?",
      "Clarity brings product analytics, session replay, experimentation, and AI insights together so your team can understand what people do and why.",
    ],
    [
      "Who is Clarity for?",
      "Clarity is designed for product, design, research, and engineering teams who want to make better decisions with a shared view of customer behavior.",
    ],
    [
      "Can I connect Clarity to my existing tools?",
      "Clarity is designed to work alongside your product stack. Your team can bring behavioral signals together with the workflows you already use.",
    ],
    [
      "How does Clarity protect customer data?",
      "Privacy and governance are part of the product experience, with controls that help teams use behavioral data responsibly.",
    ],
    [
      "Can I try Clarity before talking to sales?",
      "Yes. Get started to explore the product and see how Clarity fits your team.",
    ],
  ];

  return (
    <section className="clarity-faq-section" id="faqs">
      <div className="clarity-faq-intro">
        <span className="clarity-kicker">A FEW GOOD QUESTIONS</span>
        <h2>Good to know.</h2>
        <p>Everything you need to get a clearer picture.</p>
      </div>
      <div className="clarity-faq-list">
        {questions.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <ChevronDown size={17} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="clarity-footer" id="get-started">
      <div className="clarity-footer-cta">
        <span className="clarity-footer-spark">
          <Sparkles size={19} />
        </span>
        <h2>
          See your product
          <br />
          <em>with fresh eyes.</em>
        </h2>
        <p>Bring every customer signal into focus.</p>
        <a href="#platform" className="clarity-footer-button">
          Explore the platform <ArrowRight size={16} />
        </a>
        <div
          className="clarity-footer-orbit clarity-footer-orbit-one"
          aria-hidden="true"
        >
          <Activity size={27} />
        </div>
        <div
          className="clarity-footer-orbit clarity-footer-orbit-two"
          aria-hidden="true"
        >
          <Sparkles size={23} />
        </div>
      </div>
      <div className="clarity-footer-bottom">
        <Brand footer />
        <p>Product intelligence, made clear.</p>
        <nav aria-label="Footer navigation">
          <a href="#platform">Platform</a>
          <a href="#privacy">Privacy</a>
          <a href="#faqs">FAQs</a>
        </nav>
        <span>© 2026 Clarity</span>
      </div>
    </footer>
  );
}

export default function ClarityLanding() {
  const api_key =
    "clr.TwT6WfZW.ea65c825069f199f667fc39ace35d17ce5ec0737726881ce2599f0c8e6e4ef20";
  const project_id = "ad3a6d9c-a1ad-4833-a841-258b3a69528a";
  return (
    <div className="clarity-site" id="top">
      <section className="clarity-hero">
        <div className="clarity-hero-landscape" aria-hidden="true" />
        <SiteHeader />
        <div className="clarity-hero-copy">
          <span className="clarity-hero-kicker">
            PRODUCT INTELLIGENCE, MADE CLEAR
          </span>
          <h1>
            See the story
            <br />
            behind every metric.
          </h1>
          <p>
            Clarity brings analytics, session replay, and experiments together —
            so you can understand what people do, and why.
          </p>
          <a className="clarity-hero-button" href="#platform">
            <Sparkles size={15} /> Explore the platform <ArrowRight size={15} />
          </a>
        </div>
        <ProductPreview />
      </section>
      <main>
        <StorySection />
        <NotesSection />
        <PrivacySection />
        <FAQSection />
      </main>
      <SiteFooter />
      <script
        src="/clarity.js"
        data-project-id={project_id}
        data-api-key={api_key}
        data-ingest="http://localhost:4000"
        data-sample-rate="1"
        data-mask-text="false"
        async
        defer
      />
    </div>
  );
}
