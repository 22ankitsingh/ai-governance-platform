import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, FileText, Brain, BarChart3, CheckCircle2, Building2, TrendingUp, Shield } from 'lucide-react';

export default function Landing() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-content">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', padding: '6px 16px 6px 8px', marginBottom: '24px', backdropFilter: 'blur(8px)' }}>
            <Shield size={16} style={{ color: 'var(--highlight-light)' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>AI-Powered Governance Platform</span>
          </div>
          <h1>Empowering Citizens.<br />Transforming Governance.</h1>
          <p>
            Report civic issues, track their resolution in real-time, and hold local
            government accountable — all powered by AI-driven classification and transparent workflows.
          </p>
          <div className="hero-buttons">
            {isAuthenticated ? (
              <Link to={isAdmin ? '/admin' : '/dashboard'} className="btn btn-lg" style={{ background: 'white', color: 'var(--primary-950)', fontWeight: 700 }}>
                Go to Dashboard <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-lg" style={{ background: 'white', color: 'var(--primary-950)', fontWeight: 700 }}>
                  Report an Issue <ArrowRight size={18} />
                </Link>
                <Link to="/login" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', borderColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <div className="section-title">
          <h2>How It Works</h2>
          <p>A transparent, efficient process from issue to resolution</p>
        </div>
        <div className="landing-features-grid">
          <div className="feature-card">
            <div className="feature-card-icon"><FileText size={24} /></div>
            <h3>Report Issues</h3>
            <p>Submit civic issues with photos, location, and descriptions. Our AI automatically classifies and routes your report to the right department.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon" style={{ background: 'var(--accent-50)', color: 'var(--accent)' }}><Brain size={24} /></div>
            <h3>AI Classification</h3>
            <p>Advanced AI analyzes your report to determine category, severity, and the best department to handle it — ensuring fast and accurate routing.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon" style={{ background: 'var(--highlight-50)', color: 'var(--primary-700)' }}><BarChart3 size={24} /></div>
            <h3>Track Progress</h3>
            <p>Monitor your issue through every stage with a real-time timeline. Get notified when status changes occur.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><CheckCircle2 size={24} /></div>
            <h3>Verify Resolution</h3>
            <p>Once resolved, review before/after images and rate the resolution quality. Your feedback drives accountability.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon" style={{ background: 'var(--soft-accent-light)', color: '#9333ea' }}><Building2 size={24} /></div>
            <h3>Admin Dashboard</h3>
            <p>Government officials get a powerful triage queue, department management, and analytics dashboard for data-driven governance.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><TrendingUp size={24} /></div>
            <h3>Analytics & Insights</h3>
            <p>Comprehensive analytics on resolution rates, department performance, geographic patterns, and AI prediction accuracy.</p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="landing-how">
        <div className="section-title">
          <h2>Get Started in Minutes</h2>
          <p>Simple steps to make your voice heard</p>
        </div>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h4>Create Account</h4>
            <p>Register as a citizen with your email</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h4>Submit Report</h4>
            <p>Describe the issue, upload photos, and pin the location</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h4>AI Processes</h4>
            <p>AI classifies and routes to the right department</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h4>Track & Verify</h4>
            <p>Follow progress and verify the resolution</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--primary-950)', color: 'rgba(255,255,255,0.5)', padding: '32px', textAlign: 'center', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <Shield size={16} style={{ color: 'var(--primary-light)' }} />
          <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>PrajaGov</span>
        </div>
        <p>© 2026 PrajaGov. Building transparent governance through technology.</p>
      </footer>
    </div>
  );
}
