import { Link } from "react-router-dom";
import { ArrowRight, Bot, CheckCircle2, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import "./portal.css";

export default function Landing() {
  return (
    <div className="landing-shell">
      <nav className="public-nav">
        <Link className="brand" to="/">
          <span className="brand-mark">🐝</span>
          <span>Block<span>Beez</span></span>
        </Link>
        <div className="public-nav-links">
          <a href="#how">How it works</a>
          <Link to="/assistant">AI Assistant</Link>
          <Link className="nav-verify" to="/verify">Verify Honey</Link>
        </div>
      </nav>

      <main>
        <section className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow-pill"><Sparkles size={14} /> HIVE-TO-TABLE TRUST PLATFORM</div>
            <h1>Trust every drop.<br /><em>Trace every batch.</em></h1>
            <p className="hero-lead">BlockBeez connects smart beekeeping, quality data and consumer verification into one transparent honey ecosystem.</p>
            <div className="hero-actions">
              <Link className="verify-hero-btn" to="/verify"><QrCode size={19} /> VERIFY THE HONEY <ArrowRight size={18} /></Link>
              <Link className="ghost-btn" to="/buyer/catalog">Explore verified honey</Link>
            </div>
            <div className="trust-row">
              <span><CheckCircle2 size={16} /> Batch-level traceability</span>
              <span><CheckCircle2 size={16} /> QR verification</span>
              <span><CheckCircle2 size={16} /> AI-ready hive health</span>
            </div>
          </div>
          <div className="hero-art">
            <div className="honey-orbit orbit-one" />
            <div className="honey-orbit orbit-two" />
            <div className="hive-visual"><span>🐝</span><strong>HIVE</strong><small>CONNECTED</small></div>
            <div className="floating-card card-top"><ShieldCheck size={18}/><div><b>Verified batch</b><small>BB-2026-100</small></div></div>
            <div className="floating-card card-bottom"><Bot size={18}/><div><b>AI health</b><small>94% healthy</small></div></div>
          </div>
        </section>

        <section className="role-section" id="roles">
          <div className="section-intro"><span>ONE PLATFORM · TWO EXPERIENCES</span><h2>What brings you to BlockBeez?</h2><p>Choose your path. Your tools, data and actions stay focused on what you need.</p></div>
          <div className="role-grid">
            <Link to="/login" className="role-card beekeeper-card">
              <div className="role-icon">🐝</div><div className="role-label">FOR BEEKEEPERS</div><h3>Run a smarter apiary.</h3><p>Manage hives, capture harvests, monitor health and build trusted batch histories.</p><span className="role-link">Enter Beekeeper Portal <ArrowRight size={17}/></span>
            </Link>
            <Link to="/buyer/login" className="role-card buyer-card">
              <div className="role-icon">🍯</div><div className="role-label">FOR BUYERS</div><h3>Know your honey.</h3><p>Discover verified products and follow the story from the jar back to its originating hive.</p><span className="role-link">Enter Buyer Experience <ArrowRight size={17}/></span>
            </Link>
          </div>
        </section>

        <section className="how-section" id="how">
          <div className="section-intro"><span>THE BLOCKBEEZ LOOP</span><h2>One batch. One digital identity.</h2></div>
          <div className="flow-strip">
            {[["01","🐝","Hive"],["02","📡","Monitor"],["03","🍯","Harvest"],["04","🆔","Batch ID"],["05","🧪","Quality"],["06","🔳","Verify"]].map(([n,icon,label]) => <div className="flow-node" key={n}><small>{n}</small><strong>{icon}</strong><b>{label}</b></div>)}
          </div>
        </section>
      </main>
      <footer className="public-footer"><span>🐝 BlockBeez</span><span>Smart beekeeping · Traceability · Trust</span><Link to="/assistant">Need help? Ask AI</Link></footer>
    </div>
  );
}
