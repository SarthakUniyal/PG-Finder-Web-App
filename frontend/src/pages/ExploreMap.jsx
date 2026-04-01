import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import PGLogo from '../components/PGLogo';
import { findNearestPG } from '../utils/dijkstra';
import '../style/ExploreMap.css';

// ── Custom House Emoji Icon for PG listings ──
const houseIcon = L.divIcon({
  className: 'house-marker',
  html: '<div class="house-icon">🏠</div>',
  iconSize:   [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -44],
});

// ── "You Are Here" blue pulse icon (optionally with heading arrow) ──
function buildUserLocationIcon(headingDeg) {
  const hasHeading = Number.isFinite(headingDeg);
  const arrow = hasHeading
    ? `<div class="user-heading" style="transform: rotate(${headingDeg}deg);">
         <div class="user-heading-arrow"></div>
       </div>`
    : '';

  return L.divIcon({
    className: 'user-marker',
    html: `<div class="user-pulse">
             ${arrow}
             <div class="user-dot"></div>
           </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}



// ── Unified right-side control panel (Locate + Zoom) ──
function MapControls({ setUserPos, setUserAccuracy, setUserHeading, setLocStatus }) {
  const map = useMap();
  const [locActive, setLocActive] = useState(false);
  const [locError,  setLocError]  = useState(false);
  const locatedPosRef = React.useRef(null);
  const watchIdRef = React.useRef(null);

  const clearWatcher = React.useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const locateWithBrowserGPS = React.useCallback((shouldSetView = true) => {
    if (!navigator.geolocation) {
      setLocActive(false);
      setLocError(true);
      setLocStatus('error');
      return;
    }

    clearWatcher();
    setLocError(false);
    setLocActive(true);
    setLocStatus('locating');

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0, // force fresh GPS fix, avoid stale cached location
    };

    const onSuccess = (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy || null;
      const heading = Number.isFinite(position.coords.heading) ? position.coords.heading : null;
      const pos = [lat, lng];

      locatedPosRef.current = pos;
      setUserPos(pos);
      setUserAccuracy(accuracy);
      setUserHeading(heading);
      setLocStatus('success');
      setLocActive(false);

      if (shouldSetView) {
        map.flyTo(pos, 16, { duration: 1.2 });
      }
    };

    const onError = () => {
      setLocActive(false);
      setLocError(true);
      setLocStatus('error');
      setTimeout(() => setLocError(false), 3000);
    };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);

    // Keep listening briefly to improve fix quality if a better GPS reading arrives.
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
    setTimeout(() => clearWatcher(), 20000);
  }, [clearWatcher, map, setLocStatus, setUserAccuracy, setUserPos]);

  useEffect(() => {
    return () => clearWatcher();
  }, [clearWatcher]);

  // ── Auto-locate on first mount ──
  useEffect(() => {
    // Detect user location but avoid forcing map view on initial load.
    locateWithBrowserGPS(false);
  }, [locateWithBrowserGPS]);

  const handleLocate = () => {
    // Always request a fresh GPS read (not cached), then recenter.
    locateWithBrowserGPS(true);
  };

  return (
    <div className="map-controls-panel">
      {/* Locate Me */}
      <button
        className={`map-ctrl-btn ${locActive ? 'map-ctrl-btn--active' : ''} ${locError ? 'map-ctrl-btn--error' : ''}`}
        onClick={handleLocate}
        title="Locate me"
      >
        {locActive ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin-once 0.8s linear infinite'}}>
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2"  x2="12" y2="6"  />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2"  y1="12" x2="6"  y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        ) : locError ? (
          <span style={{fontWeight:800, color:'#e53528', fontSize:'1.1rem'}}>!</span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2"  x2="12" y2="6"  />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2"  y1="12" x2="6"  y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        )}
      </button>

      <div className="map-ctrl-divider" />

      {/* Zoom In */}
      <button className="map-ctrl-btn" onClick={() => map.zoomIn()} title="Zoom in">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5"  y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Zoom Out */}
      <button className="map-ctrl-btn" onClick={() => map.zoomOut()} title="Zoom out">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

// ── Keep map focused on all available PG markers on initial load ──
function FitListingsBounds({ listings }) {
  const map = useMap();
  const hasFitRef = React.useRef(false);

  useEffect(() => {
    if (hasFitRef.current) return;
    const coords = listings
      .filter((pg) => Number.isFinite(pg.lat) && Number.isFinite(pg.lng))
      .map((pg) => [pg.lat, pg.lng]);

    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 14);
    } else {
      map.fitBounds(coords, { padding: [40, 40] });
    }
    hasFitRef.current = true;
  }, [listings, map]);

  return null;
}

// Removed MarkerWrapper completely to avoid React-Leaflet Context crashes.

export default function ExploreMap() {
  const [scrolled,       setScrolled]       = useState(false);
  const [user,           setUser]           = useState(null);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [listings,       setListings]       = useState([]);
  const [userPos,        setUserPos]        = useState(null);
  const [userAddress,    setUserAddress]    = useState(null); // reverse-geocoded address
  const [locStatus,      setLocStatus]      = useState('idle');
  const [userAccuracy,   setUserAccuracy]   = useState(null);
  const [userHeading,    setUserHeading]    = useState(null);
  const [dijkstraResult, setDijkstraResult] = useState(null);
  const [selectedLinePG, setSelectedLinePG] = useState(null); // PG to draw line to
  const [routePath, setRoutePath] = useState(null); // road path from routing API

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);

    const token    = localStorage.getItem('token');
    const userName = localStorage.getItem('userName');
    if (token && userName) {
      setUser({ name: userName, initial: userName.charAt(0).toUpperCase() });
    }

    // Fetch vacant listings
    axios.get('http://localhost:4000/api/listings?vacant=true')
      .then(res => setListings(res.data))
      .catch(err => console.error('Error fetching listings:', err));

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reverse geocode when user position is found
  useEffect(() => {
    if (!userPos) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${userPos[0]}&lon=${userPos[1]}&format=json`)
      .then(r => r.json())
      .then(data => {
        const a = data.address || {};
        const parts = [
          a.road || a.pedestrian || a.footway,
          a.suburb || a.neighbourhood || a.village,
          a.city || a.town || a.county,
          a.state,
        ].filter(Boolean);
        setUserAddress(parts.slice(0, 3).join(', ') || data.display_name?.split(',').slice(0, 2).join(', '));
      })
      .catch(() => setUserAddress(null));
  }, [userPos]);

  // Re-run Dijkstra whenever user position or listings change
  useEffect(() => {
    if (userPos && listings.length > 0) {
      const result = findNearestPG(userPos, listings);
      setDijkstraResult(result);
      // Auto-draw line to nearest PG
      if (result?.nearest?.pg) setSelectedLinePG(result.nearest.pg);
    }
  }, [userPos, listings]);

  // Fetch actual road route (not straight line) between user and selected PG
  useEffect(() => {
    if (!userPos || !selectedLinePG?.lat || !selectedLinePG?.lng) {
      setRoutePath(null);
      return;
    }

    const controller = new AbortController();
    const fetchRoadRoute = async () => {
      try {
        const fromLng = userPos[1];
        const fromLat = userPos[0];
        const toLng = selectedLinePG.lng;
        const toLat = selectedLinePG.lat;
        const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();

        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length === 0) {
          setRoutePath(null);
          return;
        }

        // OSRM returns [lng, lat]; Leaflet expects [lat, lng]
        setRoutePath(coords.map(([lng, lat]) => [lat, lng]));
      } catch (err) {
        if (err.name !== 'AbortError') {
          setRoutePath(null);
        }
      }
    };

    fetchRoadRoute();
    return () => controller.abort();
  }, [userPos, selectedLinePG]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    setUser(null);
    setShowDropdown(false);
  };

  const defaultCenter = [20.5937, 78.9629]; // India center fallback

  return (
    <div className="map-page-root">
      {/* ── Navbar ── */}
      <nav className={`hp-nav ${scrolled ? 'hp-nav--scrolled' : ''}`}>
        <div className="hp-nav-inner">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <PGLogo size={38} />
          </Link>
          <ul className="hp-nav-menu">
            <li><Link to="/"        className="hp-nav-link">Home</Link></li>
            <li><Link to="/map"     className="hp-nav-link hp-nav-link--active">Explore Map</Link></li>
            <li><Link to="/listings"   className="hp-nav-link">PG Listings</Link></li>
            <li><Link to="/about"   className="hp-nav-link">About Us</Link></li>
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
        </div>
      </nav>

      {/* ── Main Map Content ── */}
      <main className="map-page-main">
        <div className="map-page-header">
          <div className="map-header-inner">
            <h1 className="map-title">Explore Vacant <span className="text-red">PGs</span></h1>
            <p className="map-sub">Find your next home geographically across India.</p>
          </div>
        </div>

        <div className="map-view-container">
          <MapContainer
            center={defaultCenter}
            zoom={5}
            scrollWheelZoom={true}
            zoomControl={false}
            style={{ height: '700px', width: '100%', background: '#fff' }}
          >
            <FitListingsBounds listings={listings} />

            {/* 📍 Unified Controls Panel */}
            <MapControls
              setUserPos={setUserPos}
              setUserAccuracy={setUserAccuracy}
              setUserHeading={setUserHeading}
              setLocStatus={setLocStatus}
            />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />

            {/* 🏠 PG Markers */}
            {(() => {
              const seenCoords = {};
              return listings.filter(pg => pg.lat && pg.lng).map((pg) => {
                let { lat, lng } = pg;
                // Form a key for identical coordinates up to ~11 cm precision
                const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
                if (seenCoords[key] !== undefined) {
                  seenCoords[key]++;
                  // Add a tiny deterministic diagonal offset (approx 11 meters) for each overlapping pin
                  lat += seenCoords[key] * 0.0001;
                  lng += seenCoords[key] * 0.0001;
                } else {
                  seenCoords[key] = 0;
                }

                return (
                  <Marker 
                    key={pg._id} 
                    position={[lat, lng]} 
                    icon={houseIcon}
                    eventHandlers={{
                      click: () => {
                        if (userPos) setSelectedLinePG(pg);
                      },
                      add: (e) => {
                        const marker = e.target;
                        const el = marker.getElement();
                        if (el) {
                          let timeoutId;
                          el.addEventListener('mouseenter', () => {
                            clearTimeout(timeoutId);
                            marker.openPopup();
                            setTimeout(() => {
                              const popupEl = marker.getPopup()?.getElement();
                              if (popupEl) {
                                popupEl.onmouseenter = () => clearTimeout(timeoutId);
                                popupEl.onmouseleave = () => { timeoutId = setTimeout(() => marker.closePopup(), 200); };
                              }
                            }, 10);
                          });
                          el.addEventListener('mouseleave', () => {
                            timeoutId = setTimeout(() => marker.closePopup(), 200);
                          });
                        }
                      }
                    }}
                  >
                    <Popup autoPan={false} closeButton={false}>
                      <div className="pg-popup-wide">
                        <div className="pg-popup-img-wrap">
                          <img src={pg.image} alt={pg.title} className="pg-popup-img" />
                        </div>
                        <div className="pg-popup-info">
                          <h4>{pg.title}</h4>
                          <p className="pg-popup-price">{pg.price}</p>
                          <p className="pg-popup-loc">📍 {pg.location}</p>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button 
                              onClick={async () => {
                                const token = localStorage.getItem('token');
                                if (!token) {
                                  alert('Please login to save PGs to your list.');
                                  return;
                                }
                                try {
                                  await axios.post(
                                    `http://localhost:4000/api/auth/saved-pgs/${pg._id}`,
                                    {},
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  alert('PG added to your list successfully!');
                                } catch (err) {
                                  if (err.response?.status === 409) {
                                    alert('This PG is already in your list.');
                                  } else {
                                    alert('Failed to save PG. Please try again.');
                                  }
                                }
                              }}
                              className="hp-btn hp-btn--red" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}
                            >
                              Add to PG List
                            </button>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              });
            })()}

            {/* 📍 User's live location marker */}
            {userPos && (
              <Marker position={userPos} icon={buildUserLocationIcon(userHeading)}>
                <Popup>
                  <div className="user-loc-popup">
                    <strong>📍 You are here</strong>
                    <p>This is your current location.</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* ── Shortest path Polyline ── */}
            {userPos && selectedLinePG && (
              <Polyline
                positions={routePath || [userPos, [selectedLinePG.lat, selectedLinePG.lng]]}
                color="#2563eb"
                weight={3}
                dashArray="8 5"
                opacity={0.85}
              />
            )}
          </MapContainer>
        </div>

        {/* ── Distance & Routing Panel (Dijkstra Result) ── */}
        <div className="map-routing-panel">
          <div className="map-routing-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
            </svg>
            Distance &amp; Routing
          </div>

          <div className="map-routing-grid">
            {/* Current Location */}
            <div className="map-routing-cell">
              <div className="map-routing-cell-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
                Your Current Location
              </div>
              <div className="map-routing-cell-value">
                {userPos
                  ? (userAddress
                      ? userAddress
                      : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Detecting address…</span>)
                  : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Enable location first</span>
                }
                {userPos && (
                  <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                    {`Lat ${userPos[0].toFixed(5)}, Lng ${userPos[1].toFixed(5)}`}
                    {userAccuracy ? ` | Accuracy ~${Math.round(userAccuracy)}m` : ''}
                    {Number.isFinite(userHeading) ? ` | Heading ${Math.round(userHeading)}°` : ''}
                  </div>
                )}
                {!userPos && locStatus === 'error' && (
                  <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#dc2626' }}>
                    Location access denied/unavailable. Allow location in browser site settings.
                  </div>
                )}
              </div>
            </div>

            {/* Selected / Nearest PG */}
            <div className="map-routing-cell">
              <div className="map-routing-cell-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
                  <path d="M9 21V12h6v9"/>
                </svg>
                {selectedLinePG ? 'Selected PG' : 'Nearest PG'}
              </div>
              <div className="map-routing-cell-value">
                {selectedLinePG
                  ? selectedLinePG.title
                  : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      {userPos ? 'Calculating…' : 'Enable location first'}
                    </span>
                }
              </div>
            </div>

            {/* Distance */}
            <div className="map-routing-cell">
              <div className="map-routing-cell-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                Approx. Distance
              </div>
              <div className="map-routing-distance">
                {selectedLinePG && dijkstraResult
                  ? (() => {
                      const found = dijkstraResult.allResults.find(r => r.pg._id === selectedLinePG._id);
                      return found ? `${found.distanceKm.toFixed(1)} km` : `${dijkstraResult.nearest.distanceKm.toFixed(1)} km`;
                    })()
                  : '— km'}
              </div>
            </div>
          </div>

          {/* Footer row */}
          <div className="map-routing-footer">
            <span className="map-routing-note">
              📏 Distance is measured in a straight line (Dijkstra on geographic graph). For turn-by-turn directions, use Google Maps.
            </span>
            {selectedLinePG && userPos && (
              <a
                href={`https://www.google.com/maps/dir/${userPos[0]},${userPos[1]}/${selectedLinePG.lat},${selectedLinePG.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="map-gmaps-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C7.8 0 4.4 3.4 4.4 7.6c0 5.7 7.6 16.4 7.6 16.4s7.6-10.7 7.6-16.4C19.6 3.4 16.2 0 12 0zm0 10.4a2.8 2.8 0 110-5.6 2.8 2.8 0 010 5.6z"/>
                </svg>
                Get Directions on Google Maps
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
              </a>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="map-footer">
        <p>© {new Date().getFullYear()} PG Lodge Locator. All rights reserved.</p>
      </footer>
    </div>
  );
}
