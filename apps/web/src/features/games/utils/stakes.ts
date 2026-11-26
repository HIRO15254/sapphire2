import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "../hooks/use-game-masters";

export type AnteType = "all" | "bb" | "none";

export type GameChoice =
	| { gameMixId: string }
	| { lineupId: string }
	| { variantId: string };

export interface LineupSlot {
	gameGroupId: string;
	name: string | null;
	variantIds: string[];
}

export interface StakeDraft extends LineupSlot {
	ante: string;
	anteType: AnteType | null;
	blind1: string;
	blind2: string;
	blind3: string;
}

export type BlindField = "blind1" | "blind2" | "blind3";
export type StakeField = BlindField | "ante";
export type StakeErrors = Partial<Record<StakeField, string>>;

export interface StakeInput {
	ante: number | null;
	anteType: AnteType | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	gameGroupId: string;
}

export interface SavedStake {
	ante: number | null;
	anteType: AnteType | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
}

export interface LineupShape {
	groups: {
		gameGroupId: string;
		name: string | null;
		variants: { id: string }[];
	}[];
}

export const BLIND_FIELDS = ["blind1", "blind2", "blind3"] as const;

export const ANTE_TYPE_OPTIONS = [
	{ label: "None", value: "none" },
	{ label: "BB", value: "bb" },
	{ label: "All", value: "all" },
] as const satisfies readonly { label: string; value: AnteType }[];

const WHOLE_NUMBER = /^\d+$/u;

export function isAnteType(value: string): value is AnteType {
	return value === "all" || value === "bb" || value === "none";
}

export function slotsForVariant(variant: GameVariant): LineupSlot[] {
	return [
		{ gameGroupId: variant.groupId, name: null, variantIds: [variant.id] },
	];
}

export function slotsForMix(
	mix: GameMix,
	variants: GameVariant[]
): LineupSlot[] {
	const byId = new Map(variants.map((variant) => [variant.id, variant]));
	const slots: LineupSlot[] = [];
	for (const id of mix.games) {
		const groupId = byId.get(id)?.groupId;
		if (!groupId) {
			continue;
		}
		const slot = slots.find((item) => item.gameGroupId === groupId);
		if (slot) {
			slot.variantIds.push(id);
		} else {
			slots.push({ gameGroupId: groupId, name: null, variantIds: [id] });
		}
	}
	return slots;
}

export function slotsForLineup(lineup: LineupShape): LineupSlot[] {
	return lineup.groups.map((group) => ({
		gameGroupId: group.gameGroupId,
		name: group.name,
		variantIds: group.variants.map((variant) => variant.id),
	}));
}

function occurrenceKeys(slots: { gameGroupId: string }[]): string[] {
	const seen = new Map<string, number>();
	return slots.map((slot) => {
		const occurrence = seen.get(slot.gameGroupId) ?? 0;
		seen.set(slot.gameGroupId, occurrence + 1);
		return `${slot.gameGroupId}#${occurrence}`;
	});
}

function emptyStake(slot: LineupSlot, group: GameGroup | undefined) {
	return {
		...slot,
		ante: "",
		anteType: group?.fixedAnteType ?? null,
		blind1: "",
		blind2: "",
		blind3: "",
	};
}

export function reseedStakes(
	previous: StakeDraft[],
	slots: LineupSlot[],
	groups: GameGroup[]
): StakeDraft[] {
	const carried = new Map(
		occurrenceKeys(previous).map((key, index) => [key, previous[index]])
	);
	const keys = occurrenceKeys(slots);
	return slots.map((slot, index) => {
		const source = carried.get(keys[index] ?? "");
		if (source) {
			return { ...source, ...slot };
		}
		return emptyStake(
			slot,
			groups.find((group) => group.id === slot.gameGroupId)
		);
	});
}

function amountText(value: number | null): string {
	return value === null ? "" : String(value);
}

export function stakesFromSaved(
	slots: LineupSlot[],
	saved: SavedStake[]
): StakeDraft[] {
	return slots.map((slot, index) => {
		const stake = saved[index];
		return {
			...slot,
			ante: amountText(stake?.ante ?? null),
			anteType: stake?.anteType ?? null,
			blind1: amountText(stake?.blind1 ?? null),
			blind2: amountText(stake?.blind2 ?? null),
			blind3: amountText(stake?.blind3 ?? null),
		};
	});
}

export function effectiveAnteType(
	stake: StakeDraft,
	group: GameGroup | undefined
): AnteType | null {
	return group?.fixedAnteType ?? stake.anteType;
}

export function isAntePaid(type: AnteType | null): boolean {
	return type === "all" || type === "bb";
}

