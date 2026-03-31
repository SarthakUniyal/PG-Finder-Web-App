const express  = require('express');
const router   = express.Router();
const Listing  = require('../models/Listing');
const auth     = require('../middleware/auth');

async function geocodeAddress({
  plotNumber,
  street,
  landmark,
  area,
  city,
  pinCode,
  country = 'India',
}) {
  const buildQuery = (...parts) => parts.filter(Boolean).join(', ');
  const queries = [
    buildQuery(plotNumber, street, landmark, area, city, pinCode, country),
    buildQuery(plotNumber, street, area, city, pinCode, country),
    buildQuery(street, landmark, area, city, pinCode, country),
    buildQuery(street, area, city, pinCode, country),
    buildQuery(area, city, pinCode, country),
  ].filter(Boolean);

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'PGFinderBackend/1.0',
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      // Prefer higher-confidence results closer to requested locality/city.
      const scored = data
        .map((item) => {
          const a = item.address || {};
          const text = `${item.display_name || ''} ${a.suburb || ''} ${a.neighbourhood || ''} ${a.city || ''} ${a.town || ''}`.toLowerCase();
          let score = Number(item.importance || 0);
          if (area && text.includes(String(area).toLowerCase())) score += 2;
          if (city && text.includes(String(city).toLowerCase())) score += 2;
          if (pinCode && text.includes(String(pinCode).toLowerCase())) score += 1;
          if (street && text.includes(String(street).toLowerCase())) score += 1;
          return { item, score };
        })
        .sort((x, y) => y.score - x.score);

      const best = scored[0]?.item;
      if (!best?.lat || !best?.lon) continue;
      return {
        lat: Number(best.lat),
        lng: Number(best.lon),
      };
    } catch (e) {
      // try next query variation
    }
  }

  return null;
}

// ── GET /api/listings?vacant=true  →  public, for the map ──
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.vacant === 'true') filter.isVacant = true;
    
    // Select only necessary fields for the map to vastly speed up the network request
    // We intentionally exclude the 'images' array which can contain megabytes of base64 data.
    const listings = await Listing.find(filter)
      .select('lat lng title price location image isVacant createdAt _id')
      .sort({ createdAt: -1 });
      
    res.json(listings);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ── GET /api/listings/owner  →  protected, returns only THIS owner's PGs ──
router.get('/owner', auth, async (req, res) => {
  try {
    const listings = await Listing.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ── GET /api/listings/:id  →  public, returns full listing details ──
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ msg: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ── POST /api/listings  →  protected, creates a new PG ──
router.post('/', auth, async (req, res) => {
  try {
    const {
      ownerName, contactNumber, title, pgType, description,
      city, area, street, plotNumber, landmark, pinCode, lat, lng,
      rooms, amenities, images, isVacant,
    } = req.body;

    // Build a display location string
    const location = [area, city].filter(Boolean).join(', ');
    // Build display price from first room
    const baseRent = rooms?.[0]?.rent;
    const price    = baseRent ? `₹${Number(baseRent).toLocaleString('en-IN')}/mo` : '';
    // Primary image
    const image    = images?.[0] || '';

    // Backend-side geocoding is the source of truth for precise map markers.
    const geo = await geocodeAddress({ plotNumber, street, landmark, area, city, pinCode });
    const finalLat = geo?.lat ?? lat ?? null;
    const finalLng = geo?.lng ?? lng ?? null;

    const listing = new Listing({
      ownerId: req.user.id,
      ownerName, contactNumber, title, pgType,
      description,
      city, area, street, plotNumber, landmark, pinCode,
      location, lat: finalLat, lng: finalLng,
      rooms: rooms || [],
      amenities: amenities || {},
      images: images || [],
      image,
      price,
      isVacant: isVacant !== undefined ? isVacant : true,
    });

    await listing.save();
    res.status(201).json(listing);
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ── PUT /api/listings/:id  →  protected, update a PG ──
router.put('/:id', auth, async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!listing) return res.status(404).json({ msg: 'Listing not found or not authorised' });

    const update = { ...req.body };
    // Recompute helpers
    if (update.area || update.city)
      update.location = [update.area || listing.area, update.city || listing.city].filter(Boolean).join(', ');
    if (update.rooms?.length)
      update.price = `₹${Number(update.rooms[0].rent).toLocaleString('en-IN')}/mo`;
    if (update.images?.length)
      update.image = update.images[0];

    // If location fields changed, recompute coordinates from full address.
    if (update.plotNumber || update.street || update.landmark || update.area || update.city || update.pinCode) {
      const geo = await geocodeAddress({
        plotNumber: update.plotNumber ?? listing.plotNumber,
        street: update.street ?? listing.street,
        landmark: update.landmark ?? listing.landmark,
        area: update.area ?? listing.area,
        city: update.city ?? listing.city,
        pinCode: update.pinCode ?? listing.pinCode,
      });
      if (geo) {
        update.lat = geo.lat;
        update.lng = geo.lng;
      }
    }

    Object.assign(listing, update);
    await listing.save();
    res.json(listing);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ── PATCH /api/listings/:id/status  →  toggle vacant ──
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!listing) return res.status(404).json({ msg: 'Not found' });
    listing.isVacant = !listing.isVacant;
    await listing.save();
    res.json({ isVacant: listing.isVacant });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ── DELETE /api/listings/:id  →  protected ──
router.delete('/:id', auth, async (req, res) => {
  try {
    const listing = await Listing.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
    if (!listing) return res.status(404).json({ msg: 'Not found' });
    res.json({ msg: 'Deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
