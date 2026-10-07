const R = 6371;
const rad = (x) => (x * Math.PI) / 180;
export function haversine(a, b) {
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export function routeDistanceFrom(position, stops) {
  if (!stops.length) return 0;
  let idx = 0,
    min = Infinity;
  stops.forEach((s, i) => {
    const d = haversine(position, s);
    if (d < min) {
      min = d;
      idx = i;
    }
  });
  let total = min;
  for (let i = idx; i < stops.length - 1; i++)
    total += haversine(stops[i], stops[i + 1]);
  return { totalKm: total, nextIndex: idx };
}
export function buildEtas(position, stops, recentSpeeds = []) {
  if (!position || !stops.length) return {};
  const speeds = recentSpeeds.filter(
    (x) => Number.isFinite(x) && x > 2 && x < 110,
  );
  const fallback = 30;
  const avg = speeds.length
    ? speeds.reduce((a, b) => a + b, 0) / speeds.length
    : fallback;
  const result = {};
  let nearest = 0,
    min = Infinity;
  stops.forEach((s, i) => {
    const d = haversine(position, s);
    if (d < min) {
      min = d;
      nearest = i;
    }
  });
  for (let i = nearest; i < stops.length; i++) {
    let distance = haversine(position, stops[i]);
    for (let j = nearest; j < i; j++)
      distance += haversine(stops[j], stops[j + 1]);
    const minutes = Math.max(0, Math.round((distance / avg) * 60));
    result[stops[i]._id.toString()] = {
      minutes,
      distanceKm: distance,
      arrival: new Date(Date.now() + minutes * 60000).toISOString(),
    };
  }
  return result;
}
