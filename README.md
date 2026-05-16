# 🏠 PG Finder Web App

A full-stack web application that helps students and working professionals find **Paying Guest (PG) accommodations** across India. Owners can list their PG properties, and seekers can browse, filter, save, and locate them on an interactive map — all with an **offline-first** experience.

---

## 🌟 Features

### For PG Seekers
- **Browse Listings** — View all available PGs with photos, price, amenities, and location details.
- **Search & Filter** — Filter PGs by city, gender preference (Boys / Girls / Co-ed), and price range.
- **Save Favourites** — Bookmark PGs to your personal saved list (synced to your account).
- **Interactive Map** — Explore all PGs on a live map powered by **Leaflet + OpenStreetMap**.
- **Get Directions** — One-click "Get Directions" opens Google Maps with your live GPS location as the origin and the PG as the destination.
- **View Details** — Full listing page with room types, rent, deposit, amenities (Wi-Fi, AC, Food, CCTV), and owner contact.

### For PG Owners
- **Owner Dashboard** — A dedicated dashboard to manage all your listed properties.
- **Add / Edit / Delete PGs** — Full CRUD operations on your listings.
- **Multi-Image Upload** — Upload multiple photos per listing (stored as Base64, supports Cloudinary).
- **Vacancy Toggle** — Instantly mark a PG as vacant or occupied with a single click.
- **Auto Geocoding** — When you save a listing, the backend automatically geocodes the address using the **Nominatim (OpenStreetMap)** API and pins it on the map — no manual coordinate entry required.

### App-Wide
- **JWT Authentication** — Secure signup/login with JSON Web Tokens.
- **Role-Based Access** — Separate flows for Seekers and Owners. Protected routes redirect unauthenticated users to login.
- **Offline-First Architecture** — Built with a custom Stale-While-Revalidate (SWR) engine using **IndexedDB** so the app works even without a network connection.
- **Offline Mutation Queue** — Write operations (save/unsave PG, etc.) are queued when offline and automatically replayed when the connection is restored.
- **Image Caching** — PG images are cached in IndexedDB (up to 120 images with LRU eviction) for instant load on repeat visits.
- **Self-Healing Saved List** — If a PG listing is deleted, stale references are automatically cleaned from all users' saved lists.

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** + **Vite** | UI framework and dev/build tooling |
| **React Router v7** | Client-side routing |
| **Leaflet** + **React-Leaflet** | Interactive map with PG markers |
| **Material UI (MUI v7)** | UI component library |
| **Bootstrap 5** + **React-Bootstrap** | Responsive layout and utility classes |
| **Axios** | HTTP client for API calls |
| **IndexedDB** (custom) | Offline cache (responses, images, sync queue) |
| **Sass** | CSS pre-processing |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js** + **Express 5** | REST API server |
| **MongoDB** + **Mongoose** | Database and ODM |
| **JWT** (`jsonwebtoken`) | Authentication tokens |
| **bcryptjs** | Password hashing |
| **Multer** + **Cloudinary** | Image upload support |
| **Nominatim API** | Free geocoding (address → lat/lng) |
| **dotenv** | Environment variable management |
| **Nodemon** | Dev server auto-restart |

---

## 📁 Project Structure

```
PG-Finder-Web-App/
├── backend/
│   ├── controllers/          # (Reserved for future controller logic)
│   ├── middleware/
│   │   └── auth.js           # JWT verification middleware
│   ├── models/
│   │   ├── Listing.js        # Mongoose schema for PG listings
│   │   └── Users.js          # Mongoose schema for user accounts
│   ├── routes/
│   │   ├── auth.js           # Signup, Login, Saved PGs CRUD
│   │   └── listings.js       # Listings CRUD + geocoding
│   ├── services/             # (Reserved for future services)
│   ├── .env.example          # Environment variable template
│   ├── db.js                 # MongoDB connection helper
│   └── server.js             # Express app entry point
│
└── frontend/
    ├── public/               # Static assets
    └── src/
        ├── components/
        │   ├── InsertPG.jsx      # Form to add/edit a PG listing
        │   ├── InsertTenant.jsx  # Tenant information form
        │   ├── Navigation.jsx    # Top navigation bar
        │   ├── Footer.jsx        # Site footer
        │   ├── SmartImage.jsx    # Image component with offline cache fallback
        │   ├── Slider.jsx        # Image carousel/slider
        │   └── PgFrontend.jsx    # PG card component for listings grid
        ├── pages/
        │   ├── Home.jsx          # Landing page with search & featured listings
        │   ├── Login.jsx         # Login page
        │   ├── Signup.jsx        # Registration page
        │   ├── PGListings.jsx    # Searchable grid of all available PGs
        │   ├── ExploreMap.jsx    # Interactive Leaflet map (auth-protected)
        │   ├── OwnerDashboard.jsx# Owner's property management dashboard
        │   ├── About.jsx         # About the project page
        │   └── Contact.jsx       # Contact page
        ├── utils/
        │   ├── offlineManager.js # Full offline-first SWR engine (IndexedDB)
        │   └── dijkstra.js       # Dijkstra's algorithm utility
        ├── App.jsx               # Root component with route definitions
        └── main.jsx              # React entry point
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (or local MongoDB)
- Cloudinary account (for image uploads, optional)

### 1. Clone the Repository

```bash
git clone https://github.com/SarthakUniyal/PG-Finder-Web-App.git
cd PG-Finder-Web-App
```

### 2. Setup the Backend

```bash
cd backend
npm install
```

Copy the environment variable template and fill in your values:

```bash
cp .env.example .env
```

**`.env` variables:**

```env
PORT=4000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key_here
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Start the backend server:

