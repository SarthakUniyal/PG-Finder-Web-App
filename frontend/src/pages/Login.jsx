import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock } from 'react-icons/fi';
import '../style/Auth.css';
import PGLogo from '../components/PGLogo';
import API_BASE_URL from '../config/api';

// ─── localStorage keys ────────────────────────────────────────────────────────
const SESSION_KEY     = 'pg_session';      // {token, userRole, userId, userName, email}
const CREDENTIALS_KEY = 'pg_credentials'; // {email, passwordHash} — for offline login
const REMEMBER_KEY    = 'pg_remember_email';

// ─── SHA-256 hash using browser Web Crypto API ────────────────────────────────
async function sha256(text) {
  try {
    const encoder = new TextEncoder();
    const data    = encoder.encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback if Web Crypto not available (very old browsers)
    return null;
  }
}

// ─── Session helpers ──────────────────────────────────────────────────────────
function saveSession(data) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Save hashed credentials for offline login
async function saveCredentials(email, password) {
  try {
    const hash = await sha256(password);
    if (hash) {
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ email, passwordHash: hash }));
    }
  } catch {}
}

// Check entered credentials against stored hash
async function checkOfflineCredentials(email, password) {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return false;
    const stored = JSON.parse(raw);
    if (stored.email !== email) return false;
    const hash = await sha256(password);
    return hash && hash === stored.passwordHash;
  } catch { return false; }
}

// Apply a session object to all individual keys (used by other pages)
function applySessionToLocalStorage(session) {
  localStorage.setItem('token',     session.token);
  localStorage.setItem('userRole',  session.userRole);
  localStorage.setItem('userId',    session.userId  || '');
  if (session.userName) localStorage.setItem('userName',  session.userName);
  if (session.email)    localStorage.setItem('userEmail', session.email);
}

// ─── Network fetch with timeout ───────────────────────────────────────────────
async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('__NETWORK_ERROR__');
    throw new Error('__NETWORK_ERROR__');
  }
}

