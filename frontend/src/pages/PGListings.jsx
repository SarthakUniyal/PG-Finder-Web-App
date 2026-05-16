import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import PGLogo from '../components/PGLogo';
import SmartImage from '../components/SmartImage';
import { cachedGet, cachedMutate, isOnline } from '../utils/offlineManager';
import '../style/HomePage.css';

/* ── Image gallery sub-component with active thumbnail state ── */
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

// ─── localStorage cache key (versioned — bump version to bust stale data) ───
// v3: busts stale base64/Cloudinary-URL cached data after local-file migration
const LS_KEY = 'pg_saved_listings_v3';

// Helper: read from localStorage synchronously
function readLSCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return null;
}

// Helper: write to localStorage (best-effort)
function writeLSCache(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {/* storage full — silent */}
}

export default function PGListings() {
  const navigate = useNavigate();

  // ── Initialize from localStorage SYNCHRONOUSLY (lazy init — runs only once) ──
  const [listings, setListings] = useState(() => readLSCache() || []);
  const [loading, setLoading]   = useState(() => !readLSCache()); // no spinner if LS has data

  const [scrolled, setScrolled]       = useState(false);
  const [user, setUser]               = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [online, setOnline]           = useState(isOnline());

  // ── Synchronous auth guard — no flash ──
  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" replace state={{ message: 'Please log in to view your PG listings.' }} />;
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);

    const handleOnline  = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    const token    = localStorage.getItem('token');
    const userName = localStorage.getItem('userName');
    const userRole = localStorage.getItem('userRole');
    if (token && userName) {
      setUser({ name: userName, initial: userName.charAt(0).toUpperCase(), role: userRole });
    }

    // ── Fetch fresh data from network / IndexedDB ──
    // If localStorage already had data, setLoading is false so UI is already showing.
    // This fetch runs in the background and updates listings when it completes.
    // Safety: if LS was empty, dismiss spinner after 5 s so the user sees the empty state.
    const loadingTimer = setTimeout(() => setLoading(false), 5000);

    const applyData = (data) => {
      clearTimeout(loadingTimer);
      // Always update — even empty array clears stale cache from a previous session
      const items = (data || []).filter(l => l != null);
      setListings(items);
      writeLSCache(items);   // keep localStorage fresh for next visit
      setLoading(false);
    };

    cachedGet(
      'http://localhost:4000/api/auth/saved-pgs-populated?v=2',
      token,
      applyData   // ← background refresh callback
    )
      .then(applyData)
      .catch(err => {
        clearTimeout(loadingTimer);
        console.error('Error fetching saved PGs:', err);
        setLoading(false);
      });

    return () => {
      clearTimeout(loadingTimer);
      window.removeEventListener('scroll', onScroll);
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
    localStorage.removeItem('pg_session');  // clear auto-login session
    navigate('/login', { replace: true });
  };

  // NOTE: fetchFullListing removed.
  // "View Details" now opens the modal INSTANTLY using the pg data we already have
  // from the saved-pgs-populated endpoint (which returns full populated data).
  // No extra network call needed — this makes it instant even on slow mobile internet.

  const handleRemoveListing = async (id) => {
    // 1. Optimistic update — fast feel
    const originalListings = [...listings];
    const newListings = listings.filter(l => l._id !== id);
    setListings(newListings);
    writeLSCache(newListings); // keep localStorage in sync immediately

    
    const token = localStorage.getItem('token');
    try {
      await cachedMutate(
        'DELETE',
        `http://localhost:4000/api/auth/saved-pgs/${id}`,
        null,
        token,
        () => console.log('[Offline] Remove PG queued for sync')
      );
    } catch (err) {
      console.error('Error removing listing:', err);
      // Revert both UI and localStorage if the server rejected
      setListings(originalListings);
      writeLSCache(originalListings);
    }
  };

  const offlineBannerStyle = {
    display: online ? 'none' : 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#fef3c7',
    color: '#92400e',
    borderBottom: '1px solid #fde68a',
    padding: '8px 20px',
    fontSize: '0.82rem',
    fontWeight: 600,
  };

  return (
    <div className="hp-root" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Offline Banner ── */}
      <div style={offlineBannerStyle}>
        <span>📡</span>
        <span>You're offline — showing cached data. Changes will sync when you reconnect.</span>
      </div>

      {/* ── Navbar ── */}
      <nav className={`hp-nav ${scrolled ? 'hp-nav--scrolled' : ''}`}>
        <div className="hp-nav-inner">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <PGLogo size={38} />
          </Link>
          <ul className="hp-nav-menu">
            <li><Link to="/" className="hp-nav-link">Home</Link></li>
            <li><Link to="/map" className="hp-nav-link">Explore Map</Link></li>
            <li><Link to="/listings" className="hp-nav-link hp-nav-link--active">PG Listings</Link></li>
            <li><Link to="/about" className="hp-nav-link">About Us</Link></li>
            <li><Link to="/contact" className="hp-nav-link">Contact Us</Link></li>
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
        </div>
      </nav>

      <main style={{ flex: 1, padding: '100px 2rem 4rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1a1a2e', marginBottom: '0.5rem' }}>
            Your Saved <span style={{ color: '#e53528' }}>PGs</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '1.1rem' }}>PGs you've added from the Explore Map</p>
        </div>

        {loading ? (
          <div className="hp-loader-container">
            <div className="hp-spinner"></div>
            <div className="hp-loader-text">Finding the perfect PGs for you...</div>
          </div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>
            You haven't added any PGs yet. Explore the map to add some!
          </div>
        ) : (
          <div className="hp-pg-grid" style={{ gap: '2rem' }}>
            {listings.map(pg => (
              <div className="hp-pg-card" key={pg._id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="hp-pg-card-img-wrap" style={{ height: '170px', position: 'relative' }}>
                  <SmartImage src={pg.image} alt={pg.title} className="hp-pg-card-img" fallback="/pg_card_1.png" style={{ height: '100%', objectFit: 'cover' }} />
                  {/* Occupancy badge */}
                  <span style={{
                    position: 'absolute', top: '10px', right: '10px',
                    padding: '3px 10px', borderRadius: '20px',
                    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    background: pg.isVacant ? '#dcfce7' : '#fee2e2',
                    color: pg.isVacant ? '#15803d' : '#dc2626',
                    border: `1px solid ${pg.isVacant ? '#86efac' : '#fca5a5'}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    backdropFilter: 'blur(4px)',
                  }}>
                    {pg.isVacant ? '● Vacant' : '● Occupied'}
                  </span>
                </div>
                <div className="hp-pg-card-body" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 className="hp-pg-card-title" style={{ fontSize: '0.95rem', marginBottom: '0.3rem', color: '#1a1a2e', lineHeight: 1.3 }}>{pg.title}</h3>
                  <div style={{ marginBottom: '0.8rem' }}>
                    <span style={{ 
                      fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                      background: pg.pgType === 'boys' ? '#eff6ff' : pg.pgType === 'girls' ? '#fff1f2' : '#f0fdf4',
                      color: pg.pgType === 'boys' ? '#2563eb' : pg.pgType === 'girls' ? '#e11d48' : '#16a34a',
                      textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      {pg.pgType === 'boys' ? '👦 Boys Only' : pg.pgType === 'girls' ? '👧 Girls Only' : '👥 Co-ed'}
                    </span>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.95rem' }}>
                      <span style={{ color: '#e53528' }}>{pg.price}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="hp-btn hp-btn--outline-red"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                        onClick={() => setSelectedListing(pg)}
                      >
                        View Details
                      </button>
                      <button
                        className="hp-btn"
                        style={{ 
                          padding: '0.3rem 0.5rem', fontSize: '0.72rem', 
                          background: '#fff', color: '#ef4444', 
                          border: '1px solid #fee2e2',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        onClick={() => handleRemoveListing(pg._id)}
                        title="Remove from saved list"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="hp-footer" style={{ marginTop: 'auto' }}>
        <div className="hp-footer-bottom">
          © {new Date().getFullYear()} PG Finder. All rights reserved.
        </div>
      </footer>

      {/* ── Property Details Modal ── */}
      {selectedListing && (
        <div className="hp-modal-overlay" onClick={() => setSelectedListing(null)}>
          <div className="hp-modal-content hp-modal-content--details" onClick={(e) => e.stopPropagation()}>
            <div className="hp-modal-header">
              <h2>Property Details</h2>
              <button className="hp-modal-close-icon" onClick={() => setSelectedListing(null)}>✕</button>
            </div>

            <div className="hp-modal-body">
              {/* Image Gallery */}
              <ModalGallery listing={selectedListing} />

              {/* Info Grid — equal 50/50 columns */}
              <div className="hp-modal-info-grid">

                {/* LEFT COLUMN */}
                <div className="hp-modal-info-main">
                  <h1 className="hp-modal-detail-title">{selectedListing.title}</h1>
                  <div className="hp-modal-detail-price-row">
                    <span className="hp-modal-detail-price">{selectedListing.price}</span>
                    <span className="hp-modal-detail-separator">|</span>
                    <span className={`hp-modal-pgtype-badge hp-modal-pgtype-badge--${selectedListing.pgType || 'co-ed'}`}>
                      {selectedListing.pgType === 'boys'
                        ? '👦 Boys Only'
                        : selectedListing.pgType === 'girls'
                        ? '👧 Girls Only'
                        : '👥 Co-ed'}
                    </span>
                  </div>

                  {/* Amenities */}
                  {selectedListing.amenities &&
                    (selectedListing.amenities.wifi || selectedListing.amenities.ac ||
                     selectedListing.amenities.food || selectedListing.amenities.cctv) && (
                    <>
                      <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe" style={{ marginTop: '1.5rem' }}>Amenities</h3>
                      <div className="hp-amenity-pill-grid">
                        {selectedListing.amenities.wifi && (
                          <div className="hp-amenity-pill"><span className="hp-amenity-pill-icon">📶</span> WiFi</div>
                        )}
                        {selectedListing.amenities.ac && (
                          <div className="hp-amenity-pill"><span className="hp-amenity-pill-icon">❄️</span> AC</div>
                        )}
                        {selectedListing.amenities.food && (
                          <div className="hp-amenity-pill"><span className="hp-amenity-pill-icon">🥘</span> Food</div>
                        )}
                        {selectedListing.amenities.cctv && (
                          <div className="hp-amenity-pill"><span className="hp-amenity-pill-icon">📷</span> CCTV</div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Description */}
                  <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe" style={{ marginTop: '1.5rem' }}>Description</h3>
                  <p className="hp-modal-text">
                    {selectedListing.description || 'No description provided for this property. Please contact the owner for more details.'}
                  </p>
                </div>

                {/* RIGHT COLUMN */}
                <div className="hp-modal-info-sidebar">

                  {/* Room Options — top of right column */}
                  {selectedListing.rooms && selectedListing.rooms.length > 0 && (
                    <>
                      <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe">Room Options</h3>
                      <div className="hp-room-cards">
                        {selectedListing.rooms.map((room, idx) => (
                          <div key={idx} className="hp-room-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem' }}>
                            <span className="hp-room-type">
                              {room.roomType === 'Apartment' ? '🏢 Apartment' : '🛏️ PG'}
                            </span>
                            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
                              {room.roomType === 'Apartment'
                                ? `${room.totalRooms} BHK`
                                : `${room.totalRooms} ${room.totalRooms === 1 ? 'Room' : 'Rooms'} Available`}
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
                      selectedListing.city
                        ? `${selectedListing.city}${selectedListing.pinCode ? ` - ${selectedListing.pinCode}` : ''}`
                        : '',
                    ].filter(Boolean).join(', ') || 'Location not provided'}
                  </div>

                  {selectedListing.landmark && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                      📍 Near {selectedListing.landmark}
                    </div>
                  )}

                  <div style={{ marginTop: '2rem' }}>
                    <h3 className="hp-modal-section-title hp-modal-section-title--red-pipe">Owner & Contact</h3>
                    <div className="hp-modal-owner-card">
                      {/* Owner row */}
                      <div className="hp-modal-owner-row">
                        <div className="hp-modal-owner-avatar">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Managed by</div>
                          <div className="hp-modal-owner-name-text">{selectedListing.ownerName || 'N/A'}</div>
                        </div>
                      </div>
                      {/* Contact row */}
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
