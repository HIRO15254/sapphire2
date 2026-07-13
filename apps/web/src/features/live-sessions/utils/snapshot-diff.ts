/**
 * Compute which snapshot fields on a live session diverge from the parent
 * master rule. Used by the active-session scene to surface a "Modified"
 * badge next to per-session overrides.
 */

export type DiffMap<K extends string> = Partial<Record<K, boolean>>;

/**
 * Structural shape of one mix/level game group (matches mixGameGroupSchema /
 * levelGameGroupSchema minus anteType, which the top-level anteType diff
 * already covers for the flat game and which levels don't carry at all).
 */
interface GameGroupShape {
	ante?: number | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	name?: string | null;
	variants: readonly string[];
}

function sameGameGroup(a: GameGroupShape, b: GameGroupShape): boolean {
	return (
		(a.name ?? null) === (b.name ?? null) &&
		a.variants.length === b.variants.length &&
		a.variants.every((variant, i) => variant === b.variants[i]) &&
		(a.blind1 ?? null) === (b.blind1 ?? null) &&
		(a.blind2 ?? null) === (b.blind2 ?? null) &&
		(a.blind3 ?? null) === (b.blind3 ?? null) &&
		(a.ante ?? null) === (b.ante ?? null)
	);
}

/** Order-sensitive structural compare of two game-group lists. */
function diffGameGroups(
	snap: readonly GameGroupShape[] | null | undefined,
	master: readonly GameGroupShape[] | null | undefined
): boolean {
	const snapGroups = snap ?? [];
	const masterGroups = master ?? [];
	if (snapGroups.length !== masterGroups.length) {
		return true;
	}
	return snapGroups.some((group, i) => {
		const other = masterGroups[i];
		return !(other && sameGameGroup(group, other));
	});
}

interface CashSnapshotFields {
	ante: number | null;
	anteType: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	mixGames?: readonly GameGroupShape[] | null;
	ruleName: string | null;
	tableSize: number | null;
	variant: string | null;
}

interface CashMasterFields {
	ante: number | null;
	anteType: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	mixGames?: readonly GameGroupShape[] | null;
	name: string;
	tableSize: number | null;
	variant: string;
}

export type CashDiffField =
	| "ruleName"
	| "variant"
	| "blind1"
	| "blind2"
	| "blind3"
	| "ante"
	| "anteType"
	| "minBuyIn"
	| "maxBuyIn"
	| "mixGames"
	| "tableSize";

export function diffCashSnapshot(
	snap: CashSnapshotFields,
	master: CashMasterFields | null | undefined
): DiffMap<CashDiffField> {
	if (!master) {
		return {};
	}
	return {
		ruleName: snap.ruleName !== master.name,
		variant: snap.variant !== master.variant,
		blind1: snap.blind1 !== master.blind1,
		blind2: snap.blind2 !== master.blind2,
		blind3: snap.blind3 !== master.blind3,
		ante: snap.ante !== master.ante,
		anteType: snap.anteType !== master.anteType,
		minBuyIn: snap.minBuyIn !== master.minBuyIn,
		maxBuyIn: snap.maxBuyIn !== master.maxBuyIn,
		mixGames: diffGameGroups(snap.mixGames, master.mixGames),
		tableSize: snap.tableSize !== master.tableSize,
	};
}

interface TournamentSnapshotFields {
	bountyAmount: number | null;
	buyIn: number | null;
	entryFee: number | null;
	ruleName: string;
	startingStack: number | null;
	tableSize: number | null;
	variant: string;
}

interface TournamentMasterFields {
	bountyAmount: number | null;
	buyIn: number | null;
	entryFee: number | null;
	name: string;
	startingStack: number | null;
	tableSize: number | null;
	variant: string;
}

export type TournamentDiffField =
	| "ruleName"
	| "variant"
	| "buyIn"
	| "entryFee"
	| "startingStack"
	| "bountyAmount"
	| "tableSize";

export function diffTournamentSnapshot(
	snap: TournamentSnapshotFields,
	master: TournamentMasterFields | null | undefined
): DiffMap<TournamentDiffField> {
	if (!master) {
		return {};
	}
	return {
		ruleName: snap.ruleName !== master.name,
		variant: snap.variant !== master.variant,
		buyIn: snap.buyIn !== master.buyIn,
		entryFee: snap.entryFee !== master.entryFee,
		startingStack: snap.startingStack !== master.startingStack,
		bountyAmount: snap.bountyAmount !== master.bountyAmount,
		tableSize: snap.tableSize !== master.tableSize,
	};
}

interface BlindLevelShape {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	games?: readonly GameGroupShape[] | null;
	isBreak: boolean;
	minutes: number | null;
}

export function diffBlindLevels(
	snap: readonly BlindLevelShape[],
	master: readonly BlindLevelShape[] | null | undefined
): boolean {
	if (!master) {
		return false;
	}
	if (snap.length !== master.length) {
		return true;
	}
	for (const [i, s] of snap.entries()) {
		const m = master[i];
		if (!m) {
			return true;
		}
		if (
			s.isBreak !== m.isBreak ||
			s.blind1 !== m.blind1 ||
			s.blind2 !== m.blind2 ||
			s.blind3 !== m.blind3 ||
			s.ante !== m.ante ||
			s.minutes !== m.minutes ||
			diffGameGroups(s.games, m.games)
		) {
			return true;
		}
	}
	return false;
}

interface ChipPurchaseShape {
	chips: number;
	cost: number;
	name: string;
}

export function diffChipPurchases(
	snap: readonly ChipPurchaseShape[],
	master: readonly ChipPurchaseShape[] | null | undefined
): boolean {
	if (!master) {
		return false;
	}
	if (snap.length !== master.length) {
		return true;
	}
	for (const [i, s] of snap.entries()) {
		const m = master[i];
		if (!m || s.name !== m.name || s.cost !== m.cost || s.chips !== m.chips) {
			return true;
		}
	}
	return false;
}
