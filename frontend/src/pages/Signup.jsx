import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiHome } from 'react-icons/fi';
import '../style/Auth.css';

function Signup() {
  const [formData, setFormData] = useState({
    fullName: '', email: '', accountType: 'user', password: '', confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { fullName, email, accountType, password, confirmPassword } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async e => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:4000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, accountType, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.msg || 'Something went wrong');
      }
      // This sends the success message to the login page
      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create Account</h2>
        <p className="auth-subtitle">Join us and get started today</p>
        
        {error && <p className="error-message">{error}</p>}
        
        <form onSubmit={onSubmit}>
          {/* ... all your form groups ... */}
          <div className="form-group">
            <label htmlFor="fullname">Full Name</label>
            <div className="input-group">
              <FiUser className="input-icon" />
              <input id="fullname" name="fullName" value={fullName} onChange={onChange} type="text" placeholder="Enter your full name" required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-group">
              <FiMail className="input-icon" />
              <input id="email" name="email" value={email} onChange={onChange} type="email" placeholder="Enter your email" required />
            </div>
          </div>
          <div className="form-group">
            <label>Account Type</label>
            <div className="account-type-group">
              <label className="account-type-card">
                <input type="radio" name="accountType" value="user" checked={accountType === 'user'} onChange={onChange} />
                <div className="card-content">
                  <FiUser size={24} />
                  <strong>User</strong>
                  <small>Looking for properties</small>
                </div>
              </label>
              <label className="account-type-card">
                <input type="radio" name="accountType" value="owner" checked={accountType === 'owner'} onChange={onChange} />
                <div className="card-content">
                  <FiHome size={24} />
                  <strong>Owner</strong>
                  <small>Renting out properties</small>
                </div>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-group">
              <FiLock className="input-icon" />
              <input id="password" name="password" value={password} onChange={onChange} type="password" placeholder="Create a password" required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <div className="input-group">
              <FiLock className="input-icon" />
              <input id="confirm-password" name="confirmPassword" value={confirmPassword} onChange={onChange} type="password" placeholder="Confirm your password" required />
            </div>
          </div>
          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? <div className="loader"></div> : 'Create account'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
export default Signup;