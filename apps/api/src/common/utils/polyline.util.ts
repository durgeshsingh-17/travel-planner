import { haversineKm } from './geo.util';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Decodes a Google/OSRM encoded polyline (precision 5). */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  const next = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length + 1);

    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    latitude += next();
    longitude += next();
    points.push({ latitude: latitude / factor, longitude: longitude / factor });
  }

  return points;
}

/**
 * The point `fraction` (0–1) of the way along a path, measured by distance.
 * Used to place overnight halts on long drives.
 */
export function pointAlong(path: LatLng[], fraction: number): LatLng {
  if (path.length === 0) {
    throw new Error('Path is empty');
  }

  if (path.length === 1 || fraction <= 0) {
    return path[0];
  }

  const segments = path.slice(1).map((point, index) => haversineKm(path[index].latitude, path[index].longitude, point.latitude, point.longitude));
  const target = segments.reduce((sum, length) => sum + length, 0) * Math.min(fraction, 1);
  let travelled = 0;

  for (const [index, length] of segments.entries()) {
    if (travelled + length >= target) {
      const ratio = length === 0 ? 0 : (target - travelled) / length;
      const from = path[index];
      const to = path[index + 1];
      return {
        latitude: from.latitude + (to.latitude - from.latitude) * ratio,
        longitude: from.longitude + (to.longitude - from.longitude) * ratio
      };
    }

    travelled += length;
  }

  return path[path.length - 1];
}
