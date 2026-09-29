import type { SeatPoint } from "@/features/live-sessions/utils/table-geometry";

const TABLE_CENTRE = 50;
const DEALER_PULL_TOWARD_CENTRE = 0.34;
const SECONDS_PER_HOUR = 3600;
const MIN_RATE_SECONDS = 60;

function wrap(value: number, size: number): number {
	return ((value % size) + size) % size;
}

export function dealerSeatIndex(
	handCount: number | null,
	dealerOffset: number,
	seatCount: number
): number | null {
	if (seatCount <= 0) {
		return null;
	}
	return wrap((handCount ?? 0) + dealerOffset, seatCount);
}

export function shiftDealerOffset(
	dealerOffset: number,
	step: number,
	seatCount: number
): number {
	if (seatCount <= 0) {
		return 0;
	}
	return wrap(dealerOffset + step, seatCount);
}

export function dealerSpot(seat: SeatPoint): SeatPoint {
	const pull = (value: number) =>
		value + (TABLE_CENTRE - value) * DEALER_PULL_TOWARD_CENTRE;
	return { x: pull(seat.x), y: pull(seat.y) };
}

export function computeHandsPerHour(
	handCount: number | null,
	activeSeconds: number
): number | null {
	if (activeSeconds < MIN_RATE_SECONDS) {
		return null;
	}
	return Math.round((handCount ?? 0) / (activeSeconds / SECONDS_PER_HOUR));
}
