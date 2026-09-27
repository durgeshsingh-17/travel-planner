import { describe, expect, it } from 'vitest';

import { decodePolyline, pointAlong } from './polyline.util';

describe('decodePolyline', () => {
  it('decodes the reference example', () => {
    // From the polyline algorithm documentation.
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 }
    ]);
  });
});

describe('pointAlong', () => {
  const path = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 0, longitude: 3 }
  ];

  it('walks the path by distance', () => {
    expect(pointAlong(path, 0.5).longitude).toBeCloseTo(1.5, 5);
    expect(pointAlong(path, 0)).toEqual(path[0]);
    expect(pointAlong(path, 1)).toEqual(path[2]);
  });
});
