const R = 6371;
const rad = (x) => (x * Math.PI) / 180;
export const hasCoordinates = (point) =>
  Number.isFinite(point?.latitude) &&
  point.latitude >= -90 &&
  point.latitude <= 90 &&
  Number.isFinite(point?.longitude) &&
  point.longitude >= -180 &&
  point.longitude <= 180;

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

export function nearestRouteStop(position, stops) {
  if (!hasCoordinates(position) || !stops.length || stops.some((stop) => !hasCoordinates(stop))) {
    return null;
  }
  let nearest = { index: 0, distanceKm: Infinity };
  stops.forEach((stop, index) => {
    const distanceKm = haversine(position, stop);
    if (distanceKm < nearest.distanceKm) nearest = { index, distanceKm };
  });
  return nearest;
}

export function routeProgressFrom(position, stops) {
  if (!hasCoordinates(position) || !stops.length || stops.some((stop) => !hasCoordinates(stop))) {
    return null;
  }
  if (stops.length === 1) {
    return { position: 0, nextIndex: 0, distanceFromRouteKm: haversine(position, stops[0]) };
  }

  const longitudeScale = Math.cos(rad(position.latitude));
  const point = {
    x: position.longitude * longitudeScale,
    y: position.latitude,
  };
  let closest = { distanceSquared: Infinity, position: 0, nextIndex: 1 };

  for (let index = 0; index < stops.length - 1; index++) {
    const start = {
      x: stops[index].longitude * longitudeScale,
      y: stops[index].latitude,
    };
    const end = {
      x: stops[index + 1].longitude * longitudeScale,
      y: stops[index + 1].latitude,
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared
      ? Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
              lengthSquared,
          ),
        )
      : 0;
    const projectedX = start.x + fraction * dx;
    const projectedY = start.y + fraction * dy;
    const distanceSquared =
      (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2;

    if (distanceSquared < closest.distanceSquared) {
      closest = {
        distanceSquared,
        position: index + fraction,
        nextIndex: index + 1,
      };
    }
  }

  return {
    position: closest.position,
    nextIndex: closest.nextIndex,
    distanceFromRouteKm: Math.sqrt(closest.distanceSquared) * 111.195,
  };
}

export function routeTrackingState(
  position,
  stops,
  isStopped,
  stopProximityMeters,
) {
  const stopLocationAvailable =
    stops.length > 0 && stops.every((stop) => hasCoordinates(stop));
  if (!stopLocationAvailable) {
    return {
      stopLocationAvailable: false,
      routeProgress: null,
      currentStop: null,
      nearestStop: null,
      nextStop: null,
      nextStopIndex: null,
    };
  }

  const progress = routeProgressFrom(position, stops);
  const nearest = nearestRouteStop(position, stops);
  const isAtStop =
    isStopped &&
    nearest &&
    nearest.distanceKm * 1000 <= stopProximityMeters;
  const currentStop = isAtStop
    ? {
        _id: stops[nearest.index]._id,
        name: stops[nearest.index].name,
        sequence: stops[nearest.index].sequence,
      }
    : null;
  const nextStopIndex = isAtStop
    ? nearest.index + 1
    : progress?.nextIndex ?? null;

  return {
    stopLocationAvailable: true,
    routeProgress: progress?.position ?? null,
    currentStop,
    nearestStop: nearest
      ? {
          _id: stops[nearest.index]._id,
          name: stops[nearest.index].name,
          sequence: stops[nearest.index].sequence,
          distanceKm: nearest.distanceKm,
        }
      : null,
    nextStopIndex,
    nextStop:
      nextStopIndex != null && nextStopIndex < stops.length
        ? {
            _id: stops[nextStopIndex]._id,
            name: stops[nextStopIndex].name,
            sequence: stops[nextStopIndex].sequence,
          }
        : null,
  };
}

export function routeDistanceFrom(position, stops) {
  const progress = routeProgressFrom(position, stops);
  if (!progress) return null;
  const nearest = progress.nextIndex;
  let totalKm = haversine(position, stops[nearest]);
  for (let index = nearest; index < stops.length - 1; index++) {
    totalKm += haversine(stops[index], stops[index + 1]);
  }
  return { totalKm, nextIndex: nearest };
}
export function buildEtas(position, stops, recentSpeeds = [], startIndex) {
  if (!hasCoordinates(position) || !stops.length || stops.some((stop) => !hasCoordinates(stop))) {
    return {};
  }
  const speeds = recentSpeeds.filter(
    (x) => Number.isFinite(x) && x > 2 && x < 110,
  );
  const fallback = 30;
  const avg = speeds.length
    ? speeds.reduce((a, b) => a + b, 0) / speeds.length
    : fallback;
  const result = {};
  const progress = routeProgressFrom(position, stops);
  const nearest = Number.isInteger(startIndex)
    ? Math.max(0, Math.min(startIndex, stops.length))
    : progress?.nextIndex ?? nearestRouteStop(position, stops)?.index ?? 0;
  if (nearest >= stops.length) return {};
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
