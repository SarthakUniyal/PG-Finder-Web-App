// ─── Central API Configuration ────────────────────────────────────────────────
// In PRODUCTION the backend is hosted on Render.
// In DEVELOPMENT it falls back to localhost:4000.
//
// To override locally, create   frontend/.env   with:
//   VITE_API_BASE_URL=http://localhost:4000
// ──────────────────────────────────────────────────────────────────────────────

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://pg-finder-web-app.onrender.com';

export default API_BASE_URL;
