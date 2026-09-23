import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import type {
	MixGameGroupRow,
	MixGroupInfo,
	ResolveGroup,
} from "@/shared/lib/mix-games";
import { createGroupFormatter } from "@/utils/format-number";

export type MixTarget = "cash" | "level";

type AnteType = MixGameGroupRow["anteType"];

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

function normalized(label: string): string {
	return label.trim().toLowerCase();
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function countGames(groups: readonly VariantBucket[]): number {
	return groups.reduce((total, group) => total + group.variants.length, 0);
}

export function describeMixValidity(
	groups: readonly VariantBucket[],
	target: MixTarget
): { isValid: boolean; label: string } {
	const minimum = MIN_GAMES[target];
	const isValid = countGames(groups) >= minimum;
	return {
		isValid,
		label: isValid
			? "Valid"
			: `Needs ${minimum}+ ${minimum === 1 ? "game" : "games"}`,
	};
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

export function toggleVariantInGroup(
	rows: readonly MixGameGroupRow[],
	uid: string,
	label: string,
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	const row = rows.find((candidate) => candidate.uid === uid);
	if (!row) {
		return [...rows];
	}
	const key = normalized(label);
	if (row.variants.some((variant) => normalized(variant) === key)) {
		return removeVariantFromGroup(rows, uid, label);
	}
	if (isVariantTakenElsewhere(rows, uid, label)) {
		return [...rows];
	}
	const added = { ...row, variants: [...row.variants, label] };
	const next =
		row.variants.length === 0
			? withGroupInfo(added, resolveGroup(label))
			: added;
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

export function deriveAnteType(previous: AnteType, ante: string): AnteType {
	if (ante.trim() === "") {
		return "none";
	}
	return previous === "bb" ? "bb" : "all";
}

export function withDerivedAnteTypes(
	rows: readonly MixGameGroupRow[]
): MixGameGroupRow[] {
	return rows.map((row) => ({
		...row,
		anteType: deriveAnteType(row.anteType, row.ante),
	}));
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
