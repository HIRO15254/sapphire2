import {
	resolveBlindLabels,
	variantShortLabel,
} from "@sapphire2/db/constants/game-variants";
import { createGroupFormatter } from "@/utils/format-number";

export { variantShortLabel as variantLabel } from "@sapphire2/db/constants/game-variants";

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
 * short labels joined with "+" (e.g. "NLH+PLO"), or "—" when there is
 * neither a name nor any variants.
 */
export function groupDisplayLabel(group: GameGroupLike): string {
	const trimmedName = group.name?.trim();
	if (trimmedName) {
		return trimmedName;
	}
	if (group.variants.length === 0) {
		return "—";
	}
	return group.variants.map((variant) => variantShortLabel(variant)).join("+");
}

/**
 * Compact stakes string for a group, e.g. "1/2", "1/2/5", or
 * "400/800 BI 100 (Ante:75)". Blind labels are resolved from the group's
 * first variant so a stud-family group gets a "Bring-in" style blind3
 * (" BI <n>") instead of a straddle-style slash.
 */
export function formatGroupStakes(group: GameGroupLike): string {
	const labels = resolveBlindLabels(group.variants[0] ?? "nlh");
	const fmt = createGroupFormatter([
		group.blind1,
		group.blind2,
		group.blind3,
		group.ante,
	]);

	const parts: string[] = [];
	if (group.blind1 != null) {
		parts.push(fmt(group.blind1));
	}
	if (group.blind2 != null) {
		parts.push(fmt(group.blind2));
	} else if (parts.length > 0) {
		parts.push("—");
	}

	let result = parts.join("/");

	if (group.blind3 != null) {
		result +=
			labels.blind3 === "Bring-in"
				? ` BI ${fmt(group.blind3)}`
				: `/${fmt(group.blind3)}`;
	}

	if (group.ante != null) {
		result +=
			group.anteType === "bb"
				? ` (BBA:${fmt(group.ante)})`
				: ` (Ante:${fmt(group.ante)})`;
	}

	return result === "" ? "—" : result;
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
