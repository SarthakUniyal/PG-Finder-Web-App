import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiHome } from 'react-icons/fi';
import '../style/Auth.css';
import API_BASE_URL from '../config/api';
import PGLogo from '../components/PGLogo';

function Signup() {
  const [formData, setFormData] = useState({
    fullName: '', email: '', accountType: 'user', password: '', confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { fullName, email, accountType, password, confirmPassword } = formData;
  const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async e => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setIsLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, accountType, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || 'Something went wrong');
      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">

      {/* Navbar */}
      <nav className="auth-navbar">
        <Link to="/" className="auth-navbar-logo">
          <PGLogo size={32} />
        </Link>
        <div className="auth-navbar-links">
          <Link to="/login" style={{padding:'0.45rem 1.1rem',fontSize:'0.85rem',borderRadius:'6px',fontFamily:'Inter,sans-serif',fontWeight:600,display:'inline-flex',alignItems:'center',textDecoration:'none',border:'2px solid #e53528',color:'#e53528',background:'transparent',cursor:'pointer',transition:'all 0.22s'}}>
            Login
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
              Start Your PG<br /><span>Journey Today</span>
            </h2>
            <p className="auth-left-sub">
              Create a free account and get access to thousands of verified PGs across India.
            </p>
            <div className="auth-left-features">
              <div className="auth-left-feature">
                <div className="auth-left-feature-icon">🏠</div>
                <span>Browse 2,500+ verified PG listings</span>
              </div>
              <div className="auth-left-feature">
                <div className="auth-left-feature-icon">🔒</div>
                <span>Safe, secure and completely free</span>
              </div>
              <div className="auth-left-feature">
                <div className="auth-left-feature-icon">📞</div>
                <span>Direct contact with PG owners</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel – form */}
        <div className="auth-right">
          <div className="auth-form-wrap">
            <div className="auth-form-badge">🏡 Join PG Finder</div>
            <h1 className="auth-form-title">Create Account</h1>
            <p className="auth-form-sub">Join us and find your perfect PG today</p>

            {error && <p className="error-message">{error}</p>}

            <form onSubmit={onSubmit}>
              <div className="form-group">
                <label htmlFor="fullname">Full Name</label>
                <div className="input-group">
                  <FiUser className="input-icon" />
                  <input id="fullname" name="fullName" value={fullName} onChange={onChange}
                    type="text" placeholder="Enter your full name" required />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-group">
                  <FiMail className="input-icon" />
                  <input id="email" name="email" value={email} onChange={onChange}
                    type="email" placeholder="Enter your email" required />
                </div>
              </div>
              <div className="form-group">
                <label>Account Type</label>
                <div className="account-type-group">
                  <label className="account-type-card">
                    <input type="radio" name="accountType" value="user"
                      checked={accountType === 'user'} onChange={onChange} />
                    <div className="card-content">
                      <FiUser size={22} />
                      <strong>Tenant</strong>
                      <small>Looking for a PG</small>
                    </div>
                  </label>
                  <label className="account-type-card">
                    <input type="radio" name="accountType" value="owner"
                      checked={accountType === 'owner'} onChange={onChange} />
                    <div className="card-content">
                      <FiHome size={22} />
                      <strong>Owner</strong>
                      <small>Listing a PG</small>
                    </div>
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-group">
                  <FiLock className="input-icon" />
                  <input id="password" name="password" value={password} onChange={onChange}
                    type="password" placeholder="Create a password" required />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="confirm-password">Confirm Password</label>
                <div className="input-group">
                  <FiLock className="input-icon" />
                  <input id="confirm-password" name="confirmPassword" value={confirmPassword}
                    onChange={onChange} type="password" placeholder="Confirm your password" required />
                </div>
              </div>
              <button type="submit" className="auth-button" disabled={isLoading}>
                {isLoading ? <div className="loader" /> : 'Create Account'}
              </button>
            </form>

            <p className="auth-footer">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Signup;