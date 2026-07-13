// Derived-bucket editor model for mixed games. Which bucket a game lands in
// is decided by the master data (each variant belongs to exactly one game
// group), never assembled by hand — the editor only adds/removes games and
// edits per-mix amounts/names. Numeric cells stay strings (inputMode=
// "numeric" convention, parsed on submit); `toMixGames`/`fromMixGames`
// adapt to the shared payload shape in @sapphire2/db/schemas/game, which is
// unchanged: buckets serialize as ordinary named groups.
import type { LevelGameGroup, MixGameGroup } from "@sapphire2/db/schemas/game";

/**
 * Sentinel id of the fallback group a resolver returns while the master rows
 * haven't loaded (kept in sync with use-game-groups.ts, which builds its
 * pending fallback from this constant). Buckets resolved to it get a derived
 * per-bucket id (`__pending__:<variants>`) so distinct stored groups never
 * collapse onto one groupId — a shared id makes reseedFromLabels' Map keep
 * only the last bucket's amounts (c06).
 */
export const PENDING_GROUP_ID = "__pending__";

/** Resolved master info for the group a variant belongs to. */
export interface MixGroupInfo {
	blind1Label: string;
	blind2Label: string;
	blind3Label: string | null;
	/** game_group row id — the bucket identity key. */
	id: string;
	label: string;
	/** Canonical display position (builtin order, then user groups). */
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
	/**
	 * Per-mix display name. null = none stored; display falls back to the
	 * group label at render time, and serialization keeps it null so a no-op
	 * edit round-trip never freezes a display label into history (c18).
	 */
	name: string | null;
	sortIndex: number;
	uid: string;
	variants: string[];
}

function normalized(variant: string): string {
	return variant.trim().toLowerCase();
}

/** Every variant already assigned to any bucket, in display order. */
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

/** Per-bucket id for buckets whose group could not be resolved. */
function derivedPendingId(variants: string[]): string {
	return `${PENDING_GROUP_ID}:${variants.join("+")}`;
}

/**
 * Add a game. Its bucket is derived from the master mapping: appended to the
 * bucket of its group, or a new bucket is created at the canonical position.
 * No-op when the variant is already used anywhere (a game belongs to exactly
 * one group, mirroring the shared schema's cross-group duplicate refine).
 */
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
	// A pending resolution carries no real group identity — give the variant
	// its own bucket instead of merging every unresolved game into one.
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

/** Remove a whole bucket (all of its games) in one action. */
export function removeGroup(
	rows: MixGameGroupRow[],
	uid: string
): MixGameGroupRow[] {
	return rows.filter((r) => r.uid !== uid);
}

/** Remove a game; a bucket that loses its last game disappears. */
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

/** Per-cell validation message for mix amount cells (c31). */
export const MIX_CELL_ERROR = "Must be a whole number ≥ 0";

/** The string amount cells every bucket row carries. */
export const MIX_AMOUNT_SLOTS = ["blind1", "blind2", "blind3", "ante"] as const;

/**
 * Validation for one amount cell: empty is allowed, anything else must be a
 * whole number ≥ 0, mirroring the server's `.int().min(0)`. Full-string
 * `Number()` parse so trailing garbage is rejected, not truncated (SA2-103).
 * Pairs with cellToInt (the serialization): invalid input must be blocked at
 * submit with this message, never silently coerced to null (c31).
 */
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

/** True when any amount cell in any row fails {@link mixCellError}. */
export function hasMixCellErrors(rows: MixGameGroupRow[]): boolean {
	return rows.some((row) =>
		MIX_AMOUNT_SLOTS.some((slot) => mixCellError(row[slot]) !== undefined)
	);
}

// Full-string integer parse: `Number()` rejects trailing garbage that
// `Number.parseInt` would silently truncate (SA2-103); negatives and
// fractions map to null like every other optional amount cell.
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

// Shared bucket→group serialization: name persists only what was stored or
// user-entered (never a materialized display fallback — c18).
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

/**
 * Buckets → shared payload. The derived bucket metadata (group id/labels)
 * is intentionally dropped: stored groups are self-describing via name +
 * variant labels, so master edits never rewrite history.
 */
export function toMixGames(rows: MixGameGroupRow[]): MixGameGroup[] | null {
	const games = rows
		.filter((r) => r.variants.length > 0)
		.map((r) => ({
			...serializeRow(r),
			// "No ante" must never persist a stale amount left in the disabled
			// cell (c57).
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
		// Buckets from different stored groups must never share a groupId:
		// pending resolutions and later groups collapsing onto an id already
		// claimed (deleted variants parked in the fallback group) both get a
		// per-bucket derived id instead (c06).
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

/**
 * Buckets → tournament-level payload (levelGamesSchema shape: no anteType).
 * Serializes directly — levels have no anteType concept, so the editor rows'
 * "none" default must not null the ante like toMixGames does.
 */
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

/**
 * Build editor buckets from an ordered list of variant labels (a mix
 * master's composition). Unknown/deleted labels are simply skipped by the
 * duplicate guard rules of addVariant; grouping derives from the master
 * mapping.
 */
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

/**
 * Re-derive the buckets from a new master composition while keeping what
 * the user already entered: a group that survives the recomposition keeps
 * its per-mix name and amounts; removed groups disappear, new groups start
 * blank. Used after the referenced mix master is edited mid-form.
 */
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
