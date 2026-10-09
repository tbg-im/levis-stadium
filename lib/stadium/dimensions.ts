/**
 * Real-world dimensions for Levi's Stadium, in meters.
 *
 * World frame: the field center is the origin, +x points across the field toward the east
 * stands (bearing 62°), -z points up the field toward the north end zone (bearing 332°),
 * +y is up. Footprints come from OpenStreetMap (stadium way 296503400, SAP Tower way
 * 357300432, pitch way 357300430); heights from OSM tags and published figures.
 */

/** True-north bearing of the field's long axis (north end zone), from the OSM pitch. */
export const FIELD_BEARING_DEG = 332;

/** NFL field: 120 × 53⅓ yd including both 10-yd end zones. */
export const FIELD = {
  length: 109.728,
  width: 48.768,
  endZone: 9.144,
  yard: 0.9144,
};

/**
 * Inner edge of the seating bowl (the front wall of the lower bowl) as a rounded rectangle:
 * half-width across the field, half-length along it, and corner radius. Every tier is an
 * offset of this ring, so rows stay parallel to the field all the way around.
 */
export const BOWL = { hx: 40, hz: 68, r: 14 };

export const SEAT = {
  /** Seat pitch along a row (≈ 20 in). */
  width: 0.5,
  /** Gap left between sections for the aisle stairs. */
  aisle: 1.2,
};

/** SAP Tower (west suite tower): OSM footprint u -91…-67, v -89…88, height 44 m (7 levels). */
export const TOWER = {
  front: -67,
  back: -91,
  north: -88,
  south: 89,
  roof: 46,
  /** The tower's end blocks start where the west sideline straight ends. */
  blockStart: 54,
};

/** Main concourse that rings the top of the lower bowl. */
export const CONCOURSE = { outer: 38 };

/** East exoskeleton: back of the upper deck to the outer frame line (OSM edge ≈ u 128). */
export const EAST_FRAME = { inner: 71, outer: 86, top: 52 };

/** Video boards: 200 × 48 ft, one behind each end zone. */
export const VIDEO_BOARD = { width: 61, height: 14.6, bottom: 27 };

export const STADIUM_FACTS = {
  capacity: 68500,
  expandedCapacity: 75000,
  suites: 174,
  clubSeats: 8500,
  opened: 2014,
  towerHeight: 44,
  towerLevels: 7,
  elevation: 5,
};
