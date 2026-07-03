import { describe, expect, it } from "vitest";
import {
	type Coords,
	DEFAULT_NEAREST_RADIUS_METERS,
	findNearestRoom,
	haversineMeters,
} from "../geo";

const TOKYO: Coords = { latitude: 35.6812, longitude: 139.7671 };

describe("haversineMeters", () => {
	it("returns 0 for identical points", () => {
		expect(haversineMeters(TOKYO, TOKYO)).toBe(0);
	});

	it("computes ~111 km for one degree of latitude", () => {
		const a: Coords = { latitude: 35, longitude: 139 };
		const b: Coords = { latitude: 36, longitude: 139 };
		const d = haversineMeters(a, b);
		// One degree of latitude ≈ 111.19 km; allow 1 km tolerance.
		expect(d).toBeGreaterThan(110_000);
		expect(d).toBeLessThan(112_000);
	});

	it("is symmetric", () => {
		const a: Coords = { latitude: 35, longitude: 139 };
		const b: Coords = { latitude: 35.5, longitude: 139.5 };
		expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
	});

	it("one degree of longitude shrinks with latitude", () => {
		const equatorial = haversineMeters(
			{ latitude: 0, longitude: 0 },
			{ latitude: 0, longitude: 1 }
		);
		const northern = haversineMeters(
			{ latitude: 60, longitude: 0 },
			{ latitude: 60, longitude: 1 }
		);
		// At 60°N a degree of longitude is roughly half the equatorial distance.
		expect(northern).toBeLessThan(equatorial);
		expect(northern).toBeCloseTo(equatorial / 2, -3);
	});
});

describe("findNearestRoom", () => {
	const near: Coords = { latitude: 35.6815, longitude: 139.7675 }; // ~50 m from TOKYO
	const far: Coords = { latitude: 34.6937, longitude: 135.5023 }; // Osaka, ~400 km

	it("picks the closest room of several within radius", () => {
		const rooms = [
			{ id: "osaka", latitude: far.latitude, longitude: far.longitude },
			{ id: "near", latitude: near.latitude, longitude: near.longitude },
			{ id: "tokyo", latitude: TOKYO.latitude, longitude: TOKYO.longitude },
		];
		// Searching from TOKYO: the exact-match "tokyo" room is closest.
		expect(findNearestRoom(TOKYO, rooms)?.id).toBe("tokyo");
	});

	it("ignores rooms with null latitude", () => {
		const rooms = [
			{ id: "no-lat", latitude: null, longitude: 139.7671 },
			{ id: "tokyo", latitude: TOKYO.latitude, longitude: TOKYO.longitude },
		];
		expect(findNearestRoom(TOKYO, rooms)?.id).toBe("tokyo");
	});

	it("ignores rooms with null longitude", () => {
		const rooms = [
			{ id: "no-lng", latitude: 35.6812, longitude: null },
			{ id: "tokyo", latitude: TOKYO.latitude, longitude: TOKYO.longitude },
		];
		expect(findNearestRoom(TOKYO, rooms)?.id).toBe("tokyo");
	});

	it("returns undefined when every room is outside the radius", () => {
		const rooms = [
			{ id: "osaka", latitude: far.latitude, longitude: far.longitude },
		];
		expect(findNearestRoom(TOKYO, rooms)).toBeUndefined();
	});

	it("returns undefined for an empty room list", () => {
		expect(findNearestRoom(TOKYO, [])).toBeUndefined();
	});

	it("returns undefined when all rooms lack coordinates", () => {
		const rooms = [
			{ id: "a", latitude: null, longitude: null },
			{ id: "b", latitude: null, longitude: null },
		];
		expect(findNearestRoom(TOKYO, rooms)).toBeUndefined();
	});

	it("respects a custom radius", () => {
		const rooms = [
			{ id: "near", latitude: near.latitude, longitude: near.longitude },
		];
		// ~50 m away: excluded by a 10 m radius, included by a 100 m radius.
		expect(findNearestRoom(TOKYO, rooms, 10)).toBeUndefined();
		expect(findNearestRoom(TOKYO, rooms, 100)?.id).toBe("near");
	});

	it("includes a room exactly at the radius boundary (inclusive)", () => {
		const oneDegLat: Coords = { latitude: 36, longitude: 139 };
		const distance = haversineMeters(
			{ latitude: 35, longitude: 139 },
			oneDegLat
		);
		const rooms = [
			{
				id: "edge",
				latitude: oneDegLat.latitude,
				longitude: oneDegLat.longitude,
			},
		];
		expect(
			findNearestRoom({ latitude: 35, longitude: 139 }, rooms, distance)?.id
		).toBe("edge");
	});

	it("exposes a sensible default radius", () => {
		expect(DEFAULT_NEAREST_RADIUS_METERS).toBe(500);
	});
});
