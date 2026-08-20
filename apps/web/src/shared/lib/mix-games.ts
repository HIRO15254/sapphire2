import type { LevelGameGroup, MixGameGroup } from "@sapphire2/db/schemas/game";

export const PENDING_GROUP_ID = "__pending__";

export interface MixGroupInfo {
	blind1Label: string;
	blind2Label: string;
	blind3Label: string | null;
	id: string;
	label: string;
	sortIndex: number;
}

export type ResolveGroup = (variantLabel: string) => MixGroupInfo;

export interface MixGameGroupRow {
	ante: string;
	anteType: "none" | "all" | "bb";
	blind1: string;
	blind1Label: string;
	blind2: string;
	blind2Label: string;
	blind3: string;
	blind3Label: string | null;
	groupId: string;
	groupLabel: string;
	name: string | null;
	sortIndex: number;
	uid: string;
	variants: string[];
}

function normalized(variant: string): string {
	return variant.trim().toLowerCase();
}

export function usedVariants(rows: MixGameGroupRow[]): string[] {
	return rows.flatMap((r) => r.variants);
}

export function updateGroup(
	rows: MixGameGroupRow[],
	uid: string,
	patch: Partial<Omit<MixGameGroupRow, "uid" | "groupId">>
): MixGameGroupRow[] {
	return rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r));
}

function newBucket(group: MixGroupInfo): MixGameGroupRow {
	return {
		uid: crypto.randomUUID(),
		groupId: group.id,
		groupLabel: group.label,
		blind1Label: group.blind1Label,
		blind2Label: group.blind2Label,
		blind3Label: group.blind3Label,
		sortIndex: group.sortIndex,
		name: null,
		variants: [],
		blind1: "",
		blind2: "",
		blind3: "",
		ante: "",
		anteType: "none",
	};
}

function derivedPendingId(variants: string[]): string {
	return `${PENDING_GROUP_ID}:${variants.join("+")}`;
}

export function addVariant(
	rows: MixGameGroupRow[],
	variantLabel: string,
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	const taken = new Set(usedVariants(rows).map(normalized));
	if (taken.has(normalized(variantLabel))) {
		return rows;
	}
	const group = resolveGroup(variantLabel);
	const groupId =
		group.id === PENDING_GROUP_ID ? derivedPendingId([variantLabel]) : group.id;
	const existing = rows.find((r) => r.groupId === groupId);
	if (existing) {
		return rows.map((r) =>
			r.uid === existing.uid
				? { ...r, variants: [...r.variants, variantLabel] }
				: r
		);
	}
	const bucket = { ...newBucket(group), groupId, variants: [variantLabel] };
	return [...rows, bucket].sort((a, b) => a.sortIndex - b.sortIndex);
}

export function removeGroup(
	rows: MixGameGroupRow[],
	uid: string
): MixGameGroupRow[] {
	return rows.filter((r) => r.uid !== uid);
}

export function removeVariant(
	rows: MixGameGroupRow[],
	variantLabel: string
): MixGameGroupRow[] {
	return rows
		.map((r) => ({
			...r,
			variants: r.variants.filter((v) => v !== variantLabel),
		}))
		.filter((r) => r.variants.length > 0);
}

export const MIX_CELL_ERROR = "Must be a whole number ≥ 0";

export const MIX_AMOUNT_SLOTS = ["blind1", "blind2", "blind3", "ante"] as const;

export function mixCellError(value: string): string | undefined {
	if (value.trim() === "") {
		return undefined;
	}
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) {
		return MIX_CELL_ERROR;
	}
	return undefined;
}

export function hasMixCellErrors(rows: MixGameGroupRow[]): boolean {
	return rows.some((row) =>
		MIX_AMOUNT_SLOTS.some((slot) => mixCellError(row[slot]) !== undefined)
	);
}

function cellToInt(value: string): number | null {
	if (value.trim() === "") {
		return null;
	}
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) {
		return null;
	}
	return parsed;
}

function serializeRow(r: MixGameGroupRow): LevelGameGroup {
	const trimmed = r.name?.trim() ?? "";
	return {
		name: trimmed === "" ? null : trimmed,
		variants: r.variants,
		blind1: cellToInt(r.blind1),
		blind2: cellToInt(r.blind2),
		blind3: cellToInt(r.blind3),
		ante: cellToInt(r.ante),
	};
}

export function toMixGames(rows: MixGameGroupRow[]): MixGameGroup[] | null {
	const games = rows
		.filter((r) => r.variants.length > 0)
		.map((r) => ({
			...serializeRow(r),
			ante: r.anteType === "none" ? null : cellToInt(r.ante),
			anteType: r.anteType,
		}));
	return games.length > 0 ? games : null;
}

export function fromMixGames(
	games: MixGameGroup[] | null | undefined,
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	const seenIds = new Set<string>();
	return (games ?? []).map((g) => {
		const group = resolveGroup(g.variants[0] ?? "");
		const groupId =
			group.id === PENDING_GROUP_ID || seenIds.has(group.id)
				? derivedPendingId(g.variants)
				: group.id;
		seenIds.add(groupId);
		return {
			...newBucket(group),
			groupId,
			name: g.name ?? null,
			variants: [...g.variants],
			blind1: g.blind1 == null ? "" : String(g.blind1),
			blind2: g.blind2 == null ? "" : String(g.blind2),
			blind3: g.blind3 == null ? "" : String(g.blind3),
			ante: g.ante == null ? "" : String(g.ante),
			anteType: g.anteType ?? "none",
		};
	});
}

export function toLevelGames(rows: MixGameGroupRow[]): LevelGameGroup[] | null {
	const games = rows.filter((r) => r.variants.length > 0).map(serializeRow);
	return games.length > 0 ? games : null;
}

export function fromLevelGames(
	games: LevelGameGroup[] | null | undefined,
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	return fromMixGames(
		(games ?? []).map((g) => ({ ...g, anteType: null })),
		resolveGroup
	);
}

export function rowsFromVariantLabels(
	labels: string[],
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	let rows: MixGameGroupRow[] = [];
	for (const label of labels) {
		rows = addVariant(rows, label, resolveGroup);
	}
	return rows;
}

export function reseedFromLabels(
	rows: MixGameGroupRow[],
	labels: string[],
	resolveGroup: ResolveGroup
): MixGameGroupRow[] {
	const fresh = rowsFromVariantLabels(labels, resolveGroup);
	const prevByGroupId = new Map(rows.map((r) => [r.groupId, r]));
	return fresh.map((row) => {
		const prev = prevByGroupId.get(row.groupId);
		if (!prev) {
			return row;
		}
		return {
			...row,
			name: prev.name,
			blind1: prev.blind1,
			blind2: prev.blind2,
			blind3: prev.blind3,
			ante: prev.ante,
			anteType: prev.anteType,
		};
	});
}
