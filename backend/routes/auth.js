const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/Users');
const auth = require('../middleware/auth');
const router = express.Router();

// --- SIGNUP ROUTE ---
router.post('/signup', async (req, res) => {
  const { fullName, email, accountType, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User with this email already exists' });
    }
    user = new User({
      fullName,
      email,
      accountType,
      password,
    });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error(err.message);
    // Corrected this line to send JSON
    res.status(500).json({ msg: 'Server Error' }); 
  }
});

// --- LOGIN ROUTE ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    const payload = {
      user: {
        id: user.id,
      },
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5h' },
      (err, token) => {
        if (err) throw err;
        // It now sends the token AND the user's role (accountType)
        res.json({ 
          token, 
          user: {
            id: user.id,
            accountType: user.accountType,
            fullName: user.fullName
          } 
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' }); 
  }
});



// ── GET /api/auth/saved-pgs-populated  →  fetch user's saved PGs with details ──
router.get('/saved-pgs-populated', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'savedListings',
      select: 'lat lng title price location pgType image images isVacant createdAt _id ownerName contactNumber description amenities rooms plotNumber street landmark area city pinCode'
    });

    // Filter out nulls (listings that were deleted after being saved)
    const validListings = (user.savedListings || []).filter(l => l != null);

    // Self-heal: if any dead refs were found, persist the cleaned list
    if (validListings.length !== (user.savedListings || []).length) {
      user.savedListings = validListings.map(l => l._id);
      await user.save();
    }

    res.json(validListings);
  } catch (err) {
    console.error('saved-pgs-populated error:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// ── GET /api/auth/saved-pgs  →  fetch user's saved PG IDs ──
router.get('/saved-pgs', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('savedListings', '_id');

    // Filter out refs pointing to deleted listings
    const validIds = (user.savedListings || []).filter(l => l != null).map(l => l._id);

    // Self-heal: persist cleaned list if any dead refs were found
    if (validIds.length !== (user.savedListings || []).length) {
      user.savedListings = validIds;
      await user.save();
    }

    res.json(validIds);
  } catch (err) {
    console.error('saved-pgs error:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// ── POST /api/auth/saved-pgs/:listingId  →  add a PG to saved list ──
router.post('/saved-pgs/:listingId', auth, async (req, res) => {
  const { listingId } = req.params;

  // 1. Strict Hex Regex for 24-character ObjectIds
  if (!/^[0-9a-fA-F]{24}$/.test(listingId)) {
    console.error(`Invalid PG ID format received: "${listingId}" (length: ${listingId.length})`);
    return res.status(400).json({ msg: 'Invalid PG ID format. Please use a valid 24-character listing ID.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    // Ensure savedListings is initialized as an array
    if (!user.savedListings) {
      user.savedListings = [];
    }

    // 2. Filter out nulls/undefined to prevent .toString() crashes
    const savedIdsAsStrings = user.savedListings
      .filter(l => l != null)
      .map(l => l.toString());

    if (!savedIdsAsStrings.includes(listingId)) {
      user.savedListings.push(listingId);
      await user.save();
      res.json(user.savedListings);
    } else {
      res.status(409).json({ msg: 'This PG is already in your list.' });
    }
  } catch (err) {
    console.error('Save PG error:', err.message);
    res.status(500).json({ msg: 'Server Error: ' + err.message });
  }
});

// ── DELETE /api/auth/saved-pgs/:listingId  →  remove a PG from saved list ──
router.delete('/saved-pgs/:listingId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.savedListings = user.savedListings.filter(l => l.toString() !== req.params.listingId);
    await user.save();
    res.json(user.savedListings);
  } catch (err) {
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;