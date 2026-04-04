import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { isAuthenticated, isAdmin } = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-content">
          <h1>Empowering Citizens.<br />Transforming Governance.</h1>
          <p>
            Report civic issues, track their resolution in real-time, and hold local
            government accountable — all powered by AI-driven classification and transparent workflows.
          </p>
          <div className="hero-buttons">
            {isAuthenticated ? (
              <Link to={isAdmin ? '/admin' : '/dashboard'} className="btn btn-primary btn-lg">
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">
                  Report an Issue →
                </Link>
                <Link to="/login" className="btn btn-secondary btn-lg" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', borderColor: 'rgba(255,255,255,0.25)' }}>
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
            <div className="feature-card-icon">📝</div>
            <h3>Report Issues</h3>
            <p>Submit civic issues with photos, location, and descriptions. Our AI automatically classifies and routes your report to the right department.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">🤖</div>
            <h3>AI Classification</h3>
            <p>Advanced AI analyzes your report to determine category, severity, and the best department to handle it — ensuring fast and accurate routing.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">📊</div>
            <h3>Track Progress</h3>
            <p>Monitor your issue through every stage with a real-time timeline. Get notified when status changes occur.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">✅</div>
            <h3>Verify Resolution</h3>
            <p>Once resolved, review before/after images and rate the resolution quality. Your feedback drives accountability.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">🏛️</div>
            <h3>Admin Dashboard</h3>
            <p>Government officials get a powerful triage queue, department management, and analytics dashboard for data-driven governance.</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">📈</div>
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
      <footer style={{ background: 'var(--primary-950)', color: 'rgba(255,255,255,0.5)', padding: '2rem', textAlign: 'center', fontSize: '0.85rem' }}>
        <p>© 2026 AI-Powered Governance Platform. Building transparent governance through technology.</p>
      </footer>
    </div>
  );
}
