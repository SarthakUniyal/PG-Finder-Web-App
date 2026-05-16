import React from 'react';

/**
 * PG Lodge Locator SVG Logo
 * Matches the bottom-left logo from the reference image:
 *  - Blue teardrop map-pin shape
 *  - Orange building silhouette inside the pin
 *  - Wifi/signal arcs at the top of the pin
 *  - "PG" in orange bold text
 *  - "LODGE LOCATOR" in dark navy bold text
 */
export default function PGLogo({ size = 44, showText = true }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
      {/* ── Pin Icon ── */}
      <svg
        width={size}
        height={size * 1.1}
        viewBox="0 0 100 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Drop-shadow filter */}
        <defs>
          <filter id="pinshadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1a3a6b" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Outer blue pin body */}
        <path
          d="M50 4 C28 4 10 22 10 44 C10 68 50 106 50 106 C50 106 90 68 90 44 C90 22 72 4 50 4 Z"
          fill="#1a5fa8"
          filter="url(#pinshadow)"
        />

        {/* Inner lighter circle area */}
        <circle cx="50" cy="42" r="30" fill="#1870c8" />

        {/* Wifi / signal arcs at top */}
        <path d="M42 20 Q50 14 58 20" stroke="#f5a623" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M46 25 Q50 21 54 25" stroke="#f5a623" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Building silhouette in orange */}
        {/* Main building body */}
        <rect x="36" y="38" width="28" height="22" rx="1" fill="#f5a623" />
        {/* Roof / top triangle */}
        <polygon points="34,38 50,26 66,38" fill="#e8920a" />
        {/* Door */}
        <rect x="45" y="50" width="10" height="10" rx="1" fill="#1a5fa8" />
        {/* Windows */}
        <rect x="38" y="42" width="6" height="5" rx="0.5" fill="white" opacity="0.85" />
        <rect x="56" y="42" width="6" height="5" rx="0.5" fill="white" opacity="0.85" />
      </svg>

      {/* ── Text ── */}
      {showText && (
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, userSelect: 'none' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f5a623', letterSpacing: '0.5px', fontFamily: 'Inter,sans-serif' }}>
            PG
          </span>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1a3a6b', letterSpacing: '1.5px', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>
            LODGE LOCATOR
          </span>
        </span>
      )}
    </span>
  );
}
