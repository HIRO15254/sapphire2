// Editor row model + pure helpers for the mix-games group editor. A row is
// one "game group": the games that share a single blind structure. Numeric
// cells stay strings (inputMode="numeric" convention, parsed here on
// submit); `toMixGames` / `fromMixGames` adapt to the shared payload shape
// in @sapphire2/db/schemas/game.
import type { MixGameGroup } from "@sapphire2/db/schemas/game";

export interface MixGameGroupRow {
	ante: string;
	anteType: "none" | "all" | "bb";
	blind1: string;
	blind2: string;
	blind3: string;
	name: string;
	uid: string;
	variants: string[];
}

export function emptyMixGroupRow(): MixGameGroupRow {
	return {
		uid: crypto.randomUUID(),
		name: "",
		variants: [],
		blind1: "",
		blind2: "",
		blind3: "",
		ante: "",
		anteType: "none",
	};
}

export function addGroup(rows: MixGameGroupRow[]): MixGameGroupRow[] {
	return [...rows, emptyMixGroupRow()];
}

export function removeGroup(
	rows: MixGameGroupRow[],
	uid: string
): MixGameGroupRow[] {
	return rows.filter((r) => r.uid !== uid);
}

export function updateGroup(
	rows: MixGameGroupRow[],
	uid: string,
	patch: Partial<Omit<MixGameGroupRow, "uid">>
): MixGameGroupRow[] {
	return rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r));
}

export function moveGroup(
	rows: MixGameGroupRow[],
	uid: string,
	direction: "up" | "down"
): MixGameGroupRow[] {
	const index = rows.findIndex((r) => r.uid === uid);
	const target = direction === "up" ? index - 1 : index + 1;
	if (index === -1 || target < 0 || target >= rows.length) {
		return rows;
	}
	const next = [...rows];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

function normalized(variant: string): string {
	return variant.trim().toLowerCase();
}

/** Every variant already assigned to any group, in display order. */
export function usedVariants(rows: MixGameGroupRow[]): string[] {
	return rows.flatMap((r) => r.variants);
}

/**
 * Append a variant to a group. No-op when the variant is already used in
 * any group (case-insensitive) — a game may appear in one group only,
 * mirroring the shared schema's cross-group duplicate refine.
 */
export function addVariantToGroup(
	rows: MixGameGroupRow[],
	uid: string,
	variant: string
): MixGameGroupRow[] {
	const taken = new Set(usedVariants(rows).map(normalized));
	if (taken.has(normalized(variant))) {
		return rows;
	}
	return rows.map((r) =>
		r.uid === uid ? { ...r, variants: [...r.variants, variant] } : r
	);
}

export function removeVariantFromGroup(
	rows: MixGameGroupRow[],
	uid: string,
	variant: string
): MixGameGroupRow[] {
	return rows.map((r) =>
		r.uid === uid
			? { ...r, variants: r.variants.filter((v) => v !== variant) }
			: r
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

/**
 * Editor rows → shared payload. Groups without any variant are dropped
 * (half-filled editor rows must not fail submission); null when nothing
 * meaningful remains so callers can send "no mix definition".
 */
export function toMixGames(rows: MixGameGroupRow[]): MixGameGroup[] | null {
	const games = rows
		.filter((r) => r.variants.length > 0)
		.map((r) => ({
			name: r.name.trim() === "" ? null : r.name.trim(),
			variants: r.variants,
			blind1: cellToInt(r.blind1),
			blind2: cellToInt(r.blind2),
			blind3: cellToInt(r.blind3),
			ante: cellToInt(r.ante),
			anteType: r.anteType,
		}));
	return games.length > 0 ? games : null;
}

export function fromMixGames(
	games: MixGameGroup[] | null | undefined
): MixGameGroupRow[] {
	return (games ?? []).map((g) => ({
		uid: crypto.randomUUID(),
		name: g.name ?? "",
		variants: [...g.variants],
		blind1: g.blind1 == null ? "" : String(g.blind1),
		blind2: g.blind2 == null ? "" : String(g.blind2),
		blind3: g.blind3 == null ? "" : String(g.blind3),
		ante: g.ante == null ? "" : String(g.ante),
		anteType: g.anteType ?? "none",
	}));
}

export type MixTemplateKind = "horse" | "8game" | "10game";

// Group compositions follow real structure-sheet conventions: stud games
// carry their own ante/bring-in structure, so they are always a separate
// group from the flop/draw limit games. Amounts are left blank for the
// user to fill.
const TEMPLATE_GROUPS: Record<
	MixTemplateKind,
	Array<{ name: string; variants: string[] }>
> = {
	horse: [
		{ name: "Flop", variants: ["lhe", "o8"] },
		{ name: "Stud", variants: ["razz", "stud", "stud8"] },
	],
	"8game": [
		{ name: "Limit", variants: ["27td", "lhe", "o8"] },
		{ name: "Stud", variants: ["razz", "stud", "stud8"] },
		{ name: "Big Bet", variants: ["nlh", "plo"] },
	],
	"10game": [
		{ name: "Limit", variants: ["27td", "lhe", "o8", "badugi"] },
		{ name: "Stud", variants: ["razz", "stud", "stud8"] },
		{ name: "Big Bet", variants: ["nlh", "plo", "27sd"] },
	],
};

export function mixTemplate(kind: MixTemplateKind): MixGameGroupRow[] {
	return TEMPLATE_GROUPS[kind].map((g) => ({
		...emptyMixGroupRow(),
		name: g.name,
		variants: [...g.variants],
	}));
}
