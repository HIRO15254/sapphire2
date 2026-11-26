import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";

const CREATED = "2026-11-01T00:00:00.000Z";

export function gameGroup(overrides: Partial<GameGroup> & { id: string }) {
	return {
		archivedAt: null,
		blind1Label: "SB",
		blind1Required: true,
		blind2Label: "BB",
		blind2Required: true,
		blind3Label: null,
		blind3Required: false,
		builtinKey: null,
		createdAt: CREATED,
		fixedAnteType: null,
		isReferenced: false,
		label: overrides.id,
		updatedAt: CREATED,
		userId: "user-1",
		...overrides,
	} satisfies GameGroup;
}

export function gameVariant(
	overrides: Partial<GameVariant> & { groupId: string; id: string }
) {
	return {
		archivedAt: null,
		builtinKey: null,
		createdAt: CREATED,
		isReferenced: false,
		label: overrides.id,
		shortLabel: null,
		sortOrder: 0,
		updatedAt: CREATED,
		userId: "user-1",
		...overrides,
	} satisfies GameVariant;
}

export function gameMix(
	overrides: Partial<GameMix> & { games: string[]; id: string }
) {
	return {
		archivedAt: null,
		builtinKey: null,
		createdAt: CREATED,
		isReferenced: false,
		label: overrides.id,
		updatedAt: CREATED,
		userId: "user-1",
		...overrides,
	} satisfies GameMix;
}

export const bigBet = gameGroup({ id: "big-bet", label: "Big Bet" });
export const limit = gameGroup({
	blind1Label: "Small Bet",
	blind2Label: "Big Bet",
	id: "limit",
	label: "Limit",
});
export const stud = gameGroup({
	blind1Label: "Small Bet",
	blind2Label: "Big Bet",
	blind3Label: "Bring-in",
	fixedAnteType: "all",
	id: "stud",
	label: "Stud",
});

export const nlh = gameVariant({
	groupId: "big-bet",
	id: "nlh",
	label: "NL Hold'em",
	shortLabel: "NLH",
});
export const plo = gameVariant({
	groupId: "big-bet",
	id: "plo",
	label: "Pot Limit Omaha",
	shortLabel: "PLO",
});
export const lhe = gameVariant({
	groupId: "limit",
	id: "lhe",
	label: "Limit Hold'em",
	shortLabel: "LHE",
});
export const razz = gameVariant({
	groupId: "stud",
	id: "razz",
	label: "Razz",
});

export const masterGroups = [limit, stud, bigBet];
export const masterVariants = [nlh, plo, lhe, razz];
