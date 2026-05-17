import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import '../style/HomePage.css';
import PGLogo from '../components/PGLogo';
import SmartImage from '../components/SmartImage';
import { isOnline } from '../utils/offlineManager';

// ── Cache helpers ─────────────────────────────────────────────────────────────
// Versioned key — bump to force a cache bust when data shape changes
const LS_HOME_KEY = 'hp_all_listings_v1';

function readHomeCache() {
  try {
    const raw = localStorage.getItem(LS_HOME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return null;
}

function writeHomeCache(data) {
  try { localStorage.setItem(LS_HOME_KEY, JSON.stringify(data)); } catch {}
}

/* ─── Parse price string like "₹8,500/mo" → number 8500 ─── */
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const num = priceStr.replace(/[^\d]/g, '');
  return parseInt(num, 10) || 0;
}

/* ─── Check if a listing's price falls within the selected range ─── */
function inPriceRange(priceStr, range) {
  if (!range) return true;
  const p = parsePrice(priceStr);
  if (range === '0-5000')       return p <= 5000;
  if (range === '5000-10000')   return p > 5000  && p <= 10000;
  if (range === '10000-15000')  return p > 10000 && p <= 15000;
  if (range === '15000+')       return p > 15000;
  return true;
}

/* ─── Image gallery sub-component (mirrors PGListings modal) ─── */
function ModalGallery({ listing }) {
  const images =
    listing.images && listing.images.length > 0
      ? listing.images
      : listing.image
      ? [listing.image]
      : ['/pg_card_1.png'];
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div className="hp-modal-gallery">
      <div className="hp-modal-img-wrap-main">
        <img src={images[activeIdx]} alt={listing.title} className="hp-modal-img-main" />
      </div>
      {images.length > 1 && (
        <div className="hp-modal-img-thumbs">
          <div className="hp-modal-img-thumbs-track">
            {images.map((img, idx) => (
              <div
                key={idx}
                className={`hp-modal-img-thumb-wrap${activeIdx === idx ? ' active' : ''}`}
                onClick={() => setActiveIdx(idx)}
              >
                <img src={img} alt={`Thumb ${idx + 1}`} className="hp-modal-img-thumb" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Star rating ─── */
function StarRating({ count, total = 5 }) {
  return (
    <div className="stars">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < count ? 'star star--filled' : 'star star--empty'}>★</span>
      ))}
    </div>
  );
}

const testimonials = [
  { id: 1, avatar: '/testimonial_1.png', name: 'Rohit Sharma', stars: 4,
    quote: '"Found a perfect PG in just a few clicks! Highly recommend PG Room Finder."' },
  { id: 2, avatar: '/testimonial_2.png', name: 'Priya Mehta', stars: 5,
    quote: '"Great experience! Safe and comfortable PG with all amenities."' },
];

export default function Home() {
  const [scrolled, setScrolled]           = useState(false);
  const [city,     setCity]               = useState('');
  const [gender,   setGender]             = useState('');
  const [price,    setPrice]              = useState('');
  const [user,     setUser]               = useState(null);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [online,   setOnline]             = useState(isOnline());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Listings: lazy-init from localStorage so UI renders instantly ──
  const cached = readHomeCache();
  const [allListings, setAllListings] = useState(() => cached || []);
  const [loadingPGs,  setLoadingPGs]  = useState(() => !cached); // no spinner when cache exists

  // ── Search state ──
  const [searched,        setSearched]        = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  useEffect(() => {
    const onScroll      = () => setScrolled(window.scrollY > 10);
    const handleOnline  = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('scroll', onScroll);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    const token    = localStorage.getItem('token');
    const userName = localStorage.getItem('userName');
    const userRole = localStorage.getItem('userRole');
    if (token && userName) {
      setUser({ name: userName, initial: userName.charAt(0).toUpperCase(), role: userRole });
    }

    // ── Offline-first fetch ──────────────────────────────────────────────
    // If localStorage had data, loadingPGs is already false → UI shows cache
    // immediately. This fetch runs in background and refreshes silently.
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    fetch('http://localhost:4000/api/listings?vacant=true', { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !Array.isArray(data)) return;
        setAllListings(data);
        writeHomeCache(data);   // ← persist for next visit / offline use
      })
      .catch(() => {
        // Network failed or timed out — keep showing cached data, nothing to do
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoadingPGs(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
      window.removeEventListener('scroll',  onScroll);
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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

  // ── Derived filtered list ──
  const filteredListings = useMemo(() => {
    return allListings.filter(pg => {
      const cityMatch   = !city.trim() ||
        (pg.city   || '').toLowerCase().includes(city.trim().toLowerCase()) ||
        (pg.area   || '').toLowerCase().includes(city.trim().toLowerCase()) ||
        (pg.location || '').toLowerCase().includes(city.trim().toLowerCase());
      const genderMatch = !gender || pg.pgType === gender;
      const priceMatch  = inPriceRange(pg.price, price);
      return cityMatch && genderMatch && priceMatch;
    });
  }, [allListings, city, gender, price]);

  // ── On search button click: mark as searched and scroll down ──
  const handleSearch = () => {
    setSearched(true);
    setTimeout(() => {
      document.getElementById('hp-results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Allow Enter key in city input
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };

  // All listings shown in the Featured section
  const featuredListings = allListings;

  return (
    <div className="hp-root">

      {/* ── Offline Banner ── */}
      {!online && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#fef3c7', color: '#92400e',
          borderBottom: '1px solid #fde68a',
          padding: '8px 20px', fontSize: '0.82rem', fontWeight: 600,
        }}>
          <span>📡</span>
          <span>You're offline — showing cached listings. New data will load when you reconnect.</span>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav className={`hp-nav ${scrolled ? 'hp-nav--scrolled' : ''}`}>
        <div className="hp-nav-inner">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <PGLogo size={38} />
          </Link>
          <ul className="hp-nav-menu">
            <li><a href="#" className="hp-nav-link hp-nav-link--active">Home</a></li>
            <li><Link to="/map"      className="hp-nav-link">Explore Map</Link></li>
            <li><Link to="/listings" className="hp-nav-link">PG Listings</Link></li>
            <li><Link to="/about"    className="hp-nav-link">About Us</Link></li>
            <li><Link to="/contact"  className="hp-nav-link">Contact Us</Link></li>
          </ul>
          <div className="hp-nav-actions">
            {user ? (
              user.role === 'owner' ? (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <Link to="/owner-dashboard" className="hp-btn hp-btn--outline-red">Dashboard</Link>
                  <button className="hp-btn hp-btn--red" onClick={handleLogout}>Log out</button>
                </div>
              ) : (
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
              )
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
          <Link to="/"        className="hp-mobile-nav-link hp-mobile-nav-link--active" onClick={() => setMobileMenuOpen(false)}>🏠 Home</Link>
          <Link to="/map"      className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>🗺️ Explore Map</Link>
          <Link to="/listings" className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>📋 PG Listings</Link>
          <Link to="/about"    className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>ℹ️ About Us</Link>
          <Link to="/contact"  className="hp-mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>📬 Contact Us</Link>
          <div className="hp-mobile-nav-actions">
            {user ? (
              user.role === 'owner' ? (
                <>
                  <Link to="/owner-dashboard" className="hp-btn hp-btn--outline-red" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                  <button className="hp-btn hp-btn--red" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>Log out</button>
                </>
              ) : (
                <button className="hp-btn hp-btn--red" style={{ width: '100%' }} onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>Log out</button>
              )
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
      <section className="hp-hero">
        <div className="hp-hero-overlay" />
        <div className="hp-hero-content">
          <h1 className="hp-hero-title">
            Find Your Perfect <span className="hp-hero-accent">PG Accommodation</span>
          </h1>
          <p className="hp-hero-sub">Discover the best PGs in your city with ease!</p>
          <div className="hp-search-box">
            <input
              className="hp-search-input"
              type="text"
              placeholder="Enter City or Location"
              value={city}
              onChange={e => setCity(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="hp-search-divider" />
            <select className="hp-search-select" value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">Select Gender</option>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="co-ed">Co-Ed</option>
            </select>
            <div className="hp-search-divider" />
            <select className="hp-search-select" value={price} onChange={e => setPrice(e.target.value)}>
              <option value="">Any Price</option>
              <option value="0-5000">Under ₹ 5,000</option>
              <option value="5000-10000">₹ 5,000 – ₹ 10,000</option>
              <option value="10000-15000">₹ 10,000 – ₹ 15,000</option>
              <option value="15000+">Above ₹ 15,000</option>
            </select>
            <button className="hp-btn hp-btn--red hp-search-btn" onClick={handleSearch}>
              Search PG
            </button>
          </div>
        </div>
      </section>

      {/* ── Features Bar ── */}
      <section className="hp-features-bar">
        <div className="hp-feature-bar-item">
          <span className="hp-feature-bar-icon">📍</span>
          <span className="hp-feature-bar-label">Search by Location</span>
        </div>
        <div className="hp-feature-bar-sep" />
        <div className="hp-feature-bar-item">
          <span className="hp-feature-bar-icon">🛏️</span>
          <span className="hp-feature-bar-label">Verified Listings</span>
        </div>
        <div className="hp-feature-bar-sep" />
        <div className="hp-feature-bar-item">
          <span className="hp-feature-bar-icon">❤️</span>
          <span className="hp-feature-bar-label">Affordable Prices</span>
        </div>
      </section>

      {/* ── Search Results (shown only after Search is clicked) ── */}
      {searched && (
        <section id="hp-results-section" className="hp-featured">
          <div className="hp-featured-inner">
            <div className="hp-section-row">
              <div>
                <h2 className="hp-section-heading">Search Results</h2>
                <p className="hp-section-sub">
                  {filteredListings.length > 0
                    ? `${filteredListings.length} PG${filteredListings.length > 1 ? 's' : ''} found`
                    : 'No PGs match your filters'}
                </p>
              </div>
              <button
                className="hp-btn hp-btn--outline-red"
                style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}
                onClick={() => { setSearched(false); setCity(''); setGender(''); setPrice(''); }}
              >
                Clear Search
              </button>
            </div>

            {filteredListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '1rem' }}>
                😕 No PGs found matching your criteria. Try adjusting your filters.
              </div>
            ) : (
              <div className="hp-pg-grid" style={{ gap: '2rem' }}>
                {filteredListings.map(pg => (
                  <PGCard key={pg._id} pg={pg} onView={setSelectedListing} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Featured PGs (from DB, shown when not searching) ── */}
      {!searched && (
        <section className="hp-featured">
          <div className="hp-featured-inner">
            <div className="hp-section-row">
              <div>
                <h2 className="hp-section-heading">Top Featured PGs</h2>
                <p className="hp-section-sub">Best PGs handpicked for you</p>
              </div>
              <Link to="/listings" className="hp-btn hp-btn--red hp-view-all">View All ▶</Link>
            </div>

            {loadingPGs ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <div className="hp-spinner" style={{ margin: '0 auto 1rem' }} />
                Loading PGs…
              </div>
            ) : featuredListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                No listings available yet.
              </div>
            ) : (
              <div className="hp-pg-grid" style={{ gap: '2rem' }}>
                {featuredListings.map(pg => (
                  <PGCard key={pg._id} pg={pg} onView={setSelectedListing} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── How It Works ── */}
      <section className="hp-how">
        <div className="hp-how-inner">
          <div className="hp-section-row">
            <div><h2 className="hp-section-heading">How It Works</h2></div>
            <span className="hp-how-sub">Easy steps to find your PG</span>
          </div>
          <div className="hp-steps-row">
            <div className="hp-step-card">
              <div className="hp-step-num">1</div>
              <div className="hp-step-body">
                <div className="hp-step-title">Search PGs</div>
                <div className="hp-step-desc">Enter your location &amp; preferences</div>
              </div>
            </div>
            <div className="hp-step-arrow">›</div>
            <div className="hp-step-card">
              <div className="hp-step-num">2</div>
              <div className="hp-step-body">
                <div className="hp-step-title">Visit &amp; Compare</div>
                <div className="hp-step-desc">Schedule visits and compare options</div>
              </div>
            </div>
            <div className="hp-step-arrow">›</div>
            <div className="hp-step-card">
              <div className="hp-step-num">3</div>
              <div className="hp-step-body">
                <div className="hp-step-title">Book Your PG</div>
                <div className="hp-step-desc">Book your PG easily online</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="hp-testimonials">
        <div className="hp-test-inner">
          <h2 className="hp-test-title">What Our Users Say</h2>
          <p className="hp-test-sub">Testimonials from our happy tenants</p>
          <div className="hp-test-grid">
            {testimonials.map(t => (
              <div className="hp-test-card" key={t.id}>
                <div className="hp-test-top">
                  <img src={t.avatar} alt={t.name} className="hp-test-avatar" />
                  <StarRating count={t.stars} />
                </div>
                <p className="hp-test-quote">{t.quote}</p>
                <div className="hp-test-footer">
                  <span className="hp-test-name">{t.name}</span>
                  <StarRating count={t.stars} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="hp-cta-banner">
        <h2 className="hp-cta-title">Find Your Ideal PG Today!</h2>
        <Link to="/signup" className="hp-btn hp-btn--red hp-btn--lg">Get Started</Link>
      </section>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-brand">
            <div className="hp-footer-logo-wrap"><PGLogo size={34} /></div>
            <p style={{ marginTop: '0.8rem' }}>Your trusted platform for PG accommodation across India.</p>
          </div>
          <div className="hp-footer-col">
            <div className="hp-footer-col-title">Quick Links</div>
            <Link to="/"         className="hp-footer-link">Home</Link>
            <Link to="/listings" className="hp-footer-link">PG Listings</Link>
            <Link to="/about"    className="hp-footer-link">About Us</Link>
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
          © {new Date().getFullYear()} PG Finder. All rights reserved.
        </div>
      </footer>

      {/* ── Property Details Modal ── */}
      {selectedListing && (
        <div className="hp-modal-overlay" onClick={() => setSelectedListing(null)}>
          <div className="hp-modal-content hp-modal-content--details" onClick={e => e.stopPropagation()}>
            <div className="hp-modal-header">
              <h2>Property Details</h2>
              <button className="hp-modal-close-icon" onClick={() => setSelectedListing(null)}>✕</button>
            </div>
            <div className="hp-modal-body">
              <ModalGallery listing={selectedListing} />
              <div className="hp-modal-info-grid">
                {/* LEFT */}
                <div className="hp-modal-info-main">
                  <h1 className="hp-modal-detail-title">{selectedListing.title}</h1>
                  <div className="hp-modal-detail-price-row">
                    <span className="hp-modal-detail-price">{selectedListing.price}</span>
                    <span className="hp-modal-detail-separator">|</span>
                    <span className={`hp-modal-pgtype-badge hp-modal-pgtype-badge--${selectedListing.pgType || 'co-ed'}`}>
                      {selectedListing.pgType === 'boys' ? '👦 Boys Only'
                        : selectedListing.pgType === 'girls' ? '👧 Girls Only'
                        : '👥 Co-ed'}
                    </span>
                  </div>
                  {selectedListing.amenities &&
                    (selectedListing.amenities.wifi || selectedListing.amenities.ac ||
                     selectedListing.amenities.food || selectedListing.amenities.cctv) && (
                    <>
                      <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe" style={{ marginTop: '1.5rem' }}>Amenities</h3>
                      <div className="hp-amenity-pill-grid">
                        {selectedListing.amenities.wifi && <div className="hp-amenity-pill"><span className="hp-amenity-pill-icon">📶</span> WiFi</div>}
                        {selectedListing.amenities.ac   && <div className="hp-amenity-pill"><span className="hp-amenity-pill-icon">❄️</span> AC</div>}
                        {selectedListing.amenities.food && <div className="hp-amenity-pill"><span className="hp-amenity-pill-icon">🥘</span> Food</div>}
                        {selectedListing.amenities.cctv && <div className="hp-amenity-pill"><span className="hp-amenity-pill-icon">📷</span> CCTV</div>}
                      </div>
                    </>
                  )}
                  <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe" style={{ marginTop: '1.5rem' }}>Description</h3>
                  <p className="hp-modal-text">
                    {selectedListing.description || 'No description provided. Please contact the owner for more details.'}
                  </p>
                </div>
                {/* RIGHT */}
                <div className="hp-modal-info-sidebar">
                  {selectedListing.rooms && selectedListing.rooms.length > 0 && (
                    <>
                      <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe">Room Options</h3>
                      <div className="hp-room-cards">
                        {selectedListing.rooms.map((room, idx) => (
                          <div key={idx} className="hp-room-card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.7rem 1rem' }}>
                            <span className="hp-room-type">{room.roomType === 'Apartment' ? '🏢 Apartment' : '🛏️ PG'}</span>
                            <span style={{ fontSize:'0.82rem', color:'#64748b', fontWeight:500 }}>
                              {room.roomType === 'Apartment' ? `${room.totalRooms} BHK` : `${room.totalRooms} ${room.totalRooms === 1 ? 'Room' : 'Rooms'} Available`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe" style={{ marginTop: selectedListing.rooms?.length ? '1.5rem' : '0' }}>Location Details</h3>
                  <div className="hp-modal-location-text">
                    {[
                      selectedListing.plotNumber ? `Plot ${selectedListing.plotNumber}` : '',
                      selectedListing.street,
                      selectedListing.area,
                      selectedListing.city ? `${selectedListing.city}${selectedListing.pinCode ? ` - ${selectedListing.pinCode}` : ''}` : '',
                    ].filter(Boolean).join(', ') || 'Location not provided'}
                  </div>
                  {selectedListing.landmark && (
                    <div style={{ marginTop:'0.5rem', fontSize:'0.85rem', color:'#64748b' }}>📍 Near {selectedListing.landmark}</div>
                  )}
                  <div style={{ marginTop: '2rem' }}>
                    <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe">Owner &amp; Contact</h3>
                    <div className="hp-modal-owner-card">
                      <div className="hp-modal-owner-row">
                        <div className="hp-modal-owner-avatar">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        </div>
                        <div>
                          <div style={{ fontSize:'0.75rem', color:'#94a3b8', fontWeight:500 }}>Managed by</div>
                          <div className="hp-modal-owner-name-text">{selectedListing.ownerName || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="hp-modal-contact-row">
                        <div className="hp-modal-contact-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="white">
                            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                          </svg>
                        </div>
                        <div className="hp-modal-contact-number">
                          {selectedListing.contactNumber
                            ? (() => {
                                const raw = selectedListing.contactNumber.replace(/\D/g, '');
                                const digits = raw.startsWith('91') && raw.length > 10 ? raw.slice(2) : raw;
                                return `+91 ${digits}`;
                              })()
                            : 'Not provided'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hp-modal-footer-new">
              <button className="hp-btn hp-btn--red hp-modal-close-btn-new" onClick={() => setSelectedListing(null)}>
                Close Details
              </button>
              <div className="hp-modal-created-text">
                Created On:{' '}
                {new Date(selectedListing.createdAt || Date.now()).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ─── Reusable PG Card (no delete button) ─── */
function PGCard({ pg, onView }) {
  return (
    <div className="hp-pg-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="hp-pg-card-img-wrap" style={{ height: '170px' }}>
        <SmartImage
          src={pg.image}
          alt={pg.title}
          className="hp-pg-card-img"
          fallback="/pg_card_1.png"
          style={{ height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div className="hp-pg-card-body" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="hp-pg-card-title" style={{ fontSize: '0.95rem', marginBottom: '0.3rem', color: '#1a1a2e', lineHeight: 1.3 }}>
          {pg.title}
        </h3>
        <div style={{ marginBottom: '0.8rem' }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
            background: pg.pgType === 'boys' ? '#eff6ff' : pg.pgType === 'girls' ? '#fff1f2' : '#f0fdf4',
            color:      pg.pgType === 'boys' ? '#2563eb' : pg.pgType === 'girls' ? '#e11d48' : '#16a34a',
            textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            {pg.pgType === 'boys' ? '👦 Boys Only' : pg.pgType === 'girls' ? '👧 Girls Only' : '👥 Co-ed'}
          </span>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
          <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.95rem' }}>
            <span style={{ color: '#e53528' }}>{pg.price}</span>
          </div>
          <button
            className="hp-btn hp-btn--outline-red"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
            onClick={() => onView(pg)}
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