async function loginRequest(email, password) {
  // One attempt with 10 s timeout (don't retry — fall through to offline faster)
  return fetchWithTimeout(
    `${API_BASE_URL}/api/auth/login`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    },
    10000
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── AUTO-REDIRECT: if already logged in with a cached session ──
  useEffect(() => {
    const session  = loadSession();
    const oldToken = localStorage.getItem('token');
    const oldRole  = localStorage.getItem('userRole');

    const token = session?.token || oldToken;
    const role  = session?.userRole || oldRole;

    if (token && role) {
      if (role === 'owner') navigate('/owner-dashboard', { replace: true });
      else navigate('/', { replace: true });
    }
  }, []);

  const savedEmail = localStorage.getItem(REMEMBER_KEY) || '';

  const [formData, setFormData]     = useState({ email: savedEmail, password: '' });
  const [rememberMe, setRememberMe] = useState(!!savedEmail);
  const [error, setError]           = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [offlineMode, setOfflineMode] = useState(false); // shows "offline login" indicator
  const [successPopupMessage, setSuccessPopupMessage] = useState('');

  useEffect(() => {
    if (location.state?.message) {
      setSuccessPopupMessage(location.state.message);
      navigate('.', { replace: true, state: {} });
    }
  }, [location, navigate]);

  const { email, password } = formData;
  const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccessPopupMessage('');
    setOfflineMode(false);
    setIsLoading(true);

    // ── STEP 1: Try online login ──────────────────────────────────────────────
    let onlineSuccess = false;
    try {
      const res  = await loginRequest(email, password);
      const data = await res.json();

      if (res.ok && data.user?.accountType) {
        // ✅ Online login succeeded
        onlineSuccess = true;

        const session = {
          token:    data.token,
          userRole: data.user.accountType,
          userId:   data.user.id,
          userName: data.user.fullName || '',
          email,
        };

        // Save full session
        saveSession(session);
        applySessionToLocalStorage(session);

        // Save hashed credentials for future offline login
        await saveCredentials(email, password);

        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, email);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }

        if (session.userRole === 'owner') navigate('/owner-dashboard');
        else navigate('/');
        return;

      } else if (!res.ok) {
        // Server responded but with an error (wrong password, user not found, etc.)
        // Do NOT fall through to offline — the server explicitly rejected the credentials
        throw new Error(data.msg || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      if (!err.message?.includes('__NETWORK_ERROR__') && !onlineSuccess) {
        // Server actually responded with an error → show it, don't try offline
        if (
          !err.message?.includes('__NETWORK_ERROR__') &&
          !err.message?.includes('Failed to fetch') &&
          !err.message?.includes('NetworkError')
        ) {
          setError(err.message);
          setIsLoading(false);
          return;
        }
      }
      // Network/timeout error → fall through to offline check below
    }

    // ── STEP 2: Offline fallback — backend unreachable ────────────────────────
    if (!onlineSuccess) {
      // Try pg_session first, then reconstruct from individual keys as fallback
      let session = loadSession();

      if (!session) {
        // Try reconstructing session from individual localStorage keys
        // (these persist even after pg_session is cleared by an old logout path)
        const token    = localStorage.getItem('token');
        const userRole = localStorage.getItem('userRole');
        const userId   = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        const userEmail = localStorage.getItem('userEmail');

        if (token && userRole) {
          session = { token, userRole, userId, userName, email: userEmail || '' };
        }
      }

      if (!session) {
        // Truly no cached session at all — first time user, can't login offline
        setError('Cannot connect to server and no saved login found. Please check your internet connection and try again.');
        setIsLoading(false);
        return;
      }

      // Verify entered credentials against stored hash
      const credentialsMatch = await checkOfflineCredentials(email, password);

      if (credentialsMatch) {
        // ✅ Offline login succeeded
        setOfflineMode(true);

        // Re-save full session and apply all keys (in case pg_session was missing)
        const restoredSession = { ...session, email };
        saveSession(restoredSession);
        applySessionToLocalStorage(restoredSession);

        if (rememberMe) localStorage.setItem(REMEMBER_KEY, email);

        // Small delay to let user see the "offline mode" indicator
        setTimeout(() => {
          if (restoredSession.userRole === 'owner') navigate('/owner-dashboard');
          else navigate('/');
        }, 600);
        return;
      }

      // Check if the stored credentials belong to a different email
      const storedCredRaw = localStorage.getItem('pg_credentials');
      const storedCred = storedCredRaw ? JSON.parse(storedCredRaw) : null;

      if (!storedCred) {
        setError('Cannot connect to server. No saved credentials found. Please log in online at least once to enable offline access.');
      } else if (storedCred.email !== email) {
        setError('Cannot connect to server. No offline credentials found for this email.');
      } else {
        setError('Cannot connect to server. The password you entered does not match your saved credentials.');
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-page">

      {/* Navbar */}
      <nav className="auth-navbar">
        <Link to="/" className="auth-navbar-logo">
          <PGLogo size={32} />
        </Link>
        <div className="auth-navbar-links">
          <Link to="/signup" className="hp-btn hp-btn--outline-red" style={{padding:'0.45rem 1.1rem',fontSize:'0.85rem',borderRadius:'6px',fontFamily:'Inter,sans-serif',fontWeight:600,display:'inline-flex',alignItems:'center',textDecoration:'none',border:'2px solid #e53528',color:'#e53528',background:'transparent',cursor:'pointer',transition:'all 0.22s'}}>
            Register
          </Link>
        </div>
      </nav>

      {/* Body */}
      <div className="auth-body">

        {/* Left panel */}
        <div className="auth-left">
          <div className="auth-left-overlay" />
          <div className="auth-left-content">
            <h2 className="auth-left-title">
              Find Your Perfect<br /><span>PG Accommodation</span>
            </h2>
            <p className="auth-left-sub">
              Join thousands of students and professionals who found their ideal PG through our platform.
            </p>
            <div className="auth-left-features">
              <div className="auth-left-feature">
                <div className="auth-left-feature-icon">📍</div>
                <span>2,500+ verified PGs across India</span>
              </div>
              <div className="auth-left-feature">
                <div className="auth-left-feature-icon">⭐</div>
                <span>Rated 4.8/5 by 12,000+ tenants</span>
              </div>
              <div className="auth-left-feature">
                <div className="auth-left-feature-icon">💰</div>
                <span>Affordable prices, no hidden charges</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel – form */}
        <div className="auth-right">
          <div className="auth-form-wrap">
            <div className="auth-form-badge">🔐 Secure Login</div>
            <h1 className="auth-form-title">Welcome Back!</h1>
            <p className="auth-form-sub">Sign in to your account to continue</p>

            {/* Offline mode notice */}
            {offlineMode && (
              <p className="success-message" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }}>
                📡 Logging in offline using saved credentials…
              </p>
            )}

            {successPopupMessage && <p className="success-message">{successPopupMessage}</p>}
            {error && <p className="error-message">{error}</p>}

            <form onSubmit={onSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-group">
                  <FiMail className="input-icon" />
                  <input id="email" name="email" type="email" placeholder="Enter your email"
                    value={email} onChange={onChange} required />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-group">
                  <FiLock className="input-icon" />
                  <input id="password" name="password" type="password" placeholder="Enter your password"
                    value={password} onChange={onChange} required />
                </div>
              </div>
              <div className="form-options">
                <label className="checkbox-group" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
              </div>
              <button type="submit" className="auth-button" disabled={isLoading}>
                {isLoading ? <div className="loader" /> : 'Sign In'}
              </button>
            </form>

            <p className="auth-footer">
              Don't have an account? <Link to="/signup">Create one free</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Login;