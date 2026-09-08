import { describe, expect, it } from "vitest";
import type { ScannedSeat, ScanSeatState } from "../seat-scan-review";
import { buildScanRows, countDetectedSeats } from "../seat-scan-review";

const KNOWN = [
	{ id: "p-takashi", name: "Takashi" },
	{ id: "p-glasses", name: "Glasses" },
];

function emptySeat(seatPosition: number): ScanSeatState {
	return { occupancy: "empty", playerId: null, playerName: null, seatPosition };
}

function seatedSeat(
	seatPosition: number,
	playerId: string,
	playerName: string
): ScanSeatState {
	return { occupancy: "player", playerId, playerName, seatPosition };
}

function heroSeat(seatPosition: number): ScanSeatState {
	return { occupancy: "hero", playerId: null, playerName: null, seatPosition };
}

function scanned(
	seatNumber: number,
	name: string,
	isHero: boolean | null = false
): ScannedSeat {
	return { isHero, name, seatNumber };
}

function rowsFor(seats: ScanSeatState[], hits: ScannedSeat[]) {
	return buildScanRows({ knownPlayers: KNOWN, scanned: hits, seats });
}

describe("buildScanRows classification", () => {
	it("registers a scanned name that matches a known player as Known", () => {
		const [row] = rowsFor([emptySeat(0)], [scanned(1, "Takashi")]);

		expect(row).toMatchObject({
			isPickable: true,
			isSelectedByDefault: true,
			kind: "known",
			matchedPlayerId: "p-takashi",
		});
	});

	it("registers an unrecognised name as a new player", () => {
		const [row] = rowsFor([emptySeat(0)], [scanned(1, "Blue shirt")]);

		expect(row).toMatchObject({
			isSelectedByDefault: true,
			kind: "new",
			matchedPlayerId: null,
		});
	});

	it("leaves a name shared by two known players unselected so it is not guessed", () => {
		const rows = buildScanRows({
			knownPlayers: [
				{ id: "p-a", name: "Regular" },
				{ id: "p-b", name: "regular" },
			],
			scanned: [scanned(1, "Regular")],
			seats: [emptySeat(0)],
		});

		expect(rows[0]).toMatchObject({
			isPickable: true,
			isSelectedByDefault: false,
			matchedPlayerId: null,
		});
	});

	it("treats a seat that already holds the scanned player as no change", () => {
		const [row] = rowsFor(
			[seatedSeat(0, "p-glasses", "Glasses")],
			[scanned(1, "glasses")]
		);

		expect(row).toMatchObject({
			isPickable: false,
			isSelectedByDefault: false,
			kind: "occupied",
		});
	});

	it("flags a seat holding a different player as a conflict the user must resolve", () => {
		const [row] = rowsFor(
			[seatedSeat(0, "p-red", "Red cap")],
			[scanned(1, "Takashi")]
		);

		expect(row).toMatchObject({
			currentName: "Red cap",
			currentPlayerId: "p-red",
			isPickable: true,
			isSelectedByDefault: true,
			kind: "conflict",
			matchedPlayerId: "p-takashi",
		});
	});

	it("keeps the hero seat out of registration when it is already the hero seat", () => {
		const [row] = rowsFor([heroSeat(0)], [scanned(1, "You", true)]);

		expect(row).toMatchObject({ isPickable: false, kind: "hero" });
	});

	it("lets a scanned player take over the hero seat", () => {
		const [row] = rowsFor([heroSeat(0)], [scanned(1, "Takashi")]);

		expect(row).toMatchObject({
			currentName: "You",
			currentPlayerId: null,
			displacesHero: true,
			isPickable: true,
			isSelectedByDefault: true,
			kind: "conflict",
			matchedPlayerId: "p-takashi",
		});
	});

	it("flags a seated player the scan read as empty so the seat can be freed", () => {
		const [row] = rowsFor([seatedSeat(0, "p-red", "Red cap")], []);

		expect(row).toMatchObject({
			currentName: "Red cap",
			currentPlayerId: "p-red",
			isPickable: true,
			isSelectedByDefault: true,
			kind: "vacate",
		});
	});

	it("offers a seat the scan identifies as the hero when it is not the hero seat yet", () => {
		const [row] = rowsFor([emptySeat(0)], [scanned(1, "Me", true)]);

		expect(row).toMatchObject({
			isPickable: true,
			isSelectedByDefault: true,
			kind: "hero",
		});
	});

	it("marks a seat with no readable name as not read", () => {
		const [row] = rowsFor([emptySeat(0), emptySeat(1)], [scanned(2, "Kenji")]);

		expect(row).toMatchObject({
			isPickable: false,
			kind: "none",
			name: "",
		});
	});

	it("produces one row per table seat and ignores scanned seats outside the table", () => {
		const rows = rowsFor(
			[emptySeat(0), emptySeat(1)],
			[scanned(1, "Takashi"), scanned(6, "Off table")]
		);

		expect(rows.map((row) => row.seatPosition)).toEqual([0, 1]);
	});
});

describe("countDetectedSeats", () => {
	it("counts every row the scan produced a status for", () => {
		const rows = rowsFor(
			[emptySeat(0), emptySeat(1), emptySeat(2)],
			[scanned(1, "Takashi"), scanned(2, "Blue shirt")]
		);

		expect(countDetectedSeats(rows)).toBe(2);
	});
});
