export const HAND_DETAILS = ["count", "summary", "full"] as const;
export type HandDetail = (typeof HAND_DETAILS)[number];

export const HAND_ACTIONS = [
	"post",
	"straddle",
	"bring_in",
	"fold",
	"check",
	"call",
	"bet",
	"raise",
	"draw",
	"show",
	"muck",
] as const;
export type HandAction = (typeof HAND_ACTIONS)[number];

export const MIN_HAND_TABLE_SIZE = 2;
export const MAX_HAND_TABLE_SIZE = 10;
export const MAX_HAND_STREET = 7;
export const MAX_BOARD_CARDS = 5;
export const MAX_HOLE_CARDS = 7;
export const MAX_HAND_MEMO_LENGTH = 2000;
export const MAX_HAND_ACTIONS = 200;

export function cardListMaxLength(cards: number): number {
	return cards * 3 - 1;
}
