/**
 * Spatial Point-in-Polygon Engine & Geofence Polygon Matcher.
 *
 * Implements Ray-Casting algorithm (@turf/boolean-point-in-polygon compatible)
 * to intersect drawn geofence polygons with known police station circles and
 * postal PIN centroids across metropolitan jurisdiction grids.
 *
 * Capabilities:
 * 1. Validates polygon vertex limits (minimum 3, maximum 500 vertices).
 * 2. Ray-casting point-in-polygon intersection.
 * 3. Spatial aggregation: Intersects drawn polygon with postal PIN centroids and station circles.
 * 4. Multi-Zone Advisory reach estimator:
 *    "Targets 4 postal sectors across 2 police circles (Est. reach: 18,500 citizens)"
 */

// Known Postal PIN Centroids in Delhi-NCR Metropolitan Grid
export const PIN_CENTROIDS = [
  {
    pincode: '110007',
    name: 'Civil Lines / Delhi University',
    lat: 28.6920,
    lng: 77.2150,
    circle: 'Civil Lines Cyber Cell Desk',
    service_area_id: 'SA-NORTH-01',
    est_reach: 4800,
  },
  {
    pincode: '110009',
    name: 'Model Town / GTB Nagar',
    lat: 28.7050,
    lng: 77.1950,
    circle: 'Civil Lines Cyber Cell Desk',
    service_area_id: 'SA-NORTH-01',
    est_reach: 4500,
  },
  {
    pincode: '110054',
    name: 'Tis Hazari / Kashmere Gate',
    lat: 28.6700,
    lng: 77.2200,
    circle: 'Civil Lines Cyber Cell Desk',
    service_area_id: 'SA-NORTH-01',
    est_reach: 5200,
  },
  {
    pincode: '110001',
    name: 'Connaught Place / Barakhamba',
    lat: 28.6304,
    lng: 77.2177,
    circle: 'Central Cyber Cell Desk, Barakhamba Road',
    service_area_id: 'SA-CENTRAL-01',
    est_reach: 4000,
  },
  {
    pincode: '110002',
    name: 'Daryaganj / Delhi Gate',
    lat: 28.6420,
    lng: 77.2400,
    circle: 'Central Cyber Cell Desk, Barakhamba Road',
    service_area_id: 'SA-CENTRAL-01',
    est_reach: 4900,
  },
  {
    pincode: '110005',
    name: 'Karol Bagh',
    lat: 28.6520,
    lng: 77.1900,
    circle: 'Central Cyber Cell Desk, Barakhamba Road',
    service_area_id: 'SA-CENTRAL-01',
    est_reach: 5100,
  },
  {
    pincode: '110017',
    name: 'Malviya Nagar / Saket',
    lat: 28.5244,
    lng: 77.2066,
    circle: 'Saket Tech Crime Unit',
    service_area_id: 'SA-SOUTH-01',
    est_reach: 6000,
  },
  {
    pincode: '110019',
    name: 'Kalkaji / Nehru Place',
    lat: 28.5450,
    lng: 77.2550,
    circle: 'Saket Tech Crime Unit',
    service_area_id: 'SA-SOUTH-01',
    est_reach: 5500,
  },
  {
    pincode: '110048',
    name: 'Greater Kailash',
    lat: 28.5380,
    lng: 77.2380,
    circle: 'Saket Tech Crime Unit',
    service_area_id: 'SA-SOUTH-01',
    est_reach: 4800,
  },
  {
    pincode: '110027',
    name: 'Rajouri Garden',
    lat: 28.6500,
    lng: 77.1200,
    circle: 'Rajouri Garden Cyber Police Desk',
    service_area_id: 'SA-WEST-01',
    est_reach: 5000,
  },
  {
    pincode: '110015',
    name: 'Ramesh Nagar / Kirti Nagar',
    lat: 28.6580,
    lng: 77.1420,
    circle: 'Rajouri Garden Cyber Police Desk',
    service_area_id: 'SA-WEST-01',
    est_reach: 4600,
  },
  {
    pincode: '110026',
    name: 'Punjabi Bagh',
    lat: 28.6700,
    lng: 77.1300,
    circle: 'Rajouri Garden Cyber Police Desk',
    service_area_id: 'SA-WEST-01',
    est_reach: 4400,
  },
];

// Known Police Station Circles
export const STATION_CIRCLES = [
  {
    circle_name: 'Civil Lines Cyber Cell Desk',
    service_area_id: 'SA-NORTH-01',
    service_area_name: 'North Delhi Cyber Command',
    lat: 28.6920,
    lng: 77.2150,
    radius_km: 5.5,
  },
  {
    circle_name: 'Central Cyber Cell Desk, Barakhamba Road',
    service_area_id: 'SA-CENTRAL-01',
    service_area_name: 'Central Secretariat Cyber Command',
    lat: 28.6139,
    lng: 77.2090,
    radius_km: 4.5,
  },
  {
    circle_name: 'Saket Tech Crime Unit',
    service_area_id: 'SA-SOUTH-01',
    service_area_name: 'South Financial Corridors',
    lat: 28.5244,
    lng: 77.2066,
    radius_km: 6.5,
  },
  {
    circle_name: 'Rajouri Garden Cyber Police Desk',
    service_area_id: 'SA-WEST-01',
    service_area_name: 'West District Cyber Cell',
    lat: 28.6500,
    lng: 77.1200,
    radius_km: 5.0,
  },
];

