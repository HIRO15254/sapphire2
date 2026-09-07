export function withHeroSeat(
	occupiedSeatPositions: ReadonlySet<number>,
	heroSeatPosition: number | null
): ReadonlySet<number> {
	if (heroSeatPosition === null) {
		return occupiedSeatPositions;
	}
	return new Set([...occupiedSeatPositions, heroSeatPosition]);
}
