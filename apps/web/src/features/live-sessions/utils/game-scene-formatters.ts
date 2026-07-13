import { createGroupFormatter } from "@/utils/format-number";

export { variantDisplayLabel as variantLabel } from "@sapphire2/db/constants/game-variants";

interface BlindFields {
	ante: number | null;
	anteType?: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
}

export function formatBlindParts(game: BlindFields): string {
	const fmt = createGroupFormatter([
		game.blind1,
		game.blind2,
		game.blind3,
		game.ante,
	]);
	const parts: string[] = [];
	if (game.blind1 != null) {
		parts.push(fmt(game.blind1));
	}
	if (game.blind2 != null) {
		parts.push(fmt(game.blind2));
	} else if (parts.length > 0) {
		parts.push("—");
	}
	if (game.blind3 != null) {
		parts.push(fmt(game.blind3));
	}
	return parts.join("/");
}

export function formatAnteSuffix(game: BlindFields): string {
	if (game.ante == null || game.anteType == null || game.anteType === "none") {
		return "";
	}
	const fmt = createGroupFormatter([game.ante]);
	if (game.anteType === "bb") {
		return `(BBA:${fmt(game.ante)})`;
	}
	if (game.anteType === "all") {
		return `(Ante:${fmt(game.ante)})`;
	}
	return "";
}

// Structural type for a mixed-game "group" (a rotation entry). Defined
// locally rather than imported from a zod schema because the schema for game
// groups lands in a later phase — this structural shape is designed to match
// it once it exists.
export interface GameGroupLike {
	ante?: number | null;
	anteType?: string | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	name?: string | null;
	variants: string[];
}

/**
 * Display label for a group: its own name when set, otherwise its variants'
 * (already display-label-shaped) strings joined with "+" (e.g.
 * "NL Hold'em+Pot Limit Omaha"), or "—" when there is neither a name nor any
 * variants.
 */
export function groupDisplayLabel(group: GameGroupLike): string {
	const trimmedName = group.name?.trim();
	if (trimmedName) {
		return trimmedName;
	}
	if (group.variants.length === 0) {
		return "—";
	}
	return group.variants.join("+");
}

/**
 * Compact stakes string for a group, e.g. "1/2", "1/2/5", or
 * "400/800/100 (Ante:75)". Composes formatBlindParts + formatAnteSuffix so
 * the mix-group rendering can never drift from the flat blinds rendering
 * (c15): same slot handling (no leading slash for a blind3-only group) and
 * the same anteType rules (anteType "none" shows no suffix even when a
 * stale ante amount is stored — c57).
 */
export function formatGroupStakes(group: GameGroupLike): string {
	const fields: BlindFields = {
		blind1: group.blind1 ?? null,
		blind2: group.blind2 ?? null,
		blind3: group.blind3 ?? null,
		ante: group.ante ?? null,
		// Level game groups carry no anteType at all (levelGameGroupSchema
		// omits it) — their stored ante always displays. Mix game groups
		// carry an explicit anteType which formatAnteSuffix respects.
		anteType: group.anteType === undefined ? "all" : group.anteType,
	};
	const parts = [formatBlindParts(fields), formatAnteSuffix(fields)].filter(
		(part) => part !== ""
	);
	return parts.length === 0 ? "—" : parts.join(" ");
}

/**
 * One-line summary for a mixed-game rotation, e.g.
 * "Mix · NLH 1/2 · PLO 2/4 (+1)". Renders at most `maxGroups` groups and
 * appends a "(+k)" suffix for the remainder.
 */
export function formatMixSummary(
	groups: GameGroupLike[],
	maxGroups = 2
): string {
	if (groups.length === 0) {
		return "Mix";
	}

	const shown = groups.slice(0, maxGroups);
	const rendered = shown.map((group) => {
		const label = groupDisplayLabel(group);
		const stakes = formatGroupStakes(group);
		return stakes === "—" ? label : `${label} ${stakes}`;
	});

	const truncatedCount = groups.length - shown.length;
	const suffix = truncatedCount > 0 ? ` (+${truncatedCount})` : "";

	return `Mix · ${rendered.join(" · ")}${suffix}`;
}