/**
 * Calculates great-circle distance between two coordinates in kilometers.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Ray-Casting Point-in-Polygon Engine.
 * Tests whether a point [lng, lat] or {lat, lng} falls inside polygon coordinates.
 * Compatible with Turf.js (@turf/boolean-point-in-polygon).
 */
export function booleanPointInPolygon(point, polygon) {
  // Normalize point format to { lat, lng }
  let ptLat, ptLng;
  if (Array.isArray(point)) {
    // GeoJSON [lng, lat]
    ptLng = point[0];
    ptLat = point[1];
  } else if (point && typeof point === 'object') {
    ptLat = point.lat !== undefined ? point.lat : point.latitude;
    ptLng = point.lng !== undefined ? point.lng : point.longitude;
  }

  if (ptLat === undefined || ptLng === undefined) return false;

  // Normalize polygon vertices to array of { lat, lng }
  let ring = polygon;
  if (polygon?.type === 'Polygon' && Array.isArray(polygon.coordinates)) {
    ring = polygon.coordinates[0];
  } else if (Array.isArray(polygon) && Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
    ring = polygon[0];
  }

  if (!Array.isArray(ring) || ring.length < 3) return false;

  const vertices = ring.map((v) => {
    if (Array.isArray(v)) {
      return { lng: v[0], lat: v[1] };
    }
    return { lat: v.lat, lng: v.lng };
  });

  const n = vertices.length;
  let inside = false;
  let p1 = vertices[0];

  for (let i = 1; i <= n; i++) {
    const p2 = vertices[i % n];
    if (Math.min(p1.lng, p2.lng) < ptLng && ptLng <= Math.max(p1.lng, p2.lng)) {
      if (ptLat <= Math.max(p1.lat, p2.lat)) {
        let xinters;
        if (p1.lng !== p2.lng) {
          xinters = ((ptLng - p1.lng) * (p2.lat - p1.lat)) / (p2.lng - p1.lng) + p1.lat;
        } else {
          xinters = p1.lat;
        }
        if (p1.lat === p2.lat || ptLat <= xinters) {
          inside = !inside;
        }
      }
    }
    p1 = p2;
  }

  return inside;
}

/**
 * Validates GeoJSON polygon vertex limits and coordinate boundaries.
 */
export function validatePolygonVertices(polygon, maxVertices = 500) {
  let ring = polygon;
  if (polygon?.type === 'Polygon' && Array.isArray(polygon.coordinates)) {
    ring = polygon.coordinates[0];
  }

  if (!Array.isArray(ring)) {
    return { valid: false, error: 'Invalid polygon format: Expected coordinate array.' };
  }

  // Remove duplicate closing point if present
  let vertexCount = ring.length;
  if (vertexCount >= 4) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    const firstLng = Array.isArray(first) ? first[0] : first.lng;
    const firstLat = Array.isArray(first) ? first[1] : first.lat;
    const lastLng = Array.isArray(last) ? last[0] : last.lng;
    const lastLat = Array.isArray(last) ? last[1] : last.lat;
    if (firstLng === lastLng && firstLat === lastLat) {
      vertexCount -= 1;
    }
  }

  if (vertexCount < 3) {
    return { valid: false, error: 'Polygon must have at least 3 distinct vertices.' };
  }

  if (vertexCount > maxVertices) {
    return {
      valid: false,
      error: `Polygon exceeds maximum vertex limit of ${maxVertices} (has ${vertexCount} vertices).`,
    };
  }

  // Check geographic coordinate ranges
  for (const pt of ring) {
    const lng = Array.isArray(pt) ? pt[0] : pt.lng;
    const lat = Array.isArray(pt) ? pt[1] : pt.lat;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return { valid: false, error: `Coordinate out of bounds: lat ${lat}, lng ${lng}.` };
    }
  }

  return { valid: true, vertexCount };
}

/**
 * Computes polygon bounding box and geographic centroid.
 */
export function getPolygonCentroidAndBBox(polygon) {
  let ring = polygon;
  if (polygon?.type === 'Polygon' && Array.isArray(polygon.coordinates)) {
    ring = polygon.coordinates[0];
  }

  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  let sumLat = 0,
    sumLng = 0;
  const count = ring.length;

  for (const pt of ring) {
    const lng = Array.isArray(pt) ? pt[0] : pt.lng;
    const lat = Array.isArray(pt) ? pt[1] : pt.lat;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    sumLat += lat;
    sumLng += lng;
  }

  return {
    centroid: { lat: sumLat / count, lng: sumLng / count },
    bbox: { minLat, maxLat, minLng, maxLng },
  };
}

