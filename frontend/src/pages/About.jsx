import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiTarget, FiHeart, FiTrendingUp, FiUsers } from 'react-icons/fi';
import PGLogo from '../components/PGLogo';
import '../style/About.css';
import '../style/HomePage.css';

const teamMembers = [
  { id: 1, name: 'Sarah Johnson', role: 'Marketing Director', image: '/team_sarah.png' },
  { id: 2, name: 'Emily Smith',   role: 'Project Manager',   image: '/team_emily.png' },
  { id: 3, name: 'David Wilson',  role: 'CEO',               image: '/team_david.png' },
  { id: 4, name: 'James Brown',   role: 'Lead Developer',    image: '/team_james.png' },
];

export default function About() {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);

    const token = localStorage.getItem('token');
    const userName = localStorage.getItem('userName');
    if (token && userName) {
      setUser({ name: userName, initial: userName.charAt(0).toUpperCase() });
    }

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <div className="about-root">
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
            <li><Link to="/about" className="hp-nav-link hp-nav-link--active">About Us</Link></li>
            <li><Link to="/contact" className="hp-nav-link">Contact Us</Link></li>
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
          {/* Hamburger for mobile */}
          <button
            className={`hp-hamburger ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
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
          <Link to="/about"    className="hp-mobile-nav-link hp-mobile-nav-link--active" onClick={() => setMobileMenuOpen(false)}>ℹ️ About Us</Link>
          <Link to="/contact"  className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>📬 Contact Us</Link>
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

      {/* ── Hero ── */}
      <header className="about-hero">
        <div className="about-hero-overlay" />
        <div className="about-hero-content">
          <h1 className="about-hero-title">About Us</h1>
          <p className="about-hero-sub">Learn more about our story and mission.</p>
        </div>
      </header>

      {/* ── Who We Are ── */}
      <section className="about-section about-who">
        <div className="about-inner about-split">
          <div className="about-text-panel">
            <h2 className="about-section-title">Who We Are</h2>
            <div className="about-underline" />
            <p>We are a <strong className="text-red">passionate team dedicated</strong> to providing exceptional solutions and services for finding the perfect PG accommodations across the country.</p>
            <p>With years of experience in the industry, we strive to achieve excellence in everything we do, ensuring that every tenant finds a safe and comfortable home away from home.</p>
            <p>Our goal is to make a <strong className="text-red">positive impact</strong> and build lasting relationships with our clients and PG owners alike.</p>
          </div>
          <div className="about-image-panel">
            <img src="/about_team_working.png" alt="Our Team Working" className="about-img" />
          </div>
        </div>
      </section>

      {/* ── Mission & Story ── */}
      <section className="about-section about-dual">
        <div className="about-inner about-grid-2">
          {/* Mission */}
          <div className="about-card-split">
            <div className="about-card-text">
              <h2 className="about-section-title">Our Mission</h2>
              <div className="about-underline" />
              <p>Our mission is to deliver <strong className="text-navy">innovative and effective</strong> solutions that help our clients succeed in finding and listing quality accommodations.</p>
              <p>We are committed to <strong className="text-navy">quality, integrity,</strong> and customer satisfaction above all else.</p>
              <p>We believe in making a <strong className="text-navy">difference</strong> and helping businesses reach their full potential.</p>
            </div>
            <div className="about-card-icon-box">
              <img src="https://cdn-icons-png.flaticon.com/512/942/942799.png" alt="Mission Icon" style={{width:'100px',opacity:0.8}} />
            </div>
          </div>
          {/* Story */}
          <div className="about-card-text">
            <h2 className="about-section-title">Our Story</h2>
            <div className="about-underline" />
            <p>Founded in <strong className="text-navy">2020</strong>, we started with a vision to create something unique in the rental industry, simplifying the tedious process of finding a room.</p>
            <p>Over the years, we have grown and evolved, thanks to our dedicated team and <strong className="text-navy">loyal clients</strong> who trust us every day.</p>
            <p>We continue to expand and <strong className="text-navy">innovate</strong>, always looking forward to the future.</p>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="about-section about-values">
        <div className="about-inner about-split">
          <div className="about-text-panel">
            <h2 className="about-section-title">Our Values</h2>
            <div className="about-underline" style={{marginBottom: '2rem'}} />
            <div className="value-item">
              <div className="value-icon"><FiTrendingUp /></div>
              <span>Integrity &amp; Trust</span>
            </div>
            <div className="value-item">
              <div className="value-icon"><FiHeart /></div>
              <span>Customer Focus</span>
            </div>
            <div className="value-item">
              <div className="value-icon"><FiTarget /></div>
              <span>Innovation</span>
            </div>
            <div className="value-item">
              <div className="value-icon"><FiUsers /></div>
              <span>Teamwork</span>
            </div>
          </div>
          <div className="about-image-panel">
            <img src="/about_values_notes.png" alt="Values" className="about-img" />
          </div>
        </div>
      </section>

      {/* ── Meet Our Team ── */}
      <section className="about-section about-team">
        <div className="about-inner">
          <div className="about-header-center">
            <h2 className="about-section-title">Meet Our Team</h2>
            <div className="about-underline about-underline--center" />
            <p className="about-header-sub">Get to know the talented people behind our success.</p>
          </div>
          <div className="team-grid">
            {teamMembers.map(member => (
              <div key={member.id} className="team-card">
                <div className="team-img-wrap">
                  <img src={member.image} alt={member.name} className="team-img" />
                </div>
                <div className="team-info">
                  <h3 className="team-name">{member.name}</h3>
                  <p className="team-role">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-brand">
            <div className="hp-footer-logo-wrap">
              <PGLogo size={34} />
            </div>
            <p style={{ marginTop: '0.8rem' }}>Your trusted platform for PG accommodation across India.</p>
          </div>
          <div className="hp-footer-col">
            <div className="hp-footer-col-title">Quick Links</div>
            <Link to="/"       className="hp-footer-link">Home</Link>
            <Link to="/login"  className="hp-footer-link">PG Listings</Link>
            <Link to="/about"  className="hp-footer-link">About Us</Link>
          </div>
          <div className="hp-footer-col">
            <div className="hp-footer-col-title">Support</div>
            <Link to="/contact" className="hp-footer-link">Contact Us</Link>
            <a href="#" className="hp-footer-link">Privacy Policy</a>
            <a href="#" className="hp-footer-link">Terms of Service</a>
          </div>
          <div className="hp-footer-col">
            <div className="hp-footer-col-title">For Owners</div>
            <Link to="/login"  className="hp-footer-link">List Your PG</Link>
            <Link to="/signup" className="hp-footer-link">Register</Link>
          </div>
        </div>
        <div className="hp-footer-bottom">
          © {new Date().getFullYear()} PG Lodge Locator. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
