/**
 * Geographic helpers for defaulting the live-session room to whichever room is
 * physically nearest the device. Pure functions — no browser APIs — so they run
 * in the fast web-node test project.
 */

export interface Coords {
	latitude: number;
	longitude: number;
}

interface RoomLocation {
	id: string;
	latitude: number | null;
	longitude: number | null;
}

/**
 * Default "you are at this venue" radius. 500 m comfortably covers a casino /
 * poker-room footprint plus GPS jitter without matching a different venue
 * across town.
 */
export const DEFAULT_NEAREST_RADIUS_METERS = 500;

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two coordinates in meters (haversine formula).
 */
export function haversineMeters(a: Coords, b: Coords): number {
	const dLat = toRadians(b.latitude - a.latitude);
	const dLng = toRadians(b.longitude - a.longitude);
	const lat1 = toRadians(a.latitude);
	const lat2 = toRadians(b.latitude);

	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Returns the room closest to `coords` whose distance is within `radiusMeters`
 * (inclusive), or `undefined` when no room has coordinates or all are out of
 * range. Rooms missing either coordinate are skipped.
 */
export function findNearestRoom<T extends RoomLocation>(
	coords: Coords,
	rooms: readonly T[],
	radiusMeters: number = DEFAULT_NEAREST_RADIUS_METERS
): T | undefined {
	let nearest: T | undefined;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (const candidate of rooms) {
		if (candidate.latitude === null || candidate.longitude === null) {
			continue;
		}
		const distance = haversineMeters(coords, {
			latitude: candidate.latitude,
			longitude: candidate.longitude,
		});
		if (distance <= radiusMeters && distance < nearestDistance) {
			nearest = candidate;
			nearestDistance = distance;
		}
	}

	return nearest;
}
