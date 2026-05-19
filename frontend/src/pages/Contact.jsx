import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiPhone, FiMapPin, FiSend } from 'react-icons/fi';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import PGLogo from '../components/PGLogo';
import API_BASE_URL from '../config/api';
import '../style/Contact.css';
import '../style/HomePage.css';

// Fix for Leaflet default marker icon in React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function Contact() {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [listings, setListings] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Contact Form State
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);

    // Check auth (identical to Home page)
    const token = localStorage.getItem('token');
    const userName = localStorage.getItem('userName');
    if (token && userName) {
      setUser({ name: userName, initial: userName.charAt(0).toUpperCase() });
    }

    // Fetch vacant listings
    const fetchListings = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/listings?vacant=true`);
        setListings(res.data);
      } catch (err) {
        console.error('Error fetching listings:', err);
      }
    };
    fetchListings();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const onContactChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onContactSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', subject: '', message: '' });
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('pg_session');
    setUser(null);
    setShowDropdown(false);
  };

  return (
    <div className="contact-root">
      {/* ── Navbar (Identical to Home) ── */}
      <nav className={`hp-nav ${scrolled ? 'hp-nav--scrolled' : ''}`}>
        <div className="hp-nav-inner">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <PGLogo size={38} />
          </Link>
          <ul className="hp-nav-menu">
            <li><Link to="/" className="hp-nav-link">Home</Link></li>
            <li><Link to="/map" className="hp-nav-link">Explore Map</Link></li>
            <li><Link to="/listings" className="hp-nav-link">PG Listings</Link></li>
            <li><Link to="/about" className="hp-nav-link">About Us</Link></li>
            <li><Link to="/contact" className="hp-nav-link hp-nav-link--active">Contact Us</Link></li>
          </ul>
          <div className="hp-nav-actions">
            {user ? (
              <div className="hp-user-menu">
                <div className="hp-user-avatar" onClick={() => setShowDropdown(!showDropdown)}>
                  {user.initial}
                </div>
                {showDropdown && (
                  <div className="hp-dropdown-menu">
                    <div className="hp-dropdown-header">Hi, {user.name}</div>
                    <button className="hp-dropdown-item hp-text-red" onClick={handleLogout}>Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login"  className="hp-btn hp-btn--outline-red">Login</Link>
                <Link to="/signup" className="hp-btn hp-btn--red">Register</Link>
              </>
            )}
          </div>
          {/* Mobile nav toggle — user avatar */}
          <button
            className={`hp-mobile-toggle ${!user ? 'hp-mobile-toggle--guest' : ''}`}
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {user ? user.initial : (
              <svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
            )}
          </button>
        </div>
      </nav>

      {/* ── Mobile Drawer ── */}
      <div className={`hp-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) setMobileMenuOpen(false); }}
      >
        <div className="hp-mobile-drawer-inner">
          <Link to="/"        className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>🏠 Home</Link>
          <Link to="/map"      className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>🗺️ Explore Map</Link>
          <Link to="/listings" className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>📋 PG Listings</Link>
          <Link to="/about"    className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>ℹ️ About Us</Link>
          <Link to="/contact"  className="hp-mobile-nav-link hp-mobile-nav-link--active" onClick={() => setMobileMenuOpen(false)}>📬 Contact Us</Link>
          <div className="hp-mobile-nav-actions">
            {user ? (
              <button className="hp-btn hp-btn--red" style={{ width: '100%' }} onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>Log out</button>
            ) : (
              <>
                <Link to="/login"  className="hp-btn hp-btn--outline-red" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                <Link to="/signup" className="hp-btn hp-btn--red" onClick={() => setMobileMenuOpen(false)}>Register</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="contact-container" style={{ marginTop: 'calc(clamp(64px, 10vw, 80px) + env(safe-area-inset-top, 0px))' }}>
        <div className="contact-header">
          <h1 className="contact-title">Get in <span className="text-red">Touch</span></h1>
          <p className="contact-sub">Have questions or feedback? We'd love to hear from you!</p>
        </div>

        <div className="contact-split">
          {/* Left: Form */}
          <div className="contact-form-card">
            {submitted && (
              <div className="contact-success">
                <FiSend />
                <span>Message sent successfully! We'll get back to you soon.</span>
              </div>
            )}
            <form onSubmit={onContactSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" name="name" value={formData.name} onChange={onContactChange} placeholder="Your name" required />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={onContactChange} placeholder="Your email" required />
                </div>
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input type="text" name="subject" value={formData.subject} onChange={onContactChange} placeholder="How can we help?" required />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea name="message" value={formData.message} onChange={onContactChange} placeholder="Tell us more about your inquiry..." rows="5" required />
              </div>
              <button type="submit" className="hp-btn hp-btn--red contact-submit">
                <FiSend style={{ marginRight: '8px' }} /> Send Message
              </button>
            </form>
          </div>

          {/* Right: Info */}
          <div className="contact-info-panel">
            <div className="info-card">
              <div className="info-icon"><FiMail /></div>
              <div className="info-text">
                <h3>Email Us</h3>
                <p>support@pglodge.com</p>
                <p>listings@pglodge.com</p>
              </div>
            </div>
            <div className="info-card">
              <div className="info-icon"><FiPhone /></div>
              <div className="info-text">
                <h3>Call Us</h3>
                <p>+91 98765 43210</p>
                <p>Mon - Sat (9:00 AM - 6:00 PM)</p>
              </div>
            </div>
            <div className="info-card">
              <div className="info-icon"><FiMapPin /></div>
              <div className="info-text">
                <h3>Our Office</h3>
                <p>123, Tech Tower, Hitech City</p>
                <p>Hyderabad, Telangana, 500081</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}

      {/* Footer */}
      <footer className="contact-footer">
        <div className="footer-inner">
          <PGLogo size={34} />
          <p>© {new Date().getFullYear()} PG Lodge Locator. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
