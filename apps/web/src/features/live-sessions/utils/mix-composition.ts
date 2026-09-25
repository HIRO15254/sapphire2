import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
import {
	type LevelGameGroup,
	MAX_MIX_GROUPS,
	type MixGameGroup,
} from "@sapphire2/db/schemas/game";
import {
	fromLevelGames,
	fromMixGames,
	type MixGameGroupRow,
	type MixGroupInfo,
	type ResolveGroup,
	toLevelGames,
	toMixGames,
} from "@/shared/lib/mix-games";
import { createGroupFormatter } from "@/utils/format-number";

export type MixTarget = "cash" | "level";

interface VariantBucket {
	variants: readonly string[];
}

interface StakesLike {
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	name?: string | null;
	variants: readonly string[];
}

const MIN_GAMES: Record<MixTarget, number> = { cash: 2, level: 1 };

const TRAILING_NUMBER = /^\d+$/;

function normalized(label: string): string {
	return label.trim().toLowerCase();
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function countGames(groups: readonly VariantBucket[]): number {
	return groups.reduce((total, group) => total + group.variants.length, 0);
}

function findEmptyGroupNumber(groups: readonly VariantBucket[]): number | null {
	const index = groups.findIndex((group) => group.variants.length === 0);
	return index === -1 ? null : index + 1;
}

export function describeMixValidity(
	groups: readonly VariantBucket[],
	target: MixTarget
): { isValid: boolean; label: string } {
	const minimum = MIN_GAMES[target];
	if (countGames(groups) < minimum) {
		return {
			isValid: false,
			label: `Needs ${minimum}+ ${minimum === 1 ? "game" : "games"}`,
		};
	}
	const emptyGroupNumber = findEmptyGroupNumber(groups);
	if (emptyGroupNumber !== null) {
		return { isValid: false, label: `Group ${emptyGroupNumber} has no games` };
	}
	return { isValid: true, label: "Valid" };
}

export function summarizeMix(groups: readonly VariantBucket[]): string {
	return `${plural(groups.length, "group")} · ${plural(countGames(groups), "game")}`;
}

export function canAddGroup(rows: readonly MixGameGroupRow[]): boolean {
	return rows.length < MAX_MIX_GROUPS;
}

function withGroupInfo(
	row: MixGameGroupRow,
	group: MixGroupInfo
): MixGameGroupRow {
	return {
		...row,
		blind1Label: group.blind1Label,
		blind2Label: group.blind2Label,
		blind3Label: group.blind3Label,
		groupId: group.id,
		groupLabel: group.label,
		sortIndex: group.sortIndex,
	};
}

const EMPTY_STAKES = {
	ante: "",
	anteType: "none",
	blind1: "",
	blind2: "",
	blind3: "",
} as const;

export function groupStructure(
	group: VariantBucket,
	resolveGroup: ResolveGroup
): MixGroupInfo | null {
	const first = group.variants[0];
	return first === undefined ? null : resolveGroup(first);
}

export function autoGroupNames(
	groups: readonly VariantBucket[],
	resolveGroup: ResolveGroup
): string[] {
	const structures = groups.map((group) => groupStructure(group, resolveGroup));
	const totals = new Map<string, number>();
	for (const structure of structures) {
		if (structure !== null) {
			totals.set(structure.id, (totals.get(structure.id) ?? 0) + 1);
		}
	}
	const seen = new Map<string, number>();
	return structures.map((structure) => {
		if (structure === null) {
			return "";
		}
		const ordinal = (seen.get(structure.id) ?? 0) + 1;
		seen.set(structure.id, ordinal);
		return (totals.get(structure.id) ?? 0) > 1
			? `${structure.label} ${ordinal}`
			: structure.label;
	});
}

export function isAutoGroupName(name: string, structureLabel: string): boolean {
	const trimmed = name.trim();
	if (trimmed === structureLabel) {
		return true;
	}
	const prefix = `${structureLabel} `;
	return (
		trimmed.startsWith(prefix) &&
		TRAILING_NUMBER.test(trimmed.slice(prefix.length))
	);
}

export function withAutoGroupNames(
	rows: readonly MixGameGroupRow[],
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	const names = autoGroupNames(rows, resolveGroup);
	return rows.map((row, index) => ({
		...row,
		name: row.name?.trim() || names[index] || null,
	}));
}

function seedRows(
	rows: MixGameGroupRow[],
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	return rows.map((row, index) => {
		const structure = groupStructure(row, resolveGroup);
		const isAuto =
			row.name !== null &&
			structure !== null &&
			isAutoGroupName(row.name, structure.label);
		return {
			...row,
			groupId: structure?.id ?? row.groupId,
			name: isAuto ? null : row.name,
			uid: `group-${index}`,
		};
	});
}

export function seedMixGroups(
	games: MixGameGroup[] | null,
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	return seedRows(fromMixGames(games, resolveGroup), resolveGroup);
}

export function seedLevelGroups(
	games: LevelGameGroup[] | null,
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	return seedRows(fromLevelGames(games, resolveGroup), resolveGroup);
}

export function serializeMixGroups(
	rows: readonly MixGameGroupRow[],
	resolveGroup: ResolveGroup
): MixGameGroup[] | null {
	return toMixGames(withAutoGroupNames(rows, resolveGroup));
}

export function serializeLevelGroups(
	rows: readonly MixGameGroupRow[],
	resolveGroup: ResolveGroup
): LevelGameGroup[] | null {
	return toLevelGames(withAutoGroupNames(rows, resolveGroup));
}

export function addEmptyGroup(
	rows: readonly MixGameGroupRow[],
	group: MixGroupInfo,
	uid: string
): MixGameGroupRow[] {
	if (!canAddGroup(rows)) {
		return [...rows];
	}
	const empty: MixGameGroupRow = withGroupInfo(
		{
			ante: "",
			anteType: "none",
			blind1: "",
			blind1Label: "",
			blind2: "",
			blind2Label: "",
			blind3: "",
			blind3Label: null,
			groupId: "",
			groupLabel: "",
			name: null,
			sortIndex: 0,
			uid,
			variants: [],
		},
		group
	);
	return [...rows, empty];
}

export function variantsTakenElsewhere(
	rows: readonly MixGameGroupRow[],
	uid: string
): Set<string> {
	return new Set(
		rows
			.filter((row) => row.uid !== uid)
			.flatMap((row) => row.variants.map(normalized))
	);
}

export function isVariantTakenElsewhere(
	rows: readonly MixGameGroupRow[],
	uid: string,
	label: string
): boolean {
	return variantsTakenElsewhere(rows, uid).has(normalized(label));
}

function isInGroup(row: MixGameGroupRow, label: string): boolean {
	const key = normalized(label);
	return row.variants.some((variant) => normalized(variant) === key);
}

export function canToggleVariantInGroup(
	rows: readonly MixGameGroupRow[],
	uid: string,
	label: string,
	resolveGroup: ResolveGroup
): boolean {
	const row = rows.find((candidate) => candidate.uid === uid);
	if (!row) {
		return false;
	}
	if (isInGroup(row, label)) {
		return true;
	}
	if (isVariantTakenElsewhere(rows, uid, label)) {
		return false;
	}
	const structure = groupStructure(row, resolveGroup);
	return structure === null || structure.id === resolveGroup(label).id;
}

export function toggleVariantInGroup(
	rows: readonly MixGameGroupRow[],
	uid: string,
	label: string,
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	const row = rows.find((candidate) => candidate.uid === uid);
	if (!(row && canToggleVariantInGroup(rows, uid, label, resolveGroup))) {
		return [...rows];
	}
	if (isInGroup(row, label)) {
		return removeVariantFromGroup(rows, uid, label);
	}
	const added = { ...row, variants: [...row.variants, label] };
	let next = added;
	if (row.variants.length === 0) {
		const structure = resolveGroup(label);
		const stakes = structure.id === row.groupId ? null : EMPTY_STAKES;
		next = withGroupInfo({ ...added, ...stakes }, structure);
	}
	return rows.map((candidate) => (candidate.uid === uid ? next : candidate));
}

export function removeVariantFromGroup(
	rows: readonly MixGameGroupRow[],
	uid: string,
	label: string
): MixGameGroupRow[] {
	const key = normalized(label);
	return rows.map((row) =>
		row.uid === uid
			? {
					...row,
					variants: row.variants.filter(
						(variant) => normalized(variant) !== key
					),
				}
			: row
	);
}

export function describeGroupStakes(group: StakesLike): string {
	const format = createGroupFormatter([
		group.blind1,
		group.blind2,
		group.blind3,
	]);
	const parts = [group.blind1, group.blind2].map((value) =>
		value == null ? "—" : format(value)
	);
	if (group.blind3 != null) {
		parts.push(format(group.blind3));
	}
	return parts.join("/");
}

export function describeMixStakesLine(
	groups: readonly StakesLike[],
	resolveGroup: ResolveGroup
): string {
	return groups
		.map((group) => {
			const name =
				group.name?.trim() || resolveGroup(group.variants[0] ?? "").label;
			return `${name} ${describeGroupStakes(group)}`;
		})
		.join(" · ");
}

function gameBuckets(groups: readonly VariantBucket[]): string[][] {
	return groups
		.filter((group) => group.variants.length > 0)
		.map((group) => group.variants.map(normalized));
}

export function sameGameBuckets(
	left: readonly VariantBucket[],
	right: readonly VariantBucket[]
): boolean {
	const a = gameBuckets(left);
	const b = gameBuckets(right);
	return (
		a.length === b.length &&
		a.every(
			(bucket, index) =>
				bucket.length === b[index]?.length &&
				bucket.every((label, labelIndex) => label === b[index]?.[labelIndex])
		)
	);
}

export function variantForComposition(
	variant: string,
	groups: readonly VariantBucket[],
	namedMixBuckets: readonly VariantBucket[] | null
): string {
	if (namedMixBuckets === null || sameGameBuckets(groups, namedMixBuckets)) {
		return variant;
	}
	return MIX_VARIANT;
}

export interface VariantOption {
	groupLabel: string;
	label: string;
	shortLabel: string | null;
}

export function filterVariantOptions<T extends VariantOption>(
	options: readonly T[],
	query: string
): T[] {
	const needle = normalized(query);
	if (needle === "") {
		return [...options];
	}
	return options.filter(
		(option) =>
			normalized(option.label).includes(needle) ||
			normalized(option.shortLabel ?? "").includes(needle) ||
			normalized(option.groupLabel).includes(needle)
	);
}