/**
 * Intersects drawn polygon with known station circles and PIN centroids.
 * Computes affected PINs, circles, and estimated citizen reach.
 *
 * Output format:
 * "Targets 4 postal sectors across 2 police circles (Est. reach: 18,500 citizens)"
 */
export function matchPolygonToJurisdictions(polygon) {
  if (!polygon) {
    return {
      matched_pincodes: [],
      postal_sector_count: 0,
      matched_circles: [],
      police_circle_count: 0,
      matched_service_areas: [],
      estimated_citizen_reach: 0,
      multi_zone_summary: 'Targets 0 postal sectors across 0 police circles (Est. reach: 0 citizens)',
      polygon_geojson: null,
      centroid: null,
    };
  }

  // 1. Point-in-polygon on all PIN Centroids
  const matchedPins = [];
  for (const pin of PIN_CENTROIDS) {
    if (booleanPointInPolygon({ lat: pin.lat, lng: pin.lng }, polygon)) {
      matchedPins.push(pin);
    }
  }

  // 2. Intersect with Station Circles
  const matchedCircles = new Set();
  const matchedServiceAreas = new Set();

  for (const circle of STATION_CIRCLES) {
    let circleIntersected = false;

    // Check if circle center is inside polygon
    if (booleanPointInPolygon({ lat: circle.lat, lng: circle.lng }, polygon)) {
      circleIntersected = true;
    } else {
      // Check if any matched pin belongs to this circle
      if (matchedPins.some((p) => p.circle === circle.circle_name)) {
        circleIntersected = true;
      } else {
        // Check if any polygon vertex is within circle radius
        let ring = polygon;
        if (polygon?.type === 'Polygon' && Array.isArray(polygon.coordinates)) {
          ring = polygon.coordinates[0];
        }
        for (const pt of ring) {
          const ptLat = Array.isArray(pt) ? pt[1] : pt.lat;
          const ptLng = Array.isArray(pt) ? pt[0] : pt.lng;
          if (haversineDistanceKm(circle.lat, circle.lng, ptLat, ptLng) <= circle.radius_km) {
            circleIntersected = true;
            break;
          }
        }
      }
    }

    if (circleIntersected) {
      matchedCircles.add(circle.circle_name);
      matchedServiceAreas.add(circle.service_area_id);
    }
  }

  // Ensure circles from matched pins are included
  for (const pin of matchedPins) {
    if (pin.circle) matchedCircles.add(pin.circle);
    if (pin.service_area_id) matchedServiceAreas.add(pin.service_area_id);
  }

  const pincodesList = matchedPins.map((p) => p.pincode);
  const circlesList = Array.from(matchedCircles);
  const serviceAreasList = Array.from(matchedServiceAreas);

  // If no pins strictly inside polygon but polygon intersects a circle, fallback to circle pins
  if (pincodesList.length === 0 && circlesList.length > 0) {
    for (const circle of STATION_CIRCLES) {
      if (circlesList.includes(circle.circle_name)) {
        const fallbackPins = PIN_CENTROIDS.filter((p) => p.circle === circle.circle_name);
        for (const fp of fallbackPins) {
          if (!pincodesList.includes(fp.pincode)) {
            pincodesList.push(fp.pincode);
            matchedPins.push(fp);
          }
        }
      }
    }
  }

  // Calculate estimated citizen reach
  const estimatedReach = matchedPins.reduce((sum, p) => sum + (p.est_reach || 4500), 0);
  const formattedReach = estimatedReach.toLocaleString('en-IN');

  const sectorCount = pincodesList.length;
  const circleCount = circlesList.length;

  const multiZoneSummary = `Targets ${sectorCount} postal ${
    sectorCount === 1 ? 'sector' : 'sectors'
  } across ${circleCount} police ${circleCount === 1 ? 'circle' : 'circles'} (Est. reach: ${formattedReach} citizens)`;

  // Build standard GeoJSON Polygon
  let coordinates;
  if (polygon?.type === 'Polygon' && Array.isArray(polygon.coordinates)) {
    coordinates = polygon.coordinates;
  } else if (Array.isArray(polygon)) {
    const rawRing = polygon.map((pt) => {
      if (Array.isArray(pt)) return [pt[0], pt[1]];
      return [pt.lng, pt.lat];
    });
    // Ensure closed loop
    if (
      rawRing.length > 0 &&
      (rawRing[0][0] !== rawRing[rawRing.length - 1][0] ||
        rawRing[0][1] !== rawRing[rawRing.length - 1][1])
    ) {
      rawRing.push([rawRing[0][0], rawRing[0][1]]);
    }
    coordinates = [rawRing];
  }

  const { centroid, bbox } = getPolygonCentroidAndBBox(polygon);

  return {
    matched_pincodes: pincodesList,
    postal_sector_count: sectorCount,
    matched_pins_detail: matchedPins,
    matched_circles: circlesList,
    police_circle_count: circleCount,
    matched_service_areas: serviceAreasList,
    estimated_citizen_reach: estimatedReach,
    multi_zone_summary: multiZoneSummary,
    polygon_geojson: {
      type: 'Polygon',
      coordinates,
    },
    centroid,
    bbox,
  };
}
