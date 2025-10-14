import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMail, FiLock } from 'react-icons/fi';
import '../style/Auth.css';

function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successPopupMessage, setSuccessPopupMessage] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  // This hook runs once when the page loads to handle the success message
  useEffect(() => {
    if (location.state?.message) {
      setSuccessPopupMessage(location.state.message);
      // This clears the message from history so it doesn't reappear
      navigate('.', { replace: true, state: {} });
    }
  }, [location, navigate]);

  const { email, password } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

const onSubmit = async e => {
  e.preventDefault();
  setError('');
  setSuccessPopupMessage('');
  setIsLoading(true);

  try {
    const res = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    // ✅ Handle failed responses cleanly
    if (!res.ok) {
      throw new Error(data.msg || 'Login failed. Please check your credentials.');
    }

    // ✅ Check if user object exists
    if (!data.user || !data.user.accountType) {
      throw new Error('Invalid response from server. Please try again.');
    }

    // ✅ Safe to access now
    localStorage.setItem('token', data.token);
    localStorage.setItem('userRole', data.user.accountType);

    // ✅ Redirect based on account type
    if (data.user.accountType === 'owner') {
      navigate('/owner-dashboard');
    } else {
      navigate('/user-dashboard');
    }

  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Welcome</h2>
        <p className="auth-subtitle">Sign in to your account to continue</p>
        
        {successPopupMessage && <p className="success-message">{successPopupMessage}</p>}
        {error && <p className="error-message">{error}</p>}
        
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-group">
              <FiMail className="input-icon" />
              <input 
                id="email" name="email" type="email" placeholder="Enter your email" 
                value={email} onChange={onChange} required 
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-group">
              <FiLock className="input-icon" />
              <input 
                id="password" name="password" type="password" placeholder="Enter your password"
                value={password} onChange={onChange} required 
              />
            </div>
          </div>
          <div className="form-options">
            <div className="checkbox-group">
              <input type="checkbox" id="remember-me" />
              <label htmlFor="remember-me">Remember me</label>
            </div>
            <Link to="/forgot-password" className="forgot-link">
              Forgot password?
            </Link>
          </div>
          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? <div className="loader"></div> : 'Sign in'}
          </button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;