export function withAnteType(stake: StakeDraft, type: AnteType): StakeDraft {
	return { ...stake, ante: type === "none" ? "" : stake.ante, anteType: type };
}

export function amountError(text: string): string | null {
	const value = text.trim();
	if (value === "") {
		return null;
	}
	return WHOLE_NUMBER.test(value) && Number.isSafeInteger(Number(value))
		? null
		: "Whole numbers only";
}

function toAmount(text: string): number | null {
	const value = text.trim();
	return value === "" || amountError(value) ? null : Number(value);
}

export function stakeErrors(
	stake: StakeDraft,
	group: GameGroup | undefined,
	checkRequired: boolean
): StakeErrors {
	const errors: StakeErrors = {};
	for (const field of BLIND_FIELDS) {
		const label = group?.[`${field}Label`];
		if (!label) {
			continue;
		}
		const error =
			amountError(stake[field]) ??
			(checkRequired && group[`${field}Required`] && !stake[field].trim()
				? `Enter the ${label}`
				: null);
		if (error) {
			errors[field] = error;
		}
	}
	const anteError = isAntePaid(effectiveAnteType(stake, group))
		? amountError(stake.ante)
		: null;
	if (anteError) {
		errors.ante = anteError;
	}
	return errors;
}

export function hasStakeErrors(
	stakes: StakeDraft[],
	groups: GameGroup[]
): boolean {
	return stakes.some(
		(stake) =>
			Object.keys(
				stakeErrors(
					stake,
					groups.find((group) => group.id === stake.gameGroupId),
					true
				)
			).length > 0
	);
}

export function toStakeInputs(
	stakes: StakeDraft[],
	groups: GameGroup[]
): StakeInput[] {
	return stakes.map((stake) => {
		const group = groups.find((item) => item.id === stake.gameGroupId);
		const blind = (field: BlindField) =>
			group?.[`${field}Label`] ? toAmount(stake[field]) : null;
		const anteType = effectiveAnteType(stake, group);
		return {
			ante: isAntePaid(anteType) ? toAmount(stake.ante) : null,
			anteType,
			blind1: blind("blind1"),
			blind2: blind("blind2"),
			blind3: blind("blind3"),
			gameGroupId: stake.gameGroupId,
		};
	});
}

export function slotNames(
	slots: LineupSlot[],
	groups: GameGroup[] | undefined
): string[] {
	const totals = new Map<string, number>();
	for (const slot of slots) {
		totals.set(slot.gameGroupId, (totals.get(slot.gameGroupId) ?? 0) + 1);
	}
	const seen = new Map<string, number>();
	return slots.map((slot) => {
		const occurrence = (seen.get(slot.gameGroupId) ?? 0) + 1;
		seen.set(slot.gameGroupId, occurrence);
		if (slot.name) {
			return slot.name;
		}
		const label =
			groups?.find((group) => group.id === slot.gameGroupId)?.label ?? "Games";
		return (totals.get(slot.gameGroupId) ?? 0) > 1
			? `${label} ${occurrence}`
			: label;
	});
}

export function slotGames(
	slot: LineupSlot,
	variants: GameVariant[] | undefined
): string {
	return slot.variantIds
		.map((id) => {
			const variant = variants?.find((row) => row.id === id);
			return variant ? (variant.shortLabel ?? variant.label) : "";
		})
		.filter(Boolean)
		.join(", ");
}

const ANTE_TYPE_NAMES = { all: "All", bb: "BB", none: "None" } as const;

function levelRange(first: number, last: number): string {
	return first === last ? `Level ${first}` : `Levels ${first}–${last}`;
}

export function levelAnteTypes(
	levels: (StakeDraft[] | null)[],
	slotIndex: number
): (AnteType | null)[] {
	return levels.flatMap((stakes) =>
		stakes ? [stakes[slotIndex]?.anteType ?? null] : []
	);
}

export function anteTypeRuns(types: (AnteType | null)[]): string {
	const runs: { first: number; last: number; type: AnteType | null }[] = [];
	types.forEach((type, index) => {
		const run = runs.at(-1);
		if (run && run.type === type) {
			run.last = index + 1;
		} else {
			runs.push({ first: index + 1, last: index + 1, type });
		}
	});
	return runs
		.map(
			(run) =>
				`${levelRange(run.first, run.last)}: ${run.type ? ANTE_TYPE_NAMES[run.type] : "Not set"}`
		)
		.join(" · ");
}

export function applyAnteType(
	levels: (StakeDraft[] | null)[],
	slotIndex: number,
	type: AnteType
): (StakeDraft[] | null)[] {
	return levels.map((stakes) =>
		stakes
			? stakes.map((stake, index) =>
					index === slotIndex ? withAnteType(stake, type) : stake
				)
			: null
	);
}
