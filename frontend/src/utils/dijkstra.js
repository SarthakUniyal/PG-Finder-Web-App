/**
 * Haversine Formula — straight-line distance between two [lat, lng] points in km
 */
export function haversineDistance([lat1, lon1], [lat2, lon2]) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Dijkstra's Algorithm on a complete graph of geographic nodes.
 *
 * nodes   — array of { id, coords: [lat, lng] }
 * srcIdx  — index of the source node (0 = user location)
 *
 * Returns { distances, previous }
 *   distances[i] — shortest distance (km) from source to node i
 *   previous[i]  — predecessor index on the shortest path to i
 */
export function dijkstra(nodes, srcIdx = 0) {
  const n = nodes.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const visited = new Array(n).fill(false);

  dist[srcIdx] = 0;

  for (let iteration = 0; iteration < n; iteration++) {
    // Pick the unvisited node with the smallest known distance (min-heap O(n²))
    let u = -1;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && (u === -1 || dist[j] < dist[u])) u = j;
    }
    if (u === -1 || dist[u] === Infinity) break;
    visited[u] = true;

    // Relax all edges from u (complete graph — every node is a neighbour)
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      const edgeWeight = haversineDistance(nodes[u].coords, nodes[v].coords);
      const newDist = dist[u] + edgeWeight;
      if (newDist < dist[v]) {
        dist[v] = newDist;
        prev[v] = u;
      }
    }
  }

  return { distances: dist, previous: prev };
}

/**
 * Reconstruct the path from source to target using the `previous` array.
 * Returns an array of node indices from source → target.
 */
export function reconstructPath(previous, targetIdx) {
  const path = [];
  let cur = targetIdx;
  while (cur !== -1) {
    path.unshift(cur);
    cur = previous[cur];
  }
  return path;
}

/**
 * High-level helper: given the user's position and an array of PG listings
 * (each with .lat, .lng, .title, ._id), runs Dijkstra and returns:
 *
 *   {
 *     nearest: { pg, distanceKm },
 *     allResults: [{ pg, distanceKm }, ...] sorted nearest-first
 *   }
 */
export function findNearestPG(userPos, pgs) {
  if (!userPos || !pgs || pgs.length === 0) return null;

  // Filter only pgs that have valid coordinates
  const validPGs = pgs.filter((pg) => pg.lat && pg.lng);
  if (validPGs.length === 0) return null;

  // Build node array: index 0 = user, 1…n = PGs
  const nodes = [
    { id: 'user', coords: userPos },
    ...validPGs.map((pg) => ({ id: pg._id, coords: [pg.lat, pg.lng], pg })),
  ];

  const { distances, previous } = dijkstra(nodes, 0);

  // Build results (skip index 0 which is the user node)
  const allResults = validPGs.map((pg, i) => ({
    pg,
    distanceKm: distances[i + 1],
    path: reconstructPath(previous, i + 1),
  }));

  allResults.sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    nearest: allResults[0],
    allResults,
  };
}
