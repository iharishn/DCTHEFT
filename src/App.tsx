import { useState } from 'react';
import './App.css';
import { DottedSurface } from './components/DottedSurface';
import { IntroPage } from './components/IntroPage';
import { Dashboard } from './pages/Dashboard';

type Page = 'intro' | 'main' | 'dashboard';

function App() {
  const [page, setPage] = useState<Page>('intro');

  // ── Intro ────────────────────────────────────────────────────────────────────
  if (page === 'intro') {
    return <IntroPage onEnter={() => setPage('main')} />;
  }

  // ── Dashboard (Monitoring View) ──────────────────────────────────────────────
  if (page === 'dashboard') {
    return <Dashboard onBack={() => setPage('main')} />;
  }

  // ── Main landing page ────────────────────────────────────────────────────────
  return (
    <div className="app main-content">
      {/* Dark theme dotted background for the landing page */}
      <DottedSurface darkMode={true} />

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <span className="nav-logo">⚡</span>
          <span className="nav-title">DC TheftProtector</span>
        </div>
        <ul className="nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how">How It Works</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
        <button className="btn btn-primary" onClick={() => setPage('dashboard')}>Get Started</button>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">⚡ Next-Gen Security System</div>
        <h1 className="hero-title">
          Protect Your{' '}
          <span className="gradient-text">DC Assets</span>
          <br />
          Before Theft Happens
        </h1>
        <p className="hero-subtitle">
          Real-time monitoring, instant alerts, and intelligent theft detection
          powered by advanced sensors and AI-driven analytics.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => setPage('dashboard')}>
            Start Protecting Now
          </button>
          <a href="#how" className="btn btn-ghost">See How It Works →</a>
        </div>

        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">99.8%</span>
            <span className="stat-label">Detection Accuracy</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">&lt;2s</span>
            <span className="stat-label">Alert Response</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-value">24/7</span>
            <span className="stat-label">Active Monitoring</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="section-header">
          <div className="section-tag">Core Features</div>
          <h2 className="section-title">Everything You Need to Stay Secure</h2>
        </div>
        <div className="glow-divider" />
        <div className="features-grid">
          {[
            { icon: '🔬', title: 'Smart Sensor Array', desc: 'Multi-point DC current and voltage sensors detect anomalies instantly across your entire infrastructure.' },
            { icon: '⚡', title: 'Real-Time Alerts', desc: 'Instant push notifications, SMS, and email alerts the moment suspicious activity is detected.' },
            { icon: '🧠', title: 'AI-Powered Analysis', desc: 'Machine learning models differentiate normal fluctuations from theft patterns with unmatched precision.' },
            { icon: '📊', title: 'Live Dashboard', desc: 'A centralized web dashboard gives you a real-time overview of all monitored circuits and events.' },
            { icon: '🔒', title: 'Tamper Detection', desc: 'Physical tamper sensors and encrypted communication prevent bypass attempts.' },
            { icon: '🌐', title: 'Remote Access', desc: 'Monitor, configure, and respond from anywhere in the world via our secure cloud platform.' },
          ].map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works" id="how">
        <div className="section-header">
          <div className="section-tag">Process</div>
          <h2 className="section-title">Up and Running in Minutes</h2>
        </div>
        <div className="glow-divider" />
        <div className="steps">
          {[
            { num: '01', title: 'Install Sensors', desc: 'Clip-on current sensors attach to DC lines — no rewiring needed.' },
            { num: '02', title: 'Connect Hub', desc: 'Our wireless hub syncs with sensors and connects to your network.' },
            { num: '03', title: 'Configure Alerts', desc: 'Set thresholds and choose your preferred alert channels.' },
            { num: '04', title: 'Stay Protected', desc: "Relax — we watch your assets around the clock so you don't have to." },
          ].map((s) => (
            <div className="step" key={s.num}>
              <div className="step-num">{s.num}</div>
              <div className="step-content">
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="get-started">
        <div className="cta-box">
          <h2 className="cta-title">Ready to Eliminate DC Theft?</h2>
          <p className="cta-sub">
            Join hundreds of facilities that trust DC TheftProtector to keep their assets safe.
          </p>
          <div className="cta-actions">
            <button className="btn btn-primary" onClick={() => setPage('dashboard')}>Open Dashboard</button>
            <a href="#features" className="btn btn-outline">Learn More</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer" id="contact">
        <span className="nav-logo">⚡</span>
        <p>© 2026 DC TheftProtector. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