```bash
nodemon server.js
# or: node server.js
```

The server will run on `http://localhost:4000`.

### 3. Setup the Frontend

```bash
cd ../frontend
npm install
npm run dev
```

The frontend dev server will run on `http://localhost:5173`.

---

## 🔌 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/api/auth/signup` | ❌ | Register a new user |
| `POST` | `/api/auth/login` | ❌ | Login and receive a JWT |
| `GET` | `/api/auth/saved-pgs` | ✅ | Get saved PG IDs for the logged-in user |
| `GET` | `/api/auth/saved-pgs-populated` | ✅ | Get full saved PG objects (with self-healing) |
| `POST` | `/api/auth/saved-pgs/:listingId` | ✅ | Save a PG to the user's list |
| `DELETE` | `/api/auth/saved-pgs/:listingId` | ✅ | Remove a PG from the user's list |

### Listings (`/api/listings`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `GET` | `/api/listings` | ❌ | Get all listings (supports `?vacant=true`) |
| `GET` | `/api/listings/owner` | ✅ | Get listings for the logged-in owner |
| `GET` | `/api/listings/:id` | ❌ | Get a single listing by ID |
| `POST` | `/api/listings` | ✅ | Create a new PG listing |
| `PUT` | `/api/listings/:id` | ✅ | Update an existing listing |
| `PATCH` | `/api/listings/:id/status` | ✅ | Toggle the vacancy status |
| `DELETE` | `/api/listings/:id` | ✅ | Delete a listing |

---

## 🗺️ How Geocoding Works

When a PG owner saves a listing, the **backend automatically converts the address into GPS coordinates**:

1. The server uses the **Nominatim (OpenStreetMap)** API — a free geocoding service.
2. It builds multiple query variations from the address fields (plot, street, landmark, area, city, PIN code) as fallbacks.
3. Results are scored by relevance (prefers matches that contain the correct city and area name).
4. The best `lat/lng` is stored in the database and used to pin the PG on the Explore Map.

---

## 📶 Offline-First Architecture

The app uses a custom **Stale-While-Revalidate (SWR)** engine (`offlineManager.js`) backed by **IndexedDB**:

```
First visit (online)   → Fetch from network → Store in IndexedDB → Display
Repeat visit (online)  → Read IndexedDB instantly → Display → Refresh in background
Any visit (offline)    → Read IndexedDB instantly → Display (no network needed)
Write while offline    → Queue in IndexedDB → Replay automatically when back online
```

**Three IndexedDB object stores are used:**
- `responses` — Caches API GET responses
- `images` — Caches PG images as Base64 (up to 120, with LRU eviction)
- `syncQueue` — Queues offline mutations (POST/PUT/DELETE) for replay on reconnect

---

## 👤 User Roles

| Role | What they can do |
|---|---|
| **Seeker** | Browse PGs, search/filter, save favourites, explore map, view details |
| **Owner** | All seeker features + add/edit/delete their own PG listings, toggle vacancy |

Account type is selected at signup and stored in the JWT payload for role-based routing.

---

## 📸 Screenshots

> *(Add screenshots of your app here)*

---

## 🙏 Acknowledgements

- [OpenStreetMap](https://www.openstreetmap.org/) & [Nominatim](https://nominatim.openstreetmap.org/) for free geocoding
- [Leaflet.js](https://leafletjs.com/) for the interactive map
- [MongoDB Atlas](https://www.mongodb.com/atlas) for the cloud database
- [Cloudinary](https://cloudinary.com/) for image hosting support

---

## 📄 License

This project is licensed under the **ISC License**.

---

*Built with ❤️ by [Sarthak Uniyal](https://github.com/SarthakUniyal)*
