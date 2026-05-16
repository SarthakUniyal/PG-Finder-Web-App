/**
 * SmartImage.jsx
 *
 * A resilient drop-in replacement for <img> that:
 * 1. Renders the src URL immediately (zero delay — no change to perceived speed).
 * 2. Silently caches the image in IndexedDB as Base64 in the background.
 * 3. If the image fails to load (slow timeout / offline), falls back to:
 *    a) The IndexedDB Base64 cache (offline view)
 *    b) A local static fallback (e.g. /pg_card_1.png)
 *
 * Usage:
 *   <SmartImage src={pg.image} alt={pg.title} className="pg-card-img" />
 */

import React, { useState, useEffect, useRef } from 'react';
import { cacheImage, getCachedImage } from '../utils/offlineManager';

export default function SmartImage({
  src,
  alt = '',
  fallback = '/pg_card_1.png',
  style,
  className,
  ...props
}) {
  const [displaySrc, setDisplaySrc] = useState(src || fallback);
  const hasTriedCache = useRef(false);
  const mountedRef   = useRef(true);

  // Reset on src change
  useEffect(() => {
    mountedRef.current = true;
    hasTriedCache.current = false;
    setDisplaySrc(src || fallback);

    // Fire-and-forget: cache the image in IndexedDB while we display it normally
    if (src && !src.startsWith('data:') && !src.startsWith('/')) {
      cacheImage(src);
    }

    return () => { mountedRef.current = false; };
  }, [src, fallback]);

  const handleError = async () => {
    // Prevent infinite loop if fallback itself fails
    if (hasTriedCache.current) return;
    hasTriedCache.current = true;

    // 1. Try IndexedDB cache (works offline)
    if (src) {
      const cached = await getCachedImage(src);
      if (cached && mountedRef.current) {
        setDisplaySrc(cached);
        return;
      }
    }

    // 2. Fall back to local static asset
    if (mountedRef.current) {
      setDisplaySrc(fallback);
    }
  };

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      style={style}
      onError={handleError}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
}
