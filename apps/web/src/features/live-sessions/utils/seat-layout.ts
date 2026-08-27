const MIN_SEAT_COUNT = 2;
const MAX_SEAT_COUNT = 10;

const Y_BOTTOM = 85.8;
const Y_LOWER_SIDE = 63;
const Y_UPPER_SIDE = 35;
const Y_TOP = 14.2;

const X_LEFT_RAIL = 14.5;
const X_RIGHT_RAIL = 85.5;
const X_BOTTOM_LEFT = 26;
const X_BOTTOM_RIGHT = 74;
const X_TOP_LEFT = 31;
const X_TOP_RIGHT = 69;
const X_CENTER = 50;

export interface SeatLayoutPoint {
	leftPct: number;
	topPct: number;
}

type PairBand = "bottom" | "lowerSide" | "top" | "upperSide";
type SlotBand = PairBand | "bottomCenter" | "topCenter";

interface MasterSlot extends SeatLayoutPoint {
	band: SlotBand;
}

const PAIR_PRIORITY: PairBand[] = ["bottom", "top", "lowerSide", "upperSide"];

const MASTER_SLOTS: MasterSlot[] = [
	{ band: "bottom", leftPct: X_BOTTOM_LEFT, topPct: Y_BOTTOM },
	{ band: "lowerSide", leftPct: X_LEFT_RAIL, topPct: Y_LOWER_SIDE },
	{ band: "upperSide", leftPct: X_LEFT_RAIL, topPct: Y_UPPER_SIDE },
	{ band: "top", leftPct: X_TOP_LEFT, topPct: Y_TOP },
	{ band: "topCenter", leftPct: X_CENTER, topPct: Y_TOP },
	{ band: "top", leftPct: X_TOP_RIGHT, topPct: Y_TOP },
	{ band: "upperSide", leftPct: X_RIGHT_RAIL, topPct: Y_UPPER_SIDE },
	{ band: "lowerSide", leftPct: X_RIGHT_RAIL, topPct: Y_LOWER_SIDE },
	{ band: "bottom", leftPct: X_BOTTOM_RIGHT, topPct: Y_BOTTOM },
	{ band: "bottomCenter", leftPct: X_CENTER, topPct: Y_BOTTOM },
];

function clampSeatCount(count: number): number {
	if (count < MIN_SEAT_COUNT) {
		return MIN_SEAT_COUNT;
	}
	if (count > MAX_SEAT_COUNT) {
		return MAX_SEAT_COUNT;
	}
	return count;
}

export function seatLayout(count: number): SeatLayoutPoint[] {
	const seatCount = clampSeatCount(count);
	const numPairs = Math.min(Math.floor(seatCount / 2), PAIR_PRIORITY.length);
	const numCenters = seatCount - numPairs * 2;
	const includedPairBands = new Set(PAIR_PRIORITY.slice(0, numPairs));
	const includeTopCenter = numCenters >= 1;
	const includeBottomCenter = numCenters >= 2;

	return MASTER_SLOTS.filter((slot) => {
		if (slot.band === "topCenter") {
			return includeTopCenter;
		}
		if (slot.band === "bottomCenter") {
			return includeBottomCenter;
		}
		return includedPairBands.has(slot.band);
	}).map(({ leftPct, topPct }) => ({ leftPct, topPct }));
}
