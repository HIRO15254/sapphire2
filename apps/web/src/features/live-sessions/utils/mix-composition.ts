import type { LevelGameGroup, MixGameGroup } from "@sapphire2/db/schemas/game";
import {
	fromLevelGames,
	fromMixGames,
	type MixGameGroupRow,
	type MixGroupInfo,
	type ResolveGroup,
	reseedFromLabels,
	toLevelGames,
	toMixGames,
} from "@/shared/lib/mix-games";

interface VariantBucket {
	variants: readonly string[];
}

const MIN_MIX_GAMES = 2;

const TRAILING_NUMBER = /^\d+$/;

function normalized(label: string): string {
	return label.trim().toLowerCase();
}

export function countGames(groups: readonly VariantBucket[]): number {
	return groups.reduce((total, group) => total + group.variants.length, 0);
}

function findEmptyGroupNumber(groups: readonly VariantBucket[]): number | null {
	const index = groups.findIndex((group) => group.variants.length === 0);
	return index === -1 ? null : index + 1;
}

export function describeMixValidity(groups: readonly VariantBucket[]): {
	isValid: boolean;
	label: string;
} {
	if (countGames(groups) < MIN_MIX_GAMES) {
		return { isValid: false, label: `Needs ${MIN_MIX_GAMES}+ games` };
	}
	const emptyGroupNumber = findEmptyGroupNumber(groups);
	if (emptyGroupNumber !== null) {
		return { isValid: false, label: `Group ${emptyGroupNumber} has no games` };
	}
	return { isValid: true, label: "Valid" };
}

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

export function matchMixLabel(
	groups: readonly VariantBucket[],
	candidates: readonly { groups: readonly VariantBucket[]; label: string }[]
): string | null {
	if (countGames(groups) === 0) {
		return null;
	}
	return (
		candidates.find((candidate) => sameGameBuckets(groups, candidate.groups))
			?.label ?? null
	);
}

export function levelGroupsFor(
	current: readonly MixGameGroupRow[],
	labels: readonly string[],
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	const [only] = labels;
	const name = labels.length === 1 && only !== undefined ? only : null;
	const resolved = current.map((row) => ({
		...row,
		groupId: groupStructure(row, resolveGroup)?.id ?? row.groupId,
	}));
	return reseedFromLabels(resolved, [...labels], resolveGroup).map((row) => ({
		...row,
		name,
	}));
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
