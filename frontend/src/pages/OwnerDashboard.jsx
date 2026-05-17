import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PGLogo from '../components/PGLogo';
import SmartImage from '../components/SmartImage';
import { cachedGet, cachedMutate, isOnline } from '../utils/offlineManager';
import '../style/OwnerDashboard.css';

/* ──────────────────────────────────────────────────────────
   Amenity config
────────────────────────────────────────────────────────── */
const AMENITY_LIST = [
  { key: 'wifi', icon: '📶', label: 'WiFi'  },
  { key: 'ac',   icon: '❄️',  label: 'AC'   },
  { key: 'food', icon: '🍽️', label: 'Food'  },
  { key: 'cctv', icon: '📹', label: 'CCTV'  },
];

const defaultRoom = () => ({ roomType: 'PG', totalRooms: 1, rent: '', deposit: '' });

/* ──────────────────────────────────────────────────────────
   Create PG Modal
────────────────────────────────────────────────────────── */
function CreatePGModal({ onClose, onCreated, initialData }) {
  const [step, setStep]       = useState(0);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [basic, setBasic] = useState({
    ownerName: initialData?.ownerName || localStorage.getItem('userName') || '',
    contactNumber: initialData?.contactNumber || '',
    pgType: initialData?.pgType || 'co-ed',
    description: initialData?.description || '',
  });
  const [location, setLocation] = useState({
    city: initialData?.city || '',
    area: initialData?.area || '',
    street: initialData?.street || '',
    plotNumber: initialData?.plotNumber || '',
    landmark: initialData?.landmark || '',
    pinCode: initialData?.pinCode || '',
  });
  const [rooms, setRooms]         = useState(initialData?.rooms?.length ? initialData.rooms : [defaultRoom()]);
  const [amenities, setAmenities] = useState(initialData?.amenities || { wifi: false, ac: false, food: false, cctv: false });
  const [images, setImages]       = useState(initialData?.images || []);
  const [isVacant, setIsVacant]   = useState(initialData ? initialData.isVacant : true);
  const fileRef = useRef();

  // Handle remounting / initialData changes explicitly
  useEffect(() => {
    if (initialData) {
      setBasic({
        ownerName: initialData.ownerName || localStorage.getItem('userName') || '',
        contactNumber: initialData.contactNumber || '',
        pgType: initialData.pgType || 'co-ed',
        description: initialData.description || '',
      });
      setLocation({
        city: initialData.city || '',
        area: initialData.area || '',
        street: initialData.street || '',
        plotNumber: initialData.plotNumber || '',
        landmark: initialData.landmark || '',
        pinCode: initialData.pinCode || '',
      });
      setRooms(initialData.rooms?.length ? initialData.rooms : [defaultRoom()]);
      setAmenities(initialData.amenities || { wifi: false, ac: false, food: false, cctv: false });
      setImages(initialData.images || []);
      setIsVacant(initialData.isVacant !== undefined ? initialData.isVacant : true);
    } else {
      // RESET TO DEFAULT FOR NEW PG
      setBasic({
        ownerName: localStorage.getItem('userName') || '',
        contactNumber: '',
        pgType: 'co-ed',
        description: '',
      });
      setLocation({
        city: '', area: '', street: '', plotNumber: '', landmark: '', pinCode: '',
      });
      setRooms([defaultRoom()]);
      setAmenities({ wifi: false, ac: false, food: false, cctv: false });
      setImages([]);
      setIsVacant(true);
    }
    setStep(0); // Always start at step 0 when modal opens
  }, [initialData]);

  const updateBasic    = (k, v) => setBasic(b => ({ ...b, [k]: v }));
  const updateLocation = (k, v) => setLocation(l => ({ ...l, [k]: v }));
  const updateRoom     = (i, k, v) => setRooms(r => r.map((rm, idx) => idx === i ? { ...rm, [k]: v } : rm));
  const toggleAmenity  = (k)     => setAmenities(a => ({ ...a, [k]: !a[k] }));

  const MAX_IMAGE_SIZE_MB = 2; // 2 MB
  const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

  const toBase64 = file => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const handleFiles = useCallback(async (files) => {
    const newImages = [];
    const filesToProcess = Array.from(files).slice(0, 4 - images.length);

    for (const file of filesToProcess) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setError(`Image "${file.name}" is too large (max ${MAX_IMAGE_SIZE_MB}MB).`);
        continue;
      }
      try {
        const b64 = await toBase64(file);
        newImages.push(b64);
      } catch (e) {
        setError(`Failed to read image "${file.name}".`);
      }
    }
    setImages(prev => [...prev, ...newImages]);
  }, [images.length]);

  const onDrop = e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); };

  const handleSubmit = async () => {
    if (!basic.ownerName.trim())     return setError('Owner name is required.');
    if (!basic.contactNumber.trim()) return setError('Contact number is required.');
    if (!location.city.trim())       return setError('City is required.');
    if (rooms.some(r => !r.rent))    return setError('Please fill rent for all room types.');
    
    setError(''); setSaving(true);
    try {
      // Build a detailed query for geocoding
      const detailedParts = [
        location.plotNumber,
        location.street,
        location.landmark,
        location.area,
        location.city,
        location.pinCode,
        'India',
      ].filter(Boolean);
      const detailedQuery = detailedParts.join(', ');

      // Geocode the address as precisely as possible
      let lat = null, lng = null;
      try {
        const searchNominatim = async (query) => {
          const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(
            query,
          )}`;
          const res = await axios.get(url, {
            headers: { 'User-Agent': 'PG-Finder-App/1.0 (contact@example.com)' },
          });
          if (Array.isArray(res.data) && res.data.length > 0) {
            return {
              lat: parseFloat(res.data[0].lat),
              lng: parseFloat(res.data[0].lon),
            };
          }
          return null;
        };

        // Attempt geocoding with various levels of detail
        const queries = [
          detailedQuery,
          [location.plotNumber, location.street, location.area, location.city].filter(Boolean).join(', '),
          [location.area, location.city, 'India'].filter(Boolean).join(', '),
        ];

        for (const q of queries) {
          if (q) {
            const result = await searchNominatim(q);
            if (result) {
              lat = result.lat;
              lng = result.lng;
              break; // Found a good match, stop trying other queries
            }
          }
        }

        // Add a tiny offset only to avoid exact-overlap pins
        if (lat && lng) {
          lat += (Math.random() - 0.5) * 0.0001;
          lng += (Math.random() - 0.5) * 0.0001;
        }
      } catch (err) {
        // If geocoding fails completely, we gracefully fall back to null coords.
      }

      // 3. Safety Net: If API blocked the request or failed, but we are editing an existing PG, keep its old GPS coordinates!
      if (!lat && initialData && initialData.lat) {
        lat = initialData.lat;
        lng = initialData.lng;
      }

      const token   = localStorage.getItem('token');
      const payload = { 
        ...basic, 
        ...location, 
        title: "PG in " + (location.area || location.city),
        lat, lng,
        rooms, amenities, images, isVacant 
      };
      
      let res;
      if (initialData) {
        res = await axios.put(`http://localhost:4000/api/listings/${initialData._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        res = await axios.post('http://localhost:4000/api/listings', payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      onCreated(res.data, !!initialData);
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // Server responded with a status other than 2xx
          setError(err.response.data?.msg || `Server error: ${err.response.status}`);
        } else if (err.request) {
          // Request was made but no response received
          setError('Network error: No response from server. Please check your internet connection.');
        } else {
          // Something else happened while setting up the request
          setError(`Error: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally { setSaving(false); }
  };

  const STEPS     = ['Basic Info', 'Location', 'Rooms', 'Amenities', 'Photos & Status'];
  const canNext   = [
    () => basic.ownerName && basic.ownerName.trim() && basic.contactNumber && basic.contactNumber.trim(),
    () => location.city && location.city.trim() && location.area && location.area.trim(),
    () => rooms && rooms.length > 0 && rooms.every(r => r && r.rent),
    () => true,
    () => true,
  ];

  return (
    <div className="od-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="od-modal">
        <div className="od-modal-header">
          <div>
            <h2>{initialData ? 'Edit Your PG' : 'List Your PG'}</h2>
            <p>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          </div>
          <button className="od-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="od-modal-steps">
          {STEPS.map((_, i) => (
            <div key={i} className={`od-step ${i < step ? 'done' : i === step ? 'current' : ''}`} />
          ))}
        </div>

        <div className="od-modal-body">

          {/* STEP 0 – Basic */}
          {step === 0 && (
            <>
              <div className="od-section-title">🏠 Basic PG Information</div>
              <div className="od-form-grid">
                <div className="od-form-col">
                  <label>Owner Name *</label>
                  <input placeholder="Your full name" value={basic.ownerName}
                    onChange={e => updateBasic('ownerName', e.target.value)} />
                </div>
                <div className="od-form-col">
                  <label>Contact Number *</label>
                  <input placeholder="+91 98765 43210" value={basic.contactNumber}
                    onChange={e => updateBasic('contactNumber', e.target.value)} />
                </div>
                <div className="od-form-col">
                  <label>PG Type</label>
                  <div className="od-type-group">
                    {['boys', 'girls', 'co-ed'].map(t => (
                      <button key={t} type="button"
                        className={`od-type-btn ${basic.pgType === t ? 'selected' : ''}`}
                        onClick={() => updateBasic('pgType', t)}>
                        {t === 'boys' ? '👦 Boys' : t === 'girls' ? '👧 Girls' : '👥 Co-ed'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="od-form-col od-form-col--full">
                  <label>Description</label>
                  <textarea placeholder="Describe your PG — location highlights, nearby colleges, facilities..."
                    value={basic.description} onChange={e => updateBasic('description', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* STEP 1 – Location */}
          {step === 1 && (
            <>
              <div className="od-section-title">📍 Location Details</div>
              <div className="od-form-grid">
                <div className="od-form-col">
                  <label>City *</label>
                  <input placeholder="e.g. Hyderabad" value={location.city}
                    onChange={e => updateLocation('city', e.target.value)} />
                </div>
                <div className="od-form-col">
                  <label>Area / Locality *</label>
                  <input placeholder="e.g. Hitech City" value={location.area}
                    onChange={e => updateLocation('area', e.target.value)} />
                </div>
                <div className="od-form-col">
                  <label>Plot / Building Number</label>
                  <input placeholder="e.g. Plot No 42" value={location.plotNumber}
                    onChange={e => updateLocation('plotNumber', e.target.value)} />
                </div>
                <div className="od-form-col">
                  <label>Street / Road</label>
                  <input placeholder="e.g. Lane 3, Subhash Nagar Road" value={location.street}
                    onChange={e => updateLocation('street', e.target.value)} />
                </div>
                <div className="od-form-col">
                  <label>Nearby Landmark</label>
                  <input placeholder="e.g. Near IIIT Hyderabad" value={location.landmark}
                    onChange={e => updateLocation('landmark', e.target.value)} />
                </div>
                <div className="od-form-col">
                  <label>Pin Code</label>
                  <input placeholder="500032" value={location.pinCode}
                    onChange={e => updateLocation('pinCode', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* STEP 2 – Rooms */}
          {step === 2 && (
            <>
              <div className="od-section-title">🛏️ Room Details</div>
              {rooms.map((room, i) => (
                <div className="od-room-card" key={i}>
                  <div className="od-room-card-header">
                    <span className="od-room-label">Category Details</span>
                    {rooms.length > 1 && (
                      <button className="od-room-del" onClick={() => setRooms(r => r.filter((_, idx) => idx !== i))}>✕</button>
                    )}
                  </div>
                  <div className="od-form-grid od-form-grid--3">
                    <div className="od-form-col">
                      <label>Category</label>
                      <select value={room.roomType} onChange={e => updateRoom(i, 'roomType', e.target.value)}>
                        <option value="PG">PG</option>
                        <option value="Apartment">Apartment</option>
                      </select>
                    </div>
                    <div className="od-form-col">
                      <label>{room.roomType === 'Apartment' ? 'BHK' : 'Total Rooms'}</label>
                      <input type="number" min={1} value={room.totalRooms}
                        onChange={e => updateRoom(i, 'totalRooms', e.target.value)} />
                    </div>
                    <div className="od-form-col">
                      <label>Rent / Month (₹) *</label>
                      <input type="number" placeholder="e.g. 8500" value={room.rent}
                        onChange={e => updateRoom(i, 'rent', e.target.value)} />
                    </div>
                    <div className="od-form-col">
                      <label>Security Deposit (₹)</label>
                      <input type="number" placeholder="e.g. 17000" value={room.deposit}
                        onChange={e => updateRoom(i, 'deposit', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              {rooms.length < 5 && (
                <button className="od-btn-add-room" onClick={() => setRooms(r => [...r, defaultRoom()])}>
                  + Add Another Room Category
                </button>
              )}
            </>
          )}

          {/* STEP 3 – Amenities */}
          {step === 3 && (
            <>
              <div className="od-section-title">✨ Amenities</div>
              <div className="od-amenities-grid">
                {AMENITY_LIST.map(({ key, icon, label }) => (
                  <div key={key} className={`od-amenity-toggle ${amenities[key] ? 'on' : ''}`}
                    onClick={() => toggleAmenity(key)}>
                    <div className="od-amenity-icon">{icon}</div>
                    <div className="od-amenity-name">{label}</div>
                    <div className="od-amenity-check">{amenities[key] ? '✓' : ''}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* STEP 4 – Images + Status */}
          {step === 4 && (
            <>
              <div className="od-section-title">📸 PG Images</div>
              <div className={`od-dropzone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current.click()}>
                <div className="od-dropzone-icon">🖼️</div>
                <p>Drag & drop images here, or <span>browse files</span></p>
                <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>JPEG, PNG — up to 4 images</p>
                <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
                  onChange={e => handleFiles(e.target.files)} />
              </div>
              {images.length > 0 && (
                <div className="od-images-preview">
                  {images.map((src, i) => (
                    <div className="od-img-thumb-wrap" key={i}>
                      <img src={src} alt={`img-${i}`} className="od-img-thumb" />
                      <button className="od-img-del"
                        onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="od-section-title" style={{ marginTop: '1.4rem' }}>🔄 Availability</div>
              <div className="od-toggle-row">
                <div className="od-toggle-info">
                  <h4>{isVacant ? '✅ Available' : '❌ Not Available'}</h4>
                  <p>{isVacant ? 'This PG will appear in listings and on the map.' : 'This PG is hidden from searches.'}</p>
                </div>
                <div className={`od-toggle-switch ${isVacant ? 'on' : ''}`}
                  onClick={() => setIsVacant(v => !v)} />
              </div>
            </>
          )}

          {error && <p className="od-form-error">⚠ {error}</p>}
        </div>

        <div className="od-modal-footer">
          <span className="od-modal-footer-left">{step + 1} / {STEPS.length} — {STEPS[step]}</span>
          <div className="od-modal-footer-right">
            {step > 0 && (
              <button className="od-btn-secondary" onClick={() => setStep(s => s - 1)}>← Back</button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="od-btn-primary" disabled={!canNext[step]()}
                onClick={() => { setError(''); setStep(s => s + 1); }}>Next →</button>
            ) : (
              <button className="od-btn-primary" disabled={saving} onClick={handleSubmit}>
                {saving ? 'Saving…' : (initialData ? '💾 Save Changes' : '🚀 Publish PG')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   NAV items — trimmed to Dashboard, PG Listings, Earnings, Settings
────────────────────────────────────────────────────────── */
const NAV = [
  { id: 'dashboard', icon: '▣',  label: 'Dashboard'   },
  { id: 'listings',  icon: '≡',  label: 'PG Listings'  },
  { id: 'earnings',  icon: '₹',  label: 'Total Earnings'},
  { id: 'settings',  icon: '⚙',  label: 'Settings'     },
];

/* ──────────────────────────────────────────────────────────
   DELETE CONFIRM MODAL
────────────────────────────────────────────────────────── */
function DeleteConfirmModal({ onCancel, onConfirm }) {
  return (
    <div className="od-modal-overlay" onClick={onCancel}>
      <div className="od-modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
        <div className="od-modal-header">
          <div>
            <h2 style={{ color: '#1a1a2e' }}>Delete PG</h2>
          </div>
          <button className="od-modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="od-modal-body" style={{ minHeight: '80px', paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.9rem', color: '#374151', lineHeight: '1.5' }}>
            Are you sure you want to delete this PG Listing ?
          </p>
        </div>
        <div className="od-modal-footer">
          <div style={{ flex: 1 }}></div>
          <div className="od-modal-footer-right">
            <button className="od-btn-secondary" onClick={onCancel}>Cancel</button>
            <button className="od-btn-primary" onClick={onConfirm}>Delete PG</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   OWNER DASHBOARD PAGE
────────────────────────────────────────────────────────── */
export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [section, setSection]     = useState('dashboard');
  const [listings, setListings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPG, setEditingPG]   = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deletePGId, setDeletePGId]   = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userName  = localStorage.getItem('userName')  || 'Owner';
  const userEmail  = localStorage.getItem('userEmail') || ((() => { try { return JSON.parse(localStorage.getItem('pg_session') || '{}').email || ''; } catch { return ''; } })());
  const token      = localStorage.getItem('token');
  const role       = localStorage.getItem('userRole');
  const initial  = userName.charAt(0).toUpperCase();
  const [online, setOnline] = useState(isOnline());

  /* guard */
  useEffect(() => {
    if (!token || role !== 'owner') navigate('/login');
    const handleOnline  = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token, role, navigate]);

  /* fetch */
  const fetchListings = useCallback(async () => {
    setLoading(true);
    // Safety: dismiss spinner after 4 s max so slow internet never hangs the dashboard
    const loadingTimer = setTimeout(() => setLoading(false), 4000);
    try {
      const data = await cachedGet(
        'http://localhost:4000/api/listings/owner',
        token,
        // Called when background refresh completes — keeps dashboard in sync on slow mobile
        (fresh) => {
          setListings(Array.isArray(fresh) ? fresh : []);
          setLoading(false);
        }
      );
      clearTimeout(loadingTimer);
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch listings error:', err);
      setListings([]);
    }
    clearTimeout(loadingTimer);
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  /* toggle status */
  const toggleStatus = async id => {
    // Optimistic UI update
    setListings(l => l.map(pg => pg._id === id ? { ...pg, isVacant: !pg.isVacant } : pg));
    try {
      const data = await cachedMutate(
        'PATCH',
        `http://localhost:4000/api/listings/${id}/status`,
        {},
        token,
        () => console.log('[Offline] Toggle status queued for sync')
      );
      // If online, reconcile with server response
      if (data) {
        setListings(l => l.map(pg => pg._id === id ? { ...pg, isVacant: data.isVacant } : pg));
      }
    } catch {
      // Revert on failure
      setListings(l => l.map(pg => pg._id === id ? { ...pg, isVacant: !pg.isVacant } : pg));
      alert('Failed to update status.');
    }
  };

  /* delete */
  const deletePG = async () => {
    if (!deletePGId) return;
    // Optimistic UI
    const originalListings = [...listings];
    setListings(l => l.filter(pg => pg._id !== deletePGId));
    const idToDelete = deletePGId;
    setDeletePGId(null);
    try {
      await cachedMutate(
        'DELETE',
        `http://localhost:4000/api/listings/${idToDelete}`,
        null,
        token,
        () => console.log('[Offline] Delete PG queued for sync')
      );
    } catch (err) {
      alert('Failed to delete PG. Please try again.');
      console.error('Delete PG error:', err);
      // Revert
      setListings(originalListings);
    }
  };

  /* logout */
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('pg_session');  // clear auto-login session
    navigate('/login', { replace: true });
  };

  /* derived stats helpers */
  const buildFullAddress = (pg) => {
    if (!pg) return '';
    const parts = [
      pg.plotNumber,
      pg.street,
      pg.landmark ? `(near ${pg.landmark})` : '',
      pg.area,
      pg.city,
      pg.pinCode
    ].filter(Boolean);
    return parts.join(', ');
  };

  const calculatePGEarning = (pg) => {
    if (pg?.rooms && pg.rooms.length > 0) {
      return pg.rooms.reduce((s, r) => {
        const multiplier = r.roomType === 'PG' ? Number(r?.totalRooms || 1) : 1;
        return s + Number(r?.rent || 0) * multiplier;
      }, 0);
    }
    // Fallback: parse price if rooms are missing (handles older data format)
    if (pg?.price) {
      const numericPrice = Number(pg.price.replace(/[^\d]/g, ''));
      return isNaN(numericPrice) ? 0 : numericPrice;
    }
    return 0;
  };

  /* derived stats */
  const totalRooms      = (listings || []).reduce((a, pg) => a + (pg?.rooms || []).reduce((s, r) => s + Number(r?.totalRooms || 0), 0), 0);
  const vacantCount     = (listings || []).filter(pg => pg?.isVacant).length;
  const occupiedCount   = (listings || []).length - vacantCount;
  
  // Total actual monthly earnings (from occupied PGs)
  const totalEarning    = (listings || []).filter(pg => pg && !pg.isVacant)
    .reduce((acc, pg) => acc + calculatePGEarning(pg), 0);
  
  // Potential monthly earnings (from all PGs)
  const potentialEarning = (listings || []).reduce((acc, pg) => acc + calculatePGEarning(pg), 0);

  /* ─── section renderer ─── */
  const renderSection = () => {
    switch (section) {

      /* DASHBOARD */
      case 'dashboard': return (
        <>
          {/* Stat cards — 3 cards (removed New Enquiries, added Total Earnings) */}
          <div className="od-stats-row">
            {[
              { label: 'Total Earnings', num: `₹${totalEarning.toLocaleString('en-IN')}`, icon: '💰', cls: 'blue',   link: 'View Report' },
              { label: 'Total Rooms',     num: totalRooms,                                   icon: '🛏️', cls: 'green',  link: 'Manage'      },
              { label: 'Occupied PGs',    num: occupiedCount,                                icon: '🤝', cls: 'red',    link: 'Manage'      },
              { label: 'Vacant PGs',      num: vacantCount,                                  icon: '✅', cls: 'orange', link: 'See Vacant'  },
            ].map(c => (
              <div key={c.label} className={`od-stat-card od-stat-card--${c.cls}`}>
                <div className="od-stat-icon">{c.icon}</div>
                <div className="od-stat-num" style={c.label === 'Total Earnings' ? {fontSize:'1.3rem'} : {}}>{c.num}</div>
                <div className="od-stat-label">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Two col: PG Listings + Earnings overview */}
          <div className="od-grid-2">
            {/* My PG Listings */}
            <div className="od-card">
              <div className="od-card-header">
                <span className="od-card-title">📋 My PG Listings</span>
                <button className="od-chip" onClick={() => setSection('listings')}>View All</button>
              </div>
              {loading ? <div className="od-spinner" /> : listings.length === 0 ? (
                <div className="od-empty">
                  <div className="od-empty-icon">🏠</div>
                  <h3>No PGs yet</h3>
                  <p>Click "Add New PG" above to get started</p>
                </div>
              ) : (
                <div className="od-pg-list">
                {listings.slice(0, 4).map(pg => (
                  <div className="od-pg-item" key={pg._id}>
                    <div className="od-pg-item-top">
                      <div className="od-pg-thumb">
                        {pg.image
                          ? <SmartImage src={pg.image} alt={pg.title} fallback="" />
                          : '🏠'
                        }
                      </div>
                      <div className="od-pg-info">
                        <div className="od-pg-name">{pg.title}</div>
                        <div className="od-pg-loc">
                          📍 {pg.city || pg.area || pg.location || 'Location N/A'}
                        </div>
                        <div className="od-pg-price">{pg.price || 'Price N/A'}</div>
                      </div>
                      <span className={`od-pill ${pg.isVacant ? 'od-pill--green' : 'od-pill--red'} od-pill--compact`}>
                        {pg.isVacant ? '● Vacant' : '● Occupied'}
                      </span>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>

            {/* Earnings overview */}
            <div className="od-card">
              <div className="od-card-header">
                <span className="od-card-title">💰 Earnings Overview</span>
                <button className="od-chip" onClick={() => setSection('earnings')}>View Report</button>
              </div>
              <div className="od-earnings-big">
                <div className="od-earnings-label">Actual Monthly Revenue</div>
                <div className="od-earnings-num">₹{totalEarning.toLocaleString('en-IN')}</div>
              </div>
              <div className="od-table-wrap">
              <table className="od-table" style={{ marginTop: '1rem' }}>
                <thead><tr><th>Category</th><th>Gender</th><th>Rooms</th><th>Rent</th><th>Status</th></tr></thead>
                <tbody>
                  {(listings || []).flatMap(pg => {
                    const roomData = pg?.rooms && pg.rooms.length > 0 
                  ? pg.rooms 
                  : [{ 
                      roomType: pg.rooms?.[0]?.roomType || (pg.title?.toLowerCase().includes('apartment') ? 'Apartment' : 'PG'), 
                      totalRooms: 1, 
                      rent: calculatePGEarning(pg), 
                      isFallback: true 
                    }];
                    
                    return roomData.map((r, i) => (
                      <tr key={`${pg._id}-${i}`}>
                        <td style={{ fontWeight: 600 }}>{r.roomType}</td>
                        <td style={{ textTransform: 'capitalize' }}>
                      {pg?.pgType === 'boys' ? 'Boys' : pg?.pgType === 'girls' ? 'Girls' : 'Co-ed'}
                    </td>
                    <td>{r.roomType === 'Apartment' ? `${r.totalRooms} BHK` : r.totalRooms}</td>
                    <td style={{ color: '#e53528', fontWeight: 700 }}>₹{Number(r?.rent || 0).toLocaleString('en-IN')}</td>
                        <td>
                          <span className={`od-pill ${pg?.isVacant ? 'od-pill--green' : 'od-pill--red'}`}>
                            {pg?.isVacant ? 'Vacant' : 'Occupied'}
                          </span>
                        </td>
                      </tr>
                    ));
                  }).slice(0, 5)}
                  {(listings || []).length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: '#aaa', padding: '1rem' }}>No data yet</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </>
      );

      /* PG LISTINGS */
      case 'listings': return (
        <div className="od-card">
          <div className="od-card-header">
            <span className="od-card-title">📋 All PG Listings</span>
            <button className="od-btn-primary" style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
              onClick={() => setShowCreate(true)}>Add New PG</button>
          </div>
          {loading ? <div className="od-spinner" /> : listings.length === 0 ? (
            <div className="od-empty">
              <div className="od-empty-icon">🏠</div>
              <h3>No PGs listed yet</h3>
              <p>Add your first PG using the button above.</p>
            </div>
          ) : (
            <div className="od-pg-list">
              {listings.map(pg => (
                <div className="od-pg-item" key={pg._id}>
                  {/* Top: thumbnail + info */}
                  <div className="od-pg-item-top">
                    <div className="od-pg-thumb">
                      {pg.image
                        ? <SmartImage src={pg.image} alt={pg.title} fallback="" />
                        : '🏠'
                      }
                    </div>
                    <div className="od-pg-info">
                      <div className="od-pg-name">{pg.title}</div>
                      <div className="od-pg-loc">
                        📍 {pg.city || pg.area || pg.location || 'Location N/A'}{pg.pgType ? ` · ${pg.pgType}` : ''}
                      </div>
                      <div className="od-pg-price">{pg.price}</div>
                    </div>
                  </div>
                  {/* Bottom: action buttons */}
                  <div className="od-pg-actions">
                    <span className={`od-pill ${pg.isVacant ? 'od-pill--green' : 'od-pill--red'}`}>
                      {pg.isVacant ? '● Vacant' : '● Occupied'}
                    </span>
                    <button className="od-btn-sm od-btn-sm--outline" onClick={() => toggleStatus(pg._id)}>
                      {pg.isVacant ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="od-btn-sm od-btn-sm--outline" onClick={() => { setEditingPG(pg); setShowCreate(true); }}>
                      Edit
                    </button>
                    <button className="od-btn-sm od-btn-sm--ghost" onClick={() => setDeletePGId(pg._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      /* EARNINGS */
      case 'earnings': return (
        <div className="od-card">
          <div className="od-card-header"><span className="od-card-title">💰 Total Earnings</span></div>
          <div className="od-earnings-big" style={{ marginBottom: '1.5rem' }}>
            <div className="od-earnings-label">Actual Monthly Revenue</div>
            <div className="od-earnings-num">₹{totalEarning.toLocaleString('en-IN')}</div>
          </div>
          <div className="od-table-wrap">
          <table className="od-table">
            <thead><tr><th>Category</th><th>Gender</th><th>Rooms</th><th>Rent</th><th>Monthly Actual</th></tr></thead>
            <tbody>
              {(listings || []).flatMap(pg => {
                // Use actual rooms from DB, or a better fallback if missing
                const roomData = pg?.rooms && pg.rooms.length > 0 
                  ? pg.rooms 
                  : [{ 
                      roomType: pg.rooms?.[0]?.roomType || 'PG', 
                      totalRooms: 1, 
                      rent: calculatePGEarning(pg), 
                      isFallback: true 
                    }];
                
                return roomData.map((r, i) => {
                  // For PG, rent is per room. For Apartment, rent is for the whole unit.
                  const multiplier = r.roomType === 'PG' ? Number(r.totalRooms || 1) : 1;
                  const actualEarning = Number(r?.rent || 0) * multiplier;

                  return (
                    <tr key={`earn-${pg._id}-${i}`}>
                      <td style={{ fontWeight: 600 }}>
                        {r.roomType}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {pg?.pgType === 'boys' ? 'Boys' : pg?.pgType === 'girls' ? 'Girls' : 'Co-ed'}
                      </td>
                      <td>{r.roomType === 'Apartment' ? `${r.totalRooms} BHK` : r.totalRooms}</td>
                      <td style={{ color: '#e53528', fontWeight: 700 }}>₹{Number(r?.rent || 0).toLocaleString('en-IN')}</td>
                      <td style={{ color: '#065f46', fontWeight: 700 }}>
                        {pg?.isVacant ? (
                          <span style={{ color: '#9ca3af', fontWeight: 400 }}>Vacant</span>
                        ) : (
                          `₹${actualEarning.toLocaleString('en-IN')}`
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
              {(listings || []).length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>No data yet</td></tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Summary rows OUTSIDE the scroll area — always fully visible */}
          {listings?.length > 0 && (
            <div style={{ borderTop: '2px solid #e53528', marginTop: '0.5rem' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 0.6rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151' }}>Actual Monthly Revenue</span>
                <span style={{ color: '#065f46', fontWeight: 800, fontSize: '1rem' }}>₹{totalEarning.toLocaleString('en-IN')}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.65rem 0.6rem', background: '#f8fafc'
              }}>
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#64748b' }}>Potential Revenue (100% Occ.)</span>
                <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>₹{potentialEarning.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>

      );

      /* SETTINGS */
      case 'settings': return (
        <div className="od-card" style={{ maxWidth: '500px' }}>
          <div className="od-card-header"><span className="od-card-title">⚙️ Account Settings</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="od-form-col"><label>Full Name</label><input defaultValue={userName} /></div>
            <div className="od-form-col"><label>Email</label><input type="email" defaultValue={userEmail} placeholder="your@email.com" /></div>
            <div className="od-form-col"><label>Change Password</label><input type="password" placeholder="New password" /></div>
            <button className="od-btn-primary" style={{ alignSelf: 'flex-start' }}>Save Changes</button>
            <hr style={{ border: 'none', borderTop: '1px solid #eee' }} />
            <button className="od-btn-sm od-btn-sm--ghost"
              style={{ alignSelf: 'flex-start', padding: '0.5rem 1.2rem' }}
              onClick={handleLogout}>🚪 Logout</button>
          </div>
        </div>
      );

      default: return null;
    }
  };

  /* ─── RENDER ─── */
  return (
    <div className="od-root">

      {/* Mobile sidebar overlay */}
      <div className={`od-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── SIDEBAR ── */}
      <aside className={`od-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="od-sidebar-brand">
          <PGLogo size={30} />
        </div>

        {/* Nav */}
        <nav className="od-sidebar-nav">
          <div className="od-nav-label">MENU</div>
          {NAV.map(item => (
            <button key={item.id}
              className={`od-nav-item ${section === item.id ? 'active' : ''}`}
              onClick={() => { setSection(item.id); setSidebarOpen(false); }}>
              <span className="od-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <div className="od-main">
        {/* Topbar */}
        <header className="od-topbar">
          {/* od-topbar-inner is the actual flex row for content */}
          <div className="od-topbar-inner">
            {/* Hamburger - only visible on mobile */}
            <button
              className={`od-hamburger ${sidebarOpen ? 'open' : ''}`}
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Toggle sidebar"
            >
              <span /><span /><span />
            </button>
            <div className="od-topbar-title">
              <h1>{NAV.find(n => n.id === section)?.label || 'Dashboard'}</h1>
              <p>Welcome back, {userName}!</p>
              {!online && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: '#fef3c7', color: '#92400e',
                  borderRadius: '6px', padding: '3px 10px',
                  fontSize: '0.72rem', fontWeight: 700, marginTop: '4px'
                }}>
                  📡 Offline — changes will sync when you reconnect
                </span>
              )}
            </div>
            <div className="od-topbar-right">
              <button className="od-add-pg-btn" onClick={() => setShowCreate(true)}>
                <span className="od-add-pg-plus">+</span>
              </button>
              {/* Profile with dropdown */}
              <div className="od-profile-wrap">
                <div className="od-avatar" onClick={() => setShowUserMenu(v => !v)}>
                  {initial}
                </div>
                {showUserMenu && (
                  <div className="od-user-dropdown">
                    <div className="od-user-dropdown-name">{userName}</div>
                    <div className="od-user-dropdown-role">Owner Account</div>
                    <hr className="od-user-dropdown-divider" />
                    <button className="od-user-dropdown-item od-user-dropdown-item--red" onClick={handleLogout}>
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="od-content">
          {renderSection()}
        </div>
      </div>

      {/* Create PG Modal */}
      {showCreate && (
        <CreatePGModal
          key={editingPG?._id || 'new'}
          initialData={editingPG}
          onClose={() => { setShowCreate(false); setEditingPG(null); }}
          onCreated={(savedPG, isEdit) => { 
            if (isEdit) {
              setListings(l => l.map(p => p._id === savedPG._id ? savedPG : p));
            } else {
              setListings(l => [savedPG, ...l]); setSection('listings');
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletePGId && (
        <DeleteConfirmModal
          onCancel={() => setDeletePGId(null)}
          onConfirm={deletePG}
        />
      )}
    </div>
  );
}
