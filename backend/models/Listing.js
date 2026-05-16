const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomType: { type: String, enum: ['Single', 'Double', 'Triple', 'PG', 'Apartment'], default: 'PG' },
  totalRooms: { type: Number, default: 1 },
  rent: { type: Number, required: true },
  deposit: { type: Number, default: 0 },
});

const ListingSchema = new mongoose.Schema({
  // ── Owner info ──
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User_credentials' },
  ownerName: { type: String, default: '' },
  contactNumber: { type: String, default: '' },

  // ── Basic info ──
  title: { type: String, required: true },
  pgType: { type: String, enum: ['boys', 'girls', 'co-ed'], default: 'co-ed' },
  description: { type: String, default: '' },
  price: { type: String, default: '' },      // display string e.g. "₹8,500/mo"

  // ── Location ──
  city: { type: String, default: '' },
  area: { type: String, default: '' },
  street: { type: String, default: '' },
  plotNumber: { type: String, default: '' },
  landmark: { type: String, default: '' },
  pinCode: { type: String, default: '' },
  location: { type: String, default: '' },      // human-readable "Area, City"
  lat: { type: Number },
  lng: { type: Number },

  // ── Rooms (multiple types) ──
  rooms: [RoomSchema],

  // ── Amenities ──
  amenities: {
    wifi: { type: Boolean, default: false },
    ac: { type: Boolean, default: false },
    food: { type: Boolean, default: false },
    cctv: { type: Boolean, default: false },
  },

  // ── Images ──
  images: [String],   // array of base64 or URL strings
  image: { type: String, default: '' }, // primary image (first of images[])

  // ── Status ──
  isVacant: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
});

// ── Indexes for better query performance ──
ListingSchema.index({ isVacant: 1 });
ListingSchema.index({ ownerId: 1 });

module.exports = mongoose.model('Listing', ListingSchema);
